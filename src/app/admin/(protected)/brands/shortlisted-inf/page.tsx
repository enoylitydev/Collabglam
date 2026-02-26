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
import AdminMilestoneHistoryCard from "@/components/common/AdminMIlestoneHistoryCard";
import {
  HiChevronLeft,
  HiChevronRight,
  HiSearch,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
} from "react-icons/hi";

const PAGE_SIZE = 10;

const toast = (opts: { icon: "success" | "error"; title: string; text?: string }) =>
  Swal.fire({
    showConfirmButton: false,
    timer: 1200,
    timerProgressBar: true,
    background: "white",
    ...opts,
  });

interface ShortlistedRow {
  rowId: string;
  deliverableId?: string;
  influencerId: string;
  name: string;
  country: string;
  platform: string; // platforms[] -> string
  status: string;
  createdAt?: string | null;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const safeRowId = () => {
  const c: any = globalThis.crypto;
  return c?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : "—";

/**
 * ✅ Supports BOTH shapes:
 * 1) NEW: { success, total, influencers: [{ influencerId, name, country, platforms: [], createdAt }] }
 * 2) OLD: invites list with { influencerId, influencer: {}, platform, status, createdAt }
 */
const normalizeDeliverablesToUniqueInfluencers = (res: any): ShortlistedRow[] => {
  const body = res?.data && typeof res.data === "object" ? res.data : res;

  // ✅ NEW API SHAPE
  if (Array.isArray(body?.influencers)) {
    return body.influencers
      .map((inf: any) => {
        const influencerId = String(inf?.influencerId || inf?._id || "");
        if (!influencerId) return null;

        const platformsArr = Array.isArray(inf?.platforms) ? inf.platforms : [];
        const platformStr = platformsArr.length ? platformsArr.join(", ") : "—";

        return {
          rowId: safeRowId(),
          influencerId,
          name: String(inf?.name || inf?.fullName || inf?.username || "—"),
          country: String(inf?.country || "—"),
          platform: platformStr,
          status: String(inf?.status || "—"),
          createdAt: inf?.createdAt || null,
        } as ShortlistedRow;
      })
      .filter(Boolean) as ShortlistedRow[];
  }

  // ✅ OLD API SHAPE (invites list)
  const list = body?.data || body?.result || body?.deliverables || body?.items || body;
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
      platform: String(x?.platform || "—"),
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
  <p className="p-6 text-center text-red-600">{children}</p>
);

export default function AdminShortlistedInfluencersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const campaignId = searchParams.get("id") || searchParams.get("campaignId");
  const brandId = searchParams.get("brandId"); // ✅ REQUIRED FOR MILESTONES IN ADMIN

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

  const [milestoneCountByInfluencer, setMilestoneCountByInfluencer] = useState<
    Record<string, number>
  >({});

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [selectedInf, setSelectedInf] = useState<ShortlistedRow | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    amount: "",
    description: "",
  });
  const [isSavingMilestone, setIsSavingMilestone] = useState(false);

  const [campaignBudget, setCampaignBudget] = useState<number | null>(null);
  const [campaignMilestoneTotal, setCampaignMilestoneTotal] = useState<number>(0);
  const [isBudgetLocked, setIsBudgetLocked] = useState<boolean>(false);

  const amountNum = useMemo(() => Number(milestoneForm.amount) || 0, [milestoneForm.amount]);

  const remainingBudget = useMemo(() => {
    if (campaignBudget == null) return null;
    return Math.max(0, campaignBudget - campaignMilestoneTotal);
  }, [campaignBudget, campaignMilestoneTotal]);

  const toggleExpand = (id: string) => setExpandedRow((cur) => (cur === id ? null : id));

  /** Budget + milestone totals (FILTERED BY brandId) */
  const refreshBudgetAndTotals = useCallback(async () => {
    if (!campaignId) return;

    try {
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
  }, [campaignId, brandId]);

  /** Fetch shortlisted influencers */
  useEffect(() => {
    if (!campaignId) {
      setError("Campaign id missing.");
      setLoading(false);
      return;
    }

    if (!brandId) {
      setError("brandId missing in URL. Open from Review Campaigns so brandId is passed.");
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

        const term = searchTerm.trim().toLowerCase();
        const filtered = !term
          ? normalized
          : normalized.filter((r) =>
              [r.name, r.influencerId, r.country, r.platform, r.status, r.createdAt || ""]
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
        setError(e?.response?.data?.message || e?.message || "Failed to load shortlisted influencers.");
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId, brandId, searchTerm]);

  useEffect(() => {
    if (!brandId) return;
    refreshBudgetAndTotals();
  }, [refreshBudgetAndTotals, brandId]);

  const handleAddMilestone = (inf: ShortlistedRow) => {
    setSelectedInf(inf);
    setMilestoneForm({ title: "", amount: "", description: "" });
    setShowMilestoneModal(true);
  };

  // ✅ ADMIN: directly create milestone (NO STRIPE)
  const handleSaveMilestone = async () => {
    if (!selectedInf?.influencerId || !campaignId) return;

    if (!brandId) {
      toast({
        icon: "error",
        title: "brandId missing",
        text: "brandId is required in URL for milestones.",
      });
      return;
    }

    if (!milestoneForm.title.trim()) {
      toast({ icon: "error", title: "Enter a milestone title" });
      return;
    }

    if (Number.isNaN(amountNum) || amountNum <= 0) {
      toast({ icon: "error", title: "Invalid amount", text: "Enter a valid positive amount." });
      return;
    }

    if (campaignBudget != null && remainingBudget !== null) {
      if (remainingBudget <= 0) {
        setIsBudgetLocked(true);
        toast({ icon: "error", title: "Budget reached" });
        return;
      }
      if (amountNum > remainingBudget) {
        toast({
          icon: "error",
          title: "Amount exceeds remaining budget",
          text: `Remaining budget is ${remainingBudget.toLocaleString()}.`,
        });
        return;
      }
    }

    try {
      setIsSavingMilestone(true);

      await post("milestone/create", {
        influencerId: selectedInf.influencerId,
        campaignId,
        milestoneTitle: milestoneForm.title,
        amount: amountNum,
        milestoneDescription: milestoneForm.description,
        brandId,
        paymentProvider: "admin", // optional (safe), remove if backend rejects unknown fields
      });

      toast({ icon: "success", title: "Milestone added" });

      setShowMilestoneModal(false);
      setSelectedInf(null);
      setMilestoneForm({ title: "", amount: "", description: "" });
      setPage(1);

      await refreshBudgetAndTotals();
    } catch (err: any) {
      console.error(err);
      toast({
        icon: "error",
        title: "Error",
        text: err?.response?.data?.message || err?.message || "Failed to create milestone.",
      });
    } finally {
      setIsSavingMilestone(false);
    }
  };

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return rowsData.slice(start, end);
  }, [rowsData, page]);

  const tableRows = useMemo(() => {
    return paginatedRows.flatMap((inf, idx) => {
      const rowKey = inf.rowId;

      const milestoneCount = milestoneCountByInfluencer[String(inf.influencerId)] || 0;
      const hasMilestones = milestoneCount > 0;

      const baseRow = (
        <TableRow
          key={rowKey}
          className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100 transition-colors`}
        >
          <TableCell className="font-medium text-black">{inf.name}</TableCell>
          <TableCell className="text-center">{inf.country}</TableCell>
          <TableCell className="text-center">{inf.platform}</TableCell>
          <TableCell className="text-center">{inf.status}</TableCell>
          <TableCell className="text-center">{formatDate(inf.createdAt || null)}</TableCell>

          <TableCell className="text-center">
            {hasMilestones ? (
              <span className="text-black">Working</span>
            ) : (
              <span className="text-gray-600">Awaiting Milestone</span>
            )}
          </TableCell>

          <TableCell className="flex space-x-2 justify-center">
            <Button
              size="sm"
              variant="outline"
              className="border-black text-black hover:bg-gray-100 disabled:opacity-50"
              onClick={() => handleAddMilestone(inf)}
              disabled={!inf.influencerId || isBudgetLocked}
            >
              Add Milestone
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="border-black text-black hover:bg-gray-100 disabled:opacity-50"
              onClick={() => toggleExpand(rowKey)}
              disabled={!hasMilestones}
            >
              View Milestone
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="cursor-pointer"
              onClick={() => toggleExpand(rowKey)}
              disabled={!inf.influencerId}
              title="Toggle history"
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
              <AdminMilestoneHistoryCard
                brandId={brandId as string}
                campaignId={campaignId as string}
                influencerId={inf.influencerId}
              />
            </TableCell>
          </TableRow>
        ) : null;

      return [baseRow, detailsRow].filter(Boolean) as any[];
    });
  }, [paginatedRows, expandedRow, campaignId, isBudgetLocked, milestoneCountByInfluencer, brandId]);

  const totalPages = meta.totalPages;

  return (
    <div className="min-h-screen bg-white p-4 md:p-8 space-y-6 text-black">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Shortlisted Influencers</h1>

          {campaignBudget != null && (
            <p className="text-xs text-gray-600">
              Budget:{" "}
              <strong>
                {campaignBudget.toLocaleString(undefined, { style: "currency", currency: "USD" })}
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
                  ? remainingBudget.toLocaleString(undefined, { style: "currency", currency: "USD" })
                  : "—"}
              </strong>
            </p>
          )}

          {isBudgetLocked && (
            <p className="text-xs font-semibold text-red-600">
              Budget reached. You cannot create more milestones.
            </p>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          className="border-black text-black hover:bg-gray-100 self-start"
          onClick={() => router.back()}
        >
          Back
        </Button>
      </header>

      {/* Search */}
      <div className="w-full">
        <div className="relative w-full sm:max-w-md">
          <HiSearch className="absolute inset-y-0 left-3 my-auto text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search influencers..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-sm"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSkeleton rows={PAGE_SIZE} />
      ) : error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader className="bg-black">
              <TableRow>
                <TableHead className="font-semibold text-white">Influencer</TableHead>
                <TableHead className="font-semibold text-center text-white">Country</TableHead>
                <TableHead className="font-semibold text-center text-white">Platform</TableHead>
                <TableHead className="font-semibold text-center text-white">Deliverable Status</TableHead>
                <TableHead className="font-semibold text-center text-white">Created</TableHead>
                <TableHead className="font-semibold text-center text-white">Milestones</TableHead>
                <TableHead className="font-semibold text-center text-white">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {tableRows.length > 0 ? (
                tableRows
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-gray-600">
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
            className="border-gray-300 hover:bg-gray-100"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
          >
            <HiChevronLeft />
          </Button>
          <span className="text-sm text-gray-700">
            Page <strong className="text-black">{page}</strong> of{" "}
            <strong className="text-black">{totalPages}</strong>
          </span>
          <Button
            variant="outline"
            size="icon"
            className="border-gray-300 hover:bg-gray-100"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
          >
            <HiChevronRight />
          </Button>
        </div>
      )}

      {/* Milestone Modal */}
      {showMilestoneModal && selectedInf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white border border-gray-200 shadow-xl">
            <div className="px-6 py-4 flex items-start justify-between bg-black">
              <div className="text-white">
                <p className="text-xs uppercase tracking-wide opacity-80">Create milestone</p>
                <h2 className="text-lg font-semibold mt-1">{selectedInf.name}</h2>
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

            <div className="px-6 py-5 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <FloatingLabelInput
                  id="milestoneTitle"
                  label="Milestone Title"
                  value={milestoneForm.title}
                  onChange={(e: any) =>
                    setMilestoneForm((f) => ({ ...f, title: e.target.value }))
                  }
                />

                <FloatingLabelInput
                  id="milestoneAmount"
                  label="Amount"
                  value={milestoneForm.amount}
                  onChange={(e: any) =>
                    setMilestoneForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  type="number"
                />
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

            <div className="flex gap-2 border-t bg-gray-50 px-6 py-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowMilestoneModal(false)}
                className="border-gray-300 hover:bg-white"
                disabled={isSavingMilestone}
              >
                Cancel
              </Button>

              <Button
                onClick={handleSaveMilestone}
                disabled={!selectedInf?.influencerId || isSavingMilestone || isBudgetLocked}
                className="bg-black text-white hover:bg-gray-800 disabled:opacity-60"
              >
                {isSavingMilestone ? "Saving..." : "Add Milestone"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}