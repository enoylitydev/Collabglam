"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  HiOutlinePhotograph,
  HiOutlineCalendar,
  HiOutlineCurrencyDollar,
  HiOutlineDocument,
} from "react-icons/hi";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// ❌ Removed tooltip imports
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
  // ✨ categories replaces interestId
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
  // backend may send either of these flags
  hasApplied?: number;
  isApplied?: number;
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
        {
          campaignId: campaign?.campaignsId,
          influencerId,
        }
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
          err.response?.data?.message ||
          "Failed to apply. Please try again later.",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="animate-pulse rounded-lg bg-gray-200 p-6 text-gray-500">
          Loading…
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <p className="rounded-lg bg-red-100 p-6 text-red-600">
          {error || "Campaign not found."}
        </p>
      </div>
    );
  }

  const c = campaign;
  const appliedFlag = (c.hasApplied ?? c.isApplied ?? 0) === 1;

  return (
    <div className="min-h-screen p-8 bg-gray-50 text-gray-800 space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-gray-800">Campaign Details</h1>
        <p className="mt-1 text-gray-600">
          Detailed view of{" "}
          <span className="font-medium">{c.productOrServiceName}</span>.
        </p>

        <div className="flex justify-end items-center space-x-4 mt-4">
          <Button
            onClick={() => router.back()}
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md"
          >
            Back
          </Button>

          {appliedFlag ? (
            <span className="inline-block px-4 py-2 rounded-md bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800">
              Already Applied
            </span>
          ) : (
            <Button
              onClick={handleApply}
              className="inline-block px-4 py-2 rounded-md bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 cursor-pointer hover:bg-gradient-to-r hover:from-[#FFDB58] hover:to-[#FFBF00]"
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
            <HiOutlinePhotograph className="h-6 w-6 text-[#FFBF00]" /> Product
            Info
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
              <p className="mt-1 whitespace-pre-wrap text-gray-800">
                {c.description}
              </p>
            </div>
            {Array.isArray(c.images) && c.images.length > 0 && (
              <div className="md:col-span-3">
                <p className="text-sm font-medium text-gray-600">Images</p>
                <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {c.images.map((url, i) => (
                    <div
                      key={i}
                      className="relative h-36 rounded-lg overflow-hidden border"
                    >
                      <img
                        src={url}
                        alt={`img-${i}`}
                        className="h-full w-full object-cover"
                      />
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
            <HiOutlineCalendar className="h-6 w-6 text-[#FFBF00]" /> Target
            Audience
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-gray-600">Age</p>
              <p className="mt-1 text-gray-800">
                {c.targetAudience?.age?.MinAge ?? 0}–
                {c.targetAudience?.age?.MaxAge ?? 0}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Gender</p>
              <p className="mt-1 text-gray-800">
                {c.targetAudience?.gender === 0
                  ? "Female"
                  : c.targetAudience?.gender === 1
                  ? "Male"
                  : "All"}
              </p>
            </div>
            <div className="md:col-span-3">
              <p className="text-sm font-medium text-gray-600">Locations</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {(c.targetAudience?.locations ?? []).length > 0 ? (
                  (c.targetAudience?.locations ?? []).map((loc) => (
                    <Badge
                      key={loc.countryId}
                      variant="outline"
                      className="text-gray-800 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58]"
                    >
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
                      className="text-gray-800 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58]"
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
            <HiOutlineCurrencyDollar className="h-6 w-6 text-[#FFBF00]" />{" "}
            Campaign Details
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
              <p className="mt-1 text-gray-800">
                ${Number(c.budget || 0).toLocaleString()}
              </p>
            </div>

            {/* Start Date — label always visible */}
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

            {/* End Date — label always visible */}
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

      {/* Creative Brief & Notes */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <HiOutlineDocument className="h-6 w-6 text-[#FFBF00]" /> Creative
            Brief & Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {c.creativeBriefText && (
            <div>
              <p className="text-sm font-medium text-gray-600">Brief Text</p>
              <p className="whitespace-pre-wrap text-gray-800">
                {c.creativeBriefText}
              </p>
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
                    className="flex items-center gap-2 rounded-lg border border-[#FFBF00] bg-white px-2 py-1 hover:bg-gray-50"
                  >
                    <HiOutlineDocument className="h-5 w-5 bg-clip-text text-transparent bg-gradient-to-r from-[#FFBF00] to-[#FFDB58]" />
                    <span className="truncate text-sm font-medium text-gray-800">
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
              <p className="text-xl font-medium text-gray-600">
                Additional Notes
              </p>
              <p className="whitespace-pre-wrap text-gray-800">
                {c.additionalNotes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
