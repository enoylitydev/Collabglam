"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { get, post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  User,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
} from "lucide-react";

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
  description?: string;
  status: DisputeStatus;
  campaignId?: string | null;
  campaignName?: string | null;
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

  const [pendingStatus, setPendingStatus] = useState<DisputeStatus | "">("");
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
      setError(
        e?.response?.data?.message || e?.message || "Failed to post comment"
      );
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
      setError(
        e?.response?.data?.message ||
          e?.message ||
          "Failed to update status"
      );
    } finally {
      setUpdating(false);
    }
  };

  const getStatusConfig = (s: DisputeStatus) => {
    const configs = {
      open: {
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-200",
        icon: AlertCircle,
      },
      in_review: {
        bg: "bg-purple-50",
        text: "text-purple-700",
        border: "border-purple-200",
        icon: Clock,
      },
      awaiting_user: {
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-200",
        icon: Clock,
      },
      resolved: {
        bg: "bg-green-50",
        text: "text-green-700",
        border: "border-green-200",
        icon: CheckCircle2,
      },
      rejected: {
        bg: "bg-red-50",
        text: "text-red-700",
        border: "border-red-200",
        icon: XCircle,
      },
    };
    return configs[s];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dispute details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Dispute
          </h2>
          <p className="text-red-600 mb-6">{error}</p>
          <Button variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!d) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Dispute not found</p>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(d.status);
  const StatusIcon = statusConfig.icon;
  const isFinalized = d.status === "resolved" || d.status === "rejected";

  const hasCampaign = Boolean(d.campaignId);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => router.push("/admin/disputes")}
            className="mb-4"
          >
            ← Back to Disputes
          </Button>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {d.subject}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Created {new Date(d.createdAt).toLocaleString()}
                  </span>
                  <span className="mx-1">•</span>
                  <span>
                    Updated {new Date(d.updatedAt).toLocaleString()}
                  </span>
                  <span className="mx-1">•</span>
                  <span className="font-mono text-xs">
                    Ticket ID: {d.disputeId}
                  </span>
                </div>
              </div>
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
              >
                <StatusIcon className="h-5 w-5" />
                <span className="font-semibold capitalize">
                  {d.status.replace("_", " ")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Party Information */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Brand */}
          <div
            onClick={() =>
              router.push(`/admin/brands/view?brandId=${d.brandId}`)
            }
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition"
          >
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 rounded-lg p-3">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Brand
                </h3>
                <p className="text-lg font-semibold text-gray-900 truncate">
                  {d.brandName || "Unknown Brand"}
                </p>
                <p className="text-xs text-gray-500 font-mono mt-1">
                  {d.brandId}
                </p>
              </div>
            </div>
          </div>

          {/* Influencer */}
          <div
            onClick={() =>
              router.push(
                `/admin/influencers/view?influencerId=${d.influencerId}`
              )
            }
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition"
          >
            <div className="flex items-start gap-3">
              <div className="bg-purple-100 rounded-lg p-3">
                <User className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Influencer
                </h3>
                <p className="text-lg font-semibold text-gray-900 truncate">
                  {d.influencerName || "Unknown Influencer"}
                </p>
                <p className="text-xs text-gray-500 font-mono mt-1">
                  {d.influencerId}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Campaign & Opened By */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Campaign */}
          <div
            className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${
              hasCampaign ? "cursor-pointer hover:shadow-md transition" : ""
            }`}
            onClick={() => {
              if (hasCampaign) {
                router.push(`/admin/campaigns/view?id=${d.campaignId}`);
              }
            }}
          >
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              Campaign
            </h3>

            {hasCampaign ? (
              <>
                <p className="text-lg font-semibold text-gray-900 truncate">
                  {d.campaignName || "Linked campaign"}
                </p>
                <p className="text-xs text-gray-500 font-mono mt-1">
                  {d.campaignId}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500">No campaign linked</p>
            )}
          </div>

          {/* Opened By */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              Dispute By
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                {d.createdBy?.role || "Unknown"}
              </span>
              {d.createdBy?.role === "Brand" && (
                <span className="text-sm text-gray-600">
                  • {d.brandName || d.brandId}
                </span>
              )}
              {d.createdBy?.role === "Influencer" && (
                <span className="text-sm text-gray-600">
                  • {d.influencerName || d.influencerId}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status Update */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-600" />
            Update Status
          </h2>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="md:w-56">
              <Select
                value={pendingStatus}
                onValueChange={(v) =>
                  setPendingStatus(v as DisputeStatus)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 shadow-lg">
                  {statusOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Input
                placeholder="Add a resolution note (optional)"
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
              />
            </div>
            <Button
              onClick={updateStatus}
              disabled={updating || !pendingStatus}
              className="md:w-32 bg-red-100 text-black hover:bg-red-700 border-red-200 hover:text-white"
            >
              {updating ? "Updating..." : "Update"}
            </Button>
          </div>
        </div>

        {/* Description */}
        {d.description && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Description
            </h2>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {d.description}
              </p>
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-gray-600" />
            Comments
            <span className="text-sm font-normal text-gray-500">
              ({d.comments?.length || 0})
            </span>
          </h2>

          {d.comments && d.comments.length > 0 ? (
            <div className="space-y-4 mb-6">
              {d.comments.map((c) => {
                const roleColors: Record<Comment["authorRole"], string> = {
                  Admin: "bg-red-100 text-red-700",
                  Brand: "bg-blue-100 text-blue-700",
                  Influencer: "bg-purple-100 text-purple-700",
                };
                return (
                  <div
                    key={c.commentId}
                    className="bg-gray-50 rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${roleColors[c.authorRole]}`}
                      >
                        {c.authorRole}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(c.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {c.text}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 mb-6">
              <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No comments yet</p>
            </div>
          )}

          {isFinalized ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600">
                This dispute has been {d.status}. Comments are no longer
                allowed.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                rows={4}
                placeholder="Write your comment here..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="resize-none"
              />
              <div className="flex justify-end">
                <Button
                  onClick={postComment}
                  disabled={posting || !comment.trim()}
                  className="min-w-32"
                >
                  {posting ? "Posting..." : "Post Comment"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
