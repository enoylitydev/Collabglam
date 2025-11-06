"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { get, post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  campaignId?: string | null;
  brandId: string;
  influencerId: string;
  brandName?: string | null;
  influencerName?: string | null;
  createdBy?: { id?: string; role?: "Brand" | "Influencer" };
  assignedTo?: { adminId?: string | null; name?: string | null } | null;
  comments?: Comment[];
  createdAt: string;
  updatedAt: string;
};

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "in_review", label: "In Review" },
  { value: "awaiting_user", label: "Awaiting User" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
];

export default function AdminDisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Dispute | null>(null);

  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  const [pendingStatus, setPendingStatus] = useState<Dispute["status"] | "">("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await get<{ dispute: Dispute }>(`/dispute/admin/${id}`);
      setD(data.dispute);
    } catch (e: any) {
      setError(e?.message || "Failed to load dispute");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const postComment = async () => {
    if (!id || !comment.trim()) return;
    setPosting(true);
    try {
      await post(`/dispute/admin/${id}/comment`, { text: comment.trim() });
      setComment("");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to post comment");
    } finally {
      setPosting(false);
    }
  };

  const updateStatus = async () => {
    if (!id || !pendingStatus) return;
    setUpdating(true);
    try {
      await post("/dispute/admin/update-status", {
        disputeId: id,
        status: pendingStatus,
        resolution: resolutionNote || undefined,
      });
      setResolutionNote("");
      setPendingStatus("");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const statusTone = (s: Dispute["status"]) => ({
    open: "bg-blue-100 text-blue-800",
    in_review: "bg-purple-100 text-purple-800",
    awaiting_user: "bg-amber-100 text-amber-800",
    resolved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  }[s]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <div>
          <p className="text-red-600">{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => router.back()}>Back</Button>
        </div>
      ) : !d ? (
        <p>Not found</p>
      ) : (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold truncate">{d.subject}</h1>
              <div className="text-gray-600 mt-1 space-x-3 text-sm">
                <span>Campaign: <span className="font-mono text-xs">{d.campaignId || '—'}</span></span>
                <span>Brand: <span>{d.brandName || <span className="font-mono text-xs">{d.brandId}</span>}</span></span>
                <span>Influencer: <span>{d.influencerName || <span className="font-mono text-xs">{d.influencerId}</span>}</span></span>
                <span>Assigned: <span className="font-mono text-xs">{d.assignedTo?.name || d.assignedTo?.adminId || '—'}</span></span>
                <span>
                  Opened by: <span className="font-mono text-xs">
                    {d.createdBy?.role
                      ? `${d.createdBy.role}${
                          d.createdBy.role === 'Brand'
                            ? ` · ${(d.brandName || d.brandId || '—')}`
                            : d.createdBy.role === 'Influencer'
                              ? ` · ${(d.influencerName || d.influencerId || '—')}`
                              : ''
                        }`
                      : '—'}
                  </span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`px-2 py-1 rounded text-xs font-medium ${statusTone(d.status)}`}>{d.status.replace("_", " ")}</span>
            </div>
          </div>

          <div className="bg-white rounded border p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-3">
              <div className="w-48">
                <Select value={pendingStatus} onValueChange={(v) => setPendingStatus(v as Dispute["status"]) }>
                  <SelectTrigger className="!bg-white">
                    <SelectValue placeholder="Set status" />
                  </SelectTrigger>
                  <SelectContent className="!bg-white">
                    {statusOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Input
                  placeholder="Resolution note (optional)"
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                />
              </div>
              <Button onClick={updateStatus} disabled={updating || !pendingStatus}>Update</Button>
            </div>
          </div>

          {d.description && (
            <div className="bg-white rounded border p-4">
              <h2 className="font-medium mb-1">Description</h2>
              <p className="text-gray-800 whitespace-pre-wrap">{d.description}</p>
            </div>
          )}

          <div className="bg-white rounded border p-4">
            <h2 className="font-medium mb-3">Comments</h2>
            {d.comments && d.comments.length ? (
              <ul className="space-y-3">
                {d.comments.map((c) => (
                  <li key={c.commentId} className="border rounded p-3 bg-gray-50">
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

            {d.status === "resolved" || d.status === "rejected" ? (
              <p className="text-sm text-gray-500 mt-4">This dispute is finalized and can no longer receive comments.</p>
            ) : (
              <div className="mt-4 space-y-2">
                <Textarea rows={3} placeholder="Write a comment" value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="flex justify-end">
                  <Button onClick={postComment} disabled={posting || !comment.trim()}>Post Comment</Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push("/admin/disputes")}>Back to list</Button>
          </div>
        </div>
      )}
    </div>
  );
}
