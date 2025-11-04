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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import Swal from "sweetalert2";

interface CampaignData {
  _id: string;
  productOrServiceName: string;
  description: string;
  images: string[];
  targetAudience: {
    age: { MinAge: number; MaxAge: number };
    gender: number;
    locations: { countryId: string; countryName: string; _id: string }[];
  };
  categories: {
    categoryId: number;
    categoryName: string;
    subcategoryId: string;
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
  campaignsId: string;
  hasApplied: number;
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
  }, [id]);

  const fetchCampaign = async () => {
    try {
      const data = await post<CampaignData>(`/campaign/checkApplied`, { campaignId: id, influencerId: localStorage.getItem('influencerId') });
      setCampaign(data);
    } catch (e) {
      console.error(e);
      setError("Failed to load campaign details.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    const influencerId = localStorage.getItem('influencerId');

    if (!influencerId) {
      return Swal.fire({
        icon: 'warning',
        title: 'Not Logged In',
        text: 'Please log in to apply for this campaign.',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
      });
    }

    try {
      const result = await post<{ success: boolean; message: string }>(
        '/apply/campaign',
        {
          campaignId: campaign?.campaignsId,
          influencerId,
        }
      );

      if (result.message === "Application recorded") {
        await Swal.fire({
          icon: 'success',
          title: 'Success',
          text: result.message,
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true
        });
        fetchCampaign();
      } else {
        throw new Error(result.message);
      }
    } catch (err: any) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'Failed to apply. Please try again later.',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true
      });
    }
  };

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

  return (
    <div className="min-h-screen p-8 bg-gray-50 text-gray-800 space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-gray-800">Campaign Details</h1>
        <p className="mt-1 text-gray-600">
          Detailed view of <span className="font-medium">{c.productOrServiceName}</span>.
        </p>

        <div className="flex justify-between items-center mt-4 space-x-4">
          <Button
            onClick={() => router.back()}
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400 transition"
          >
            Back
          </Button>

          {c.hasApplied === 1 ? (
            <span
              className="inline-block px-4 py-2 rounded-md bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 font-semibold"
            >
              Already Applied
            </span>
          ) : (
            <Button
              onClick={handleApply}
              className="inline-block px-4 py-2 rounded-md bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 font-semibold hover:bg-gradient-to-r hover:from-[#FFDB58] hover:to-[#FFBF00] transition"
            >
              Apply for Work
            </Button>
          )}
        </div>
      </header>

      <Card className="bg-white shadow-lg rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-medium text-gray-800">
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
              <p className="mt-1 text-gray-800 whitespace-pre-wrap">{c.description}</p>
            </div>
            {c.images?.length > 0 && (
              <div className="md:col-span-3">
                <p className="text-sm font-medium text-gray-600">Images</p>
                <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {c.images.map((url, i) => (
                    <div key={i} className="relative h-36 rounded-lg overflow-hidden border border-gray-300 shadow-sm">
                      <img src={url} alt={`img-${i}`} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white shadow-lg rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-medium text-gray-800">
            <HiOutlineCalendar className="h-6 w-6 text-[#FFBF00]" /> Target Audience
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-gray-600">Age</p>
              <p className="mt-1 text-gray-800">{c.targetAudience.age.MinAge}–{c.targetAudience.age.MaxAge}</p>
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
                  <Badge key={loc.countryId} variant="outline" className="text-gray-800 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58]">
                    {loc.countryName}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="md:col-span-3">
              <p className="text-sm font-medium text-gray-600">Categories</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {c.categories.map((cat) => (
                  <Badge key={cat.subcategoryId} variant="default" className="text-gray-800 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58]">
                    {cat.categoryName}: {cat.subcategoryName}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white shadow-lg rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-medium text-gray-800">
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
              <p className="mt-1 text-gray-800">${c.budget.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger>
                  <HiOutlineCalendar className="h-5 w-5 text-[#FFBF00]" />
                </TooltipTrigger>
                <TooltipContent>Start Date</TooltipContent>
              </Tooltip>
              <p className="text-gray-800">{new Date(c.timeline.startDate).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger>
                  <HiOutlineCalendar className="h-5 w-5 text-[#FFBF00]" />
                </TooltipTrigger>
                <TooltipContent>End Date</TooltipContent>
              </Tooltip>
              <p className="text-gray-800">{new Date(c.timeline.endDate).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white shadow-lg rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-medium text-gray-800">
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
          {c.creativeBrief.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-600">Files</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {c.creativeBrief.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-[#FFBF00] bg-white px-2 py-1 hover:bg-gray-50 transition"
                  >
                    <HiOutlineDocument className="h-5 w-5 text-[#FFBF00]" />
                    <span className="truncate text-sm font-medium text-gray-800">{url.split("/").pop()}</span>
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
