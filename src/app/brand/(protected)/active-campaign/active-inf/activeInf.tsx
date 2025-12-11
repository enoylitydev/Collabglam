/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { get, post } from "@/lib/api";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FloatingLabelInput } from "@/components/common/FloatingLabelInput";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  HiOutlineCalendar,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiSearch,
} from "react-icons/hi";
import MilestoneHistoryCard from "@/components/common/milestoneCard";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const TABLE_GRADIENT_FROM = "#FFA135";
const TABLE_GRADIENT_TO = "#FF7236";

const toast = (opts: {
  icon: "success" | "error";
  title: string;
  text?: string;
}) =>
  Swal.fire({
    showConfirmButton: false,
    timer: 1200,
    timerProgressBar: true,
    background: "white",
    ...opts,
  });

/* ------------------------ Raw API types (minimal) ------------------------ */
type Provider = "instagram" | "youtube" | "tiktok" | string;

interface RawOnboarding {
  categoryName?: string;
  subcategories?: { subcategoryName?: string }[];
}

interface RawInfluencer {
  _id?: string;
  influencerId?: string;
  name?: string;
  email?: string;
  primaryPlatform?: Provider;
  onboarding?: RawOnboarding;
  updatedAt?: string;
  isAccepted?: number;
  isAssigned?: number;

  // New fields from backend
  socialHandle?: string | null;
  audienceSize?: number | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* -------------------- Row model used by this table ---------------------- */
interface InfluencerRow {
  _id: string;
  influencerId?: string;
  name: string;
  username: string | null;
  socialUrl: string | null;
  platformName?: string;
  categoryNames: string[];
  followers: number | null;
  updatedAt: string | null;
  isAccepted?: number;
  isAssigned?: number;
}

type SortKey = "name" | "username" | "followers" | "updatedAt";
const PAGE_SIZE = 10;

/* Razorpay global type */
declare global {
  interface Window {
    Razorpay: any;
  }
}

/* --------------------------- Helper functions --------------------------- */
const formatNumber = (n?: number | null) =>
  typeof n === "number" ? n.toLocaleString() : "—";

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : "—";

const buildSocialUrl = (provider: Provider | undefined, username: string): string => {
  const u = username.replace(/^@/, "");
  if (provider === "youtube") return `https://www.youtube.com/@${u}`;
  if (provider === "tiktok") return `https://www.tiktok.com/@${u}`;
  // default instagram
  return `https://www.instagram.com/${u}`;
};

const dedupe = <T,>(arr: T[]) => Array.from(new Set(arr));

const toRow = (doc: RawInfluencer): InfluencerRow => {
  const username = (doc.socialHandle && doc.socialHandle.trim()) || null;

  const socialUrl =
    username && doc.primaryPlatform
      ? buildSocialUrl(doc.primaryPlatform, username)
      : null;

  const categoryNames = dedupe<string>(
    [doc.onboarding?.categoryName].filter(
      (x): x is string => typeof x === "string" && !!x.trim()
    )
  );

  const followers =
    typeof doc.audienceSize === "number" ? doc.audienceSize : null;

  return {
    _id: (doc._id as string) || doc.influencerId || crypto.randomUUID(),
    influencerId: doc.influencerId,
    name: doc.name || "—",
    username,
    socialUrl,
    platformName:
      doc.primaryPlatform === "instagram"
        ? "Instagram"
        : doc.primaryPlatform === "youtube"
          ? "YouTube"
          : doc.primaryPlatform === "tiktok"
            ? "TikTok"
            : doc.primaryPlatform || undefined,
    categoryNames,
    followers,
    updatedAt: doc.updatedAt ?? null,
    isAccepted: doc.isAccepted,
    isAssigned: doc.isAssigned,
  };
};

const loadScript = (src: string) =>
  new Promise<boolean>((res) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => res(true);
    s.onerror = () => res(false);
    document.body.appendChild(s);
  });

/* ============================== Component =============================== */
export default function ActiveInfluencersPage() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id");
  const campaignName = searchParams.get("name");
  const router = useRouter();

  const [rowsData, setRowsData] = useState<InfluencerRow[]>([]);
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
  const [sortField, setSortField] = useState<SortKey>("updatedAt");
  const [sortOrder, setSortOrder] = useState<1 | 0>(1); // 1=desc, 0=asc
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [selectedInf, setSelectedInf] = useState<InfluencerRow | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    amount: "",
    description: "",
  });
  const [isSavingMilestone, setIsSavingMilestone] = useState(false);

  // Razorpay fee settings
  const FEE_PERCENT = 0.02; // 2%

  const amountNum = useMemo(
    () => Number(milestoneForm.amount) || 0,
    [milestoneForm.amount]
  );

  const razorpayFee = useMemo(
    () => Math.round(amountNum * FEE_PERCENT * 100) / 100,
    [amountNum]
  );

  const totalWithFee = useMemo(
    () => amountNum + razorpayFee,
    [amountNum, razorpayFee]
  );

  // campaign budget + allocated milestones (for this brand)
  const [campaignBudget, setCampaignBudget] = useState<number | null>(null);
  const [campaignMilestoneTotal, setCampaignMilestoneTotal] =
    useState<number>(0);
  const [isBudgetLocked, setIsBudgetLocked] = useState<boolean>(false);

  const remainingBudget = useMemo(() => {
    if (campaignBudget == null) return null;
    return Math.max(0, campaignBudget - campaignMilestoneTotal);
  }, [campaignBudget, campaignMilestoneTotal]);

  const toggleExpand = (id: string) =>
    setExpandedRow((cur) => (cur === id ? null : id));

  const toggleSort = (field: SortKey) => {
    setPage(1);
    if (sortField === field) setSortOrder((o) => (o === 1 ? 0 : 1));
    else {
      setSortField(field);
      setSortOrder(1);
    }
  };

  const SortIndicator = ({ field }: { field: SortKey }) =>
    sortField === field ? (
      sortOrder === 1 ? (
        <HiOutlineChevronDown className="inline ml-1 w-4 h-4" />
      ) : (
        <HiOutlineChevronUp className="inline ml-1 w-4 h-4" />
      )
    ) : null;

  // fetch budget + milestone total for this campaign/brand
  const refreshBudgetAndTotals = useCallback(async () => {
    if (!campaignId) return;

    try {
      const brandId =
        typeof window !== "undefined" ? localStorage.getItem("brandId") : null;

      const [campaignResp, milestoneResp] = await Promise.all([
        get<any>(`/campaign/id?id=${campaignId}`),
        post<{ milestones: { amount: number; brandId: string }[] }>(
          "milestone/byCampaign",
          { campaignId }
        ),
      ]);

      const rawBudget = Number(campaignResp?.budget);
      const budget = !Number.isNaN(rawBudget) ? rawBudget : null;
      setCampaignBudget(budget);

      const list = Array.isArray(milestoneResp.milestones)
        ? milestoneResp.milestones
        : [];

      let sum = 0;
      list.forEach((m) => {
        if (!brandId || m.brandId === brandId) {
          sum += Number(m.amount) || 0;
        }
      });

      setCampaignMilestoneTotal(sum);

      if (budget != null && sum >= budget) {
        setIsBudgetLocked(true);
      } else {
        setIsBudgetLocked(false);
      }
    } catch (e) {
      console.error("Failed to refresh campaign budget / milestones", e);
    }
  }, [campaignId]);

  // Fetch influencers accepted for this campaign
  useEffect(() => {
    if (!campaignId) {
      setError("No campaign selected.");
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await post<{ influencers: RawInfluencer[] }>(
          "campaign/accepted-inf",
          {
            campaignId,
            search: searchTerm.trim(),
            sortBy: sortField,
            order: sortOrder === 1 ? "desc" : "asc",
          }
        );

        const list = Array.isArray(resp.influencers) ? resp.influencers : [];
        const normalized = list.map(toRow);

        setRowsData(normalized);

        const total = normalized.length;
        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

        setMeta({
          total,
          page: 1,
          limit: PAGE_SIZE,
          totalPages,
        });
        setPage(1);
      } catch (e) {
        console.error(e);
        setError("Failed to load applicants.");
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId, searchTerm, sortField, sortOrder]);

  // Fetch budget + milestone totals on mount / campaign change
  useEffect(() => {
    refreshBudgetAndTotals();
  }, [refreshBudgetAndTotals]);

  const handleAddMilestone = (inf: InfluencerRow) => {
    setSelectedInf(inf);
    setMilestoneForm({ title: "", amount: "", description: "" });
    setShowMilestoneModal(true);
  };

  const handleSaveMilestone = async () => {
    if (!selectedInf?.influencerId || !campaignId) return;

    if (!milestoneForm.title.trim()) {
      toast({
        icon: "error",
        title: "Enter a milestone title",
      });
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

      // Load Razorpay SDK
      const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      if (!ok) {
        toast({
          icon: "error",
          title: "Payment error",
          text: "Payment SDK failed to load. Please try again.",
        });
        setIsSavingMilestone(false);
        return;
      }

      const brandId =
        typeof window !== "undefined" ? localStorage.getItem("brandId") : null;

      if (!brandId) {
        toast({
          icon: "error",
          title: "Missing brand",
          text: "Please log in again as a brand.",
        });
        setIsSavingMilestone(false);
        return;
      }

      // 1️⃣ Create milestone order on backend (using dedicated endpoint)
      const orderResp = await post<any>("/payment/milestone-order", {
        amount: totalWithFee,
        currency: "USD", // keep consistent with your backend / budget
        brandId,
        influencerId: selectedInf.influencerId,
        campaignId,
        milestoneTitle: milestoneForm.title,
      });

      const { id: order_id, amount, currency } = orderResp.order;

      // 2️⃣ Open Razorpay Checkout
      const rzp = new window.Razorpay({
        key: "rzp_live_GngmINuJmpWywN", // or process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
        amount,
        currency,
        name: "CollabGlam",
        description: `Milestone - ${milestoneForm.title}`,
        order_id,
        handler: async (response: any) => {
          try {
            // 3️⃣ Verify milestone payment
            await post("/payment/milestone-verify", {
              razorpay_order_id: order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            // 4️⃣ Create milestone AFTER successful payment
            await post("milestone/create", {
              influencerId: selectedInf.influencerId,
              campaignId,
              milestoneTitle: milestoneForm.title,
              amount: amountNum, // base amount (for influencer & budget)
              milestoneDescription: milestoneForm.description,
              brandId,
              razorpayOrderId: order_id,
              razorpayPaymentId: response.razorpay_payment_id,
            });

            Swal.fire({
              icon: "success",
              title: "Milestone added",
              text:
                "Milestone has been created successfully for this campaign.\n" +
                `Base: ${amountNum.toFixed(2)}, Fee: ${razorpayFee.toFixed(
                  2
                )}, Total: ${totalWithFee.toFixed(2)}`,
              showConfirmButton: false,
              timer: 1500,
              timerProgressBar: true,
            });

            setShowMilestoneModal(false);
            setMilestoneForm({ title: "", amount: "", description: "" });
            setPage(1);
            await refreshBudgetAndTotals();
          } catch (err) {
            console.error(err);
            toast({
              icon: "error",
              title: "Payment verification failed",
              text:
                "Payment was captured but we could not create the milestone. Please contact support with your payment ID.",
            });
          } finally {
            setIsSavingMilestone(false);
          }
        },
        prefill: {
          name: "",
          email: "",
          contact: "",
        },
        theme: { color: "#FFA135" },
        modal: {
          ondismiss: () => {
            setIsSavingMilestone(false);
          },
        },
      });

      rzp.on("payment.failed", (resp: any) => {
        console.error("Razorpay payment failed", resp);
        toast({
          icon: "error",
          title: "Payment failed",
          text: resp?.error?.description || "Payment was not completed.",
        });
        setIsSavingMilestone(false);
      });

      rzp.open();
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
        toast({
          icon: "error",
          title: "Error",
          text: apiMessage,
        });
      }
      setIsSavingMilestone(false);
    }
  };

  const handleViewDetails = (inf: InfluencerRow) => {
    if (!inf.influencerId) return;
    router.push(`/brand/influencers?id=${inf.influencerId}`);
  };

  // pagination
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return rowsData.slice(start, end);
  }, [rowsData, page]);

  const tableRows = useMemo(() => {
    return paginatedRows.flatMap((inf, idx) => {
      const hoverGradient = `linear-gradient(to right, ${TABLE_GRADIENT_FROM}11, ${TABLE_GRADIENT_TO}11)`;
      const rowKey = inf._id || `${inf.username || inf.name}-${idx}`;

      const baseRow = (
        <TableRow
          key={rowKey}
          className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"
            } transition-colors`}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundImage = hoverGradient)
          }
          onMouseLeave={(e) => (e.currentTarget.style.backgroundImage = "")}
        >
          {/* Name */}
          <TableCell>{inf.name}</TableCell>

          {/* Social Handle */}
          <TableCell>
            {inf.username ? (
              <a
                href={inf.socialUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
                title="Open profile"
              >
                @{inf.username.replace(/^@/, "")}
              </a>
            ) : (
              "—"
            )}
            {inf.platformName && (
              <span className="ml-1 text-xs text-gray-500">
                ({inf.platformName})
              </span>
            )}
          </TableCell>

          {/* Categories */}
          <TableCell className="space-x-1">
            {inf.categoryNames.length ? (
              inf.categoryNames.map((cat, i) => (
                <Badge
                  key={`${inf._id}-cat-${i}`}
                  variant="secondary"
                  className="capitalize inline-block"
                >
                  {cat}
                </Badge>
              ))
            ) : (
              "—"
            )}
          </TableCell>

          {/* Audience */}
          <TableCell>
            <div>
              <strong>{formatNumber(inf.followers)}</strong>
            </div>
          </TableCell>

          {/* Updated */}
          <TableCell className="whitespace-nowrap">
            <HiOutlineCalendar className="inline mr-1" />
            {formatDate(inf.updatedAt)}
          </TableCell>

          {/* Status */}
          <TableCell className="text-center">
            {inf.isAccepted === 1 ? (
              <p>Working</p>
            ) : inf.isAssigned === 1 ? (
              <p>Contract Sent</p>
            ) : (
              <p>Applied</p>
            )}
          </TableCell>

          {/* Actions */}
          <TableCell className="flex space-x-2 justify-center">
            <Button
              size="sm"
              variant="outline"
              className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:bg-gradient-to-r hover:from-[#FF7236] hover:to-[#FFA135] cursor-pointer disabled:opacity-50"
              onClick={() => handleViewDetails(inf)}
              disabled={!inf.influencerId}
              title={inf.influencerId ? "View details" : "Missing influencerId"}
            >
              View
            </Button>

            {/* <Button
              size="sm"
              variant="outline"
              className="bg-gradient-to-r from-[#FF8C00] via-[#FF5E7E] to-[#D12E53] text-white cursor-pointer hover:bg-gradient-to-r hover:from-[#FF5E7E] hover:to-[#D12E53]"
              onClick={() => router.push("/brand/messages")}
              title="Message"
            >
              Message
            </Button> */}

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
              size="icon"
              variant="ghost"
              className="ml-1 cursor-pointer"
              onClick={() => toggleExpand(rowKey)}
              disabled={!inf.influencerId}
              title={inf.influencerId ? "Toggle history" : "Missing influencerId"}
            >
              {expandedRow === rowKey ? (
                <HiOutlineChevronUp className="w-4 h-4" />
              ) : (
                <HiOutlineChevronDown className="w-4 h-4" />
              )}
            </Button>
          </TableCell>
        </TableRow>
      );

      const detailsRow =
        expandedRow === rowKey && inf.influencerId ? (
          <TableRow key={`${rowKey}-details`}>
            <TableCell colSpan={7} className="p-0">
              <MilestoneHistoryCard
                role="brand"
                brandId={
                  typeof window !== "undefined"
                    ? localStorage.getItem("brandId")
                    : undefined
                }
                influencerId={inf.influencerId}
                campaignId={campaignId as string}
              />
            </TableCell>
          </TableRow>
        ) : null;

      return [baseRow, detailsRow].filter(Boolean);
    });
  }, [paginatedRows, expandedRow, campaignId, router, isBudgetLocked]);

  const totalPages = meta.totalPages;
  const totalAccepted = meta.total;

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-4 rounded-md">
        <div className="space-y-1">
          <h1
            className="text-3xl font-bold text-gray-800"
            title={campaignName || "Unknown Campaign"}
          >
            Campaign:{" "}
            {(campaignName || "Unknown Campaign").length > 20
              ? `${(campaignName || "Unknown Campaign").slice(0, 20)}...`
              : campaignName || "Unknown Campaign"}
          </h1>

          {campaignBudget != null && (
            <p className="text-xs text-gray-600">
              Budget:{" "}
              <strong>
                {campaignBudget.toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                })}
              </strong>{" "}
              · Allocated in milestones:{" "}
              <strong>
                {campaignMilestoneTotal.toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                })}
              </strong>{" "}
              · Remaining:{" "}
              <strong>
                {remainingBudget != null
                  ? remainingBudget.toLocaleString(undefined, {
                    style: "currency",
                    currency: "USD",
                  })
                  : "—"}
              </strong>
            </p>
          )}

          {isBudgetLocked && (
            <p className="text-xs font-semibold text-red-600">
              Milestone total has reached the campaign budget. You cannot create
              more milestones.
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="bg-white text-gray-800 hover:bg-gray-100 cursor-pointer self-start"
          onClick={() => router.back()}
        >
          Back
        </Button>
      </header>

      {/* Search */}
      <div className="mb-6 max-w-md">
        <div className="relative">
          <HiSearch
            className="absolute inset-y-0 left-3 my-auto text-gray-400"
            size={20}
          />
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
          <Table className="min-w-[960px]">
            <TableHeader
              className="text-white"
              style={{
                backgroundImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO})`,
              }}
            >
              <TableRow>
                <TableHead
                  onClick={() => toggleSort("name")}
                  className="cursor-pointer select-none font-semibold"
                >
                  {totalAccepted} Accepted <SortIndicator field="name" />
                </TableHead>
                <TableHead
                  onClick={() => toggleSort("username")}
                  className="cursor-pointer select-none font-semibold"
                >
                  Social Handle <SortIndicator field="username" />
                </TableHead>
                <TableHead className="font-semibold">Categories</TableHead>
                <TableHead
                  onClick={() => toggleSort("followers")}
                  className="cursor-pointer select-none font-semibold"
                >
                  Audience <SortIndicator field="followers" />
                </TableHead>
                <TableHead
                  onClick={() => toggleSort("updatedAt")}
                  className="cursor-pointer select-none font-semibold"
                >
                  Updated <SortIndicator field="updatedAt" />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.length > 0 ? (
                tableRows
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-6 text-center text-muted-foreground"
                  >
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
                <h2 className="text-lg font-semibold mt-1">
                  {selectedInf.name}
                </h2>
                <div className="mt-1 text-xs text-white flex flex-wrap items-center gap-2">
                  {selectedInf.username && (
                    <span>@{selectedInf.username.replace(/^@/, "")}</span>
                  )}
                  {selectedInf.platformName && (
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                      {selectedInf.platformName}
                    </span>
                  )}
                  {campaignName && (
                    <span
                      className="truncate max-w-[170px]"
                      title={campaignName}
                    >
                      Campaign:{" "}
                      <span className="font-medium">{campaignName}</span>
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMilestoneModal(false)}
                className="ml-3 text-white/90 hover:text-white text-lg leading-none"
                aria-label="Close"
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
                    {campaignBudget.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                    })}
                  </strong>{" "}
                  · Allocated:{" "}
                  <strong>
                    {campaignMilestoneTotal.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                    })}
                  </strong>{" "}
                  · Remaining:{" "}
                  <strong>
                    {remainingBudget != null
                      ? remainingBudget.toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })
                      : "—"}
                  </strong>
                </p>
              )}

              {isBudgetLocked && (
                <p className="text-xs font-semibold text-red-600">
                  Milestone total has reached the campaign budget. You cannot
                  create more milestones.
                </p>
              )}

              {/* Razorpay fee breakdown */}
              {amountNum > 0 && (
                <div className="mt-2 text-xs text-gray-700 space-y-1 border border-gray-200 rounded-md p-3 bg-gray-50">
                  <p>
                    Milestone amount:{" "}
                    <strong>
                      {amountNum.toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD", // change to "INR" if needed
                      })}
                    </strong>
                  </p>
                  <p>
                    Razorpay fee (2%):{" "}
                    <strong className="text-orange-600">
                      {razorpayFee.toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                    </strong>
                  </p>
                  <p>
                    Total payable:{" "}
                    <strong>
                      {totalWithFee.toLocaleString(undefined, {
                        style: "currency",
                        currency: "USD",
                      })}
                    </strong>
                  </p>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <FloatingLabelInput
                  id="milestoneTitle"
                  label="Milestone Title"
                  value={milestoneForm.title}
                  onChange={(e) =>
                    setMilestoneForm((f) => ({ ...f, title: e.target.value }))
                  }
                />

                {/* Amount + Razorpay tooltip */}
                <div className="relative">
                  <FloatingLabelInput
                    id="milestoneAmount"
                    label="Amount"
                    value={milestoneForm.amount}
                    onChange={(e) =>
                      setMilestoneForm((f) => ({ ...f, amount: e.target.value }))
                    }
                    type="number"
                  />

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="absolute right-3 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-700 cursor-help"
                          aria-label="Razorpay fee info"
                        >
                          ?
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs bg-gray-800 text-white">
                        Razorpay charges a 2% payment processing fee when you add milestone
                        funds. This 2% is added on top of the milestone amount you enter.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <FloatingLabelInput
                id="milestoneDesc"
                label="Milestone Description"
                value={milestoneForm.description}
                onChange={(e) =>
                  setMilestoneForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
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
                  disabled={
                    !selectedInf?.influencerId ||
                    isSavingMilestone ||
                    isBudgetLocked
                  }
                  className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF8A1F] hover:to-[#FF5A2E] focus:outline-none focus:ring-2 focus:ring-[#FFA135]/40 cursor-pointer disabled:opacity-60"
                >
                  {isBudgetLocked
                    ? "Budget Reached"
                    : isSavingMilestone
                      ? "Processing..."
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

/* ------------------------ Reusable sub-components ----------------------- */
const LoadingSkeleton = ({ rows }: { rows: number }) => (
  <div className="p-6 space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className="h-12 w-full rounded-md" />
    ))}
  </div>
);

const ErrorMessage: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <p className="p-6 text-center text-destructive">{children}</p>;
