"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type Dispute = {
  disputeId: string;
  subject: string;
  description?: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_review" | "awaiting_user" | "resolved" | "rejected";
  campaignId?: string | null;
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
  const [search, setSearch] = useState<string>("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const body: any = { page, limit: 10 };
      if (status && status !== "all") body.status = status;
      if (search.trim()) body.search = search.trim();
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
  }, [page]);

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
        <Button onClick={() => router.push("/brand/disputes/new")}>New Dispute</Button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="w-48">
          <Select value={status} onValueChange={(v) => setStatus(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((o) => (
                <SelectItem key={o.value || "all"} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          placeholder="Search subject/description"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button onClick={() => { setPage(1); load(); }}>Search</Button>
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
                <th className="text-left p-3">Priority</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Updated</th>
                <th className="text-left p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.disputeId} className="border-t">
                  <td className="p-3 font-medium">{d.subject}</td>
                  <td className="p-3 font-mono text-xs">{d.campaignId || '—'}</td>
                  <td className="p-3">
                    <Badge variant={d.priority === "high" ? "destructive" : d.priority === "low" ? "secondary" : "default"}>
                      {d.priority}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <StatusBadge s={d.status} />
                  </td>
                  <td className="p-3 text-gray-600">{new Date(d.updatedAt).toLocaleString()}</td>
                  <td className="p-3">
                    <Link className="text-blue-600 hover:underline" href={`/brand/disputes/${d.disputeId}`}>View</Link>
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
