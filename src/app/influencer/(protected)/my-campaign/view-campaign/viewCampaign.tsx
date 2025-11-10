"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { post } from "@/lib/api";
import { resolveFileList } from "@/lib/files";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import Swal from "sweetalert2";

interface AudienceLocation {
  countryId: string;
  countryName: string;
  _id?: string;
}
interface CategoryItem {
  categoryId: string;        // ObjectId (string)
  categoryName: string;
  subcategoryId: string;     // UUID / string
  subcategoryName: string;
}
interface CampaignData {
  _id: string;
  productOrServiceName: string;
  description: string;
  images: string[];
  targetAudience: {
    age: { MinAge: number; MaxAge: number };
    gender: number; // 0=Female,1=Male,2=All
    locations?: AudienceLocation[];
  };
  categories?: CategoryItem[];
  goal: string;
  budget: number;
  timeline: { startDate?: string; endDate?: string };
  creativeBriefText?: string;
  creativeBrief?: string[];
  additionalNotes?: string;
  isActive: number;
  createdAt: string;
  campaignsId: string;
  hasApplied?: number;
  isApplied?: number;
}

const INFL_GRAD = "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58]";
const INFL_GRAD_HOVER = "hover:from-[#FFDB58] hover:to-[#FFBF00]";
const isPdf = (href: string) => /\.pdf(?:$|[?#])/i.test(href);

export default function ViewCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Image preview modal
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  // Inline PDF preview
  const [pdfPreview, setPdfPreview] = useState<{ name: string; url: string } | null>(null);

  useEffect(() => {
    if (!id) {
      setError("No campaign ID provided.");
      setLoading(false);
      return;
    }
    fetchCampaign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchCampaign = async () => {
    try {
      const data = await post<CampaignData>(`/campaign/checkApplied`, {
        campaignId: id,
        influencerId: localStorage.getItem("influencerId"),
      });
      setCampaign(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load campaign details.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    const influencerId = localStorage.getItem("influencerId");

    if (!influencerId) {
      return Swal.fire({
        icon: "warning",
        title: "Not Logged In",
        text: "Please log in to apply for this campaign.",
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      });
    }

    try {
      const result = await post<{ success: boolean; message: string }>(
        "/apply/campaign",
        { campaignId: campaign?.campaignsId, influencerId }
      );

      if (result.message === "Application recorded") {
        await Swal.fire({
          icon: "success",
          title: "Success",
          text: result.message,
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true,
        });
        fetchCampaign();
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text:
          err?.response?.data?.message ||
          "Failed to apply. Please try again later.",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });
    }
  };

  // Files
  const imageUrls = useMemo(
    () => resolveFileList(campaign?.images ?? []).filter(Boolean),
    [campaign?.images]
  );
  const creativeBriefUrls = useMemo(
    () => resolveFileList(campaign?.creativeBrief ?? []).filter(Boolean),
    [campaign?.creativeBrief]
  );

  // Modal navigation
  useEffect(() => {
    if (previewIndex >= imageUrls.length) setPreviewIndex(0);
  }, [imageUrls.length, previewIndex]);

  const openPreview = useCallback((idx: number) => {
    setPreviewIndex(idx);
    setPreviewOpen(true);
  }, []);
  const closePreview = useCallback(() => setPreviewOpen(false), []);
  const prevImage = useCallback(() => {
    if (imageUrls.length < 2) return;
    setPreviewIndex((i) => (i - 1 + imageUrls.length) % imageUrls.length);
  }, [imageUrls.length]);
  const nextImage = useCallback(() => {
    if (imageUrls.length < 2) return;
    setPreviewIndex((i) => (i + 1) % imageUrls.length);
  }, [imageUrls.length]);

  // Keyboard nav
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

  // Touch swipe
  useEffect(() => {
    if (!isPreviewOpen) return;
    let startX = 0;
    const onTouchStart = (e: TouchEvent) => (startX = e.touches[0].clientX);
    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) (dx > 0 ? prevImage() : nextImage());
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [isPreviewOpen, prevImage, nextImage]);

  // Download any file
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

  // Inline PDF open/close
  const openPdfInline = useCallback(async (href: string) => {
    const name = decodeURIComponent(href.split("/").pop() || "document.pdf");
    try {
      const res = await fetch(href, { credentials: "include" });
      const blob = await res.blob();
      const typed = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
      const url = URL.createObjectURL(typed);
      setPdfPreview((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { name, url };
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

  // Cleanup blob on unmount
  useEffect(() => {
    return () => {
      if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
    };
  }, [pdfPreview]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="animate-pulse rounded-lg bg-gray-200 p-6 text-gray-500">Loading…</div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <p className="rounded-lg bg-red-100 p-6 text-red-600">{error || "Campaign not found."}</p>
      </div>
    );
  }

  const c = campaign;
  const appliedFlag = (c.hasApplied ?? c.isApplied ?? 0) === 1;
  const currentImage = imageUrls[previewIndex] || "";

  return (
    <div className="min-h-screen p-8 bg-gray-50 text-gray-800 space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-gray-800">Campaign Details</h1>
        <p className="mt-1 text-gray-600">
          Detailed view of <span className="font-medium">{c.productOrServiceName}</span>.
        </p>

        <div className="flex justify-end items-center space-x-4 mt-4">
          <Button
            onClick={() => router.back()}
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400 transition"
          >
            Back
          </Button>

          {appliedFlag ? (
            <span className={`inline-block px-4 py-2 rounded-md text-gray-800 ${INFL_GRAD}`}>
              Already Applied
            </span>
          ) : (
            <Button
              onClick={handleApply}
              className={`inline-block px-4 py-2 rounded-md text-gray-800 ${INFL_GRAD} ${INFL_GRAD_HOVER} transition`}
            >
              Apply for Work
            </Button>
          )}
        </div>
      </header>

      {/* Product Info */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <HiOutlinePhotograph className="h-6 w-6 text-[#FFBF00]" /> Product Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-gray-600">Name</p>
              <p className="mt-1 text-gray-800">{c.productOrServiceName}</p>
            </div>
            <div className="md:col-span-2 lg:col-span-2">
              <p className="text-sm font-medium text-gray-600">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-gray-800">{c.description}</p>
            </div>

            {/* Images with modal preview */}
            {imageUrls.length > 0 && (
              <div className="md:col-span-3">
                <p className="text-sm font-medium text-gray-600">Images</p>
                <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {imageUrls.map((url, i) => (
                    <button
                      type="button"
                      key={i}
                      className="relative h-36 rounded-lg overflow-hidden border focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      onClick={() => openPreview(i)}
                      title="Click to preview"
                    >
                      <img
                        src={url}
                        alt={`img-${i + 1}`}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </button>
                  ))}
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
            <HiOutlineCalendar className="h-6 w-6 text-[#FFBF00]" /> Target Audience
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-gray-600">Age</p>
              <p className="mt-1 text-gray-800">
                {c.targetAudience?.age?.MinAge ?? 0}–{c.targetAudience?.age?.MaxAge ?? 0}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Gender</p>
              <p className="mt-1 text-gray-800">
                {c.targetAudience?.gender === 0 ? "Female" : c.targetAudience?.gender === 1 ? "Male" : "All"}
              </p>
            </div>

            {/* Locations */}
            <div className="md:col-span-3">
              <p className="text-sm font-medium text-gray-600">Locations</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {(c.targetAudience?.locations ?? []).length > 0 ? (
                  (c.targetAudience?.locations ?? []).map((loc) => (
                    <Badge key={loc.countryId} variant="outline" className={`text-gray-800 ${INFL_GRAD}`}>
                      {loc.countryName}
                    </Badge>
                  ))
                ) : (
                  <span className="text-gray-700">—</span>
                )}
              </div>
            </div>

            {/* Categories */}
            <div className="md:col-span-3">
              <p className="text-sm font-medium text-gray-600">Categories</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(c.categories ?? []).length > 0 ? (
                  (c.categories ?? []).map((cat, idx) => (
                    <Badge
                      key={`${cat.subcategoryId}-${idx}`}
                      variant="default"
                      className={`text-gray-800 ${INFL_GRAD}`}
                    >
                      {cat.categoryName} • {cat.subcategoryName}
                    </Badge>
                  ))
                ) : (
                  <span className="text-gray-700">—</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Details */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <HiOutlineCurrencyDollar className="h-6 w-6 text-[#FFBF00]" /> Campaign Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-600">Goal</p>
              <p className="mt-1 text-gray-800">{c.goal}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Budget</p>
              <p className="mt-1 text-gray-800">${Number(c.budget || 0).toLocaleString()}</p>
            </div>

            {c.timeline?.startDate && (
              <div>
                <p className="text-sm font-medium text-gray-600">Start Date</p>
                <div className="mt-1 flex items-center gap-2">
                  <HiOutlineCalendar className="h-5 w-5 text-[#FFBF00]" />
                  <span className="text-gray-800">
                    {new Date(c.timeline.startDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}

            {c.timeline?.endDate && (
              <div>
                <p className="text-sm font-medium text-gray-600">End Date</p>
                <div className="mt-1 flex items-center gap-2">
                  <HiOutlineCalendar className="h-5 w-5 text-[#FFBF00]" />
                  <span className="text-gray-800">
                    {new Date(c.timeline.endDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Creative Brief & Notes (inline PDF preview + download) */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <HiOutlineDocument className="h-6 w-6 text-[#FFBF00]" /> Creative Brief & Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {c.creativeBriefText && (
            <div>
              <p className="text-sm font-medium text-gray-600">Brief Text</p>
              <p className="whitespace-pre-wrap text-gray-800">{c.creativeBriefText}</p>
            </div>
          )}

          {creativeBriefUrls.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-600">Files</p>
              <div className="grid grid-cols-1 gap-2">
                {creativeBriefUrls.map((href, i) => {
                  const name = decodeURIComponent(href.split("/").pop() || "");
                  const pdf = isPdf(href);
                  return (
                    <div
                      key={`${href}-${i}`}
                      className="flex items-center justify-between rounded-lg border bg-yellow-50 p-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <HiOutlineDocument className="h-5 w-5 text-yellow-700" />
                        <span className="truncate text-sm font-medium text-yellow-800">{name || "document"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {pdf && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-white text-gray-800 hover:bg-gray-50"
                            onClick={() => openPdfInline(href)}
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

          {/* Inline PDF viewer */}
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

      {/* ===== Image Preview Modal ===== */}
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

          <div className="relative w-full">
            <div className="flex items-center justify-center">
              <img
                src={currentImage}
                alt={`Preview ${previewIndex + 1}`}
                className="max-h-[80vh] w-auto rounded-lg shadow-xl select-none object-contain"
                draggable={false}
              />
            </div>

            {imageUrls.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  aria-label="Previous image"
                >
                  <HiChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  aria-label="Next image"
                >
                  <HiChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            <div className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-gray-900 shadow">
              {previewIndex + 1} / {imageUrls.length || 1}
            </div>
          </div>

          {!!imageUrls.length && (
            <div className="mt-4 flex gap-2 overflow-x-auto px-2 pb-1">
              {imageUrls.map((src, idx) => (
                <button
                  key={src + idx}
                  onClick={() => setPreviewIndex(idx)}
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border ${
                    idx === previewIndex ? "ring-2 ring-yellow-500 border-transparent" : "border-gray-200"
                  }`}
                  aria-label={`Open image ${idx + 1}`}
                >
                  <img src={src} alt={`thumb-${idx + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <DialogFooter className="mt-4 flex w-full items-center justify-between gap-2">
            <div className="text-xs text-gray-300">
              {c.productOrServiceName}
              {imageUrls.length > 1 ? ` — image ${previewIndex + 1}` : ""}
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
