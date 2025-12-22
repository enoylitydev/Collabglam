/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api, { post } from "@/lib/api";
import Swal from "sweetalert2";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import {
  HiOutlineCalendar,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiSearch,
  HiOutlineDotsVertical,
} from "react-icons/hi";

import MilestoneHistoryCard from "@/components/common/milestoneCard";

function formatAudienceSize(input: number | string | null | undefined) {
  if (input === null || input === undefined) return "—";

  const n =
    typeof input === "number"
      ? input
      : Number(String(input).replace(/,/g, "").trim());

  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n < 1000) return String(Math.round(n));

  if (n < 1_000_000) {
    const v = n / 1000;
    const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
    return `${Number(v.toFixed(digits))}K`;
  }

  if (n < 1_000_000_000) {
    const v = n / 1_000_000;
    const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
    return `${Number(v.toFixed(digits))}M`;
  }

  const v = n / 1_000_000_000;
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${Number(v.toFixed(digits))}B`;
}

const TABLE_GRADIENT_FROM = "#FFA135";
const TABLE_GRADIENT_TO = "#FF7236";

interface Influencer {
  _id: string;
  name: string;
  email: string;
  phone: string;
  handle: string;
  categoryName: string;
  audienceSize: number | string;
  createdAt: string;
  callingcode: string;
  influencerId: string;

  isAssigned: number; // pending
  isAccepted: number; // working

  isContracted?: number;
  contractId?: string | null;

  hasMilestone?: number; // 1/0
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

function StatusBadge({ inf }: { inf: Influencer }) {
  if (inf.isAccepted === 1)
    return <Badge className="bg-green-600 text-white">Working</Badge>;
  if (inf.isAssigned === 1)
    return <Badge className="bg-amber-500 text-white">Pending</Badge>;
  return <Badge variant="secondary">Applied</Badge>;
}

function MilestonesExpandedRow({
  influencer,
  campaignId,
  brandId,
  onCollapse,
}: {
  influencer: Influencer;
  campaignId: string | null;
  brandId: string | null;
  onCollapse: () => void;
}) {
  return (
    <TableRow className="bg-white">
      <TableCell colSpan={7} className="p-0">
        {/* Expanded panel */}
        <div className="border-t bg-gradient-to-b from-gray-50 to-white">
          <div className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  Milestones
                </span>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="bg-white"
              onClick={onCollapse}
            >
              Collapse
            </Button>
          </div>

          <div className="px-4 pb-4">

            <MilestoneHistoryCard
              role="brand"
              brandId={brandId}
              influencerId={influencer.influencerId}
              campaignId={campaignId || undefined}
              className="w-full"
            />
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function AppliedInfluencersPage() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id");
  const campaignName = searchParams.get("name");
  const router = useRouter();

  const [brandId, setBrandId] = useState<string | null>(null);

  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [applicantCount, setApplicantCount] = useState(0);

  const [meta, setMeta] = useState<Meta>({
    total: 0,
    page: 1,
    limit: PAGE_SIZE_OPTIONS[0],
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(
    PAGE_SIZE_OPTIONS[0]
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<keyof Influencer>("createdAt");
  const [sortOrder, setSortOrder] = useState<1 | 0>(1);

  // ✅ expanded milestones (inline)
  const [expandedMilestonesFor, setExpandedMilestonesFor] = useState<string | null>(null);

  // load brandId once
  useEffect(() => {
    try {
      const id = localStorage.getItem("brandId");
      setBrandId(id);
    } catch {
      setBrandId(null);
    }
  }, []);

  // debounce search to reduce API calls
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // collapse expanded row when paging/sorting/searching changes
  useEffect(() => {
    setExpandedMilestonesFor(null);
  }, [page, limit, debouncedSearch, sortField, sortOrder, campaignId]);

  const handleViewDetails = useCallback(
    (inf: Influencer) => {
      router.push(`/brand/influencers?id=${inf.influencerId}`);
    },
    [router]
  );

  const toggleMilestones = useCallback((inf: Influencer) => {
    if (inf.hasMilestone !== 1) return;
    setExpandedMilestonesFor((curr) =>
      curr === inf.influencerId ? null : inf.influencerId
    );
  }, []);

  // ✅ Open Contract PDF in a new tab (no view page)
  const handleViewContract = useCallback(async (inf: Influencer) => {
    if (!inf.contractId) return;

    try {
      // optional: mark as viewed (non-blocking)
      post("/contract/viewed", { contractId: inf.contractId, role: "brand" }).catch(() => { });

      const res = await api.get("/contract/preview", {
        params: { contractId: inf.contractId },
        responseType: "blob",
      });

      const blobUrl = URL.createObjectURL(res.data);
      const win = window.open(blobUrl, "_blank", "noopener,noreferrer");

      if (!win) {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.click();
      }

      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (err: any) {
      console.error(err);
      Swal.fire("Error", err?.message || "Failed to open contract PDF.", "error");
    }
  }, []);

  // Fetch applicants
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
        const res = await post<{
          meta: Meta;
          influencers: Influencer[];
          applicantCount: number;
        }>("campaign/history-list", {
          campaignId,
          page,
          limit,
          search: debouncedSearch,
          sortField,
          sortOrder,
        });

        setInfluencers(res.influencers || []);
        setApplicantCount(res.applicantCount || 0);
        setMeta(res.meta);
      } catch {
        setError("Failed to load applicants.");
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId, page, limit, debouncedSearch, sortField, sortOrder]);

  // Sorting
  const toggleSort = useCallback((field: keyof Influencer) => {
    setPage(1);
    setSortField((curr) => {
      if (curr === field) {
        setSortOrder((o) => (o === 1 ? 0 : 1));
        return curr;
      }
      setSortOrder(1);
      return field;
    });
  }, []);

  const SortIndicator = ({ field }: { field: keyof Influencer }) =>
    sortField === field ? (
      sortOrder === 1 ? (
        <HiOutlineChevronDown className="inline ml-1 w-4 h-4" />
      ) : (
        <HiOutlineChevronUp className="inline ml-1 w-4 h-4" />
      )
    ) : null;

  const rows = useMemo(() => {
    return influencers.flatMap((inf, idx) => {
      const isExpanded = expandedMilestonesFor === inf.influencerId;

      const mainRow = (
        <TableRow
          key={inf._id}
          className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} transition-colors`}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${TABLE_GRADIENT_FROM}11, ${TABLE_GRADIENT_TO}11)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundImage = "";
          }}
        >
          <TableCell className="font-medium text-gray-900">{inf.name}</TableCell>

          <TableCell className="truncate max-w-[220px] text-gray-700">
            {inf.handle || "—"}
          </TableCell>

          <TableCell>
            <Badge variant="secondary" className="capitalize">
              {inf.categoryName || "—"}
            </Badge>
          </TableCell>

          <TableCell className="text-gray-700">
            {formatAudienceSize(inf.audienceSize)}
          </TableCell>

          <TableCell className="whitespace-nowrap text-gray-700">
            <HiOutlineCalendar className="inline mr-1" />
            {new Date(inf.createdAt).toLocaleDateString()}
          </TableCell>

          <TableCell className="text-center">
            <StatusBadge inf={inf} />
          </TableCell>

          <TableCell className="whitespace-nowrap">
            <div className="flex justify-end items-center gap-2">

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white text-gray-800 hover:bg-gray-100"
                  >
                    <HiOutlineDotsVertical className="mr-2" />
                    Actions
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-56 bg-white cursor-pointer">
                  <DropdownMenuItem onClick={() => handleViewDetails(inf)}>
                    View Influencer
                  </DropdownMenuItem>

                  {inf.contractId ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleViewContract(inf)}>
                        View Contract (PDF)
                      </DropdownMenuItem>
                    </>
                  ) : null}

                  {inf.hasMilestone === 1 ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => toggleMilestones(inf)}>
                        <span className="flex items-center justify-between w-full">
                          <span>{isExpanded ? "Hide Milestones" : "Show Milestones"}</span>
                          {isExpanded ? <HiOutlineChevronUp /> : <HiOutlineChevronDown />}
                        </span>
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TableCell>
        </TableRow>
      );

      const expandedRow =
        inf.hasMilestone === 1 && isExpanded ? (
          <MilestonesExpandedRow
            key={`${inf._id}-milestones`}
            influencer={inf}
            campaignId={campaignId}
            brandId={brandId}
            onCollapse={() => setExpandedMilestonesFor(null)}
          />
        ) : null;

      return expandedRow ? [mainRow, expandedRow] : [mainRow];
    });
  }, [influencers, expandedMilestonesFor, campaignId, brandId, toggleMilestones, handleViewContract, handleViewDetails]);

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between p-4 rounded-xl border bg-white shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Campaign: {campaignName || "Unknown Campaign"}
          </h1>
          <p className="text-sm text-gray-600">
            Total Applicants: <span className="font-semibold">{applicantCount}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="bg-white"
            onClick={() => router.back()}
          >
            Back
          </Button>
        </div>
      </header>

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="w-full md:max-w-md">
          <div className="relative">
            <HiSearch className="absolute inset-y-0 left-3 my-auto text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search influencers..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>
          {searchTerm.trim() && debouncedSearch !== searchTerm.trim() ? (
            <p className="text-xs text-gray-500 mt-1">Searching…</p>
          ) : null}
        </div>

        <div className="flex items-center gap-2 justify-end">
          <span className="text-sm text-gray-600">Rows:</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value) as any);
              setPage(1);
            }}
            className="border border-gray-200 rounded-md px-3 py-2 text-sm bg-white"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSkeleton rows={limit} />
      ) : error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : (
        <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
          <Table className="min-w-[1050px]">
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
                  Influencer <SortIndicator field="name" />
                </TableHead>

                <TableHead
                  onClick={() => toggleSort("handle")}
                  className="cursor-pointer select-none font-semibold"
                >
                  Social Handle <SortIndicator field="handle" />
                </TableHead>

                <TableHead
                  onClick={() => toggleSort("categoryName")}
                  className="cursor-pointer select-none font-semibold"
                >
                  Category <SortIndicator field="categoryName" />
                </TableHead>

                <TableHead
                  onClick={() => toggleSort("audienceSize")}
                  className="cursor-pointer select-none font-semibold"
                >
                  Audience <SortIndicator field="audienceSize" />
                </TableHead>

                <TableHead
                  onClick={() => toggleSort("createdAt")}
                  className="cursor-pointer select-none"
                >
                  Date <SortIndicator field="createdAt" />
                </TableHead>

                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {influencers.length > 0 ? (
                rows
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No influencers match criteria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex justify-center md:justify-end items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="bg-white"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
          >
            <HiChevronLeft />
          </Button>

          <span className="text-sm text-gray-700">
            Page <strong>{page}</strong> of {meta.totalPages}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="bg-white"
            disabled={page === meta.totalPages}
            onClick={() => setPage((p) => Math.min(p + 1, meta.totalPages))}
          >
            <HiChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}

const LoadingSkeleton = ({ rows }: { rows: number }) => (
  <div className="p-6 space-y-2 bg-white rounded-xl border shadow-sm">
    {Array(rows)
      .fill(0)
      .map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
  </div>
);

const ErrorMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-6 bg-white rounded-xl border shadow-sm">
    <p className="text-center text-destructive">{children}</p>
  </div>
);
