"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

type DisputeStatus = "open" | "in_review" | "awaiting_user" | "resolved" | "rejected";

type Dispute = {
  disputeId: string;
  subject: string;
  description?: string;
  status: DisputeStatus;
  campaignId?: string | null;
  campaignName?: string | null;
  brandId: string;
  influencerId: string;
  assignedTo?: { adminId?: string | null; name?: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

type ListResp = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  disputes: Dispute[];
};

// Status filter values use numeric mapping expected by backend:
// 0 = ALL, 1–5 map to STATUS_ORDER in backend
const statusOptions = [
  { value: "0", label: "All" },
  { value: "1", label: "Open" },
  { value: "2", label: "In Review" },
  { value: "3", label: "Awaiting You" },
  { value: "4", label: "Resolved" },
  { value: "5", label: "Rejected" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export default function BrandDisputesPage() {
  const router = useRouter();

  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandLoaded, setBrandLoaded] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Dispute[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string>("0"); // numeric string, maps to backend
  const [searchInput, setSearchInput] = useState<string>("");
  const [appliedSearch, setAppliedSearch] = useState<string>("");

  // Load brandId from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = localStorage.getItem("brandId");
    setBrandId(id);
    setBrandLoaded(true);
  }, []);

  const load = async () => {
    if (!brandLoaded) return;

    setLoading(true);
    setError(null);

    if (!brandId) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      setLoading(false);
      setError("Brand ID not found. Please log in again.");
      return;
    }

    try {
      const body: any = {
        page,
        limit: pageSize,
        brandId, // send brandId to backend (even if it also uses token)
      };

      // send numeric status (0–5) to backend
      const statusNum = parseInt(status, 10);
      if (!Number.isNaN(statusNum)) {
        body.status = statusNum;
      }

      if (appliedSearch.trim()) {
        body.search = appliedSearch.trim();
      }

      const data = await post<ListResp>("/dispute/brand/list", body);

      setRows(data.disputes || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.message || "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!brandLoaded) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandLoaded, brandId, page, status, appliedSearch, pageSize]);

  const StatusBadge = ({ s }: { s: DisputeStatus }) => {
    const tone =
      {
        open: "bg-blue-100 text-blue-800",
        in_review: "bg-purple-100 text-purple-800",
        awaiting_user: "bg-amber-100 text-amber-800",
        resolved: "bg-green-100 text-green-700",
        rejected: "bg-red-100 text-red-700",
      }[s] || "bg-gray-100 text-gray-700";

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${tone}`}>
        {s.replace("_", " ")}
      </span>
    );
  };

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);

    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const clearFilters = () => {
    setStatus("0");
    setSearchInput("");
    setAppliedSearch("");
    setPage(1);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Disputes</h1>
        <Button
          className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white"
          onClick={() => router.push("/brand/disputes/new")}
        >
          New Dispute
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        {/* Status filter */}
        <div className="w-full md:w-56">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="!bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="!bg-white">
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="flex-1 flex gap-2">
          <Input
            className="bg-white text-black"
            placeholder="Search subject/description"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                setAppliedSearch(searchInput);
              }
            }}
          />
          <Button
            className="bg-white text-black border"
            onClick={() => {
              setPage(1);
              setAppliedSearch(searchInput);
            }}
          >
            Search
          </Button>
        </div>

        {/* Clear filters */}
        <Button
          variant="destructive"
          className="bg-red-500 text-white"
          onClick={clearFilters}
        >
          Clear
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-600">No disputes found.</p>
      ) : (
        <div className="overflow-x-auto rounded-[16px] border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Subject</th>
                <th className="text-left p-3">Campaign</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Updated</th>
                <th className="text-left p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.disputeId} className="border-t">
                  <td className="p-3 font-medium max-w-xs truncate">{d.subject}</td>
                  <td className="p-3">{d.campaignName || "—"}</td>
                  <td className="p-3">
                    <StatusBadge s={d.status} />
                  </td>
                  <td className="p-3 text-gray-600">
                    {new Date(d.updatedAt).toLocaleString()}
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      className="text-sm text-gray-800 hover:underline"
                      href={`/brand/disputes/${d.disputeId}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-4">
          {/* Range info */}
          <div className="text-xs text-gray-600">
            {total > 0 ? (
              <>
                Showing{" "}
                <span className="font-medium">
                  {from}-{to}
                </span>{" "}
                of <span className="font-medium">{total}</span> disputes
              </>
            ) : (
              "No results"
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Page size */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 hidden sm:inline">
                Rows per page:
              </span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-[72px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="!bg-white">
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Page controls */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {pageNumbers.map((pNum) => (
                <Button
                  key={pNum}
                  size="icon"
                  className="h-8 w-8"
                  variant={pNum === page ? "default" : "outline"}
                  onClick={() => setPage(pNum)}
                >
                  {pNum}
                </Button>
              ))}

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={page >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
