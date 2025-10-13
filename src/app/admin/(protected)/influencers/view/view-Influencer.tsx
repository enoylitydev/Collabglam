"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { post ,get} from "@/lib/api";
import {
  HiChevronLeft,
  HiOutlineMail,
  HiPhone,
  HiOutlineUser,
  HiOutlineGlobeAlt,
  HiLocationMarker,
  HiCalendar,
  HiUserGroup,
  HiOutlineFlag,
  HiStar,
  HiExternalLink,
} from "react-icons/hi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { get } from "http"; // Remove this line

interface SocialProfile {
  provider: string;
  username: string;
  followers: number;
  engagementRate: number;
  url: string;
  picture?: string;
  isVerified: boolean;
}

interface SubscriptionFeature {
  key: string;
  limit: number;
  used: number;
}

interface InfluencerDetail {
  influencerId: string;
  name: string;
  email: string;
  phone: string;
  primaryPlatform: string;
  socialProfiles: SocialProfile[];
  country: string;
  city: string;
  dateOfBirth: string;
  gender: string;
  languages: Array<{ name: string; code: string }>;
  onboarding: {
    formats: string[];
    budgets: Array<{ format: string; range: string }>;
    projectLength: string;
    capacity: string;
    collabTypes: string[];
    allowlisting: boolean;
  };
  otpVerified: boolean;
  subscription: {
    planName: string;
    startedAt: string;
    expiresAt: string;
    features: SubscriptionFeature[];
  };
  subscriptionExpired: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ViewInfluencerPage() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("influencerId");

  const [influencer, setInfluencer] = useState<InfluencerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInfluencer = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const resp = await get(
          "/admin/influencer/getById",
          { id }
        );
        setInfluencer(resp.influencer);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to load influencer.");
      } finally {
        setLoading(false);
      }
    };
    fetchInfluencer();
  }, [id]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <Skeleton className="h-10 w-48" />
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-6">
            <Skeleton className="h-32 w-32 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
              <Skeleton className="h-4 w-80" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <HiChevronLeft className="mr-2" /> Back
        </Button>
        <Card className="p-6 border-red-200 bg-red-50">
          <p className="text-red-600 font-medium">Error: {error}</p>
        </Card>
      </div>
    );
  }

  if (!influencer) return null;

  const primaryProfile = influencer.socialProfiles?.find(
    p => p.provider === influencer.primaryPlatform
  ) || influencer.socialProfiles?.[0];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 bg-gray-50 min-h-screen">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="hover:bg-white"
      >
        <HiChevronLeft className="mr-2 h-5 w-5" />
        Back to Influencers
      </Button>

      {/* Header Card */}
      <Card className="p-8 bg-gradient-to-br from-white to-gray-50 shadow-lg">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Profile Picture */}
          <div className="flex-shrink-0">
            {primaryProfile?.picture ? (
              <img
                src={primaryProfile.picture}
                alt={influencer.name}
                className="h-32 w-32 rounded-full object-cover border-4 border-white shadow-lg"
              />
            ) : (
              <div className="h-32 w-32 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-5xl font-bold shadow-lg">
                {influencer.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-4xl font-bold text-gray-900">
                {influencer.name}
              </h1>
              <Badge
                variant={influencer.subscriptionExpired ? "destructive" : "default"}
                className="px-3 py-1"
              >
                {influencer.subscriptionExpired ? "Expired" : "Active"}
              </Badge>
              {influencer.otpVerified && (
                <Badge variant="secondary" className="px-3 py-1">
                  ✓ Verified
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <HiOutlineMail className="h-5 w-5 text-blue-500" />
                <span>{influencer.email}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <HiPhone className="h-5 w-5 text-green-500" />
                <span>{influencer.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <HiLocationMarker className="h-5 w-5 text-red-500" />
                <span>{influencer.city}, {influencer.country}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <HiCalendar className="h-5 w-5 text-purple-500" />
                <span>{formatDate(influencer.dateOfBirth)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <HiUserGroup className="h-5 w-5 text-orange-500" />
                <span>{influencer.gender}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <HiOutlineFlag className="h-5 w-5 text-indigo-500" />
                <span>{influencer.languages.map(l => l.name).join(", ")}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="social" className="space-y-6">
        <TabsList className="bg-white p-1 shadow">
          <TabsTrigger value="social">Social Profiles</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        {/* Social Profiles Tab */}
        <TabsContent value="social" className="space-y-4">
          {influencer.socialProfiles?.map((profile) => (
            <Card key={profile.provider} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4 flex-1">
                  {profile.picture && (
                    <img
                      src={profile.picture}
                      alt={profile.username}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-semibold capitalize">
                        {profile.provider}
                      </h3>
                      {profile.isVerified && (
                        <Badge variant="secondary">Verified</Badge>
                      )}
                      {profile.provider === influencer.primaryPlatform && (
                        <Badge className="bg-blue-500">Primary</Badge>
                      )}
                    </div>
                    <p className="text-gray-600 mb-3">@{profile.username}</p>
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="font-semibold text-2xl text-blue-600">
                          {formatNumber(profile.followers)}
                        </span>
                        <p className="text-gray-500">Followers</p>
                      </div>
                      <div>
                        <span className="font-semibold text-2xl text-green-600">
                          {(profile.engagementRate * 100).toFixed(2)}%
                        </span>
                        <p className="text-gray-500">Engagement</p>
                      </div>
                    </div>
                  </div>
                </div>
                <a
                  href={profile.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700"
                >
                  <HiExternalLink className="h-6 w-6" />
                </a>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Subscription Tab */}
        <TabsContent value="subscription">
          <Card className="p-6 shadow-lg">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">
                Subscription Details
              </h3>
              <Badge className="px-4 py-2 text-lg bg-gradient-to-r from-blue-500 to-purple-500">
                {influencer.subscription.planName.toUpperCase()}
              </Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Started On</p>
                <p className="text-lg font-semibold">
                  {formatDate(influencer.subscription.startedAt)}
                </p>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Expires On</p>
                <p className="text-lg font-semibold">
                  {formatDate(influencer.subscription.expiresAt)}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100">
                    <TableHead className="font-bold">Feature</TableHead>
                    <TableHead className="font-bold">Limit</TableHead>
                    <TableHead className="font-bold">Used</TableHead>
                    <TableHead className="font-bold">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {influencer.subscription.features.map((f, idx) => {
                    const remaining = f.limit - f.used;
                    const percentage = (f.used / f.limit) * 100;
                    return (
                      <TableRow key={f.key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <TableCell className="font-medium capitalize">
                          {f.key.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell>{f.limit}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{f.used}</span>
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  percentage > 80 ? "bg-red-500" : percentage > 50 ? "bg-yellow-500" : "bg-green-500"
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className={remaining === 0 ? "text-red-600 font-semibold" : "text-green-600"}>
                          {remaining}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6 shadow-lg">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <HiStar className="text-yellow-500" />
                Content Preferences
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">Formats</p>
                  <div className="flex flex-wrap gap-2">
                    {influencer.onboarding.formats.map((f) => (
                      <Badge key={f} variant="secondary">{f}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Budget Ranges</p>
                  <div className="space-y-2">
                    {influencer.onboarding.budgets.map((b, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="font-medium">{b.format}</span>
                        <Badge>{b.range}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 shadow-lg">
              <h3 className="text-xl font-bold mb-4">Work Details</h3>
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Project Length</p>
                  <p className="font-semibold">{influencer.onboarding.projectLength}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Capacity</p>
                  <p className="font-semibold">{influencer.onboarding.capacity}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600">Allowlisting</p>
                  <Badge variant={influencer.onboarding.allowlisting ? "default" : "secondary"}>
                    {influencer.onboarding.allowlisting ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-2">Collaboration Types</p>
                  <div className="flex flex-wrap gap-2">
                    {influencer.onboarding.collabTypes.map((t) => (
                      <Badge key={t} variant="outline">{t}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Footer Info */}
      <Card className="p-4 bg-gray-50 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Account Created: {formatDate(influencer.createdAt)}</span>
          <span>Last Updated: {formatDate(influencer.updatedAt)}</span>
        </div>
      </Card>
    </div>
  );
}