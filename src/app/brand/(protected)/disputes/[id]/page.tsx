"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { get, post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  description: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_review" | "awaiting_user" | "resolved" | "rejected";
  campaignId?: string | null;
  brandId: string;
  influencerId: string;
  assignedTo?: { adminId?: string | null; name?: string | null } | null;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
};

export default function BrandDisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Dispute | null>(null);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await get<{ dispute: Dispute }>(`/dispute/${id}`);
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
      await post(`/dispute/${id}/comment`, { text: comment.trim() });
      setComment("");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to post comment");
    } finally {
      setPosting(false);
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
    <div className="p-6 max-w-4xl mx-auto">
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{d.subject}</h1>
              {d.campaignId ? (
                <p className="text-gray-600">Campaign: <span className="font-mono text-xs">{d.campaignId}</span></p>
              ) : (
                <p className="text-gray-600">No campaign linked</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={d.priority === "high" ? "destructive" : d.priority === "low" ? "secondary" : "default"}>{d.priority}</Badge>
              <span className={`px-2 py-1 rounded text-xs font-medium ${statusTone(d.status)}`}>{d.status.replace("_", " ")}</span>
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
            {d.comments?.length ? (
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
        </div>
      )}
    </div>
  );
}
