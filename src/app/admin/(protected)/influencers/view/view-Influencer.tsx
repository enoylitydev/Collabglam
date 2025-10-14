"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { get } from "@/lib/api";
import {
  ChevronLeft,
  Mail,
  Phone,
  User,
  Globe,
  MapPin,
  Calendar,
  Users,
  Flag,
  Star,
  ExternalLink,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
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

interface SocialProfile {
  provider: string;
  username: string;
  followers: number;
  engagementRate: number;
  url: string;
  picture?: string;
  isVerified: boolean;
  avgLikes?: number;
  avgComments?: number;
  postsCount?: number;
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
    cadences?: string[];
    promptAnswers?: Record<string, string>;
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
        const resp = await get("/admin/influencer/getById", { id });
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
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <Card className="p-6 space-y-6 shadow-xl">
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-4 hover:bg-white/80"
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Card className="p-6 border-red-200 bg-red-50 shadow-xl">
            <div className="flex items-center gap-3">
              <XCircle className="h-6 w-6 text-red-600" />
              <p className="text-red-600 font-medium">Error: {error}</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!influencer) return null;

  const primaryProfile = influencer.socialProfiles?.find(
    (p) => p.provider === influencer.primaryPlatform
  ) || influencer.socialProfiles?.[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="hover:bg-white/80 shadow-sm"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Influencers
        </Button>

        <Card className="p-6 md:p-8 bg-white/80 backdrop-blur-sm shadow-xl border-0">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            <div className="flex-shrink-0">
              {primaryProfile?.picture ? (
                <img
                  src={primaryProfile.picture}
                  alt={influencer.name}
                  className="h-32 w-32 rounded-full object-cover border-4 border-white shadow-lg ring-4 ring-blue-100"
                />
              ) : (
                <div className="h-32 w-32 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-5xl font-bold shadow-lg ring-4 ring-blue-100">
                  {influencer.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                  {influencer.name}
                </h1>
                <Badge
                  variant={influencer.subscriptionExpired ? "destructive" : "default"}
                  className="px-3 py-1"
                >
                  {influencer.subscriptionExpired ? "Expired" : "Active"}
                </Badge>
                {influencer.otpVerified && (
                  <Badge variant="secondary" className="px-3 py-1 bg-green-100 text-green-700 hover:bg-green-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg">
                  <Mail className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <span className="truncate">{influencer.email}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg">
                  <Phone className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span>{influencer.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg">
                  <MapPin className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <span>{influencer.city}, {influencer.country}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg">
                  <Calendar className="h-4 w-4 text-purple-500 flex-shrink-0" />
                  <span>{formatDate(influencer.dateOfBirth)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg">
                  <Users className="h-4 w-4 text-orange-500 flex-shrink-0" />
                  <span>{influencer.gender}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg">
                  <Flag className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                  <span className="truncate">{influencer.languages.map((l) => l.name).join(", ")}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Tabs defaultValue="social" className="space-y-6">
          <TabsList className="bg-white shadow-lg p-1 border-0">
            <TabsTrigger value="social" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              Social Profiles
            </TabsTrigger>
            <TabsTrigger value="subscription" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              Subscription
            </TabsTrigger>
            <TabsTrigger value="preferences" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              Preferences
            </TabsTrigger>
          </TabsList>

          <TabsContent value="social" className="space-y-4">
            {influencer.socialProfiles?.map((profile) => (
              <Card
                key={profile.provider}
                className="p-6 hover:shadow-xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm"
              >
                <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 w-full">
                    {profile.picture && (
                      <img
                        src={profile.picture}
                        alt={profile.username}
                        className="h-16 w-16 rounded-full object-cover ring-4 ring-slate-100"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="text-xl font-semibold capitalize text-slate-900">
                          {profile.provider}
                        </h3>
                        {profile.isVerified && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                        {profile.provider === influencer.primaryPlatform && (
                          <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                            Primary
                          </Badge>
                        )}
                      </div>
                      <p className="text-slate-600 mb-3">@{profile.username}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <Users className="h-4 w-4 text-blue-600" />
                            <span className="text-xs text-slate-600">Followers</span>
                          </div>
                          <span className="text-xl font-bold text-blue-600">
                            {formatNumber(profile.followers)}
                          </span>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4 text-green-600" />
                            <span className="text-xs text-slate-600">Engagement</span>
                          </div>
                          <span className="text-xl font-bold text-green-600">
                            {(profile.engagementRate * 100).toFixed(2)}%
                          </span>
                        </div>
                        {profile.avgLikes !== undefined && (
                          <div className="bg-pink-50 p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <Heart className="h-4 w-4 text-pink-600" />
                              <span className="text-xs text-slate-600">Avg Likes</span>
                            </div>
                            <span className="text-xl font-bold text-pink-600">
                              {formatNumber(profile.avgLikes)}
                            </span>
                          </div>
                        )}
                        {profile.avgComments !== undefined && (
                          <div className="bg-purple-50 p-3 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <MessageCircle className="h-4 w-4 text-purple-600" />
                              <span className="text-xs text-slate-600">Avg Comments</span>
                            </div>
                            <span className="text-xl font-bold text-purple-600">
                              {formatNumber(profile.avgComments)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <a
                    href={profile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 transition-colors"
                  >
                    <ExternalLink className="h-6 w-6" />
                  </a>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="subscription">
            <Card className="p-6 shadow-xl border-0 bg-white/80 backdrop-blur-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h3 className="text-2xl font-bold text-slate-900">
                  Subscription Details
                </h3>
                <Badge className="px-4 py-2 text-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
                  {influencer.subscription.planName.toUpperCase()}
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                  <p className="text-sm text-slate-600 mb-1">Started On</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {formatDate(influencer.subscription.startedAt)}
                  </p>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                  <p className="text-sm text-slate-600 mb-1">Expires On</p>
                  <p className="text-lg font-semibold text-slate-900">
                    {formatDate(influencer.subscription.expiresAt)}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="font-bold text-slate-900">Feature</TableHead>
                      <TableHead className="font-bold text-slate-900">Limit</TableHead>
                      <TableHead className="font-bold text-slate-900">Used</TableHead>
                      <TableHead className="font-bold text-slate-900">Remaining</TableHead>
                      <TableHead className="font-bold text-slate-900">Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {influencer.subscription.features.map((f, idx) => {
                      const remaining = f.limit - f.used;
                      const percentage = f.limit > 0 ? (f.used / f.limit) * 100 : 0;
                      return (
                        <TableRow
                          key={f.key}
                          className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}
                        >
                          <TableCell className="font-medium capitalize text-slate-900">
                            {f.key.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="text-slate-700">{f.limit}</TableCell>
                          <TableCell className="text-slate-700">{f.used}</TableCell>
                          <TableCell
                            className={
                              remaining === 0
                                ? "text-red-600 font-semibold"
                                : "text-green-600 font-semibold"
                            }
                          >
                            {remaining}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    percentage > 80
                                      ? "bg-red-500"
                                      : percentage > 50
                                      ? "bg-yellow-500"
                                      : "bg-green-500"
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-slate-600">
                                {percentage.toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="preferences">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900">
                  <Star className="text-yellow-500" />
                  Content Preferences
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-600 mb-2 font-medium">Formats</p>
                    <div className="flex flex-wrap gap-2">
                      {influencer.onboarding.formats.map((f) => (
                        <Badge key={f} variant="secondary" className="bg-blue-100 text-blue-700">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-2 font-medium">Budget Ranges</p>
                    <div className="space-y-2">
                      {influencer.onboarding.budgets.map((b, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <span className="font-medium text-slate-900">{b.format}</span>
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            {b.range}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-6 shadow-xl border-0 bg-white/80 backdrop-blur-sm">
                <h3 className="text-xl font-bold mb-4 text-slate-900">Work Details</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                    <p className="text-sm text-slate-600 mb-1">Project Length</p>
                    <p className="font-semibold text-slate-900">
                      {influencer.onboarding.projectLength}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                    <p className="text-sm text-slate-600 mb-1">Capacity</p>
                    <p className="font-semibold text-slate-900">
                      {influencer.onboarding.capacity}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                    <p className="text-sm text-slate-600 mb-1">Allowlisting</p>
                    <Badge
                      variant={
                        influencer.onboarding.allowlisting ? "default" : "secondary"
                      }
                      className={
                        influencer.onboarding.allowlisting
                          ? "bg-green-500 hover:bg-green-600"
                          : ""
                      }
                    >
                      {influencer.onboarding.allowlisting ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-2 font-medium">
                      Collaboration Types
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {influencer.onboarding.collabTypes.map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="border-slate-300 text-slate-700"
                        >
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Card className="p-4 bg-white/60 backdrop-blur-sm text-sm text-slate-600 shadow-lg border-0">
          <div className="flex flex-col md:flex-row justify-between gap-2">
            <span>Account Created: {formatDate(influencer.createdAt)}</span>
            <span>Last Updated: {formatDate(influencer.updatedAt)}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
