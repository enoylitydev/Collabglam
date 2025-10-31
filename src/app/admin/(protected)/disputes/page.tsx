"use client";

import React, { useEffect, useState } from "react";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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
  priority: "low" | "medium" | "high";
  status: "open" | "in_review" | "awaiting_user" | "resolved" | "rejected";
  campaignId: string;
  brandId: string;
  influencerId: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Dispute[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [pendingStatus, setPendingStatus] = useState<Record<string, Dispute["status"]>>({});
  const [resolutionNote, setResolutionNote] = useState<Record<string, string>>({});
  const truncate = (s?: string, n: number = 140) => {
    const v = s || '';
    return v.length > n ? v.slice(0, n) + '…' : (v || '—');
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const body: any = { page, limit: 10 };
      if (status && status !== "all") body.status = status;
      if (search.trim()) body.search = search.trim();
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
  }, [page]);

  const assignToMe = async (disputeId: string) => {
    try {
      await post("/dispute/admin/assign", { disputeId });
      await load();
    } catch (e) {}
  };

  const updateStatus = async (disputeId: string) => {
    try {
      const s = pendingStatus[disputeId];
      if (!s) return;
      await post("/dispute/admin/update-status", {
        disputeId,
        status: s,
        resolution: resolutionNote[disputeId] || undefined,
      });
      await load();
    } catch (e) {}
  };

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
                <th className="text-left p-3">Description</th>
                <th className="text-left p-3">Brand</th>
                <th className="text-left p-3">Influencer</th>
                <th className="text-left p-3">Priority</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Assigned</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <>
                  <tr key={d.disputeId} className="border-t align-top">
                    <td className="p-3 font-medium">{d.subject}</td>
                    <td className="p-3 font-mono text-xs">{d.campaignId || '—'}</td>
                    <td className="p-3 text-gray-700">{truncate(d.description, 160)}</td>
                    <td className="p-3 font-mono text-xs">{d.brandId}</td>
                    <td className="p-3 font-mono text-xs">{d.influencerId}</td>
                    <td className="p-3">
                      <Badge variant={d.priority === "high" ? "destructive" : d.priority === "low" ? "secondary" : "default"}>
                        {d.priority}
                      </Badge>
                    </td>
                    <td className="p-3"><StatusBadge s={d.status} /></td>
                    <td className="p-3">{d.assignedTo?.name || d.assignedTo?.adminId || <span className="text-gray-400">—</span>}</td>
                    <td className="p-3 w-[340px]">
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => assignToMe(d.disputeId)}>Assign to me</Button>
                          <div className="w-44">
                            <Select value={pendingStatus[d.disputeId] || ""} onValueChange={(v) => setPendingStatus((s) => ({ ...s, [d.disputeId]: v as Dispute["status"] }))}>
                              <SelectTrigger>
                                <SelectValue placeholder="Set status" />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.filter(o => o.value !== "all").map((o) => (
                                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button size="sm" onClick={() => updateStatus(d.disputeId)}>Update</Button>
                          <Button size="sm" variant="link" onClick={() => setExpanded(expanded === d.disputeId ? null : d.disputeId)}>
                            {expanded === d.disputeId ? 'Hide details' : 'Details'}
                          </Button>
                        </div>
                        <Input
                          placeholder="Resolution note (optional)"
                          value={resolutionNote[d.disputeId] || ""}
                          onChange={(e) => setResolutionNote((r) => ({ ...r, [d.disputeId]: e.target.value }))}
                        />
                      </div>
                    </td>
                  </tr>
                  {expanded === d.disputeId && (
                    <tr>
                      <td colSpan={9} className="bg-gray-50 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-1">
                            <h3 className="font-semibold mb-2">Description</h3>
                            <p className="text-gray-800 whitespace-pre-wrap">{d.description || '—'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <h3 className="font-semibold mb-2">Comments</h3>
                            {d.comments && d.comments.length > 0 ? (
                              <ul className="space-y-3">
                                {d.comments.map(c => (
                                  <li key={c.commentId} className="p-3 rounded border bg-white">
                                    <div className="text-xs text-gray-600 mb-1">
                                      <span className="font-medium">{c.authorRole}</span> • {new Date(c.createdAt).toLocaleString()}
                                    </div>
                                    <div className="text-gray-900 whitespace-pre-wrap">{c.text}</div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-gray-600">No comments yet.</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
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
