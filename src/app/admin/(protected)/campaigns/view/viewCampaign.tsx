"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { get } from "@/lib/api";
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

interface CampaignData {
  _id: string;
  brandId?: string;
  brandName?: string;
  productOrServiceName: string;
  description: string;
  images: string[];
  targetAudience: {
    age: { MinAge: number; MaxAge: number };
    gender: 0 | 1 | 2; // 0 = Female, 1 = Male, 2 = All
    locations: { countryId: string; countryName: string }[];
  };
  // interestId removed
  categories: {
    // IDs removed per request
    categoryName: string;
    subcategoryName: string;
  }[];
  goal: string;
  budget: number;
  timeline: { startDate: string; endDate: string };
  creativeBriefText?: string;
  creativeBrief: string[];
  additionalNotes?: string;
  isActive: number;
  createdAt: string;
  applicantCount?: number;
  hasApplied?: number;
  campaignsId?: string;
}

export default function ViewCampaignPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch {
        setError("Failed to load campaign details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const genderLabel = (g: 0 | 1 | 2) =>
    g === 0 ? "Female" : g === 1 ? "Male" : "All";

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Skeleton className="h-12 w-1/3 rounded-lg animate-pulse" />
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

  return (
    <div className="max-w-5xl mx-auto space-y-8">
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
          <Badge
            variant={c.isActive === 1 ? "default" : "destructive"}
            className="inline-flex items-center space-x-1"
          >
            {c.isActive === 1 ? (
              <>
                <HiCheckCircle />
                <span>Active</span>
              </>
            ) : (
              <>
                <HiXCircle />
                <span>Inactive</span>
              </>
            )}
          </Badge>
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.refresh()}
            aria-label="Refresh"
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
            <p className="mt-1 text-gray-800">{c.productOrServiceName}</p>
          </div>
          <div className="md:col-span-2 lg:col-span-2">
            <p className="text-sm font-medium text-gray-600">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-gray-800">
              {c.description}
            </p>
          </div>
          {c.images.length > 0 && (
            <div className="md:col-span-3">
              <p className="text-sm font-medium text-gray-600">Images</p>
              <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {c.images.map((url, i) => (
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
            <p className="mt-1 text-gray-800">
              {c.targetAudience.age.MinAge}–{c.targetAudience.age.MaxAge}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Gender</p>
            <p className="mt-1 text-gray-800">
              {genderLabel(c.targetAudience.gender)}
            </p>
          </div>
          <div className="md:col-span-3">
            <p className="text-sm font-medium text-gray-600">Locations</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.targetAudience.locations.map((loc) => (
                <Badge key={loc.countryId} variant="secondary">
                  {loc.countryName}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories (IDs removed) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HiOutlineDocument className="h-6 w-6 text-indigo-500" />
            Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {c.categories && c.categories.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {c.categories.map((cat, idx) => (
                <div key={idx} className="rounded-lg border p-3">
                  <div className="text-sm font-medium text-gray-900">
                    {cat.categoryName} → {cat.subcategoryName}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-700">No categories added.</p>
          )}
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
            <p className="mt-1 text-gray-800">{c.goal}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">Budget</p>
            <p className="mt-1 text-gray-800">
              <HiOutlineCurrencyDollar className="inline mb-1" />
              {c.budget.toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HiOutlineCalendar className="h-5 w-5 text-gray-500" />
            <p className="text-gray-800">{formatDate(c.timeline.startDate)}</p>
          </div>
          <div className="flex items-center gap-2">
            <HiOutlineCalendar className="h-5 w-5 text-gray-500" />
            <p className="text-gray-800">{formatDate(c.timeline.endDate)}</p>
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
            <>
              <p className="text-sm font-medium text-gray-600">Brief Text</p>
              <p className="whitespace-pre-wrap text-gray-800">
                {c.creativeBriefText}
              </p>
            </>
          )}

          {c.creativeBrief.length > 0 && (
            <>
              <p className="text-sm font-medium text-gray-600">Files</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {c.creativeBrief.map((url, i) => (
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
              <p className="text-sm font-medium text-gray-600">
                Additional Notes
              </p>
              <p className="whitespace-pre-wrap text-gray-800">
                {c.additionalNotes}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
