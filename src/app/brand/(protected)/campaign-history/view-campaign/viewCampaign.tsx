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
import { resolveFileList } from "@/lib/files";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CampaignLocation {
  countryId: string;
  countryName: string;
}

interface CampaignCategory {
  categoryId: number;
  categoryName: string;
  subcategoryId: string;
  subcategoryName: string;
}

interface CampaignData {
  _id: string;
  brandId?: string;
  brandName?: string;

  productOrServiceName: string;
  description: string;
  images: string[];

  targetAudience: {
    age: { MinAge: number; MaxAge: number };
    gender: 0 | 1 | 2;
    locations?: CampaignLocation[];
  };

  categories?: CampaignCategory[];

  goal: string;
  campaignType?: string;
  budget: number;
  timeline: { startDate: string; endDate: string };

  creativeBriefText?: string;
  creativeBrief: string[];

  additionalNotes?: string;
  isActive: number;
  createdAt: string;

  isDraft?: number;
  applicantCount?: number;
  hasApplied?: number;
}

const TABLE_GRADIENT_FROM = "#FFA135";
const TABLE_GRADIENT_TO = "#FF7236";

const isPdf = (href: string) => /\.pdf(?:$|[?#])/i.test(href);

function formatDate(d?: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(dt);
}

function formatMoney(n?: number) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function StatusPill({ isActive }: { isActive: number }) {
  const active = isActive === 1;
  return (
    <span
      className={[
        "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full",
        active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800",
      ].join(" ")}
    >
      {active ? "Active" : "Completed"}
    </span>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <CardTitle className="flex items-center gap-2 text-xl font-semibold text-gray-900">
      <span className="text-orange-500">{icon}</span>
      <span>{title}</span>
      {subtitle ? <span className="text-sm font-medium text-gray-500">— {subtitle}</span> : null}
    </CardTitle>
  );
}

export default function ViewCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ===== Image preview modal =====
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  // ===== PDF preview modal =====
  const [pdfPreview, setPdfPreview] = useState<{ name: string; url: string; srcHref: string } | null>(null);

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

  const imageUrls = useMemo(() => resolveFileList(campaign?.images ?? []).filter(Boolean), [campaign?.images]);
  const creativeBriefUrls = useMemo(
    () => resolveFileList(campaign?.creativeBrief ?? []).filter(Boolean),
    [campaign?.creativeBrief]
  );

  // Clamp preview index when images change
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

  // Keyboard navigation in image modal
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

  // Touch swipe in image modal
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

  // PDF modal open/close
  const openPdfPreview = useCallback(async (href: string) => {
    const name = decodeURIComponent(href.split("/").pop() || "document.pdf");
    try {
      const res = await fetch(href, { credentials: "include" });
      const blob = await res.blob();
      const typed = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
      const url = URL.createObjectURL(typed);

      setPdfPreview((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { name, url, srcHref: href };
      });
    } catch (e) {
      console.error("Failed to preview PDF", e);
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }, []);

  const closePdfPreview = useCallback(() => {
    setPdfPreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
    };
  }, [pdfPreview]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="animate-pulse rounded-2xl bg-white shadow p-8 text-gray-600">Loading…</div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <p className="rounded-2xl bg-red-50 border border-red-100 p-6 text-red-600">{error || "Campaign not found."}</p>
      </div>
    );
  }

  const c = campaign;
  const locations = c.targetAudience.locations ?? [];
  const categories = c.categories ?? [];
  const currentImage = imageUrls[previewIndex] || "";

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Campaign Details</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">{c.productOrServiceName}</span>
              <span className="text-gray-300">•</span>
              <span>Created: {formatDate(c.createdAt)}</span>
              <span className="text-gray-300">•</span>
              <StatusPill isActive={c.isActive} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="bg-white text-gray-900 border-gray-200 hover:bg-gray-50"
              onClick={() => router.back()}
            >
              Back
            </Button>
          </div>
        </header>

        {/* Overview */}
        <Card className="bg-white rounded-2xl shadow-sm">
          <CardHeader>
            <SectionTitle
              icon={<HiOutlineCurrencyDollar className="h-6 w-6" />}
              title="Overview"
              subtitle={c.brandName ? `Brand: ${c.brandName}` : undefined}
            />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-gray-100 p-4 bg-white">
                <div className="text-xs font-semibold text-gray-500">Goal</div>
                <div className="mt-1 text-gray-900 font-semibold">{c.goal || "—"}</div>
              </div>

              <div className="rounded-xl border border-gray-100 p-4 bg-white">
                <div className="text-xs font-semibold text-gray-500">Budget</div>
                <div className="mt-1 text-gray-900 font-semibold">{formatMoney(c.budget)}</div>
              </div>

              <div className="rounded-xl border border-gray-100 p-4 bg-white">
                <div className="text-xs font-semibold text-gray-500">Start Date</div>
                <div className="mt-1 text-gray-900 font-semibold flex items-center gap-2">
                  <HiOutlineCalendar className="h-5 w-5 text-gray-400" />
                  {formatDate(c.timeline?.startDate)}
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 p-4 bg-white">
                <div className="text-xs font-semibold text-gray-500">End Date</div>
                <div className="mt-1 text-gray-900 font-semibold flex items-center gap-2">
                  <HiOutlineCalendar className="h-5 w-5 text-gray-400" />
                  {formatDate(c.timeline?.endDate)}
                </div>
              </div>
            </div>

            {!!c.campaignType && (
              <div className="mt-4">
                <span className="text-xs font-semibold text-gray-500">Campaign Type</span>
                <div className="mt-1 text-sm text-gray-900">{c.campaignType}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Info */}
        <Card className="bg-white rounded-2xl shadow-sm">
          <CardHeader>
            <SectionTitle
              icon={<HiOutlinePhotograph className="h-6 w-6" />}
              title="Product & Description"
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="md:col-span-1 rounded-xl border border-gray-100 p-4">
                <div className="text-xs font-semibold text-gray-500">Name</div>
                <div className="mt-1 text-gray-900 font-semibold">{c.productOrServiceName}</div>
              </div>

              <div className="md:col-span-2 rounded-xl border border-gray-100 p-4">
                <div className="text-xs font-semibold text-gray-500">Description</div>
                <div className="mt-1 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {c.description || "—"}
                </div>
              </div>
            </div>

            {/* Images */}
            <div>
              <div className="text-sm font-semibold text-gray-900">Images</div>
              <div className="text-xs text-gray-500 mt-1">
                {imageUrls.length ? "" : "No images uploaded."}
              </div>

              {imageUrls.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {imageUrls.map((url, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => openPreview(i)}
                      className="group relative h-40 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      aria-label={`Preview image ${i + 1}`}
                    >
                      <img
                        src={url}
                        alt={`img-${i + 1}`}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
                      <div className="absolute bottom-2 left-2 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-gray-900">
                        <HiOutlineEye className="h-4 w-4" />
                        Preview
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Target Audience */}
        <Card className="bg-white rounded-2xl shadow-sm">
          <CardHeader>
            <SectionTitle icon={<HiOutlineCalendar className="h-6 w-6" />} title="Target Audience" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-gray-100 p-4">
                <div className="text-xs font-semibold text-gray-500">Age</div>
                <div className="mt-1 font-semibold text-gray-900">
                  {c.targetAudience.age.MinAge}–{c.targetAudience.age.MaxAge}
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 p-4">
                <div className="text-xs font-semibold text-gray-500">Gender</div>
                <div className="mt-1 font-semibold text-gray-900">
                  {c.targetAudience.gender === 0 ? "Female" : c.targetAudience.gender === 1 ? "Male" : "All"}
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 p-4">
                <div className="text-xs font-semibold text-gray-500">Locations</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {locations.length > 0 ? (
                    locations.map((loc) => (
                      <Badge key={loc.countryId} variant="outline" className="bg-orange-50 text-orange-700 border-orange-100">
                        {loc.countryName}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">No locations specified</span>
                  )}
                </div>
              </div>
            </div>

            {categories.length > 0 && (
              <div className="mt-4 rounded-xl border border-gray-100 p-4">
                <div className="text-xs font-semibold text-gray-500">Categories</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <Badge key={cat.subcategoryId} variant="outline" className="bg-orange-50 text-orange-700 border-orange-100">
                      {cat.categoryName} — {cat.subcategoryName}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Creative Brief & Notes */}
        <Card className="bg-white rounded-2xl shadow-sm">
          <CardHeader>
            <SectionTitle icon={<HiOutlineDocument className="h-6 w-6" />} title="Creative Brief & Notes" />
          </CardHeader>
          <CardContent className="space-y-4">
            {c.creativeBriefText && (
              <div className="rounded-xl border border-gray-100 p-4">
                <div className="text-xs font-semibold text-gray-500">Brief Text</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                  {c.creativeBriefText}
                </div>
              </div>
            )}

            {creativeBriefUrls.length > 0 && (
              <div className="rounded-xl border border-gray-100 p-4">
                <div className="text-sm font-semibold text-gray-900">Files</div>
                <div className="mt-3 space-y-2">
                  {creativeBriefUrls.map((href, i) => {
                    const name = decodeURIComponent(href.split("/").pop() || "");
                    const pdf = isPdf(href);

                    return (
                      <div
                        key={`${href}-${i}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3"
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <div
                            className="h-10 w-10 rounded-xl flex items-center justify-center text-white"
                            style={{
                              backgroundImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO})`,
                            }}
                          >
                            <HiOutlineDocument className="h-5 w-5" />
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-gray-900">
                              {name || "document"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {pdf ? "PDF document" : "File"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {pdf && (
                            <button
                              type="button"
                              onClick={() => openPdfPreview(href)}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white text-black border border-gray-200 hover:bg-gray-50"
                            >
                              <HiOutlineEye size={18} />
                              Preview
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => downloadFile(href, name || "document")}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white text-black border border-gray-200 hover:bg-gray-50"
                          >
                            <HiDownload size={18} />
                            Download
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {c.additionalNotes && c.additionalNotes.trim() !== "" && (
              <div className="rounded-xl border border-gray-100 p-4">
                <div className="text-sm font-semibold text-gray-900">Additional Notes</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                  {c.additionalNotes}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ===== Image Preview Modal (Improved UI) ===== */}
      <Dialog open={isPreviewOpen} onOpenChange={(o) => (o ? setPreviewOpen(true) : closePreview())}>
        <DialogContent className="sm:max-w-[1100px] max-w-[95vw] p-0 overflow-hidden border-0 bg-black">
          <DialogHeader className="px-4 py-3 bg-black/70">
            <DialogTitle className="flex items-center justify-between gap-3 text-white">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{c.productOrServiceName}</div>
                <div className="text-xs text-white/70">
                  {previewIndex + 1} / {imageUrls.length || 1}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white/95 text-gray-900 border-white/20 hover:bg-white"
                  onClick={() =>
                    downloadFile(
                      currentImage,
                      (currentImage && decodeURIComponent(currentImage.split("/").pop() || "")) || "image"
                    )
                  }
                  disabled={!currentImage}
                >
                  <HiDownload className="mr-2 h-4 w-4" />
                  Download
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="bg-white/95 text-gray-900 border-white/20 hover:bg-white"
                  onClick={closePreview}
                >
                  Close
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="relative">
            <div className="flex items-center justify-center p-4">
              <img
                src={currentImage}
                alt={`Preview ${previewIndex + 1}`}
                className="max-h-[75vh] w-auto rounded-xl shadow-2xl select-none object-contain"
                draggable={false}
              />
            </div>

            {imageUrls.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow hover:bg-white focus:outline-none"
                  aria-label="Previous image"
                >
                  <HiChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow hover:bg-white focus:outline-none"
                  aria-label="Next image"
                >
                  <HiChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>

          {!!imageUrls.length && (
            <div className="bg-black/80 px-3 py-3 border-t border-white/10">
              <div className="flex gap-2 overflow-x-auto">
                {imageUrls.map((src, idx) => (
                  <button
                    key={src + idx}
                    onClick={() => setPreviewIndex(idx)}
                    className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border ${
                      idx === previewIndex ? "border-transparent ring-2 ring-orange-500" : "border-white/15"
                    }`}
                    aria-label={`Open image ${idx + 1}`}
                  >
                    <img src={src} alt={`thumb-${idx + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== PDF Preview Modal (Improved UI) ===== */}
      <Dialog open={!!pdfPreview} onOpenChange={(o) => (!o ? closePdfPreview() : null)}>
        <DialogContent className="sm:max-w-[1100px] max-w-[95vw] p-0 overflow-hidden bg-white">
          <DialogHeader
            className="px-4 py-3 text-white"
            style={{
              backgroundImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO})`,
            }}
          >
            <DialogTitle className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{pdfPreview?.name || "PDF Preview"}</div>
                <div className="text-xs text-white/80">Inline preview</div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="bg-white text-gray-900 border-white/30 hover:bg-gray-50"
                  onClick={() => pdfPreview && downloadFile(pdfPreview.url, pdfPreview.name)}
                  disabled={!pdfPreview}
                >
                  <HiDownload className="mr-2 h-4 w-4" />
                  Download
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="bg-white text-gray-900 border-white/30 hover:bg-gray-50"
                  onClick={() => pdfPreview && window.open(pdfPreview.srcHref, "_blank", "noopener,noreferrer")}
                  disabled={!pdfPreview}
                >
                  Open
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="bg-white text-gray-900 border-white/30 hover:bg-gray-50"
                  onClick={closePdfPreview}
                >
                  Close
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="h-[80vh] w-full bg-gray-50">
            {pdfPreview ? (
              <iframe
                src={`${pdfPreview.url}#zoom=page-width`}
                title={pdfPreview.name}
                className="h-full w-full"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
