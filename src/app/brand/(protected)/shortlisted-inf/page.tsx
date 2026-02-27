"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { get, post } from "@/lib/api";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { FloatingLabelInput } from "@/components/common/FloatingLabelInput";
import MilestoneHistoryCard from "@/components/common/milestoneCard";
import {
  HiChevronLeft,
  HiChevronRight,
  HiSearch,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
} from "react-icons/hi";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TABLE_GRADIENT_FROM = "#FFA135";
const TABLE_GRADIENT_TO = "#FF7236";
const PAGE_SIZE = 10;

// Payment gateway fee settings (2%)
const GATEWAY_FEE_PERCENT = 0.02;

// localStorage key to complete milestone after Stripe redirect
const PENDING_MILESTONE_KEY = "pendingMilestoneStripe";

// sessionStorage guard key (prevents success effect running twice)
const STRIPE_MILESTONE_HANDLED_KEY = "stripe_milestone_handled_session";

const toast = (opts: { icon: "success" | "error"; title: string; text?: string }) =>
  Swal.fire({
    showConfirmButton: false,
    timer: 1200,
    timerProgressBar: true,
    background: "white",
    ...opts,
  });

type AnyObj = Record<string, any>;

interface ShortlistedRow {
  rowId: string;
  deliverableId?: string;
  influencerId: string;
  name: string;
  country: string;
  platform: string;
  status: string;
  createdAt?: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const getStoredBrandId = () => {
  try {
    return typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
  } catch {
    return null;
  }
};

const safeJsonParse = <T,>(s: string | null): T | null => {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};

const safeRowId = () => {
  const c: any = globalThis.crypto;
  return c?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : "—";

const normalizeDeliverablesToUniqueInfluencers = (res: any): ShortlistedRow[] => {
  const body = res?.data && typeof res.data === "object" ? res.data : res;

  const platformToString = (obj: any) => {
    // NEW API: platforms: string[]
    if (Array.isArray(obj?.platforms) && obj.platforms.length) {
      return obj.platforms.join(", "); // "youtube" or "youtube, instagram"
    }
    // fallback: platform: string
    if (typeof obj?.platform === "string" && obj.platform.trim()) {
      return obj.platform.trim();
    }
    // sometimes backend might return platforms as string
    if (typeof obj?.platforms === "string" && obj.platforms.trim()) {
      return obj.platforms.trim();
    }
    return "—";
  };

  // ✅ NEW API SHAPE: { success, total, influencers: [...] }
  if (Array.isArray(body?.influencers)) {
    return body.influencers
      .map((inf: any) => {
        const influencerId = String(inf?.influencerId || inf?._id || "");
        if (!influencerId) return null;

        return {
          rowId: safeRowId(),
          influencerId,
          name: String(inf?.name || inf?.fullName || inf?.username || "—"),
          country: String(inf?.country || "—"),
          platform: platformToString(inf), // ✅ FIXED HERE
          status: "—",
          createdAt: inf?.createdAt || null,
        } as ShortlistedRow;
      })
      .filter(Boolean) as ShortlistedRow[];
  }

  // ✅ OLD API SHAPE (invites list)
  const list =
    body?.data ||
    body?.result ||
    body?.deliverables ||
    body?.items ||
    body;

  const arr = Array.isArray(list) ? list : [];

  const map = new Map<string, ShortlistedRow>();

  for (const x of arr) {
    const inf = x?.influencer || {};
    const influencerId = x?.influencerId || inf?.influencerId || inf?._id || "";
    if (!influencerId) continue;
    if (map.has(String(influencerId))) continue;

    map.set(String(influencerId), {
      rowId: safeRowId(),
      deliverableId: x?._id || x?.id,
      influencerId: String(influencerId),
      name: String(inf?.name || "—"),
      country: String(inf?.country || "—"),
      platform: platformToString(x) !== "—" ? platformToString(x) : platformToString(inf), // ✅ more robust
      status: String(x?.status || "—"),
      createdAt: x?.createdAt || null,
    });
  }

  return Array.from(map.values());
};

const LoadingSkeleton = ({ rows }: { rows: number }) => (
  <div className="p-6 space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className="h-12 w-full rounded-md" />
    ))}
  </div>
);

const ErrorMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="p-6 text-center text-destructive">{children}</p>
);

export default function ShortlistedInfluencersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const campaignId = searchParams.get("id") || searchParams.get("campaignId");
  const stripeSuccess = searchParams.get("stripe_success");
  const stripeCancel = searchParams.get("stripe_cancel");
  const sessionId = searchParams.get("session_id");

  const [rowsData, setRowsData] = useState<ShortlistedRow[]>([]);
  const [meta, setMeta] = useState<Meta>({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [milestoneCountByInfluencer, setMilestoneCountByInfluencer] = useState<Record<string, number>>(
    {}
  );

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [selectedInf, setSelectedInf] = useState<ShortlistedRow | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    amount: "",
    description: "",
  });
  const [isSavingMilestone, setIsSavingMilestone] = useState(false);

  // campaign budget + allocated milestones (for this brand)
  const [campaignBudget, setCampaignBudget] = useState<number | null>(null);
  const [campaignMilestoneTotal, setCampaignMilestoneTotal] = useState<number>(0);
  const [isBudgetLocked, setIsBudgetLocked] = useState<boolean>(false);

  const amountNum = useMemo(() => Number(milestoneForm.amount) || 0, [milestoneForm.amount]);

  const gatewayFee = useMemo(
    () => Math.round(amountNum * GATEWAY_FEE_PERCENT * 100) / 100,
    [amountNum]
  );

  const totalWithFee = useMemo(() => amountNum + gatewayFee, [amountNum, gatewayFee]);

  const remainingBudget = useMemo(() => {
    if (campaignBudget == null) return null;
    return Math.max(0, campaignBudget - campaignMilestoneTotal);
  }, [campaignBudget, campaignMilestoneTotal]);

  const toggleExpand = (id: string) => setExpandedRow((cur) => (cur === id ? null : id));

  /** Clean Stripe params from CURRENT URL */
  const getCleanUrl = useCallback(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.delete("stripe_success");
    url.searchParams.delete("stripe_cancel");
    url.searchParams.delete("session_id");
    return url.pathname + (url.search ? url.search : "");
  }, []);

  /** Budget + milestone totals */
  const refreshBudgetAndTotals = useCallback(async () => {
    if (!campaignId) return;

    try {
      const brandId = getStoredBrandId();

      const [campaignResp, milestoneResp] = await Promise.all([
        get<any>(`/campaign/id?id=${campaignId}`),
        post<any>("milestone/byCampaign", { campaignId }),
      ]);

      const rawBudget = Number(campaignResp?.budget);
      const budget = !Number.isNaN(rawBudget) ? rawBudget : null;
      setCampaignBudget(budget);

      const list = Array.isArray(milestoneResp?.milestones) ? milestoneResp.milestones : [];

      let sum = 0;
      const counts: Record<string, number> = {};

      list.forEach((m: any) => {
        if (brandId && m.brandId !== brandId) return;

        sum += Number(m.amount) || 0;

        const infId =
          m.influencerId ||
          m.influencerID ||
          m.influencer_id ||
          m.influencer?.influencerId ||
          m.influencer?._id;

        if (infId) {
          const key = String(infId);
          counts[key] = (counts[key] || 0) + 1;
        }
      });

      setCampaignMilestoneTotal(sum);
      setMilestoneCountByInfluencer(counts);
      setIsBudgetLocked(budget != null && sum >= budget);
    } catch (e) {
      console.error("Failed to refresh campaign budget / milestones", e);
    }
  }, [campaignId]);

  /** Stripe redirect handler (milestones) */
  useEffect(() => {
    if (!stripeSuccess && !stripeCancel) return;

    const cleanUrl = getCleanUrl();

    // Cancel flow
    if (stripeCancel) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(STRIPE_MILESTONE_HANDLED_KEY);
        localStorage.removeItem(PENDING_MILESTONE_KEY);
      }
      router.replace(cleanUrl);
      toast({ icon: "error", title: "Payment cancelled" });
      return;
    }

    // Success flow
    if (stripeSuccess && sessionId) {
      // Guard (StrictMode / rerender / back-forward cache)
      if (typeof window !== "undefined") {
        const handled = sessionStorage.getItem(STRIPE_MILESTONE_HANDLED_KEY);
        if (handled === sessionId) {
          router.replace(cleanUrl);
          return;
        }
        sessionStorage.setItem(STRIPE_MILESTONE_HANDLED_KEY, sessionId);
      }

      // Strip params ASAP (prevents loops)
      router.replace(cleanUrl);

      (async () => {
        try {
          setIsSavingMilestone(true);

          const pending = safeJsonParse<{
            brandId: string;
            influencerId: string;
            campaignId: string;
            title: string;
            description: string;
            amountBase: number;
            gatewayFee: number;
            totalPaid: number;
            currency: string;
          }>(typeof window !== "undefined" ? localStorage.getItem(PENDING_MILESTONE_KEY) : null);

          if (!pending) throw new Error("Missing milestone data. Please try again.");

          // 1) Verify Stripe session
          const verifyResp = await post<any>("/payment/milestone-verify", { sessionId });
          if (!verifyResp?.success) {
            throw new Error(verifyResp?.message || "Payment verification failed.");
          }

          // 2) Create milestone after payment success
          await post("milestone/create", {
            influencerId: pending.influencerId,
            campaignId: pending.campaignId,
            milestoneTitle: pending.title,
            amount: pending.amountBase, // base amount only
            milestoneDescription: pending.description,
            brandId: pending.brandId,

            paymentProvider: "stripe",
            stripeSessionId: sessionId,
            stripePaymentIntentId: verifyResp?.paymentIntentId || null,
            totalPaid: pending.totalPaid,
            gatewayFee: pending.gatewayFee,
          });

          Swal.fire({
            icon: "success",
            title: "Milestone added",
            text:
              "Milestone has been created successfully.\n" +
              `Base: ${Number(pending.amountBase).toFixed(2)}, Fee: ${Number(pending.gatewayFee).toFixed(2)}, Total: ${Number(
                pending.totalPaid
              ).toFixed(2)}`,
            showConfirmButton: false,
            timer: 1500,
            timerProgressBar: true,
          });

          if (typeof window !== "undefined") localStorage.removeItem(PENDING_MILESTONE_KEY);

          setShowMilestoneModal(false);
          setMilestoneForm({ title: "", amount: "", description: "" });
          setPage(1);

          await refreshBudgetAndTotals();
        } catch (e: any) {
          console.error(e);
          toast({
            icon: "error",
            title: "Could not finish milestone",
            text: e?.message || "Something went wrong.",
          });
          if (typeof window !== "undefined") localStorage.removeItem(PENDING_MILESTONE_KEY);
        } finally {
          setIsSavingMilestone(false);
        }
      })();
    }
  }, [stripeSuccess, stripeCancel, sessionId, router, getCleanUrl, refreshBudgetAndTotals]);

  /** Fetch shortlisted influencers for this campaign */
  useEffect(() => {
    if (!campaignId) {
      setError("Campaign id missing.");
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = `/deliverable/influencer/campaign/${encodeURIComponent(campaignId)}`;
        const resp = await get<any>(endpoint);

        const normalized = normalizeDeliverablesToUniqueInfluencers(resp);

        // client search filter
        const term = searchTerm.trim().toLowerCase();
        const filtered = !term
          ? normalized
          : normalized.filter((r) =>
            [
              r.name,
              r.influencerId,
              r.country,
              r.platform,
              r.status,
              r.createdAt || "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(term)
          );

        setRowsData(filtered);

        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
        setMeta({ total, page: 1, limit: PAGE_SIZE, totalPages });
        setPage(1);
      } catch (e: any) {
        console.error(e);
        setError(
          e?.response?.data?.message ||
          e?.message ||
          "Failed to load shortlisted influencers."
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId, searchTerm]);

  /** Fetch budget + milestone totals */
  useEffect(() => {
    refreshBudgetAndTotals();
  }, [refreshBudgetAndTotals]);

  const handleAddMilestone = (inf: ShortlistedRow) => {
    setSelectedInf(inf);
    setMilestoneForm({ title: "", amount: "", description: "" });
    setShowMilestoneModal(true);
  };

  const handleSaveMilestone = async () => {
    if (!selectedInf?.influencerId || !campaignId) return;

    if (!milestoneForm.title.trim()) {
      toast({ icon: "error", title: "Enter a milestone title" });
      return;
    }

    if (Number.isNaN(amountNum) || amountNum <= 0) {
      toast({
        icon: "error",
        title: "Invalid amount",
        text: "Please enter a valid positive amount.",
      });
      return;
    }

    // client-side budget check
    if (campaignBudget != null) {
      if (remainingBudget !== null && remainingBudget <= 0) {
        setIsBudgetLocked(true);
        toast({
          icon: "error",
          title: "Campaign budget fully allocated",
          text:
            "You have already added milestones equal to the campaign budget. You cannot create new milestones.",
        });
        return;
      }

      if (remainingBudget !== null && amountNum > remainingBudget) {
        toast({
          icon: "error",
          title: "Amount exceeds remaining budget",
          text: `Remaining campaign budget for milestones is ${remainingBudget.toLocaleString()}. Please enter a smaller amount.`,
        });
        return;
      }
    }

    try {
      setIsSavingMilestone(true);

      const brandId = getStoredBrandId();
      if (!brandId) {
        toast({
          icon: "error",
          title: "Missing brand",
          text: "Please log in again as a brand.",
        });
        return;
      }

      // ✅ ALWAYS return to the same current route
      const origin = window.location.origin;
      const pathname = window.location.pathname;

      const basePath = `${pathname}?id=${encodeURIComponent(campaignId)}`;
      const successUrl = `${origin}${basePath}&stripe_success=1&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}${basePath}&stripe_cancel=1`;

      // store pending milestone data for after redirect
      localStorage.setItem(
        PENDING_MILESTONE_KEY,
        JSON.stringify({
          brandId,
          influencerId: selectedInf.influencerId,
          campaignId,
          title: milestoneForm.title,
          description: milestoneForm.description,
          amountBase: amountNum,
          gatewayFee,
          totalPaid: totalWithFee,
          currency: "USD",
        })
      );

      // Create Stripe checkout session for milestone
      const sessionResp = await post<any>("/payment/milestone-order", {
        amount: totalWithFee,
        currency: "USD",
        brandId,
        influencerId: selectedInf.influencerId,
        campaignId,
        milestoneTitle: milestoneForm.title,
        successUrl,
        cancelUrl,
      });

      if (!sessionResp?.success || !sessionResp?.url) {
        throw new Error(sessionResp?.message || "Failed to start checkout.");
      }

      window.location.href = sessionResp.url;
    } catch (err: any) {
      console.error(err);

      const apiMessage =
        err?.response?.data?.message || err.message || "Something went wrong";

      if (
        apiMessage.includes(
          "You have added milestone equal to campaign now not able to add now milestone"
        )
      ) {
        setIsBudgetLocked(true);
        toast({
          icon: "error",
          title: "Campaign budget fully allocated",
          text: apiMessage,
        });
        await refreshBudgetAndTotals();
      } else if (
        apiMessage.includes("Total milestone amount cannot exceed campaign budget")
      ) {
        toast({
          icon: "error",
          title: "Milestone exceeds campaign budget",
          text: apiMessage,
        });
        await refreshBudgetAndTotals();
      } else {
        toast({ icon: "error", title: "Error", text: apiMessage });
      }

      localStorage.removeItem(PENDING_MILESTONE_KEY);
    } finally {
      setIsSavingMilestone(false);
    }
  };

  /** Pagination */
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return rowsData.slice(start, end);
  }, [rowsData, page]);

  const tableRows = useMemo(() => {
    return paginatedRows.flatMap((inf, idx) => {
      const hoverGradient = `linear-gradient(to right, ${TABLE_GRADIENT_FROM}11, ${TABLE_GRADIENT_TO}11)`;
      const rowKey = inf.rowId;

      const milestoneCount = milestoneCountByInfluencer[String(inf.influencerId)] || 0;
      const hasMilestones = milestoneCount > 0;

      const baseRow = (
        <TableRow
          key={rowKey}
          className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} transition-colors`}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundImage = hoverGradient)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundImage = "")}
        >
          <TableCell className="font-medium">{inf.name}</TableCell>

          <TableCell className="text-center">{inf.country}</TableCell>

          <TableCell className="text-center">{inf.platform}</TableCell>

          <TableCell className="text-center">{inf.status}</TableCell>

          <TableCell className="text-center">{formatDate(inf.createdAt || null)}</TableCell>

          <TableCell className="text-center">
            {hasMilestones ? <p>Working</p> : <p>Awaiting Milestone</p>}
          </TableCell>

          <TableCell className="text-center">
            <div className="flex flex-col items-center gap-2">
              {/* Row 1: existing action buttons */}
              <div className="flex items-center gap-2 justify-center">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-green-500 text-white hover:bg-green-600 cursor-pointer disabled:opacity-50"
                  onClick={() => handleAddMilestone(inf)}
                  disabled={!inf.influencerId || isBudgetLocked}
                  title={
                    !inf.influencerId
                      ? "Missing influencerId"
                      : isBudgetLocked
                        ? "Campaign budget already fully allocated in milestones"
                        : "Add milestone"
                  }
                >
                  Add Milestone
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:bg-gradient-to-r hover:from-[#FF7236] hover:to-[#FFA135] cursor-pointer disabled:opacity-50"
                  onClick={() => toggleExpand(rowKey)}
                  disabled={!hasMilestones}
                  title={hasMilestones ? "View milestone history" : "No milestones yet"}
                >
                  View Milestone
                </Button>

                {/* <Button
                  size="icon"
                  variant="ghost"
                  className="ml-1 cursor-pointer"
                  onClick={() => toggleExpand(rowKey)}
                  disabled={!inf.influencerId}
                  title="Toggle history"
                >
                  {expandedRow === rowKey ? (
                    <HiOutlineChevronUp className="w-4 h-4" />
                  ) : (
                    <HiOutlineChevronDown className="w-4 h-4" />
                  )}
                </Button> */}
              </div>

              {/* Row 2: NEW button under Actions */}
              <Button
                variant="outline"
                className="border-gray-300 text-gray-800 hover:bg-gray-50"
                onClick={() =>
                  router.push(
                    `/brand/deleverables?campaignId=${encodeURIComponent(campaignId as string)}`
                  )
                }
                disabled={!campaignId}
                title={!campaignId ? "Campaign id missing" : "View deliverables"}
              >
                View Deliverables
              </Button>
            </div>
          </TableCell>
        </TableRow>
      );

      const detailsRow =
        expandedRow === rowKey && inf.influencerId ? (
          <TableRow key={`${rowKey}-details`}>
            <TableCell colSpan={7} className="p-0">
              <MilestoneHistoryCard
                role="brand"
                brandId={getStoredBrandId() || undefined}
                influencerId={inf.influencerId}
                campaignId={campaignId as string}
              />
            </TableCell>
          </TableRow>
        ) : null;

      return [baseRow, detailsRow].filter(Boolean) as any[];
    });
  }, [paginatedRows, expandedRow, campaignId, isBudgetLocked, milestoneCountByInfluencer]);

  const totalPages = meta.totalPages;

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-4 rounded-md">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gray-800">
            Shortlisted Influencers
          </h1>

          {campaignBudget != null && (
            <p className="text-xs text-gray-600">
              Budget:{" "}
              <strong>
                {campaignBudget.toLocaleString(undefined, { style: "currency", currency: "USD" })}
              </strong>{" "}
              · Allocated in milestones:{" "}
              <strong>
                {campaignMilestoneTotal.toLocaleString(undefined, { style: "currency", currency: "USD" })}
              </strong>{" "}
              · Remaining:{" "}
              <strong>
                {remainingBudget != null
                  ? remainingBudget.toLocaleString(undefined, { style: "currency", currency: "USD" })
                  : "—"}
              </strong>
            </p>
          )}

          {isBudgetLocked && (
            <p className="text-xs font-semibold text-red-600">
              Milestone total has reached the campaign budget. You cannot create more milestones.
            </p>
          )}
        </div>
      </header>

      {/* Search */}
      <div className="mb-6 w-full">
        <div className="relative w-full sm:max-w-md">
          <HiSearch className="absolute inset-y-0 left-3 my-auto text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search influencers..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSkeleton rows={PAGE_SIZE} />
      ) : error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : (
        <div className="bg-white rounded-md shadow-sm overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader
              className="text-white"
              style={{
                backgroundImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO})`,
              }}
            >
              <TableRow>
                <TableHead className="font-semibold">Influencer</TableHead>
                <TableHead className="font-semibold text-center">Country</TableHead>
                <TableHead className="font-semibold text-center">Platform</TableHead>
                <TableHead className="font-semibold text-center">Deliverable Status</TableHead>
                <TableHead className="font-semibold text-center">Created</TableHead>
                <TableHead className="font-semibold text-center">Milestones</TableHead>
                <TableHead className="font-semibold text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {tableRows.length > 0 ? (
                tableRows
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    No influencers match criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center md:justify-end items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
          >
            <HiChevronLeft />
          </Button>
          <span className="text-sm">
            Page <strong>{page}</strong> of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
          >
            <HiChevronRight />
          </Button>
        </div>
      )}

      {/* Milestone Modal */}
      {showMilestoneModal && selectedInf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div
              className="px-6 py-4 flex items-start justify-between"
              style={{
                backgroundImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO})`,
              }}
            >
              <div className="text-white">
                <p className="text-xs uppercase tracking-wide">Create milestone</p>
                <h2 className="text-lg font-semibold mt-1">{selectedInf.name}</h2>
                <div className="mt-1 text-xs text-white flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                    {selectedInf.platform}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowMilestoneModal(false)}
                className="ml-3 text-white/90 hover:text-white text-lg leading-none"
                aria-label="Close"
                disabled={isSavingMilestone}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {campaignBudget != null && (
                <p className="text-xs text-gray-600">
                  Budget:{" "}
                  <strong>
                    {campaignBudget.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                  </strong>{" "}
                  · Allocated:{" "}
                  <strong>
                    {campaignMilestoneTotal.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                  </strong>{" "}
                  · Remaining:{" "}
                  <strong>
                    {remainingBudget != null
                      ? remainingBudget.toLocaleString(undefined, { style: "currency", currency: "USD" })
                      : "—"}
                  </strong>
                </p>
              )}

              {isBudgetLocked && (
                <p className="text-xs font-semibold text-red-600">
                  Milestone total has reached the campaign budget. You cannot create more milestones.
                </p>
              )}

              {/* Gateway fee breakdown */}
              {amountNum > 0 && (
                <div className="mt-2 text-xs text-gray-700 space-y-1 border border-gray-200 rounded-md p-3 bg-gray-50">
                  <p>
                    Milestone amount:{" "}
                    <strong>{amountNum.toLocaleString(undefined, { style: "currency", currency: "USD" })}</strong>
                  </p>
                  <p>
                    Payment gateway fee (2%):{" "}
                    <strong className="text-orange-600">
                      {gatewayFee.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                    </strong>
                  </p>
                  <p>
                    Total payable:{" "}
                    <strong>{totalWithFee.toLocaleString(undefined, { style: "currency", currency: "USD" })}</strong>
                  </p>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <FloatingLabelInput
                  id="milestoneTitle"
                  label="Milestone Title"
                  value={milestoneForm.title}
                  onChange={(e: any) => setMilestoneForm((f) => ({ ...f, title: e.target.value }))}
                />

                {/* Amount + fee tooltip */}
                <div className="relative">
                  <FloatingLabelInput
                    id="milestoneAmount"
                    label="Amount"
                    value={milestoneForm.amount}
                    onChange={(e: any) => setMilestoneForm((f) => ({ ...f, amount: e.target.value }))}
                    type="number"
                  />

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="absolute right-3 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-700 cursor-help"
                          aria-label="Payment Gateway Fee Info"
                        >
                          ?
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs bg-gray-800 text-white">
                        Payment gateway applies a 2% processing fee when you add milestone funds.
                        This fee is added on top of the milestone amount you enter.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <FloatingLabelInput
                id="milestoneDesc"
                label="Milestone Description"
                value={milestoneForm.description}
                onChange={(e: any) =>
                  setMilestoneForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-3 border-t bg-gray-50 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowMilestoneModal(false)}
                  className="cursor-pointer"
                  disabled={isSavingMilestone}
                >
                  Cancel
                </Button>

                <Button
                  onClick={handleSaveMilestone}
                  disabled={!selectedInf?.influencerId || isSavingMilestone || isBudgetLocked}
                  className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF8A1F] hover:to-[#FF5A2E] focus:outline-none focus:ring-2 focus:ring-[#FFA135]/40 cursor-pointer disabled:opacity-60"
                >
                  {isBudgetLocked
                    ? "Budget Reached"
                    : isSavingMilestone
                      ? "Redirecting..."
                      : amountNum > 0
                        ? `Pay ${totalWithFee.toFixed(2)} (incl. fee)`
                        : "Add Milestone"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}