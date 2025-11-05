"use client";

import React, { useEffect, useState } from "react";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";

type Comment = {
  commentId: string;
  authorRole: "Admin" | "Brand" | "Influencer";
  authorId: string;
  text: string;
  createdAt: string;
};

type Dispute = {
  disputeId: string;
  subject: string;
  description?: string;
  status: "open" | "in_review" | "awaiting_user" | "resolved" | "rejected";
  campaignId: string;
  brandId: string;
  influencerId: string;
  brandName?: string | null;
  influencerName?: string | null;
  assignedTo?: { adminId?: string | null; name?: string | null } | null;
  comments?: Comment[];
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

export default function AdminDisputesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Dispute[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [appliedBy, setAppliedBy] = useState<string>("all");
  const [searchInput, setSearchInput] = useState<string>("");
  const [appliedSearch, setAppliedSearch] = useState<string>("");
  // List page shows summary only; details and actions move to detail page

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const body: any = { page, limit: 10 };
      if (status && status !== "all") body.status = status;
      if (appliedSearch.trim()) body.search = appliedSearch.trim();
      if (appliedBy && appliedBy !== "all") body.appliedBy = appliedBy;
      const data = await post<ListResp>("/dispute/admin/list", body);
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
  }, [page, status, appliedBy, appliedSearch]);

  // (removed client-side brand/influencer filters)

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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">All Disputes</h1>
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
        <div className="flex items-center gap-3 px-3 py-2 border rounded !bg-white">
          <span className="text-sm text-gray-700">Applied</span>
          {(() => {
            const brandChecked = appliedBy === 'Brand' || appliedBy === 'all';
            const influencerChecked = appliedBy === 'Influencer' || appliedBy === 'all';
            const nextFrom = (b: boolean, i: boolean) => (b && i) || (!b && !i) ? 'all' : (b ? 'Brand' : 'Influencer');
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
        <Input
          placeholder="Search subject/description"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { setPage(1); setAppliedSearch(searchInput); }
          }}
        />
        <Button onClick={() => { setPage(1); setAppliedSearch(searchInput); }}>Search</Button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-600">No disputes found.</p>
      ) : (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Subject</th>
                <th className="text-left p-3">Campaign</th>
                <th className="text-left p-3">Brand</th>
                <th className="text-left p-3">Influencer</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr
                  key={d.disputeId}
                  className="border-t align-top cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/admin/disputes/${d.disputeId}`)}
                >
                  <td className="p-3 font-medium">{d.subject}</td>
                  <td className="p-3 font-mono text-xs">{d.campaignId || '—'}</td>
                  <td className="p-3">{d.brandName || <span className="font-mono text-xs">{d.brandId}</span>}</td>
                  <td className="p-3">{d.influencerName || <span className="font-mono text-xs">{d.influencerId}</span>}</td>
                  <td className="p-3"><StatusBadge s={d.status} /></td>
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
