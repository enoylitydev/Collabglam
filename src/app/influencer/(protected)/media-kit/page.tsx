"use client";
import React, { useEffect, useMemo, useState } from "react";
import { post } from "@/lib/api";
import {
  User, Mail, Phone, Globe, Instagram, Youtube,
  Edit, Save, FileText, DollarSign, Link as LinkIcon, Languages,
  Heart, MessageCircle, Eye, TrendingUp, Users, CheckCircle2, ExternalLink,
  Tag, Award, Zap, Target, Activity, X
} from "lucide-react";

/* -------------------------- Theme helpers -------------------------- */
const activeClass = (isActive: boolean) =>
  isActive
    ? "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900 font-semibold shadow-lg"
    : "text-gray-700 hover:bg-gradient-to-r hover:from-[#FFBF00]/10 hover:to-[#FFDB58]/10 hover:text-gray-900";

/* ------------------------------ Types ------------------------------ */
type AudienceItem = { name?: string; code?: string; weight?: number };
type Audience = {
  genders?: AudienceItem[]; ages?: AudienceItem[]; geoCountries?: AudienceItem[];
  geoCities?: { name: string; weight: number }[]; languages?: AudienceItem[];
  interests?: { name: string; weight: number }[];
  [k: string]: any;
};
type PostT = { image?: string; thumbnail?: string; text?: string; likes?: number; comments?: number; views?: number; url?: string };
type CategoryLink = { categoryId: number; categoryName: string; subcategoryId: string; subcategoryName: string };
type HashTag = string | { tag: string; weight?: number };
type Mention = string | { tag: string; weight?: number };
type Affinity = string | { id?: number; name: string };

type SocialProfile = {
  provider: "instagram" | "youtube" | "tiktok" | string;
  userId?: string; username?: string; fullname?: string; url?: string; picture?: string;
  followers?: number; engagements?: number; engagementRate?: number; averageViews?: number;
  isPrivate?: boolean; isVerified?: boolean; accountType?: string;
  statsByContentType?: any; stats?: any; recentPosts?: PostT[]; popularPosts?: PostT[];
  postsCount?: number; avgLikes?: number; avgComments?: number; avgViews?: number; totalLikes?: number; totalViews?: number;
  bio?: string; categories?: CategoryLink[]; hashtags?: HashTag[]; mentions?: Mention[]; brandAffinity?: Affinity[];
  audience?: Audience; audienceExtra?: any; createdAt?: string; updatedAt?: string;
};
type MediaKit = {
  mediaKitId: string; influencerId: string;
  name?: string; email?: string; phone?: string; callingcode?: string;
  primaryPlatform?: string; socialProfiles?: SocialProfile[];
  country?: string; city?: string; dateOfBirth?: string; gender?: string;
  languages?: { languageId: string; code: string; name: string }[];
  onboarding?: {
    formats?: string[]; budgets?: { format: string; range: string }[]; projectLength?: string; capacity?: string;
    categoryId?: number; categoryName?: string; subcategories?: { subcategoryId: string; subcategoryName: string }[];
    collabTypes?: string[]; allowlisting?: boolean; cadences?: string[];
  };
  rateCard?: string | null; additionalNotes?: string | null; mediaKitPdf?: string; website?: string;
  createdAt?: string; updatedAt?: string; [k: string]: any;
};
type LoadResponse = { mediaKit: MediaKit };
type UpdateResponse = { mediaKit: MediaKit };

/* --------------------------- Utilities ---------------------------- */
const fmtShort = (n?: number) =>
  n == null ? "0" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`;
const fmtDate = (d?: string | Date) => {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString();
};

const STORAGE_KEYS = ["influencerId", "influencer_id", "userId", "user", "auth", "profile"];
const parseMaybe = (s: string | null) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
const pickId = (o: any): string | null => {
  if (!o || typeof o !== "object") return null;
  for (const k of ["influencerId", "influencer_id", "userId", "id", "_id"]) {
    const v = o?.[k]; if (typeof v === "string" || typeof v === "number") return String(v);
  }
  return o.profile ? pickId(o.profile) : o.user ? pickId(o.user) : null;
};
const getIdFromLS = () => {
  if (typeof window === "undefined") return null;
  for (const key of STORAGE_KEYS) {
    const raw = localStorage.getItem(key); if (!raw) continue;
    const t = raw.trim();
    if (!t.startsWith("{") && !t.startsWith("[")) { const s = t.replaceAll('"', ""); if (s) return s; }
    const obj = parseMaybe(raw); const found = pickId(obj); if (found) return found;
  }
  return null;
};

/** Normalize arrays that can be objects or strings */
const toHashtagStrings = (arr?: HashTag[]) =>
  Array.isArray(arr) ? arr.map(h => typeof h === "string" ? h : h?.tag).filter(Boolean) as string[] : [];
const toMentionStrings = (arr?: Mention[]) =>
  Array.isArray(arr) ? arr.map(m => typeof m === "string" ? m : m?.tag).filter(Boolean) as string[] : [];
const toAffinityStrings = (arr?: Affinity[]) =>
  Array.isArray(arr) ? arr.map(a => typeof a === "string" ? a : a?.name).filter(Boolean) as string[] : [];
const toCategoryStrings = (arr?: CategoryLink[]) =>
  Array.isArray(arr) ? arr.map(c => c?.subcategoryName || c?.categoryName).filter(Boolean) as string[] : [];

/* --------------------------- Component ---------------------------- */
export default function MediaKitPage({ influencerId: propId }: { influencerId?: string }) {
  const [activeTab, setActiveTab] = useState<"overview" | "social" | "audience" | "collaboration" | "rates" | "contact">("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [resolvedId, setResolvedId] = useState<string | null>(propId ?? null);

  const [mediaKit, setMediaKit] = useState<MediaKit | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [form, setForm] = useState<{ rateCard: string; additionalNotes: string; website: string; mediaKitPdf: string }>({
    rateCard: "", additionalNotes: "", website: "", mediaKitPdf: ""
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  /* Resolve influencerId */
  useEffect(() => {
    if (propId) { setResolvedId(propId); return; }
    const id = getIdFromLS();
    if (id) setResolvedId(id);
    else { setResolvedId(null); setLoading(false); setError("No influencer ID found in localStorage."); }
  }, [propId]);

  /* Fetch MediaKit */
  useEffect(() => {
    if (!resolvedId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = (await post("/media-kit/influencer", { influencerId: resolvedId })) as LoadResponse;
        setMediaKit(res.mediaKit);
        setForm({
          rateCard: res.mediaKit.rateCard ?? "",
          additionalNotes: res.mediaKit.additionalNotes ?? "",
          website: res.mediaKit.website ?? "",
          mediaKitPdf: res.mediaKit.mediaKitPdf ?? "",
        });
      } catch {
        setError("Failed to load media kit. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [resolvedId]);

  const primary = useMemo<SocialProfile | undefined>(() => {
    if (!mediaKit?.socialProfiles?.length) return undefined;
    return mediaKit.socialProfiles.find(p => p.provider === mediaKit.primaryPlatform) ?? mediaKit.socialProfiles[0];
  }, [mediaKit]);

  const hashtags = useMemo(() => toHashtagStrings(primary?.hashtags), [primary]);
  const mentions = useMemo(() => toMentionStrings(primary?.mentions), [primary]);
  const categories = useMemo(() => toCategoryStrings(primary?.categories), [primary]);
  const affinities = useMemo(() => toAffinityStrings(primary?.brandAffinity), [primary]);

  /* Save updates */
  const handleSave = async () => {
    if (!mediaKit) return;
    setSaving(true); setSaveMsg(null);
    try {
      const payload = { mediaKitId: mediaKit.mediaKitId, ...form };
      const res = (await post("/media-kit/update", payload)) as UpdateResponse;
      setMediaKit(res.mediaKit);
      setIsEditing(false);
      setSaveMsg("MediaKit updated successfully.");
      setTimeout(() => setSaveMsg(null), 2500);
    } catch {
      setSaveMsg("Failed to update. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------- Frames ---------------------------- */
  if (loading && !mediaKit) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#FFBF00] mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading your MediaKit...</p>
        </div>
      </div>
    );
  }
  if ((error && !mediaKit) || !resolvedId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-white">
        <div className="max-w-md w-full bg-white rounded-2xl border shadow-sm p-6 space-y-4 text-center">
          <p className="text-red-600 font-medium">{error ?? "No influencer ID available to load the MediaKit."}</p>
          <button
            onClick={() => {
              const id = getIdFromLS();
              if (id) { setResolvedId(id); setError(null); }
              else { setError("Still no influencer ID found in localStorage."); }
            }}
            className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900 font-semibold"
          >
            Retry from LocalStorage
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------- UI ------------------------------ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Hero Section */}
      <div className="relative bg-white border-b shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-r from-[#FFBF00]/5 to-[#FFDB58]/5" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58]" />
        <div className="relative max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {primary?.picture && (
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] rounded-3xl blur opacity-25 group-hover:opacity-40 transition" />
                <div className="relative w-32 h-32 rounded-3xl overflow-hidden bg-white shadow-xl ring-4 ring-white">
                  <img src={primary.picture} alt={mediaKit?.name ?? "Influencer"} className="w-full h-full object-cover" />
                </div>
                {primary?.isVerified && (
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-gradient-to-br from-[#FFBF00] to-[#FFDB58] rounded-full flex items-center justify-center shadow-lg ring-4 ring-white">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 text-center lg:text-left space-y-4">
              <div>
                <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 mb-2">
                  {mediaKit?.name || "Influencer"}
                </h1>
                {primary?.username && (
                  <p className="text-xl text-gray-600 flex items-center gap-2 justify-center lg:justify-start">
                    <span className="text-[#FFBF00]">@</span>{primary.username}
                  </p>
                )}
                {primary?.bio && (
                  <p className="text-gray-600 mt-3 max-w-2xl">{primary.bio}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                {mediaKit?.primaryPlatform && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border-2 border-[#FFBF00]/30 shadow-sm">
                    {getPlatformIcon(mediaKit.primaryPlatform)}
                    <span className="font-semibold capitalize text-gray-900">{mediaKit.primaryPlatform}</span>
                  </div>
                )}
                {primary?.accountType && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] rounded-full shadow-sm">
                    <Award className="w-4 h-4 text-gray-900" />
                    <span className="font-semibold text-gray-900">{primary.accountType}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsEditing(true)}
              className={`${activeClass(false)} px-6 py-3 rounded-xl transition-all duration-200 flex items-center gap-2 whitespace-nowrap`}
            >
              <Edit className="w-5 h-5" /> Edit MediaKit
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {primary && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard icon={<Users className="w-5 h-5" />} label="Followers" value={fmtShort(primary.followers)} />
              <StatCard icon={<Activity className="w-5 h-5" />} label="Engagements" value={fmtShort(primary.engagements)} />
              <StatCard icon={<Zap className="w-5 h-5" />} label="Eng. Rate" value={primary.engagementRate != null ? `${(primary.engagementRate * 100).toFixed(1)}%` : "N/A"} />
              <StatCard icon={<Eye className="w-5 h-5" />} label="Avg Views" value={fmtShort(primary.averageViews)} />
              <StatCard icon={<Heart className="w-5 h-5" />} label="Avg Likes" value={fmtShort(primary.avgLikes)} />
              <StatCard icon={<MessageCircle className="w-5 h-5" />} label="Avg Comments" value={fmtShort(primary.avgComments)} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border p-2 mb-8">
          <div className="flex flex-wrap gap-2">
            {(["overview", "social", "audience", "collaboration", "rates", "contact"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`${activeClass(activeTab === tab)} px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 capitalize`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <InfoCard
                icon={<User className="w-6 h-6" />}
                title="Profile Information"
                items={[
                  { label: "Full Name", value: mediaKit?.name },
                  { label: "Gender", value: mediaKit?.gender },
                  { label: "Location", value: [mediaKit?.city, mediaKit?.country].filter(Boolean).join(", ") || "-" },
                  { label: "Primary Platform", value: mediaKit?.primaryPlatform?.toUpperCase() },
                ]}
              />

              <InfoCard
                icon={<Languages className="w-6 h-6" />}
                title="Languages & Reach"
                items={[
                  { label: "Languages", value: mediaKit?.languages?.map(l => l.name).join(", ") },
                  { label: "Total Reach", value: fmtShort(primary?.followers) },
                  { label: "Account Created", value: fmtDate(mediaKit?.createdAt) }
                ]}
              />
            </div>

            {mediaKit?.languages && mediaKit.languages.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-[#FFBF00]" />
                  Languages Spoken
                </h3>
                <div className="flex flex-wrap gap-3">
                  {mediaKit.languages.map((l, i) => (
                    <span key={i} className="px-4 py-2 bg-gradient-to-r from-[#FFBF00]/10 to-[#FFDB58]/10 rounded-full text-sm font-medium text-gray-900 border border-[#FFBF00]/20">
                      {l.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SOCIAL */}
        {activeTab === "social" && (
          <div className="space-y-6">
            {/* Recent Posts */}
            {primary?.recentPosts && primary.recentPosts.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="p-6 border-b bg-gradient-to-r from-[#FFBF00]/5 to-[#FFDB58]/5">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-[#FFBF00]" />
                    Recent Content
                  </h3>
                  <p className="text-gray-600 mt-1">Latest posts from @{primary.username}</p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {primary.recentPosts.map((post, i) => (
                      <PostCard key={i} post={post} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tags & Affinities */}
            {(hashtags.length || mentions.length || categories.length || affinities.length) ? (
              <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
                {hashtags.length > 0 && (
                  <ChipSection title="Popular Hashtags" chips={hashtags.map(h => h.startsWith("#") ? h : `#${h}`)} tone="soft" />
                )}
                {mentions.length > 0 && (
                  <ChipSection title="Mentions" chips={mentions.map(m => m.startsWith("@") ? m : `@${m}`)} tone="outline" />
                )}
                {categories.length > 0 && (
                  <ChipSection title="Categories" chips={categories} tone="outline" />
                )}
                {affinities.length > 0 && (
                  <ChipSection title="Brand Affinity" chips={affinities} tone="soft" />
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* AUDIENCE */}
        {activeTab === "audience" && primary?.audience && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AudienceCard title="Gender Distribution" data={primary.audience.genders ?? []} />
              <AudienceCard title="Age Distribution" data={primary.audience.ages ?? []} />
              <AudienceCard title="Top Countries" data={primary.audience.geoCountries ?? []} />
              <AudienceCard title="Audience Interests" data={primary.audience.interests ?? []} />
            </div>
          </div>
        )}

        {/* COLLABORATION */}
        {activeTab === "collaboration" && mediaKit?.onboarding && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="p-6 border-b bg-gradient-to-r from-[#FFBF00]/5 to-[#FFDB58]/5">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Target className="w-6 h-6 text-[#FFBF00]" />
                  Collaboration Preferences
                </h3>
                <p className="text-gray-600 mt-1">How I like to work with brands</p>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <KV label="Category" value={mediaKit.onboarding.categoryName} />
                  <KV label="Project Length" value={mediaKit.onboarding.projectLength} />
                  <KV label="Monthly Capacity" value={mediaKit.onboarding.capacity} />
                  <KV label="Allowlisting" value={mediaKit.onboarding.allowlisting ? "Yes" : "No"} />
                </div>

                {mediaKit.onboarding.formats && mediaKit.onboarding.formats.length > 0 && (
                  <ChipSection title="Content Formats" chips={mediaKit.onboarding.formats} tone="soft" />
                )}

                {mediaKit.onboarding.collabTypes && mediaKit.onboarding.collabTypes.length > 0 && (
                  <ChipSection title="Collaboration Types" chips={mediaKit.onboarding.collabTypes} tone="outline" />
                )}

                {mediaKit.onboarding.budgets && mediaKit.onboarding.budgets.length > 0 && (
                  <div className="rounded-2xl border bg-white overflow-hidden">
                    <div className="p-4 border-b font-semibold flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-[#FFBF00]" /> Budgets
                    </div>
                    <div className="p-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-600">
                            <th className="py-2">Format</th>
                            <th className="py-2">Range</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mediaKit.onboarding.budgets.map((b, i) => (
                            <tr key={i} className="border-t">
                              <td className="py-2">{b.format}</td>
                              <td className="py-2">{b.range}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {mediaKit.onboarding.cadences && mediaKit.onboarding.cadences.length > 0 && (
                  <ChipSection title="Cadences" chips={mediaKit.onboarding.cadences} tone="outline" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* RATES */}
        {activeTab === "rates" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="p-6 border-b bg-gradient-to-r from-[#FFBF00]/5 to-[#FFDB58]/5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <DollarSign className="w-6 h-6 text-[#FFBF00]" />
                    Rate Card
                  </h3>
                  <p className="text-gray-600 mt-1">Standard pricing for collaborations</p>
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 rounded-xl border hover:border-[#FFBF00]/50 hover:bg-gradient-to-r hover:from-[#FFBF00]/5 hover:to-[#FFDB58]/5 transition-all text-sm font-medium"
                >
                  Edit
                </button>
              </div>
              <div className="p-6">
                {mediaKit?.rateCard ? (
                  <div className="space-y-3">
                    {mediaKit.rateCard.split("\n").map((line, i) => {
                      const [label, price] = line.split(":");
                      return (
                        <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border hover:border-[#FFBF00]/30 transition-colors">
                          <span className="font-medium text-gray-900">{(label ?? "").trim()}</span>
                          <span className="text-xl font-bold text-[#FFBF00]">{(price ?? "").trim()}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No rate card available</p>
                )}
              </div>
            </div>

            {mediaKit?.additionalNotes && (
              <div className="bg-white rounded-2xl shadow-sm border p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#FFBF00]" />
                  Additional Notes
                </h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{mediaKit.additionalNotes}</p>
              </div>
            )}

            {mediaKit?.mediaKitPdf && (
              <div className="bg-white rounded-2xl shadow-sm border p-6">
                <a
                  href={mediaKit.mediaKitPdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-semibold text-gray-900 underline"
                >
                  <FileText className="w-5 h-5" /> View MediaKit PDF <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        )}

        {/* CONTACT */}
        {activeTab === "contact" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="p-6 border-b bg-gradient-to-r from-[#FFBF00]/5 to-[#FFDB58]/5">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Mail className="w-6 h-6 text-[#FFBF00]" />
                  Get in Touch
                </h3>
                <p className="text-gray-600 mt-1">Let's collaborate on something amazing</p>
              </div>
              <div className="p-6 space-y-4">
                {mediaKit?.email && (
                  <ContactItem
                    icon={<Mail className="w-5 h-5" />}
                    label="Email"
                    value={mediaKit.email}
                    href={`mailto:${mediaKit.email}`}
                  />
                )}
                {mediaKit?.phone && (
                  <ContactItem
                    icon={<Phone className="w-5 h-5" />}
                    label="Phone"
                    value={`${mediaKit.callingcode ?? ""} ${mediaKit.phone}`}
                    href={`tel:${mediaKit.phone}`}
                  />
                )}
                {mediaKit?.website && (
                  <ContactItem
                    icon={<LinkIcon className="w-5 h-5" />}
                    label="Website"
                    value={mediaKit.website}
                    href={mediaKit.website}
                    external
                  />
                )}
                {primary?.url && (
                  <ContactItem
                    icon={getPlatformIcon(primary.provider)}
                    label={`${primary.provider.charAt(0).toUpperCase() + primary.provider.slice(1)} Profile`}
                    value={`@${primary.username}`}
                    href={primary.url}
                    external
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Drawer / Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setIsEditing(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl border-l p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Edit className="w-5 h-5 text-[#FFBF00]" /> Edit MediaKit
              </h3>
              <button onClick={() => setIsEditing(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <Field label="Website">
                <input
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#FFBF00]/40"
                  placeholder="https://..."
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                />
              </Field>

              <Field label="MediaKit PDF URL">
                <input
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#FFBF00]/40"
                  placeholder="https://..."
                  value={form.mediaKitPdf}
                  onChange={(e) => setForm({ ...form, mediaKitPdf: e.target.value })}
                />
              </Field>

              <Field label="Rate Card (one item per line, e.g. `Instagram Post: ₹25,000`)">
                <textarea
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#FFBF00]/40"
                  placeholder="Instagram Post: ₹25,000&#10;Reel: ₹35,000"
                  value={form.rateCard}
                  onChange={(e) => setForm({ ...form, rateCard: e.target.value })}
                />
              </Field>

              <Field label="Additional Notes">
                <textarea
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#FFBF00]/40"
                  placeholder="Any additional information for brands..."
                  value={form.additionalNotes}
                  onChange={(e) => setForm({ ...form, additionalNotes: e.target.value })}
                />
              </Field>
            </div>

            {saveMsg && <p className="mt-4 text-sm font-medium">{saveMsg}</p>}

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900 font-semibold disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-5 py-3 rounded-xl border hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------ UI building blocks ------------------------ */
function StatCard({ icon, label, value, trend }: { icon: React.ReactNode; label: string; value?: string; trend?: string }) {
  return (
    <div className="group">
      <div className="flex items-start gap-3 p-4 rounded-xl hover:bg-gradient-to-r hover:from-[#FFBF00]/5 hover:to-[#FFDB58]/5 transition-colors">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FFBF00] to-[#FFDB58] flex items-center justify-center text-white flex-shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-gray-900 mt-0.5">{value ?? "-"}</p>
          {trend && <p className="text-xs text-green-600 font-medium mt-0.5">{trend}</p>}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, items }: { icon: React.ReactNode; title: string; items: { label: string; value?: string }[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="p-6 border-b bg-gradient-to-r from-[#FFBF00]/5 to-[#FFDB58]/5">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span className="text-[#FFBF00]">{icon}</span>
          {title}
        </h3>
      </div>
      <div className="p-6 space-y-4">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
            <span className="text-sm font-medium text-gray-500">{item.label}</span>
            <span className="text-sm font-semibold text-gray-900">{item.value || "-"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostCard({ post }: { post: PostT }) {
  return (
    <div className="group relative rounded-2xl overflow-hidden bg-white border shadow-sm hover:shadow-xl transition-all duration-300">
      <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
        {(post.image || post.thumbnail) ? (
          <img
            src={post.image || post.thumbnail}
            alt="Post"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <div className="flex items-center gap-4 text-sm">
              {post.likes != null && (
                <span className="flex items-center gap-1">
                  <Heart className="w-4 h-4" fill="white" />
                  {fmtShort(post.likes)}
                </span>
              )}
              {post.comments != null && (
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-4 h-4" />
                  {fmtShort(post.comments)}
                </span>
              )}
              {post.views != null && (
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {fmtShort(post.views)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AudienceCard({ title, data }: { title: string; data: AudienceItem[] }) {
  if (!data || data.length === 0) return (
    <div className="bg-white rounded-2xl shadow-sm border p-6 text-gray-500">No data</div>
  );
  return (
    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
      <div className="p-6 border-b bg-gradient-to-r from-[#FFBF00]/5 to-[#FFDB58]/5">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      </div>
      <div className="p-6 space-y-4">
        {data.slice(0, 6).map((item, idx) => (
          <div key={idx} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-900">{item.name ?? item.code}</span>
              <span className="font-bold text-[#FFBF00]">{item.weight != null ? `${(item.weight * 100).toFixed(1)}%` : "-"}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] rounded-full transition-all duration-500"
                style={{ width: `${(item.weight ?? 0) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactItem({ icon, label, value, href, external }: { icon: React.ReactNode; label: string; value: string; href: string; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex items-center gap-4 p-4 rounded-xl border hover:border-[#FFBF00]/50 hover:bg-gradient-to-r hover:from-[#FFBF00]/5 hover:to-[#FFDB58]/5 transition-all group"
    >
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFBF00] to-[#FFDB58] flex items-center justify-center text-white flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate group-hover:text-[#FFBF00] transition-colors">{value}</p>
      </div>
      {external && <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-[#FFBF00] transition-colors" />}
    </a>
  );
}

function KV({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      <p className="text-lg text-gray-900">{value ?? "-"}</p>
    </div>
  );
}

function ChipSection({ title, chips, tone = "soft" }: { title: string; chips: string[]; tone?: "soft" | "outline" }) {
  if (!chips?.length) return null;
  const base =
    tone === "soft"
      ? "px-4 py-2 bg-gradient-to-r from-[#FFBF00]/10 to-[#FFDB58]/10 rounded-full text-sm font-medium text-gray-900 border border-[#FFBF00]/20"
      : "px-4 py-2 bg-white rounded-full text-sm font-medium text-gray-900 border-2 border-[#FFBF00]/30";
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {chips.map((c, i) => (
          <span key={`${c}-${i}`} className={base}>{c}</span>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Icons ------------------------------ */
function getPlatformIcon(platform: string) {
  const icons: Record<string, React.ReactNode> = {
    instagram: <Instagram className="w-5 h-5 text-pink-600" />,
    youtube: <Youtube className="w-5 h-5 text-red-600" />,
    tiktok: <Globe className="w-5 h-5 text-gray-700" />,
  };
  return icons[platform] || <Globe className="w-5 h-5 text-gray-700" />;
}

/* ----------------------------- Fields ----------------------------- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
