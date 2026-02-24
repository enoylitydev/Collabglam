"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { get } from "@/lib/api";
import { resolveFileList } from "@/lib/files";
import {
  HiChevronLeft,
  HiOutlineUserGroup,
  HiOutlineCalendar,
  HiOutlineCurrencyDollar,
  HiOutlineDocument,
  HiCheckCircle,
  HiXCircle,
} from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { HiOutlinePhotograph, HiOutlineRefresh } from "react-icons/hi";

// Added pendingUpdate structure to the interface
interface CampaignData {
  _id?: string;
  campaignsId?: string;

  brandId?: string;
  brandName?: string;
  productOrServiceName?: string;
  description?: string;

  images?: string[];

  targetAudience?: {
    age?: { MinAge?: number; MaxAge?: number };
    gender?: 0 | 1 | 2; // 0 = Female, 1 = Male, 2 = All
    locations?: { countryId: string; countryName: string }[];
  };

  categories?: {
    categoryName: string;
    subcategoryName: string;
  }[];

  goal?: string;
  campaignType?: string;
  budget?: number | string;
  influencerBudget?: number | string;

  timeline?: { startDate?: string; endDate?: string };

  creativeBriefText?: string;
  creativeBrief?: string[];
  additionalNotes?: string;

  isActive?: number;
  isDraft?: number;

  createdAt?: string;
  applicantCount?: number;
  hasApplied?: number;

  pendingUpdate?: {
    status: string;
    patch: Partial<CampaignData>;
  };
}

// Reusable component to handle before/after views cleanly
const DiffView = ({
  current,
  updated,
  hasUpdate,
}: {
  current: React.ReactNode;
  updated: React.ReactNode;
  hasUpdate: boolean;
}) => {
  if (!hasUpdate) return <div className="mt-1 text-gray-800">{current}</div>;

  return (
    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Badge className="border-none bg-amber-100 text-amber-800 shadow-none hover:bg-amber-200">
          Pending Update
        </Badge>
      </div>
      <div className="mb-2 font-medium text-gray-900">{updated}</div>
      <div className="flex items-center gap-2 border-t border-amber-100 pt-2 text-xs text-gray-500">
        <span className="opacity-70 line-through">Previous:</span>
        <div className="opacity-70 line-through">{current}</div>
      </div>
    </div>
  );
};

export default function ViewCampaignPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const genderLabel = (g?: 0 | 1 | 2) =>
    g === 0 ? "Female" : g === 1 ? "Male" : g === 2 ? "All" : "—";

  const loadCampaign = async () => {
    if (!id) {
      setError("No campaign ID provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await get<CampaignData>(`/campaign/id?id=${id}`);
      setCampaign(data);
    } catch {
      setError("Failed to load campaign details.");
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const imageUrls = useMemo(
    () => resolveFileList(campaign?.images ?? []),
    [campaign?.images]
  );

  const creativeBriefUrls = useMemo(
    () => resolveFileList(campaign?.creativeBrief ?? []),
    [campaign?.creativeBrief]
  );

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Skeleton className="h-12 w-1/3 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <p className="rounded-lg bg-red-100 px-6 py-4 text-red-700">
          {error || "Campaign not found."}
        </p>
      </div>
    );
  }

  const c = campaign;
  const patch = c.pendingUpdate?.status === "pending" ? c.pendingUpdate.patch : null;

  const statusBadge = () => {
    if (c.isDraft === 1) {
      return (
        <Badge
          variant="secondary"
          className="inline-flex items-center space-x-1 text-yellow-700"
        >
          <HiOutlineDocument className="h-4 w-4" />
          <span>Draft</span>
        </Badge>
      );
    }

    if (c.isActive === 1) {
      return (
        <Badge
          variant="default"
          className="inline-flex items-center space-x-1"
        >
          <HiCheckCircle className="h-4 w-4" />
          <span>Active</span>
        </Badge>
      );
    }

    return (
      <Badge
        variant="destructive"
        className="inline-flex items-center space-x-1"
      >
        <HiXCircle className="h-4 w-4" />
        <span>Inactive</span>
      </Badge>
    );
  };

  // Helper renderers for complex structures
  const renderLocations = (locs?: { countryId: string; countryName: string }[]) => (
    <div className="flex flex-wrap gap-2">
      {(locs ?? []).length > 0 ? (
        locs!.map((loc) => (
          <Badge key={loc.countryId} variant="secondary">
            {loc.countryName}
          </Badge>
        ))
      ) : (
        <span className="text-gray-700">No locations added.</span>
      )}
    </div>
  );

  const renderCategories = (cats?: { categoryName: string; subcategoryName: string }[]) => (
    cats && cats.length > 0 ? (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {cats.map((cat, idx) => (
          <div key={idx} className="rounded-lg border p-3">
            <div className="text-sm font-medium text-gray-900">
              {cat.categoryName} → {cat.subcategoryName}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-gray-700">No categories added.</p>
    )
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            aria-label="Back"
          >
            <HiChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-semibold text-gray-900">
            Campaign Details
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          {statusBadge()}
          <Button
            variant="outline"
            size="icon"
            onClick={loadCampaign}
            aria-label="Refresh"
            disabled={loading}
          >
            <HiOutlineRefresh className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Product Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HiOutlinePhotograph className="h-6 w-6 text-indigo-500" />
            Product Info
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {c.brandName && (
            <div>
              <p className="text-sm font-medium text-gray-600">Brand</p>
              <p className="mt-1 text-gray-800">{c.brandName}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-600">Name</p>
            <DiffView
              hasUpdate={!!patch && "productOrServiceName" in patch}
              current={c.productOrServiceName || "—"}
              updated={patch?.productOrServiceName || "—"}
            />
          </div>

          <div className="md:col-span-2 lg:col-span-2">
            <p className="text-sm font-medium text-gray-600">Description</p>
            <DiffView
              hasUpdate={!!patch && "description" in patch}
              current={<span className="whitespace-pre-wrap">{c.description || "—"}</span>}
              updated={<span className="whitespace-pre-wrap">{patch?.description || "—"}</span>}
            />
          </div>

          {imageUrls.length > 0 && (
            <div className="md:col-span-3">
              <p className="text-sm font-medium text-gray-600">Images</p>
              <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {imageUrls.map((url, i) => (
                  <div
                    key={i}
                    className="relative h-36 overflow-hidden rounded-lg border"
                  >
                    <img
                      src={url}
                      alt={`Campaign image ${i + 1}`}
                      className="h-full w-full object-cover transition-transform hover:scale-105"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audience */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HiOutlineUserGroup className="h-6 w-6 text-indigo-500" />
            Target Audience
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-gray-600">Age</p>
            <DiffView
              hasUpdate={!!patch?.targetAudience}
              current={`${c.targetAudience?.age?.MinAge ?? "—"}–${c.targetAudience?.age?.MaxAge ?? "—"}`}
              updated={`${patch?.targetAudience?.age?.MinAge ?? "—"}–${patch?.targetAudience?.age?.MaxAge ?? "—"}`}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-600">Gender</p>
            <DiffView
              hasUpdate={!!patch?.targetAudience}
              current={genderLabel(c.targetAudience?.gender)}
              updated={genderLabel(patch?.targetAudience?.gender)}
            />
          </div>

          <div className="md:col-span-3">
            <p className="text-sm font-medium text-gray-600">Locations</p>
            <DiffView
              hasUpdate={!!patch?.targetAudience}
              current={renderLocations(c.targetAudience?.locations)}
              updated={renderLocations(patch?.targetAudience?.locations)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HiOutlineDocument className="h-6 w-6 text-indigo-500" />
            Categories
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DiffView
            hasUpdate={!!patch && "categories" in patch}
            current={renderCategories(c.categories)}
            updated={renderCategories(patch?.categories)}
          />
        </CardContent>
      </Card>

      {/* Campaign Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HiOutlineCalendar className="h-6 w-6 text-indigo-500" />
            Campaign Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-gray-600">Goal</p>
            <DiffView
              hasUpdate={!!patch && "goal" in patch}
              current={c.goal || "—"}
              updated={patch?.goal || "—"}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-gray-600">Budget</p>
            <DiffView
              hasUpdate={!!patch && "budget" in patch}
              current={
                <span className="flex items-center gap-1">
                  <HiOutlineCurrencyDollar className="inline" />
                  {Number(c.budget ?? 0).toLocaleString()}
                </span>
              }
              updated={
                <span className="flex items-center gap-1">
                  <HiOutlineCurrencyDollar className="inline" />
                  {Number(patch?.budget ?? 0).toLocaleString()}
                </span>
              }
            />
          </div>

          {c.influencerBudget && (
            <div>
              <p className="text-sm font-medium text-gray-600">Influencer Budget</p>
              <DiffView
                hasUpdate={!!patch && "influencerBudget" in patch}
                current={
                  <span className="flex items-center gap-1">
                    <HiOutlineCurrencyDollar className="inline" />
                    {Number(c.influencerBudget ?? 0).toLocaleString()}
                  </span>
                }
                updated={
                  <span className="flex items-center gap-1">
                    <HiOutlineCurrencyDollar className="inline" />
                    {Number(patch?.influencerBudget ?? 0).toLocaleString()}
                  </span>
                }
              />
            </div>
          )}

          <div className="lg:col-span-2">
             <p className="text-sm font-medium text-gray-600">Timeline</p>
             <DiffView
               hasUpdate={!!patch && "timeline" in patch}
               current={
                 <div className="flex flex-col gap-1 mt-1">
                   <div className="flex items-center gap-2"><HiOutlineCalendar className="h-5 w-5 text-gray-500" /><span>Start: {formatDate(c.timeline?.startDate)}</span></div>
                   <div className="flex items-center gap-2"><HiOutlineCalendar className="h-5 w-5 text-gray-500" /><span>End: {formatDate(c.timeline?.endDate)}</span></div>
                 </div>
               }
               updated={
                 <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2"><HiOutlineCalendar className="h-5 w-5 text-gray-500" /><span>Start: {formatDate(patch?.timeline?.startDate)}</span></div>
                   <div className="flex items-center gap-2"><HiOutlineCalendar className="h-5 w-5 text-gray-500" /><span>End: {formatDate(patch?.timeline?.endDate)}</span></div>
                 </div>
               }
             />
          </div>
        </CardContent>
      </Card>

      {/* Creative Brief & Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HiOutlineDocument className="h-6 w-6 text-indigo-500" />
            Creative Brief & Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {c.creativeBriefText && (
            <div>
              <p className="text-sm font-medium text-gray-600">Brief Text</p>
              <DiffView
                hasUpdate={!!patch && "creativeBriefText" in patch}
                current={<span className="whitespace-pre-wrap">{c.creativeBriefText}</span>}
                updated={<span className="whitespace-pre-wrap">{patch?.creativeBriefText}</span>}
              />
            </div>
          )}

          {creativeBriefUrls.length > 0 && (
            <>
              <p className="text-sm font-medium text-gray-600">Files</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {creativeBriefUrls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border p-2 hover:bg-indigo-50"
                  >
                    <HiOutlineDocument className="h-5 w-5 text-indigo-600" />
                    <span className="truncate text-sm text-indigo-700">
                      {url.split("/").pop()}
                    </span>
                  </a>
                ))}
              </div>
            </>
          )}

          {c.additionalNotes && (
            <>
              <hr />
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Additional Notes
                </p>
                <DiffView
                  hasUpdate={!!patch && "additionalNotes" in patch}
                  current={<span className="whitespace-pre-wrap">{c.additionalNotes}</span>}
                  updated={<span className="whitespace-pre-wrap">{patch?.additionalNotes}</span>}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}