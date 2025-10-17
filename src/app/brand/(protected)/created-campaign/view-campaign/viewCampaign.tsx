"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  HiOutlinePhotograph,
  HiOutlineCalendar,
  HiOutlineCurrencyDollar,
  HiOutlineDocument,
} from "react-icons/hi";
import { get } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface CampaignData {
  _id: string;
  campaignsId: string;
  brandName?: string;
  productOrServiceName: string;
  description: string;
  images: string[];
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
  budget: number;
  timeline: { startDate?: string; endDate?: string };
  creativeBriefText?: string;
  creativeBrief: string[];
  additionalNotes?: string;
  isActive: number;
  createdAt: string;
}

export default function ViewCampaignPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
      } catch (e) {
        console.error(e);
        setError("Failed to load campaign details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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

  const fmtDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString() : "—";

  return (
    <div className="min-h-full p-8 space-y-8">
      <header className="flex items-center justify-between p-4 rounded-md">
        <h1 className="text-3xl font-bold text-gray-800">
          Campaign Details
        </h1>

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
            className="
              bg-gradient-to-r from-[#FFA135] to-[#FF7236]
              text-white
              hover:from-[#FF7236] hover:to-[#FFA135]
              shadow-none
            "
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
            Detailed view of <span className="font-">{c.productOrServiceName}</span>
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
              <p className="mt-1 whitespace-pre-wrap text-gray-800">{c.description}</p>
            </div>
            {c.images?.length > 0 && (
              <div className="md:col-span-3">
                <p className="text-sm font-medium text-gray-600">Images</p>
                <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {c.images.map((url, i) => (
                    <div key={i} className="relative h-36 rounded-lg overflow-hidden border">
                      <img src={url} alt={`img-${i}`} className="h-full w-full object-cover" />
                    </div>
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
                {c.targetAudience.gender === 0
                  ? "Female"
                  : c.targetAudience.gender === 1
                  ? "Male"
                  : "All"}
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
            {Array.isArray(c.categories) && c.categories.length > 0 && (
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

      {/* Creative Brief & Notes */}
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
          {Array.isArray(c.creativeBrief) && c.creativeBrief.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-600">Files</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {c.creativeBrief.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border bg-orange-50 p-2 hover:bg-orange-100"
                  >
                    <HiOutlineDocument className="h-5 w-5 text-orange-600" />
                    <span className="truncate text-sm font-medium text-orange-700">
                      {url.split("/").pop()}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
          <hr className="border-1" />
          {c.additionalNotes && (
            <div>
              <p className="text-xl font-medium text-gray-600">Additional Notes</p>
              <p className="whitespace-pre-wrap text-gray-800">{c.additionalNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
