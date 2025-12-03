"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { get, post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

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

type Dispute = {
  disputeId: string;
  subject: string;
  description: string;
  status: DisputeStatus;
  campaignId?: string | null;
  campaignName?: string | null;
  brandId: string;
  influencerId: string;
  assignedTo?: { adminId?: string | null; name?: string | null } | null;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
};

export default function InfluencerDisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [influencerId, setInfluencerId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Dispute | null>(null);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  // Guard + influencer id
  useEffect(() => {
    if (typeof window === "undefined") return;

    const userType = localStorage.getItem("userType");
    if (userType !== "influencer") {
      router.replace("/login");
      return;
    }

    const storedId = localStorage.getItem("influencerId");
    if (!storedId) {
      router.replace("/login");
      return;
    }

    setInfluencerId(storedId);
  }, [router]);

  const load = async () => {
    if (!id || !influencerId) return;
    setLoading(true);
    setError(null);
    try {
      // influencerGetById expects influencerId via query or body
      const data = await get<{ dispute: Dispute }>(
        `/dispute/influencer/${id}`,
        { influencerId }
      );
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
  }, [id, influencerId]);

  const postComment = async () => {
    if (!id || !comment.trim() || !influencerId) return;
    setPosting(true);
    try {
      await post(`/dispute/influencer/${id}/comment`, {
        text: comment.trim(),
        influencerId,
      });
      setComment("");
      await load();
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Failed to post comment"
      );
    } finally {
      setPosting(false);
    }
  };

  const statusTone = (s: DisputeStatus) =>
    ({
      open: "bg-blue-100 text-blue-800",
      in_review: "bg-purple-100 text-purple-800",
      awaiting_user: "bg-amber-100 text-amber-800",
      resolved: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
    }[s] || "bg-gray-100 text-gray-700");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <div>
          <p className="text-red-600">{error}</p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => router.back()}
          >
            Back
          </Button>
        </div>
      ) : !d ? (
        <p>Not found</p>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{d.subject}</h1>
              <p className="text-xs text-gray-500">
                Ticket ID: <span className="font-mono">{d.disputeId}</span>
              </p>
              {d.campaignName ? (
                <p className="text-gray-600 mt-1">
                  Campaign: <span className="font-medium">{d.campaignName}</span>
                </p>
              ) : (
                <p className="text-gray-600 mt-1">No campaign linked</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Opened: {new Date(d.createdAt).toLocaleString()} • Last update:{" "}
                {new Date(d.updatedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`px-2 py-1 rounded text-xs font-medium capitalize ${statusTone(
                  d.status
                )}`}
              >
                {d.status.replace("_", " ")}
              </span>
              {d.assignedTo?.name && (
                <p className="text-xs text-gray-600">
                  Assigned to:{" "}
                  <span className="font-medium">{d.assignedTo.name}</span>
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          {d.description && (
            <div className="bg-white rounded border p-4">
              <h2 className="font-medium mb-1">Description</h2>
              <p className="text-gray-800 whitespace-pre-wrap">
                {d.description}
              </p>
            </div>
          )}

          {/* Comments */}
          <div className="bg-white rounded border p-4">
            <h2 className="font-medium mb-3">Comments</h2>
            {d.comments?.length ? (
              <ul className="space-y-3">
                {d.comments.map((c) => (
                  <li
                    key={c.commentId}
                    className="border rounded p-3 bg-gray-50"
                  >
                    <div className="text-xs text-gray-600 mb-1 flex justify-between">
                      <span>
                        <span className="font-medium">{c.authorRole}</span>{" "}
                      </span>
                      <span>{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-gray-900 whitespace-pre-wrap">
                      {c.text}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-600">No comments yet.</p>
            )}

            {d.status === "resolved" || d.status === "rejected" ? (
              <p className="text-sm text-gray-500 mt-4">
                This dispute is finalized and can no longer receive comments.
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                <Textarea
                  rows={3}
                  placeholder="Write a comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setComment("")}
                    disabled={posting || !comment.trim()}
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={postComment}
                    className="bg-yellow-300"
                    disabled={posting || !comment.trim()}
                  >
                    {posting ? "Posting…" : "Post Comment"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
