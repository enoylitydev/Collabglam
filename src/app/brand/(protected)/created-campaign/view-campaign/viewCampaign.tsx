"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  HiOutlinePhotograph,
  HiOutlineCalendar,
  HiOutlineCurrencyDollar,
  HiOutlineDocument,
  HiChevronLeft,
  HiChevronRight,
  HiDownload,
  HiOutlineEye,
} from "react-icons/hi";
import { get } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface CampaignData {
  _id: string;
  campaignsId: string;
  brandName?: string;
  productOrServiceName: string;
  description: string;
  images: string[]; // GridFS filenames or absolute/relative URLs
  targetAudience: {
    age: { MinAge: number; MaxAge: number };
    gender: number; // 0=Female, 1=Male, 2=All
    locations: { countryId: string; countryName: string; _id?: string }[];
  };
  categories: {
    categoryId: string;
    categoryName: string;
    subcategoryId: string;
    subcategoryName: string;
  }[];
  goal: string;
  campaignType?: string; // ✅ NEW
  budget: number;
  timeline: { startDate?: string; endDate?: string };
  creativeBriefText?: string;
  creativeBrief: string[]; // GridFS filenames or URLs
  additionalNotes?: string;
  isActive: number;
  createdAt: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";

/** Normalize a stored filename or partial path into a fully-qualified URL. */
function fileUrl(v?: string) {
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v; // already absolute
  if (v.startsWith("/file/")) return `${API_BASE}${v}`; // API-relative path
  return `${API_BASE}/file/${encodeURIComponent(v)}`; // bare GridFS filename
}

const isPdf = (href: string) => /\.pdf(?:$|[?#])/i.test(href);

export default function ViewCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ===== Image preview state =====
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  // ===== Inline PDF preview state (inside card, not modal) =====
  const [pdfPreview, setPdfPreview] = useState<{ name: string; url: string } | null>(null);

  // Fetch campaign
  useEffect(() => {
    if (!id) {
      setError("No campaign ID provided.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await get<CampaignData>(`/campaign/id?id=${id}`);
        setCampaign(data);
      } catch (e) {
        console.error(e);
        setError("Failed to load campaign details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Normalize image list
  const campaignImages = useMemo(
    () => (campaign?.images || []).map(fileUrl).filter(Boolean),
    [campaign]
  );

  // Clamp preview index when images change
  useEffect(() => {
    if (previewIndex >= campaignImages.length) setPreviewIndex(0);
  }, [campaignImages.length, previewIndex]);

  const openPreview = useCallback((idx: number) => {
    setPreviewIndex(idx);
    setPreviewOpen(true);
  }, []);

  const closePreview = useCallback(() => setPreviewOpen(false), []);

  const prevImage = useCallback(() => {
    if (campaignImages.length < 2) return;
    setPreviewIndex((i) => (i - 1 + campaignImages.length) % campaignImages.length);
  }, [campaignImages.length]);

  const nextImage = useCallback(() => {
    if (campaignImages.length < 2) return;
    setPreviewIndex((i) => (i + 1) % campaignImages.length);
  }, [campaignImages.length]);

  // Keyboard navigation within image modal
  useEffect(() => {
    if (!isPreviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePreview();
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "ArrowRight") nextImage();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPreviewOpen, closePreview, prevImage, nextImage]);

  const currentImage = campaignImages[previewIndex] || "";

  // Touch swipe for mobile (image modal)
  useEffect(() => {
    if (!isPreviewOpen) return;
    let startX = 0;
    const onTouchStart = (e: TouchEvent) => (startX = e.touches[0].clientX);
    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) dx > 0 ? prevImage() : nextImage();
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [isPreviewOpen, prevImage, nextImage]);

  // Generic download (image/doc)
  const downloadFile = useCallback(async (src: string, filenameHint = "download") => {
    try {
      const res = await fetch(src, { credentials: "include" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameHint || src.split("/").pop() || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
      window.open(src, "_blank", "noopener,noreferrer");
    }
  }, []);

  // Open PDF inline (avoid auto-download): fetch -> blob -> object URL -> iframe
  const openPdfInline = useCallback(async (href: string) => {
    const name = decodeURIComponent(href.split("/").pop() || "document.pdf");
    try {
      const res = await fetch(href, { credentials: "include" });
      const blob = await res.blob();
      const typed = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
      setPdfPreview((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { name, url: URL.createObjectURL(typed) };
      });
    } catch (e) {
      console.error("Failed to preview PDF inline", e);
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }, []);

  const closePdfInline = useCallback(() => {
    setPdfPreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
    };
  }, [pdfPreview]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-pulse rounded-lg bg-gray-200 p-6 text-gray-500">Loading…</div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="rounded-lg bg-red-100 p-6 text-red-600">{error || "Campaign not found."}</p>
      </div>
    );
  }

  const c = campaign;
  const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : "—");

  return (
    <div className="min-h-full p-8 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between p-4 rounded-md">
        <h1 className="text-3xl font-bold text-gray-800">Campaign Details</h1>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            className="bg-white text-gray-800 hover:bg-gray-100"
            onClick={() => router.back()}
          >
            Back
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/brand/add-edit-campaign?id=${c.campaignsId}`)}
            className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF7236] hover:to-[#FFA135] shadow-none"
          >
            Edit
          </Button>
        </div>
      </header>

      {/* Product Info */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-medium">
            <HiOutlinePhotograph className="h-6 w-6 text-orange-500" />
            Detailed view of <span>{c.productOrServiceName}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {c.brandName && (
              <div>
                <p className="text-sm font-medium text-gray-600">Brand</p>
                <p className="mt-1 text-gray-800">{c.brandName}</p>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-gray-600">Name</p>
              <p className="mt-1 text-gray-800">{c.productOrServiceName}</p>
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <p className="text-sm font-medium text-gray-600">Description</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-gray-800">{c.description}</p>
            </div>

            {/* Images */}
            {Array.isArray(c.images) && c.images.length > 0 && (
              <div className="md:col-span-3">
                <p className="text-sm font-medium text-gray-600">Images</p>
                <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {c.images.map((val, i) => {
                    const src = fileUrl(val);
                    return (
                      <button
                        type="button"
                        key={`${val}-${i}`}
                        className="relative h-36 rounded-lg overflow-hidden border focus:outline-none focus:ring-2 focus:ring-orange-400"
                        onClick={() => openPreview(i)}
                        title="Click to preview"
                      >
                        <img
                          src={src}
                          alt={`${c.productOrServiceName} image ${i + 1}`}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Target Audience */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <HiOutlineCalendar className="h-6 w-6 text-orange-500" /> Target Audience
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-gray-600">Age</p>
              <p className="mt-1 text-gray-800">
                {c.targetAudience.age.MinAge}–{c.targetAudience.age.MaxAge}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Gender</p>
              <p className="mt-1 text-gray-800">
                {c.targetAudience.gender === 0 ? "Female" : c.targetAudience.gender === 1 ? "Male" : "All"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Locations</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {c.targetAudience.locations.map((loc) => (
                  <Badge key={loc.countryId} variant="outline" className="bg-orange-50 text-orange-700">
                    {loc.countryName}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Categories & Subcategories */}
            {!!c.categories?.length && (
              <div className="md:col-span-3">
                <p className="text-sm font-medium text-gray-600">Categories</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.categories.map((cat, idx) => (
                    <Badge
                      key={`${cat.subcategoryId}-${idx}`}
                      variant="outline"
                      className="bg-orange-50 text-orange-700"
                      title={`${cat.categoryName} → ${cat.subcategoryName}`}
                    >
                      {cat.categoryName}: {cat.subcategoryName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Campaign Details */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <HiOutlineCurrencyDollar className="h-6 w-6 text-orange-500" /> Campaign Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-600">Goal</p>
              <p className="mt-1 text-gray-800">{c.goal}</p>
            </div>

            {/* ✅ Campaign Type */}
            <div>
              <p className="text-sm font-medium text-gray-600">Campaign Type</p>
              <p className="mt-1 text-gray-800">
                {c.campaignType && c.campaignType.trim() !== "" ? c.campaignType : "—"}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-600">Budget</p>
              <p className="mt-1 text-gray-800">${Number(c.budget || 0).toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger>
                  <HiOutlineCalendar className="h-5 w-5 text-gray-500" />
                </TooltipTrigger>
                <TooltipContent>Start Date</TooltipContent>
              </Tooltip>
              <p className="text-gray-800">{fmtDate(c.timeline?.startDate)}</p>
            </div>
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger>
                  <HiOutlineCalendar className="h-5 w-5 text-gray-500" />
                </TooltipTrigger>
                <TooltipContent>End Date</TooltipContent>
              </Tooltip>
              <p className="text-gray-800">{fmtDate(c.timeline?.endDate)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Creative Brief & Notes (with inline PDF preview) */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <HiOutlineDocument className="h-6 w-6 text-orange-500" /> Creative Brief & Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {c.creativeBriefText && (
            <div>
              <p className="text-sm font-medium text-gray-600">Brief Text</p>
              <p className="whitespace-pre-wrap text-gray-800">{c.creativeBriefText}</p>
            </div>
          )}

          {!!c.creativeBrief?.length && (
            <div>
              <p className="text-sm font-medium text-gray-600">Files</p>
              <div className="grid grid-cols-1 gap-2">
                {c.creativeBrief.map((val, i) => {
                  const href = fileUrl(val);
                  const name = decodeURIComponent(href.split("/").pop() || "");
                  const pdf = isPdf(href);
                  return (
                    <div
                      key={`${val}-${i}`}
                      className="flex items-center justify-between rounded-lg border bg-orange-50 p-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <HiOutlineDocument className="h-5 w-5 text-orange-600" />
                        <span className="truncate text-sm font-medium text-orange-700">
                          {name || "document"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {pdf && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-white text-gray-800 hover:bg-gray-50"
                            onClick={() => openPdfInline(href)}
                            title="Preview inline"
                          >
                            <HiOutlineEye className="mr-1 h-4 w-4" />
                            Preview
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white text-gray-800 hover:bg-gray-50"
                          onClick={() => downloadFile(href, name || "document")}
                          title="Download"
                        >
                          <HiDownload className="mr-1 h-4 w-4" />
                          Download
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inline PDF viewer block */}
          {pdfPreview && (
            <div className="mt-4 rounded-lg border bg-white">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
                <div className="text-sm font-medium text-gray-800 truncate">{pdfPreview.name}</div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadFile(pdfPreview.url, pdfPreview.name)}
                  >
                    <HiDownload className="mr-1 h-4 w-4" />
                    Download
                  </Button>
                  <Button size="sm" variant="outline" onClick={closePdfInline}>
                    Close Preview
                  </Button>
                </div>
              </div>
              <div className="h-[75vh] w-full overflow-hidden">
                <iframe
                  src={`${pdfPreview.url}#zoom=page-width`}
                  title={pdfPreview.name}
                  className="h-full w-full"
                />
              </div>
            </div>
          )}

          {c.additionalNotes && (
            <>
              <hr className="border-1" />
              <div>
                <p className="text-xl font-medium text-gray-600">Additional Notes</p>
                <p className="whitespace-pre-wrap text-gray-800">{c.additionalNotes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ===== Image Preview Modal (Dialog) ===== */}
      <Dialog open={isPreviewOpen} onOpenChange={(o) => (o ? setPreviewOpen(true) : closePreview())}>
        <DialogContent
          className="
            sm:max-w-[1000px] max-w-[95vw]
            bg-transparent p-0 border-0 shadow-none
            data-[state=open]:animate-in data-[state=closed]:animate-out
          "
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Image preview</DialogTitle>
          </DialogHeader>

          {/* Preview body */}
          <div className="relative w-full">
            {/* Main image */}
            <div className="flex items-center justify-center">
              <img
                src={currentImage}
                alt={`Preview ${previewIndex + 1}`}
                className="max-h-[80vh] w-auto rounded-lg shadow-xl select-none object-contain"
                draggable={false}
              />
            </div>

            {/* Left/Right arrows */}
            {campaignImages.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                  aria-label="Previous image"
                >
                  <HiChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                  aria-label="Next image"
                >
                  <HiChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Top-left counter */}
            <div className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-gray-900 shadow">
              {previewIndex + 1} / {campaignImages.length || 1}
            </div>
          </div>

          {/* Filmstrip thumbnails */}
          {!!campaignImages.length && (
            <div className="mt-4 flex gap-2 overflow-x-auto px-2 pb-1">
              {campaignImages.map((src, idx) => (
                <button
                  key={src + idx}
                  onClick={() => setPreviewIndex(idx)}
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border ${
                    idx === previewIndex ? "ring-2 ring-orange-500 border-transparent" : "border-gray-200"
                  }`}
                  aria-label={`Open image ${idx + 1}`}
                >
                  <img src={src} alt={`thumb-${idx + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Footer actions */}
          <DialogFooter className="mt-4 flex w-full items-center justify-between gap-2">
            <div className="text-xs text-gray-300">
              {c.productOrServiceName}
              {campaignImages.length > 1 ? ` — image ${previewIndex + 1}` : ""}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="bg-white/95 text-gray-800 hover:bg-white"
                onClick={() =>
                  downloadFile(
                    currentImage,
                    (currentImage && decodeURIComponent(currentImage.split("/").pop() || "")) || "image"
                  )
                }
              >
                <HiDownload className="mr-2 h-4 w-4" />
                Download
              </Button>

              <Button
                type="button"
                variant="outline"
                className="bg-white/95 text-gray-800 hover:bg-white"
                onClick={closePreview}
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
