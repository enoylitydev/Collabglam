"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { get, post, postFormData } from "@/lib/api";
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
  Paperclip,
  ChevronLeft,
  ChevronRight,
  X,
  Mail,
} from "lucide-react";

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

type Comment = {
  commentId: string;
  authorRole: "Admin" | "Brand" | "Influencer";
  authorId: string;
  text: string;
  createdAt: string;
  attachments?: Attachment[];
};

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
  brandEmail?: string | null;       // 👈 new
  influencerEmail?: string | null;  // 👈 new
  createdBy?: { id?: string; role?: "Brand" | "Influencer" };
  assignedTo?: { adminId?: string | null; name?: string | null } | null;
  comments?: Comment[];
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
};

// ---------- Image helpers ----------

const isImageAttachment = (a: Attachment): boolean => {
  if (a.mimeType && a.mimeType.startsWith("image/")) return true;
  const clean = (a.url || "").split("?")[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(clean);
};

type ImagePreviewState = {
  images: Attachment[];
  index: number;
} | null;

const ImagePreviewModal: React.FC<{
  state: ImagePreviewState;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}> = ({ state, onClose, onPrev, onNext }) => {
  if (!state || !state.images.length) return null;
  const { images, index } = state;
  const current = images[index];
  if (!current) return null;

  const label =
    current.originalName ||
    current.url.split("?")[0].split("/").pop() ||
    "Image";

  const handleBackdropClick = () => onClose();
  const handleContentClick: React.MouseEventHandler = (e) => {
    e.stopPropagation();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={handleBackdropClick}
    >
      <div
        className="relative z-10 max-w-5xl w-full px-4"
        onClick={handleContentClick}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2 text-xs text-gray-200">
          <div className="truncate max-w-xs">{label}</div>
          <div className="flex items-center gap-3">
            <span>
              {index + 1} / {images.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 hover:bg-black/80"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {/* Image area */}
        <div className="relative flex items-center justify-center rounded-lg bg-black/40 min-h-[280px] max-h-[80vh] overflow-hidden">
          {images.length > 1 && (
            <button
              type="button"
              onClick={onPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 hover:bg-black/80 disabled:opacity-40"
            >
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={label}
            className="max-h-[80vh] max-w-full object-contain"
          />

          {images.length > 1 && (
            <button
              type="button"
              onClick={onNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 hover:bg-black/80 disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const AttachmentPillList: React.FC<{
  attachments?: Attachment[];
  onImageClick?: (images: Attachment[], index: number) => void;
}> = ({ attachments, onImageClick }) => {
  if (!attachments || attachments.length === 0) return null;

  const images = attachments.filter(isImageAttachment);

  const handleImageClick = (att: Attachment) => {
    if (!onImageClick || !images.length) return;
    const idx = images.findIndex((img) => img.url === att.url);
    if (idx === -1) return;
    onImageClick(images, idx);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment, idx) => {
        const isImg = isImageAttachment(attachment);
        const label =
          attachment.originalName ||
          attachment.url.split("?")[0].split("/").pop() ||
          `Attachment ${idx + 1}`;

        if (isImg) {
          return (
            <button
              key={attachment.url || `${label}-${idx}`}
              type="button"
              onClick={() => handleImageClick(attachment)}
              className="inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] text-gray-700 bg-white hover:bg-gray-50"
            >
              <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={attachment.url}
                  alt={label}
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="truncate max-w-[140px]">{label}</span>
            </button>
          );
        }

        return (
          <a
            key={attachment.url || `${label}-${idx}`}
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border px-2 py-1 text-[11px] text-gray-700 bg-white hover:bg-gray-50"
          >
            <Paperclip className="h-3 w-3" />
            <span className="truncate max-w-[140px]">{label}</span>
          </a>
        );
      })}
    </div>
  );
};

// ---------- Main component ----------

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
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);

  const [pendingStatus, setPendingStatus] = useState<DisputeStatus | "">("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const [previewState, setPreviewState] = useState<ImagePreviewState>(null);

  const load = useCallback(async () => {
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
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    const tooBig = files.find((f) => f.size > maxSize);
    if (tooBig) {
      setError(`"${tooBig.name}" is larger than 10MB. Please upload a smaller file.`);
    }

    const safeFiles = files.filter((f) => f.size <= maxSize);
    setCommentFiles((prev) => [...prev, ...safeFiles]);
    e.target.value = "";
  };

  const removeCommentFile = (idx: number) => {
    setCommentFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const postComment = async () => {
    if (!id || (!comment.trim() && !commentFiles.length)) return;
    setPosting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("text", comment.trim());
      commentFiles.forEach((file) => {
        form.append("attachments", file);
      });

      await postFormData(`/dispute/admin/${id}/comment`, form);
      setComment("");
      setCommentFiles([]);
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
    setError(null);
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
    } as const;
    return configs[s];
  };

  const openPreview = (images: Attachment[], index: number) => {
    if (!images.length) return;
    setPreviewState({ images, index });
  };

  const closePreview = () => setPreviewState(null);

  const prevImage = () =>
    setPreviewState((prev) => {
      if (!prev || prev.images.length < 2) return prev;
      const nextIndex =
        (prev.index - 1 + prev.images.length) % prev.images.length;
      return { ...prev, index: nextIndex };
    });

  const nextImage = () =>
    setPreviewState((prev) => {
      if (!prev || prev.images.length < 2) return prev;
      const nextIndex = (prev.index + 1) % prev.images.length;
      return { ...prev, index: nextIndex };
    });

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

  if (error && !d) {
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

  const handleMailClick =
    (email: string | null | undefined) =>
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation(); // prevent card navigation
      if (!email) return;
      window.location.href = `mailto:${email}`;
    };

  return (
    <>
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

                  {/* Mail to Brand */}
                  {d.brandEmail && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-gray-500 truncate max-w-[180px]">
                        {d.brandEmail}
                      </span>
                      <button
                        type="button"
                        onClick={handleMailClick(d.brandEmail)}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] text-blue-700 hover:bg-blue-100"
                      >
                        <Mail className="h-3 w-3" />
                        <span>Email</span>
                      </button>
                    </div>
                  )}
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

                  {/* Mail to Influencer */}
                  {d.influencerEmail && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-gray-500 truncate max-w-[180px]">
                        {d.influencerEmail}
                      </span>
                      <button
                        type="button"
                        onClick={handleMailClick(d.influencerEmail)}
                        className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-1 text-[11px] text-purple-700 hover:bg-purple-100"
                      >
                        <Mail className="h-3 w-3" />
                        <span>Email</span>
                      </button>
                    </div>
                  )}
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
              {d.attachments && d.attachments.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Dispute Attachments
                  </h3>
                  <AttachmentPillList
                    attachments={d.attachments}
                    onImageClick={openPreview}
                  />
                </div>
              )}
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

            {error && d && (
              <p className="text-sm text-red-600 mb-3">{error}</p>
            )}

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
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${roleColors[c.authorRole]}`}
                          >
                            {c.authorRole}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(c.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {c.text}
                      </p>

                      {c.attachments && c.attachments.length > 0 && (
                        <div className="mt-3">
                          <AttachmentPillList
                            attachments={c.attachments}
                            onImageClick={openPreview}
                          />
                        </div>
                      )}
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

                {/* Attachments for admin comment */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-xs cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <Paperclip className="h-3 w-3" />
                      <span>Add attachments</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleCommentFileChange}
                      />
                    </label>
                    {commentFiles.length > 0 && (
                      <span className="text-[11px] text-gray-600">
                        {commentFiles.length} file
                        {commentFiles.length > 1 ? "s" : ""} selected
                      </span>
                    )}
                  </div>

                  {commentFiles.length > 0 && (
                    <ul className="space-y-1 text-[11px] text-gray-700">
                      {commentFiles.map((file, idx) => (
                        <li
                          key={`${file.name}-${idx}`}
                          className="flex items-center justify-between gap-2 border rounded px-2 py-1 bg-gray-50"
                        >
                          <span className="truncate max-w-xs">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeCommentFile(idx)}
                            className="text-gray-500 hover:text-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setComment("");
                      setCommentFiles([]);
                    }}
                    disabled={posting || (!comment.trim() && !commentFiles.length)}
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={postComment}
                    disabled={
                      posting || (!comment.trim() && !commentFiles.length)
                    }
                    className="min-w-32 bg-gray-800 hover:bg-gray-900 text-white"
                  >
                    {posting ? "Posting..." : "Post Comment"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image preview overlay */}
      <ImagePreviewModal
        state={previewState}
        onClose={closePreview}
        onPrev={prevImage}
        onNext={nextImage}
      />
    </>
  );
}
