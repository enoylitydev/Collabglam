"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Info,
  ArrowLeft,
  User,
  Globe2,
  BarChart3,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  PlayCircle,
  ThumbsUp,
  Lock,
  TrendingUp,
  TrendingDown,
  Hash,
  AtSign,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Star,
  Send,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// ---------------- Types (aligned with new payloads incl. aggregates) ----------------
export type Platform = "youtube" | "tiktok" | "instagram";

export type StatHistoryEntry = {
  month: string; // YYYY-MM
  avgEngagements?: number;
  avgViews?: number;
  avgShares?: number;
  avgSaves?: number;
  avgLikes?: number;
  avgComments?: number;
};

// Aggregated distribution blocks that Modash sometimes returns outside `profile`
export type DistValue = { numberOfItems: number; value: number | Record<string, number> };
export type DistSet = {
  mean?: DistValue[];
  min?: DistValue[];
  max?: DistValue[];
  median?: DistValue[];
};
export type PostingStats = Record<string, any>; // heterogeneous across platforms
export type ContentAgg = {
  total?: number;
  likes?: DistSet;
  views?: DistSet;
  comments?: DistSet;
  engagement_rate?: DistValue[];
  posting_statistics?: PostingStats;
};

export type ContentTypeStats = {
  engagements?: number;
  engagementRate?: number;
  avgLikes?: number;
  avgComments?: number;
  statHistory?: StatHistoryEntry[];
  avgPosts4weeks?: number; // present on YT/TikTok all; sometimes IG too
  agg?: ContentAgg; // NEW: aggregated medians/totals injected from extra payload blocks
};

export type StatsByContentType = {
  all?: ContentTypeStats; // universally present
  reels?: ContentTypeStats; // Instagram
  posts?: ContentTypeStats; // Instagram
  videos?: ContentTypeStats; // YouTube/TikTok
  shorts?: ContentTypeStats; // YouTube/TikTok
  streams?: ContentTypeStats; // YouTube
};

export type ProfileHeader = {
  fullname?: string;
  username: string; // IG/YT/TikTok handle name
  handle?: string; // YouTube-only short handle
  url: string;
  picture: string;
  followers: number;
  engagements?: number;
  engagementRate?: number; // 0..1
  avgLikes?: number; // may not be present; we derive at top-level
  averageViews?: number; // YT/TikTok header; IG sometimes present
};

export type Contact = { value: string; type?: string };

export type RecentPost = {
  id: string;
  text?: string;
  title?: string; // we’ll derive from text if missing
  url: string;
  created: string;
  likes?: number;
  comments?: number;
  views?: number;
  thumbnail?: string; // YT required; TikTok caveat (expiring); IG often missing
  video?: string; // YT/TikTok
  type?: string; // YT/TikTok/IG
  image?: string; // IG sometimes
  mentions?: string[];
  hashtags?: string[];
};

export type WeightedItem = { code?: string; name?: string; weight: number; male?: number; female?: number };
export type MiniUser = {
  userId: string;
  fullname?: string;
  username?: string;
  url?: string;
  picture?: string;
  followers?: number;
  engagements?: number;
};

export type Audience = {
  notable?: number;
  genders?: WeightedItem[];
  ages?: WeightedItem[];
  gendersPerAge?: WeightedItem[];
  geoCountries?: WeightedItem[];
  geoCities?: WeightedItem[];
  geoStates?: WeightedItem[];
  languages?: WeightedItem[];
  interests?: WeightedItem[];
  brandAffinity?: WeightedItem[];
  notableUsers?: MiniUser[];
  audienceLookalikes?: MiniUser[];
  credibility?: number; // 0..1
  ethnicities?: WeightedItem[];
  audienceReachability?: WeightedItem[]; // {code: "-500" | "500-1000" | ...}
  audienceTypes?: WeightedItem[]; // {code: "real" | "influencers" | ...}
};

export type InfluencerProfile = {
  userId: string;
  secUid?: string; // TikTok
  profile?: ProfileHeader; // IG & YT include nested profile
  isVerified?: boolean; // IG/TikTok
  isPrivate?: boolean; // IG/TikTok sometimes
  city?: string;
  state?: string;
  country?: string;
  gender?: string;
  ageGroup?: string;
  language?: { code?: string; name?: string };
  accountType?: string;
  contacts?: Contact[];
  postsCount?: number; // IG/YT/TikTok
  postsCounts?: number; // IG alt spelling (normalize to postsCount)
  bio?: string; // IG/TikTok; YT uses description
  description?: string; // normalized alias for IG/TikTok
  interests?: string[] | WeightedItem[];
  avgLikes?: number; // normalized from statsByContentType or deprecated stats
  avgComments?: number; // normalized
  averageViews?: number; // convenience mirror of header.averageViews
  totalViews?: number; // YouTube
  totalLikes?: number; // TikTok
  total?: number; // generic
  stats?: Record<string, { value?: number; compared?: number }>; // some payloads include this
  statsByContentType?: StatsByContentType;
  hashtags?: Array<{ tag?: string; weight?: number }>;
  mentions?: Array<{ tag?: string; weight?: number }>;
  brandAffinity?: WeightedItem[];
  audience?: Audience;
  audienceCommenters?: Audience;
  audienceExtra?: {
    followersRange?: { leftNumber?: number; rightNumber?: number };
    engagementRateDistribution?: Array<{ min?: number; max?: number; total?: number; median?: boolean }>;
    credibilityDistribution?: Array<{ min?: number; max?: number; total?: number; median?: boolean }>;
  };
  lookalikes?: MiniUser[];
  lookalikesByTopics?: MiniUser[];
  recentPosts?: RecentPost[];
  popularPosts?: RecentPost[];
  sponsoredPosts?: Array<RecentPost & { sponsors?: Array<{ domain?: string; logo_url?: string; name?: string }> }>;
  paidPostPerformance?: number; // 0..1
  paidPostPerformanceViews?: number;
  sponsoredPostsMedianViews?: number;
  sponsoredPostsMedianLikes?: number;
  nonSponsoredPostsMedianViews?: number;
  nonSponsoredPostsMedianLikes?: number;
  statHistory?: Array<{
    month: string;
    followers?: number;
    following?: number;
    avgLikes?: number;
    avgViews?: number;
    avgComments?: number;
    avgShares?: number;
    avgSaves?: number;
  }>;
  avgViews?: number; // IG sometimes
  avgReelsPlays?: number; // IG reels
};

export type ReportResponse = {
  error?: boolean;
  profile: InfluencerProfile;
  // Sometimes Modash appends aggregate blocks outside `profile`.
  // If present, we'll lift them into profile.statsByContentType.*.agg
  videos?: ContentAgg;
  shorts?: ContentAgg;
  posts?: ContentAgg;
  reels?: ContentAgg;
};

// ---------------- Utilities ----------------
function formatNumber(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}
function formatPercent(x?: number, digits = 2) {
  if (x == null || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}
function titleCase(x?: string) {
  if (!x) return "—";
  const s = x.toString();
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
function prettyPlace(country?: string, city?: string, state?: string) {
  const cityPretty = city
    ? city
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ")
    : "";
  const statePretty = state ? `, ${state}` : "";
  return `${country || "—"}${cityPretty ? ` · ${cityPretty}${statePretty}` : ""}`;
}

// Read a median value from an aggregate block
function getMedian(agg?: ContentAgg, key?: "likes" | "comments" | "views"): number | undefined {
  if (!agg || !key) return undefined;
  const arr = agg[key]?.median;
  if (Array.isArray(arr) && arr.length > 0) {
    const v = arr[0]?.value as number;
    return typeof v === "number" ? v : undefined;
  }
  return undefined;
}

const pct = (x?: number) => (x == null || Number.isNaN(x) ? "—" : `${Math.round(x * 100)}%`);
const topN = <T,>(arr: T[] | undefined | null, n = 5): T[] => (Array.isArray(arr) ? arr.filter(Boolean).slice(0, n) : []);

// Normalize Modash -> UI friendly (snake -> camel, titles, description, stat history lifting, aggregate injection)
function normalizeReport(resp: ReportResponse, platform: Platform): ReportResponse {
  const out: ReportResponse = JSON.parse(JSON.stringify(resp));
  const p = out.profile as InfluencerProfile & { stats?: any };

  // Normalize IG alt spelling
  if (p.postsCounts && !p.postsCount) p.postsCount = p.postsCounts;

  // Description: IG/TikTok use `bio`, map to `description` for UI; YT already uses `description` in spec
  p.description = p.description ?? p.bio ?? p.description ?? "";

  // Header conveniences (mirror averageViews)
  if (p.profile) {
    p.averageViews = p.profile.averageViews ?? p.averageViews;
  }

  // Ensure statsByContentType scaffolding exists
  p.statsByContentType = p.statsByContentType ?? {};
  p.statsByContentType.all = p.statsByContentType.all ?? {};

  // Inject external aggregate blocks into statsByContentType.*.agg
  const raw: any = resp as any;
  const ensureAgg = (key: keyof StatsByContentType) => {
    (p.statsByContentType as any)[key] = (p.statsByContentType as any)[key] || {};
    (p.statsByContentType as any)[key].agg = (p.statsByContentType as any)[key].agg || {};
  };
  ["videos", "shorts", "posts", "reels"].forEach((k) => {
    if (raw && (raw as any)[k]) {
      ensureAgg(k as keyof StatsByContentType);
      (p.statsByContentType as any)[k].agg = (raw as any)[k];
    }
  });

  // Derive top-level avgLikes / avgComments from preferred sources
  const all = p.statsByContentType.all;
  p.avgLikes = p.avgLikes ?? all?.avgLikes ?? p.stats?.avgLikes?.value ?? undefined;
  p.avgComments = p.avgComments ?? all?.avgComments ?? p.stats?.avgComments?.value ?? undefined;

  // Normalize any existing statHistory inside statsByContentType
  if (all?.statHistory && Array.isArray(all.statHistory)) {
    all.statHistory = all.statHistory.map((h: any) => ({
      month: h.month,
      avgEngagements:
        h.avgEngagements ??
        (isFinite(h.avgLikes) || isFinite(h.avgComments)
          ? Number(h.avgLikes || 0) + Number(h.avgComments || 0)
          : undefined),
      avgViews: h.avgViews ?? (h as any).avg_views,
      avgShares: h.avgShares ?? (h as any).avg_shares,
      avgSaves: h.avgSaves ?? (h as any).avg_saves,
      avgLikes: h.avgLikes ?? (h as any).avg_likes,
      avgComments: h.avgComments ?? (h as any).avg_comments,
    }));
  }

  // Lift top-level statHistory (if present) into all.statHistory with computed avgEngagements
  if (Array.isArray(p.statHistory) && p.statHistory.length > 0) {
    const lifted = p.statHistory.map((h: any) => {
      const avgLikes = h.avgLikes ?? (h as any).avg_likes ?? 0;
      const avgComments = h.avgComments ?? (h as any).avg_comments ?? 0;
      return {
        month: h.month,
        avgViews: h.avgViews ?? (h as any).avg_views,
        avgShares: h.avgShares ?? (h as any).avg_shares,
        avgSaves: h.avgSaves ?? (h as any).avg_saves,
        avgLikes,
        avgComments,
        avgEngagements: Number(avgLikes) + Number(avgComments),
      } as StatHistoryEntry;
    });
    if (!all?.statHistory || (all.statHistory?.length || 0) < lifted.length) {
      p.statsByContentType!.all!.statHistory = lifted;
    }
  }

  // Interests normalization — ensure array of strings to avoid React rendering objects; drop empties
  if (Array.isArray(p.interests)) {
    p.interests = (p.interests as any[])
      .map((it: any) =>
        typeof it === "string"
          ? it
          : it?.name || it?.code || (typeof it?.id !== "undefined" ? String(it.id) : "")
      )
      .filter((s: any) => typeof s === "string" && s.trim().length > 0) as string[];
  }

  // Drop empty hashtag/mention tags
  if (Array.isArray(p.hashtags)) p.hashtags = p.hashtags.filter((h) => h?.tag && h.tag.trim());
  if (Array.isArray(p.mentions)) p.mentions = p.mentions.filter((h) => h?.tag && h.tag.trim());

  out.profile = p;
  return out;
}

// ---------------- Page ----------------
export default function InfluencerReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const platformParam = (searchParams.get("platform") ?? "instagram") as Platform;
  const userIdParam = searchParams.get("id") ?? ""; // UI uses `id`; server expects `userId`

  const initialCalc: "median" | "average" =
    searchParams.get("calculationMethod") === "average" ? "average" : "median";

  const [calculationMethod, setCalculationMethod] = useState<"median" | "average">(initialCalc);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ReportResponse | null>(null);

  const canFetch = !!userIdParam && ["youtube", "tiktok", "instagram"].includes(platformParam);

  const statHistory = useMemo<StatHistoryEntry[]>(() => {
    const hist = data?.profile?.statsByContentType?.all?.statHistory || [];
    return hist?.slice(-12);
  }, [data]);

  const handleFetch = async () => {
    if (!canFetch) return;
    setLoading(true);
    setError(null);

    try {
      const q = new URLSearchParams({
        platform: platformParam,
        userId: userIdParam,
        calculationMethod,
      });
      const res = await fetch(`/api/modash/report?${q.toString()}`);
      const raw = await res.json();
      if (!res.ok || raw?.error) {
        throw new Error(raw?.message || raw?.error || `Failed to fetch report (${res.status})`);
      }

      const normalized = normalizeReport(raw as ReportResponse, platformParam);
      setData(normalized);

      // Keep calc method in URL for sharing
      const sp = new URLSearchParams(Array.from(searchParams.entries()));
      sp.set("calculationMethod", calculationMethod);
      router.replace(`/brand/influencers/view?${sp.toString()}`);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const header = data?.profile?.profile;

  // Build content aggregates to display
  const contentAggRows = useMemo(() => {
    if (!data?.profile?.statsByContentType) return [] as Array<{ key: string; label: string; total?: number; medLikes?: number; medComments?: number; medViews?: number }>;
    const sbc = data.profile.statsByContentType as any;
    const rows: Array<{ key: string; label: string; total?: number; medLikes?: number; medComments?: number; medViews?: number }> = [];

    const pushRow = (key: string, label: string) => {
      const c = sbc[key] as ContentTypeStats | undefined;
      const agg = c?.agg;
      if (!agg) return;
      rows.push({
        key,
        label,
        total: agg.total,
        medLikes: getMedian(agg, "likes"),
        medComments: getMedian(agg, "comments"),
        medViews: getMedian(agg, "views"),
      });
    };

    if (platformParam === "instagram") {
      pushRow("posts", "Posts");
      pushRow("reels", "Reels");
    } else if (platformParam === "tiktok") {
      pushRow("videos", "Videos");
      pushRow("shorts", "Short videos");
    } else if (platformParam === "youtube") {
      pushRow("videos", "Videos");
      pushRow("shorts", "Shorts");
      pushRow("streams", "Streams"); // might be empty
    }

    return rows.filter((r) => r.total != null || r.medLikes != null || r.medComments != null || r.medViews != null);
  }, [data, platformParam]);

  const audience = data?.profile?.audience;

  return (
    <div className="min-h-[100vh] bg-gradient-to-b from-white to-orange-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Top Bar */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="ml-auto inline-flex items-center gap-2 text-xs text-gray-600">
            <Info className="h-4 w-4" /> Influencer contact details are not enabled by default. Contact us to unlock this data for free. Every successful request costs 1 credit.
          </div>
        </div>

        {/* Params */}
        <div className="flex flex-wrap items-end gap-3 mb-6">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Platform</label>
            <input value={platformParam} readOnly className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm w-44" />
          </div>
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-semibold text-gray-700 mb-1">User ID / Handle</label>
            <input
              defaultValue={userIdParam}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const input = (e.target as HTMLInputElement).value.trim();
                  if (input) router.push(`/brand/influencers/view?id=${encodeURIComponent(input)}&platform=${platformParam}`);
                }
              }}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm w-full"
              placeholder={platformParam === "youtube" ? "e.g. tseries" : platformParam === "tiktok" ? "e.g. charlidamelio" : "e.g. devansh.dwivedi.1"}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">calculationMethod</label>
            <select
              value={calculationMethod}
              onChange={(e) => setCalculationMethod(e.target.value as any)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="median">median</option>
              <option value="average">average</option>
            </select>
          </div>
          <button
            onClick={handleFetch}
            disabled={!canFetch || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FFA135] to-[#FF7236] px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? "Fetching…" : "Get report"}
          </button>
        </div>

        {/* Empty / Error */}
        {!data && !error && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <BarChart3 className="h-8 w-8 text-orange-600" />
            </div>
            <div className="text-lg font-semibold">Ready to fetch a report</div>
            <div className="text-sm">Confirm the params and click <span className="font-semibold">Get report</span>.</div>
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm flex items-start gap-2">
            <AlertCircle className="h-5 w-5" />
            <div>
              <div className="font-semibold">Request failed</div>
              <div>{error}</div>
            </div>
          </div>
        )}

        {/* Header */}
        {data && (
          <div className="mb-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              {header?.picture ? (
                <img src={header.picture} alt={header.fullname || header.username} className="h-20 w-20 rounded-2xl object-cover" />
              ) : (
                <div className="h-20 w-20 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <User className="h-8 w-8 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="truncate text-xl font-bold">{header?.fullname || header?.username || data.profile.userId}</h1>
                  {platformParam === "youtube" && header?.handle ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">@{header.handle}</span>
                  ) : null}
                  {data.profile.isVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      <CheckCircle2 className="h-4 w-4" /> Verified
                    </span>
                  ) : null}
                  {data.profile.isPrivate ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      <Lock className="h-4 w-4" /> Private
                    </span>
                  ) : null}
                </div>
                <div className="text-sm text-gray-600 truncate">
                  {header?.username} · {header?.url ? (<a className="underline hover:no-underline" href={header.url} target="_blank" rel="noreferrer">Profile</a>) : "—"}
                </div>

                {/* Key Metrics (platform-aware) */}
                <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2">
                  <Metric label="Followers" value={formatNumber(header?.followers)} />
                  <Metric label="Engagement rate" value={formatPercent(header?.engagementRate)} />
                  <Metric label="Avg likes" value={formatNumber(data.profile.avgLikes)} />
                  <Metric label="Avg comments" value={formatNumber(data.profile.avgComments)} />
                  {/* IG: prefer Avg views if available, else Posts(4w). Other platforms: Avg views */}
                  {platformParam === "instagram" ? (
                    data.profile.averageViews ? (
                      <Metric label="Avg views" value={formatNumber(data.profile.averageViews)} />
                    ) : (
                      <Metric label="Posts (4w)" value={formatNumber(data.profile.statsByContentType?.all?.avgPosts4weeks)} />
                    )
                  ) : (
                    <Metric label="Avg views" value={formatNumber(data.profile.averageViews)} />
                  )}
                  {typeof data.profile.postsCount === "number" && (
                    <Metric label="Posts" value={formatNumber(data.profile.postsCount)} />
                  )}
                </div>

                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                  {platformParam === "youtube" && (
                    <Metric small label="Total views" value={<span className="inline-flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" />{formatNumber(data.profile.totalViews)}</span>} />
                  )}
                  {platformParam === "tiktok" && (
                    <Metric small label="Total likes" value={<span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" />{formatNumber(data.profile.totalLikes)}</span>} />
                  )}
                  {typeof data.profile.avgReelsPlays === "number" && (
                    <Metric small label="Avg reels plays" value={formatNumber(data.profile.avgReelsPlays)} />
                  )}
                  {data.profile.language?.name && (
                    <Metric small label="Language" value={data.profile.language?.name || data.profile.language?.code || "—"} />
                  )}
                  {data.profile.accountType && (
                    <Metric small label="Account type" value={data.profile.accountType} />
                  )}
                  {data.profile.secUid && (
                    <Metric small label="secUid" value={<span className="truncate inline-block max-w-[140px] align-bottom" title={data.profile.secUid}>{data.profile.secUid}</span>} />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left */}
            <div className="lg:col-span-2 space-y-6">
              {/* Time series */}
              <section className="rounded-3xl border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold mb-3">Last 12 months — Avg Engagements</h2>
                {statHistory && statHistory.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={statHistory} margin={{ left: 6, right: 6, top: 18, bottom: 6 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <ReTooltip />
                        <Line type="monotone" dataKey="avgEngagements" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyTiny label="No stat history available" />
                )}
              </section>

              {/* Content breakdown (aggregates) */}
              <section className="rounded-3xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold">Content breakdown (medians)</h2>
                  <span className="text-xs text-gray-500">From Modash aggregates</span>
                </div>
                {contentAggRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="py-2 pr-3">Type</th>
                          <th className="py-2 pr-3">Total</th>
                          <th className="py-2 pr-3">Median likes</th>
                          <th className="py-2 pr-3">Median comments</th>
                          <th className="py-2 pr-3">Median views</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contentAggRows.map((r) => (
                          <tr key={r.key} className="border-t border-gray-100">
                            <td className="py-2 pr-3 font-medium">{r.label}</td>
                            <td className="py-2 pr-3">{formatNumber(r.total)}</td>
                            <td className="py-2 pr-3">{formatNumber(r.medLikes)}</td>
                            <td className="py-2 pr-3">{formatNumber(r.medComments)}</td>
                            <td className="py-2 pr-3">{formatNumber(r.medViews)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyTiny label="No aggregate content stats" />
                )}
              </section>

              {/* Stats snapshot (if provided at profile.stats) */}
              {(data.profile.stats && Object.keys(data.profile.stats).length > 0) && (
                <section className="rounded-3xl border border-gray-200 bg-white p-5">
                  <h2 className="text-base font-semibold mb-3">Stats snapshot</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(data.profile.stats).map(([k, v]) => (
                      <div key={k} className="rounded-xl border border-gray-200 p-4 bg-white">
                        <div className="text-xs text-gray-500">{titleCase(k.replace(/avg/g, "Avg "))}</div>
                        <div className="text-base font-semibold flex items-center gap-2">
                          <span>{formatNumber(v?.value)}</span>
                          {typeof v?.compared === "number" && (
                            v!.compared! >= 0 ? (
                              <span className="inline-flex items-center text-green-600 text-xs"><TrendingUp className="h-3.5 w-3.5" /> {pct(v?.compared)}</span>
                            ) : (
                              <span className="inline-flex items-center text-red-600 text-xs"><TrendingDown className="h-3.5 w-3.5" /> {pct(Math.abs(v!.compared!))}</span>
                            )
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Hashtags & Mentions */}
              {(topN(data.profile.hashtags, 12).length > 0 || topN(data.profile.mentions, 12).length > 0) && (
                <section className="rounded-3xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold">Hashtags & Mentions</h2>
                    <span className="text-xs text-gray-500">Top items</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {topN(data.profile.hashtags, 12).length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 mb-2 inline-flex items-center gap-1"><Hash className="h-3.5 w-3.5" /> Hashtags</div>
                        <div className="flex flex-wrap gap-2">
                          {topN(data.profile.hashtags, 12).map((h, i) => (
                            <span key={i} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-800">#{h.tag} {typeof h.weight === 'number' && <span className="text-gray-500">· {pct(h.weight)}</span>}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {topN(data.profile.mentions, 12).length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 mb-2 inline-flex items-center gap-1"><AtSign className="h-3.5 w-3.5" /> Mentions</div>
                        <div className="flex flex-wrap gap-2">
                          {topN(data.profile.mentions, 12).map((m, i) => (
                            <span key={i} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-800">@{m.tag} {typeof m.weight === 'number' && <span className="text-gray-500">· {pct(m.weight)}</span>}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Popular posts */}
              {Array.isArray(data.profile.popularPosts) && data.profile.popularPosts.length > 0 && (
                <section className="rounded-3xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold">Popular posts</h2>
                    <span className="text-xs text-gray-500">Up to 12</span>
                  </div>
                  <PostsGrid posts={data.profile.popularPosts.slice(0, 12)} />
                </section>
              )}

              {/* Sponsored posts & paid performance */}
              {(Array.isArray(data.profile.sponsoredPosts) && data.profile.sponsoredPosts.length > 0) || typeof data.profile.paidPostPerformance === 'number' ? (
                <section className="rounded-3xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold">Sponsored content</h2>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {typeof data.profile.paidPostPerformance === 'number' && (
                      <Metric small label="Paid post performance" value={<span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" />{formatPercent(data.profile.paidPostPerformance)}</span>} />
                    )}
                    {typeof data.profile.paidPostPerformanceViews === 'number' && (
                      <Metric small label="Paid perf. (views)" value={formatNumber(data.profile.paidPostPerformanceViews)} />
                    )}
                    {typeof data.profile.sponsoredPostsMedianViews === 'number' && (
                      <Metric small label="Sponsored median views" value={formatNumber(data.profile.sponsoredPostsMedianViews)} />
                    )}
                    {typeof data.profile.sponsoredPostsMedianLikes === 'number' && (
                      <Metric small label="Sponsored median likes" value={formatNumber(data.profile.sponsoredPostsMedianLikes)} />
                    )}
                    {typeof data.profile.nonSponsoredPostsMedianViews === 'number' && (
                      <Metric small label="Non‑sponsored median views" value={formatNumber(data.profile.nonSponsoredPostsMedianViews)} />
                    )}
                    {typeof data.profile.nonSponsoredPostsMedianLikes === 'number' && (
                      <Metric small label="Non‑sponsored median likes" value={formatNumber(data.profile.nonSponsoredPostsMedianLikes)} />
                    )}
                  </div>

                  {Array.isArray(data.profile.sponsoredPosts) && data.profile.sponsoredPosts.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {data.profile.sponsoredPosts.slice(0, 12).map((p, idx) => (
                        <a key={p.id + idx} href={p.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-gray-200 bg-white hover:shadow">
                          {p.thumbnail || p.image ? (
                            <div className="aspect-video bg-gray-100 overflow-hidden">
                              <img src={p.thumbnail || p.image} alt={p.title || p.text || ""} className="h-full w-full object-cover group-hover:scale-[1.02] transition" />
                            </div>
                          ) : (
                            <div className="aspect-video bg-gray-50 flex items-center justify-center text-xs text-gray-400">No preview</div>
                          )}
                          <div className="p-3">
                            <div className="line-clamp-2 text-xs font-medium">{p.title || p.text}</div>
                            <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-gray-600">
                              <div><Heart className="inline h-3 w-3" /> {formatNumber(p.likes)}</div>
                              <div><MessageCircle className="inline h-3 w-3" /> {formatNumber(p.comments)}</div>
                              <div><Eye className="inline h-3 w-3" /> {formatNumber(p.views)}</div>
                            </div>
                            {p.sponsors && p.sponsors.length > 0 && (
                              <div className="mt-2 flex items-center gap-2">
                                {p.sponsors.slice(0, 3).map((s, si) => (
                                  <span key={si} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-700">
                                    {s.logo_url ? <img src={s.logo_url} className="h-3.5 w-3.5 rounded" alt={s.name || s.domain || ""} /> : null}
                                    {s.name || s.domain}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <EmptyTiny label="No sponsored posts" />
                  )}
                </section>
              ) : null}

              {/* Recent posts */}
              <section className="rounded-3xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold">Recent posts</h2>
                  <span className="text-xs text-gray-500">Showing up to 12</span>
                </div>
                {data.profile.recentPosts && data.profile.recentPosts.length > 0 ? (
                  <PostsGrid posts={data.profile.recentPosts.slice(0, 12)} />
                ) : (
                  <EmptyTiny label="No recent posts" />
                )}
              </section>

              {/* Lookalikes & Notable users */}
              {(topN(audience?.notableUsers, 12).length > 0 || topN(audience?.audienceLookalikes, 12).length > 0 || topN(data.profile.lookalikes, 12).length > 0 || topN(data.profile.lookalikesByTopics, 12).length > 0) && (
                <section className="rounded-3xl border border-gray-200 bg-white p-5">
                  <h2 className="text-base font-semibold mb-3">Lookalikes & notable users</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {topN(audience?.notableUsers, 12).length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 mb-2">Notable users</div>
                        <PeopleList people={topN(audience?.notableUsers, 12)} />
                      </div>
                    )}
                    {topN(audience?.audienceLookalikes, 12).length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 mb-2">Audience lookalikes</div>
                        <PeopleList people={topN(audience?.audienceLookalikes, 12)} />
                      </div>
                    )}
                    {topN(data.profile.lookalikes, 12).length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 mb-2">Lookalikes</div>
                        <PeopleList people={topN(data.profile.lookalikes, 12)} />
                      </div>
                    )}
                    {topN(data.profile.lookalikesByTopics, 12).length > 0 && (
                      <div>
                        <div className="text-xs text-gray-500 mb-2">Topic lookalikes</div>
                        <PeopleList people={topN(data.profile.lookalikesByTopics, 12)} />
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Right */}
            <div className="space-y-6">
              {/* About & audience */}
              <section className="rounded-3xl border border-gray-200 bg-white p-5">
                <button
                  onClick={handleFetch}
                  disabled={!canFetch || loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FFA135] to-[#FF7236] px-4 py-2 text-white disabled:opacity-50"
                >
                  {loading ? <Send className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {loading ? "Fetching…" : "Message Now"}
                </button>
                <h2 className="text-base font-semibold mb-3">About & audience</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Globe2 className="h-4 w-4" /> {prettyPlace(data.profile.country, data.profile.city, data.profile.state)}
                  </div>
                  <div className="text-gray-600">{data.profile.description || "—"}</div>
                  {Array.isArray(data.profile.interests) && (data.profile.interests as any[]).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {(data.profile.interests as any[]).slice(0, 8).map((i: any, idx: number) => (
                        <span key={idx} className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">{typeof i === 'string' ? i : (i?.name || i?.code || '')}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Metric small label="Age group" value={data.profile.ageGroup || "—"} />
                  <Metric small label="Gender" value={titleCase(data.profile.gender)} />
                  {typeof audience?.notable === 'number' && (
                    <Metric small label="Notable audience" value={formatPercent(audience?.notable)} />
                  )}
                  {typeof audience?.credibility === 'number' && (
                    <Metric small label="Credibility" value={formatPercent(audience?.credibility)} />
                  )}
                </div>

                <div className="mt-4 text-xs text-gray-600">
                  {data.profile.contacts && data.profile.contacts.length > 0 ? (
                    <div className="space-y-1">
                      {data.profile.contacts.slice(0, 3).map((c, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span className="truncate">{c.value}</span>
                          {c.type && (
                            <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600">{c.type}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <Info className="mt-0.5 h-4 w-4" /> Contact details are locked. Reach out to enable them for free.
                    </div>
                  )}
                </div>
              </section>

              {/* Audience distributions */}
              {(audience && (
                (topN(audience.genders, 3).length > 0) ||
                (topN(audience.ages, 6).length > 0) ||
                (topN(audience.geoCountries, 6).length > 0) ||
                (topN(audience.languages, 6).length > 0) ||
                (topN(audience.ethnicities, 6).length > 0) ||
                (topN(audience.audienceTypes, 6).length > 0) ||
                (topN(audience.audienceReachability, 6).length > 0)
              )) && (
                  <section className="rounded-3xl border border-gray-200 bg-white p-5 space-y-4">
                    <h2 className="text-base font-semibold">Audience breakdown</h2>
                    {topN(audience.genders, 3).length > 0 && (
                      <DistBlock title="Genders" items={topN(audience.genders, 3)} formatLabel={(it) => it.name || it.code || "—"} />
                    )}
                    {topN(audience.ages, 6).length > 0 && (
                      <DistBlock title="Ages" items={topN(audience.ages, 6)} formatLabel={(it) => it.name || it.code || "—"} />
                    )}
                    {topN(audience.geoCountries, 6).length > 0 && (
                      <DistBlock title="Top countries" items={topN(audience.geoCountries, 6)} formatLabel={(it) => it.name || it.code || "—"} />
                    )}
                    {topN(audience.languages, 6).length > 0 && (
                      <DistBlock title="Languages" items={topN(audience.languages, 6)} formatLabel={(it) => it.name || it.code || "—"} />
                    )}
                    {topN(audience.ethnicities, 6).length > 0 && (
                      <DistBlock title="Ethnicities" items={topN(audience.ethnicities, 6)} formatLabel={(it) => it.name || it.code || "—"} />
                    )}
                    {topN(audience.audienceTypes, 6).length > 0 && (
                      <DistBlock title="Audience types" items={topN(audience.audienceTypes, 6)} formatLabel={(it) => titleCase(it.code || it.name || "")} />
                    )}
                    {topN(audience.audienceReachability, 6).length > 0 && (
                      <DistBlock title="Reachability" items={topN(audience.audienceReachability, 6)} formatLabel={(it) => it.code || it.name || "—"} />
                    )}

                    {data.profile.audienceExtra?.followersRange && (
                      <div className="rounded-xl border border-gray-200 p-4">
                        <div className="text-xs text-gray-500 mb-2">Audience followers range</div>
                        <div className="text-sm font-medium">{formatNumber(data.profile.audienceExtra.followersRange.leftNumber)} – {formatNumber(data.profile.audienceExtra.followersRange.rightNumber)}</div>
                      </div>
                    )}
                  </section>
                )}

              {/* Brand affinity */}
              {Array.isArray(data.profile.brandAffinity) && data.profile.brandAffinity.length > 0 && (
                <section className="rounded-3xl border border-gray-200 bg-white p-5">
                  <h2 className="text-base font-semibold mb-3">Brand affinity</h2>
                  <div className="flex flex-wrap gap-2">
                    {topN(data.profile.brandAffinity, 20).map((b, i) => (
                      <span key={i} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-800">{b.name || b.code || "—"} {typeof b.weight === 'number' && <span className="text-gray-500">· {pct(b.weight)}</span>}</span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Small UI helpers ----------------
function Metric({ label, value, small = false }: { label: string; value: React.ReactNode; small?: boolean }) {
  return (
    <div className={`rounded-xl border border-gray-200 ${small ? "p-3" : "p-4"} bg-white`}>
      <div className={`${small ? "text-[11px]" : "text-xs"} text-gray-500`}>{label}</div>
      <div className={`${small ? "text-sm" : "text-base"} font-semibold`}>{value}</div>
    </div>
  );
}

function EmptyTiny({ label }: { label: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500">
      {label}
    </div>
  );
}

function WeightBar({ weight }: { weight?: number }) {
  const w = Math.max(0, Math.min(1, Number(weight || 0)));
  return (
    <div className="h-2 w-full rounded bg-gray-100 overflow-hidden">
      <div className="h-full bg-orange-400" style={{ width: `${w * 100}%` }} />
    </div>
  );
}

function DistBlock({ title, items, formatLabel }: { title: string; items: WeightedItem[]; formatLabel: (it: WeightedItem) => string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-2">{title}</div>
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={idx} className="grid grid-cols-5 gap-2 items-center">
            <div className="col-span-2 truncate text-sm">{formatLabel(it)}</div>
            <div className="col-span-2"><WeightBar weight={it.weight} /></div>
            <div className="text-right text-sm text-gray-600">{pct(it.weight)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PeopleList({ people }: { people: MiniUser[] }) {
  if (!people || people.length === 0) return null;
  return (
    <div className="space-y-2">
      {people.map((u, i) => (
        <a key={(u.userId || i) + "_p"} href={u.url || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-gray-200 p-2 hover:bg-gray-50">
          {u.picture ? (
            <img src={u.picture} alt={u.fullname || u.username || ""} className="h-8 w-8 rounded-md object-cover"
            />
          ) : (
            <div className="h-8 w-8 rounded-md bg-gray-100 flex items-center justify-center">
              <User className="h-4 w-4 text-gray-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">
              {u.fullname || u.username || "—"}
            </div>
            <div className="text-xs text-gray-600 truncate">
              @{u.username || u.fullname || u.userId}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-600">
            {typeof u.followers === "number" && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {formatNumber(u.followers)}
              </span>
            )}
            {typeof u.engagements === "number" && (
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" />
                {formatNumber(u.engagements)}
              </span>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}

function derivePostTitle(p: RecentPost) {
  const base = (p.title || p.text || "").trim();
  if (base) return base;
  if (p.type) return `${titleCase(p.type)} post`;
  return "Post";
}

function PostsGrid({ posts }: { posts: RecentPost[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {posts.map((p, idx) => {
        const title = derivePostTitle(p);
        const hasPreview = Boolean(p.thumbnail || p.image);
        const created =
          p.created ? new Date(p.created).toLocaleDateString() : "";

        return (
          <a
            key={p.id + "_" + idx}
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="group overflow-hidden rounded-2xl border border-gray-200 bg-white hover:shadow"
          >
            {hasPreview ? (
              <div className="aspect-video bg-gray-100 overflow-hidden relative">
                <img
                  src={p.thumbnail || p.image}
                  alt={title}
                  className="h-full w-full object-cover group-hover:scale-[1.02] transition"
                />
                {p.video && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PlayCircle className="h-10 w-10 drop-shadow-sm text-white/90" />
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-video bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                No preview
              </div>
            )}

            <div className="p-3">
              <div className="line-clamp-2 text-xs font-medium">{title}</div>

              <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-gray-600">
                <div>
                  <Heart className="inline h-3 w-3" /> {formatNumber(p.likes)}
                </div>
                <div>
                  <MessageCircle className="inline h-3 w-3" />{" "}
                  {formatNumber(p.comments)}
                </div>
                <div>
                  <Eye className="inline h-3 w-3" /> {formatNumber(p.views)}
                </div>
              </div>

              {created && (
                <div className="mt-1 text-[10px] text-gray-500">{created}</div>
              )}

              {Array.isArray(p.hashtags) && p.hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.hashtags.slice(0, 3).map((t, i) => (
                    <span
                      key={i}
                      className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
}
