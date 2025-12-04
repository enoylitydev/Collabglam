"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { get, postFormData } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Paperclip, X, ChevronLeft, ChevronRight } from "lucide-react";

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

type DisputeStatus =
  | "open"
  | "in_review"
  | "awaiting_user"
  | "resolved"
  | "rejected";

type Role = "Admin" | "Brand" | "Influencer";

type DisputeParty = {
  role: "Brand" | "Influencer";
  id: string;
  name?: string | null;
};

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
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;

  raisedByRole?: Role | null;
  raisedById?: string | null;
  raisedBy?: DisputeParty | null;
  raisedAgainst?: DisputeParty | null;
  viewerIsRaiser?: boolean;
};

const statusTone = (s: DisputeStatus) =>
  ({
    open: "bg-blue-100 text-blue-800",
    in_review: "bg-purple-100 text-purple-800",
    awaiting_user: "bg-amber-100 text-amber-800",
    resolved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
  }[s] || "bg-gray-100 text-gray-700");

// --------------- Direction label (brand perspective) -----------------

const getDirectionLabel = (d: Dispute | null): string => {
  if (!d) return "";

  const viewerIsRaiser =
    typeof d.viewerIsRaiser === "boolean"
      ? d.viewerIsRaiser
      : d.raisedByRole === "Brand";

  const otherNameFromAgainst =
    d.raisedAgainst?.name ||
    (d.raisedAgainst?.role === "Influencer"
      ? "this influencer"
      : d.raisedAgainst?.role === "Brand"
      ? "this brand"
      : "the other party");

  const otherNameFromBy =
    d.raisedBy?.name ||
    (d.raisedBy?.role === "Influencer"
      ? "this influencer"
      : d.raisedBy?.role === "Brand"
      ? "this brand"
      : "the other party");

  if (viewerIsRaiser) {
    return `You raised this dispute against ${otherNameFromAgainst}`;
  } else {
    return `${otherNameFromBy} raised this dispute against you`;
  }
};

// ---------------------- Image helpers ----------------------

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

// Attachment chip/pill list with image click → lightbox
const AttachmentPillList: React.FC<{
  attachments?: Attachment[];
  onImageClick?: (images: Attachment[], index: number) => void;
}> = ({ attachments, onImageClick }) => {
  if (!attachments || attachments.length === 0) return null;

  const images = attachments.filter(isImageAttachment);

  const handleImageClick = (attachment: Attachment) => {
    if (!onImageClick || !images.length) return;
    const idx = images.findIndex((img) => img.url === attachment.url);
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

// ---------------------- Page Component ----------------------

export default function BrandDisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [brandId, setBrandId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [d, setD] = useState<Dispute | null>(null);
  const [comment, setComment] = useState("");
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);

  const [previewState, setPreviewState] = useState<ImagePreviewState>(null);

  // Load brandId from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("brandId");
    setBrandId(stored);
    if (!stored) {
      setError("Missing brand id (not logged in as brand?)");
    }
  }, []);

  const load = useCallback(async () => {
    if (!id || !brandId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await get<{ dispute: Dispute }>(`/dispute/brand/${id}`, {
        brandId,
      });
      setD(data.dispute);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to load dispute");
    } finally {
      setLoading(false);
    }
  }, [id, brandId]);

  useEffect(() => {
    if (!id || !brandId) return;
    load();
  }, [load, id, brandId]);

  const handleCommentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const maxSize = 10 * 1024 * 1024;
    const tooBig = files.find((f) => f.size > maxSize);
    if (tooBig) {
      setError(`"${tooBig.name}" is larger than 10MB. Please upload a smaller file.`);
    }

    const safeFiles = files.filter((f) => f.size <= maxSize);
    setCommentFiles((prev) => [...prev, ...safeFiles]);
    e.target.value = "";
  };

  const removeCommentFile = (index: number) => {
    setCommentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const postComment = async () => {
    if (!id || (!comment.trim() && !commentFiles.length) || !brandId) return;
    setPosting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("brandId", brandId);
      form.append("text", comment.trim());
      commentFiles.forEach((file) => {
        form.append("attachments", file);
      });

      await postFormData(`/dispute/brand/${id}/comment`, form);
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

  const directionLabel = getDirectionLabel(d);

  const raisedByChip =
    d?.raisedBy &&
    `${d.raisedBy.role === "Brand" ? "Brand" : "Influencer"}${
      d.raisedBy.name ? ` • ${d.raisedBy.name}` : ""
    }`;

  const raisedAgainstChip =
    d?.raisedAgainst &&
    `${d.raisedAgainst.role === "Brand" ? "Brand" : "Influencer"}${
      d.raisedAgainst.name ? ` • ${d.raisedAgainst.name}` : ""
    }`;

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

  return (
    <>
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        {/* Back */}
        <Button
          variant="outline"
          className="px-3 flex items-center gap-2 text-sm text-gray-700 bg-gray-200 hover:bg-gray-300"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold">{d.subject}</h1>
                <p className="text-xs text-gray-500">
                  Ticket ID: <span className="font-mono">{d.disputeId}</span>
                </p>

                {directionLabel && (
                  <p className="text-xs text-gray-600 mt-1">{directionLabel}</p>
                )}

                {/* Raised by / against chips */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {raisedByChip && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                      <span className="font-semibold mr-1">Raised by:</span>{" "}
                      {raisedByChip}
                    </span>
                  )}
                  {raisedAgainstChip && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                      <span className="font-semibold mr-1">Against:</span>{" "}
                      {raisedAgainstChip}
                    </span>
                  )}
                </div>

                {d.campaignName ? (
                  <p className="text-gray-600 mt-2">
                    Campaign:{" "}
                    <span className="font-medium">{d.campaignName}</span>
                  </p>
                ) : (
                  <p className="text-gray-600 mt-2">No campaign linked</p>
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

            {/* Dispute-level Attachments */}
            {d.attachments && d.attachments.length > 0 && (
              <div className="bg-white rounded border p-4">
                <h2 className="font-medium mb-2">Attachments</h2>
                <AttachmentPillList
                  attachments={d.attachments}
                  onImageClick={openPreview}
                />
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

                      {c.attachments && c.attachments.length > 0 && (
                        <div className="mt-2">
                          <AttachmentPillList
                            attachments={c.attachments}
                            onImageClick={openPreview}
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600 text-sm">No comments yet.</p>
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

                  {/* Comment attachments */}
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
                      disabled={
                        posting || (!comment.trim() && !commentFiles.length)
                      }
                    >
                      Clear
                    </Button>
                    <Button
                      onClick={postComment}
                      className="bg-orange-300 text-white hover:bg-orange-400"
                      disabled={
                        posting ||
                        (!comment.trim() && !commentFiles.length) ||
                        !brandId
                      }
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
