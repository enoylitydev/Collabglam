"use client";

import React, { useEffect, useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";

type Comment = {
  commentId: string;
  authorRole: "Admin" | "Brand" | "Influencer";
  authorId: string;
  text: string;
  createdAt: string;
};

type DisputeStatus =
  | "open"
  | "in_review"
  | "awaiting_user"
  | "resolved"
  | "rejected";

type Attachment = {
  url: string;
  originalName?: string | null;
  mimeType?: string | null;
  size?: number | null;
};

type Dispute = {
  disputeId: string;
  subject: string;
  description?: string;
  status: DisputeStatus;
  campaignId: string;
  brandId: string;
  influencerId: string;
  campaignName?: string | null;
  brandName?: string | null;
  influencerName?: string | null;
  createdBy?: { id?: string; role?: "Brand" | "Influencer" };
  assignedTo?: { adminId?: string | null; name?: string | null } | null;
  comments?: Comment[];
  attachments?: Attachment[];
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

const statusOptions = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_review", label: "In Review" },
  { value: "awaiting_user", label: "Awaiting User" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
];

// Simple debounce hook
function useDebouncedValue<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

export default function AdminDisputesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Dispute[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [status, setStatus] = useState<string>("all");
  const [appliedBy, setAppliedBy] = useState<"all" | "Brand" | "Influencer">(
    "all"
  );

  const [searchInput, setSearchInput] = useState<string>("");
  const debouncedSearch = useDebouncedValue(searchInput, 400);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const body: any = { page, limit: 10 };

      if (status && status !== "all") body.status = status;

      if (debouncedSearch.trim()) {
        body.search = debouncedSearch.trim();
      }

      if (appliedBy && appliedBy !== "all") {
        body.appliedBy = appliedBy; // backend lowercases it
      }

      const data = await post<ListResp>("/dispute/admin/list", body);
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, appliedBy, debouncedSearch]);

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
      <span className={`px-2 py-1 rounded text-xs font-medium ${tone}`}>
        {s.replace("_", " ")}
      </span>
    );
  };

  // For display like "showing 1–10 of 32"
  const from = total === 0 ? 0 : (page - 1) * 10 + 1;
  const to = Math.min(page * 10, total);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);

    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">All Disputes</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-4 md:flex-row md:items-center">
        {/* Status filter */}
        <div className="w-full md:w-48">
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

        {/* Applied-by filter (Brand/Influencer) */}
        <div className="flex items-center gap-3 px-3 py-2 border rounded !bg-white">
          <span className="text-sm text-gray-700">Applied</span>
          {(() => {
            const brandChecked = appliedBy === "Brand" || appliedBy === "all";
            const influencerChecked =
              appliedBy === "Influencer" || appliedBy === "all";

            const nextFrom = (b: boolean, i: boolean): typeof appliedBy =>
              (b && i) || (!b && !i)
                ? "all"
                : b
                ? "Brand"
                : "Influencer";

            return (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={brandChecked}
                    onCheckedChange={(val) => {
                      const b = Boolean(val);
                      const i = influencerChecked;
                      setAppliedBy(nextFrom(b, i));
                      setPage(1);
                    }}
                  />
                  Brand
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={influencerChecked}
                    onCheckedChange={(val) => {
                      const b = brandChecked;
                      const i = Boolean(val);
                      setAppliedBy(nextFrom(b, i));
                      setPage(1);
                    }}
                  />
                  Influencer
                </label>
              </>
            );
          })()}
        </div>

        {/* Search */}
        <div className="flex flex-1 gap-2">
          <Input
            placeholder="Search subject/description"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setPage(1);
            }}
            className="bg-white"
          />
          <Button
            className="border"
            onClick={() => {
              setPage(1);
            }}
          >
            Search
          </Button>
        </div>
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
                <th className="text-left p-3">Dispute ID</th>
                <th className="text-left p-3">Subject</th>
                <th className="text-left p-3">Campaign</th>
                <th className="text-left p-3">Brand</th>
                <th className="text-left p-3">Influencer</th>
                <th className="text-left p-3">Applied By</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr
                  key={d.disputeId}
                  className="border-t align-top cursor-pointer hover:bg-gray-50"
                  onClick={() =>
                    router.push(`/admin/disputes/${d.disputeId}`)
                  }
                >
                  <td className="p-3 font-mono text-xs">{d.disputeId}</td>
                  <td className="p-3 font-medium max-w-xs truncate">
                    {d.subject}
                  </td>
                  <td className="p-3">
                    {d.campaignName ? (
                      <>
                        <div className="text-sm">{d.campaignName}</div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {d.campaignId}
                        </div>
                      </>
                    ) : d.campaignId ? (
                      <span className="font-mono text-xs">
                        {d.campaignId}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {d.brandName ? (
                      <>
                        <div className="text-sm">{d.brandName}</div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {d.brandId}
                        </div>
                      </>
                    ) : d.brandId ? (
                      <span className="font-mono text-xs">{d.brandId}</span>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {d.influencerName ? (
                      <>
                        <div className="text-sm">{d.influencerName}</div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {d.influencerId}
                        </div>
                      </>
                    ) : d.influencerId ? (
                      <span className="font-mono text-xs">
                        {d.influencerId}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {d.createdBy?.role ? (
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 text-xs font-medium">
                        {d.createdBy.role}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <StatusBadge s={d.status} />
                  </td>
                  <td className="p-3 text-xs text-gray-600 whitespace-nowrap">
                    {new Date(d.updatedAt).toLocaleString()}
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
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
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
              onClick={() =>
                setPage((p) => (p >= totalPages ? totalPages : p + 1))
              }
            >
              ›
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
