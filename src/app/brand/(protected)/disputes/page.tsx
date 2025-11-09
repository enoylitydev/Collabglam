"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Dispute = {
  disputeId: string;
  subject: string;
  description?: string;
  status: "open" | "in_review" | "awaiting_user" | "resolved" | "rejected";
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

const statusOptions = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_review", label: "In Review" },
  { value: "awaiting_user", label: "Awaiting You" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
];

export default function BrandDisputesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Dispute[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<string>("all");
  const [searchInput, setSearchInput] = useState<string>("");
  const [appliedSearch, setAppliedSearch] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const body: any = { page, limit: 10 };
      if (status && status !== "all") body.status = status;
      if (appliedSearch.trim()) body.search = appliedSearch.trim();
      const data = await post<ListResp>("/dispute/my", body);
      setRows(data.disputes || []);
      setTotalPages(data.totalPages || 1);
    } catch (e: any) {
      setError(e?.message || "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, appliedSearch]);

  const StatusBadge = ({ s }: { s: Dispute["status"] }) => {
    const tone = {
      open: "bg-blue-100 text-blue-800",
      in_review: "bg-purple-100 text-purple-800",
      awaiting_user: "bg-amber-100 text-amber-800",
      resolved: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
    }[s];
    return <span className={`px-2 py-1 rounded text-xs font-medium ${tone}`}>{s.replace("_", " ")}</span>;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Disputes</h1>
        <Button
          className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white"
          onClick={() => router.push("/brand/disputes/new")}
        >
          New Dispute
        </Button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="w-48">
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="!bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="!bg-white">
              {statusOptions.map((o) => (
                <SelectItem key={o.value || "all"} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Removed 'Applied by' filter for brand view */}
        <Input className="bg-white text-black"
          placeholder="Search subject/description"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { setPage(1); setAppliedSearch(searchInput); }
          }}
        />
        <Button
          className="bg-white text-black border"
          onClick={() => { setPage(1); setAppliedSearch(searchInput); }}
        >
          Search
        </Button>
      </div>

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
                  <td className="p-3 font-medium">{d.subject}</td>
                  <td className="p-3">{d.campaignName || '—'}</td>
                  <td className="p-3">
                    <StatusBadge s={d.status} />
                  </td>
                  <td className="p-3 text-gray-600">{new Date(d.updatedAt).toLocaleString()}</td>
                  <td className="p-3">
                    <Link className="text-black-600 hover:underline" href={`/brand/disputes/${d.disputeId}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-3 mt-4">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <span className="text-sm text-gray-700">Page {page} of {totalPages}</span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
