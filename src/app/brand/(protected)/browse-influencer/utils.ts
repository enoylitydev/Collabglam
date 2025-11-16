export function pruneEmpty<T>(obj: T): T {
    if (obj && typeof obj === 'object') {
        for (const key of Object.keys(obj as any)) {
            const v = (obj as any)[key];
            if (v == null) { delete (obj as any)[key]; continue; }
            if (Array.isArray(v)) {
                if (v.length === 0) { delete (obj as any)[key]; continue; }
            } else if (typeof v === 'object') {
                (obj as any)[key] = pruneEmpty(v);
                if (Object.keys((obj as any)[key]).length === 0) delete (obj as any)[key];
            }
            if (typeof v === 'number' && Number.isNaN(v)) delete (obj as any)[key];
        }
    }
    return obj;
}

export function nfmt(n?: number) {
    if (n == null || Number.isNaN(n)) return '—';
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(Math.round(n));
}

export function pfmt(x?: number, digits = 2) {
    if (x == null || Number.isNaN(x)) return '—';
    return `${(x * 100).toFixed(digits)}%`;
}

export function titleCase(x?: string) {
    if (!x) return '—';
    const s = x.toString();
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function prettyPlace(country?: string, city?: string, state?: string) {
    const cityPretty = city
        ? city
            .split(' ')
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ')
        : '';
    const statePretty = state ? `, ${state}` : '';
    return `${country || '—'}${cityPretty ? ` · ${cityPretty}${statePretty}` : ''}`;
}

export function pct(x?: number) {
    if (x == null || Number.isNaN(x)) return '—';
    return `${Math.round(x * 100)}%`;
}

export function topN<T>(arr: T[] | undefined | null, n = 5): T[] {
    return Array.isArray(arr) ? arr.filter(Boolean).slice(0, n) : [];
}


// Returns the median for likes/comments/views from various possible aggregate shapes.
export function getMedian(
  agg: any,
  field: 'likes' | 'comments' | 'views'
): number | undefined {
  if (!agg) return undefined;

  // 1) common aggregate shapes
  const known =
    typeof agg[`median_${field}`] === 'number' ? agg[`median_${field}`] :
    typeof agg[`p50_${field}`] === 'number' ? agg[`p50_${field}`] :
    typeof agg?.medians?.[field] === 'number' ? agg.medians[field] :
    typeof agg?.percentiles?.[field]?.p50 === 'number' ? agg.percentiles[field].p50 :
    typeof agg?.p50?.[field] === 'number' ? agg.p50[field] :
    undefined;
  if (typeof known === 'number') return known;

  // 2) derive from arrays (fallback)
  const arr =
    Array.isArray(agg?.items) ? agg.items.map((x: any) => x?.[field]) :
    Array.isArray(agg?.values) ? agg.values :
    Array.isArray(agg?.[field]) ? agg[field] :
    [];

  const nums = (arr as any[])
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  if (!nums.length) return undefined;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

// utils.ts (add this at the bottom or somewhere below other helpers)

import {
  Platform,
  ReportResponse,
  InfluencerHeader,
  InfluencerProfile,
  Audience,
  AudienceSummary,
  WeightedItem,
  MiniUser,
  RecentPost,
  StatHistoryEntry,
  ModashReportRaw,
  ModashProfileRaw,
  ModashMiniUserRaw,
  ModashPostRaw,
  ModashAudienceRaw,
} from './types';

// ---- small mappers ------------------------------------------------------

const mapMiniUser = (u?: ModashMiniUserRaw): MiniUser | null => {
  if (!u || u.userId == null) return null;
  return {
    userId: u.userId,
    url: u.url,
    picture: u.picture,
    fullname: u.fullname,
    username: u.username ?? u.handle,
    followers: u.followers,
  };
};

const mapMiniUserList = (list?: ModashMiniUserRaw[]): MiniUser[] =>
  (list || [])
    .map(mapMiniUser)
    .filter((x): x is MiniUser => Boolean(x));

const mapPost = (p?: ModashPostRaw): RecentPost | null => {
  if (!p || p.id == null) return null;
  return {
    id: p.id,
    url: p.url,
    thumbnail: p.thumbnail,
    image: p.image,
    video: Boolean(p.video),
    title: p.title,
    text: p.text,
    type: p.type,
    likes: p.likes,
    comments: p.comments,
    views: p.views,
    hashtags: p.hashtags,
    created: p.created,
  };
};

const mapPostList = (list?: ModashPostRaw[]): RecentPost[] =>
  (list || [])
    .map(mapPost)
    .filter((x): x is RecentPost => Boolean(x));

const mapWeightedList = (list?: any[]): WeightedItem[] =>
  (list || []).map((w: any) => ({
    name: w?.name,
    code: w?.code,
    weight: typeof w?.weight === 'number' ? w.weight : undefined,
  }));

// ---- main normalizer ----------------------------------------------------

export function normalizeReport(
  raw: ModashReportRaw,
  platform: Platform
): ReportResponse {
  const rp: ModashProfileRaw = raw?.profile || {};

  // Header block
  const headerRaw = rp.profile || {};
  const header: InfluencerHeader = {
    picture: headerRaw.picture,
    fullname: headerRaw.fullname,
    username: headerRaw.username,
    handle: headerRaw.handle,
    url: headerRaw.url,
    followers: headerRaw.followers,
    engagementRate: headerRaw.engagementRate,
  };

  // Audience
  const audienceRaw: ModashAudienceRaw = rp.audience || {};
  const audience: Audience & AudienceSummary = {
    genders: mapWeightedList(audienceRaw.genders),
    ages: mapWeightedList(audienceRaw.ages),
    geoCountries: mapWeightedList(audienceRaw.geoCountries),
    languages: mapWeightedList(audienceRaw.languages),
    ethnicities: mapWeightedList(audienceRaw.ethnicities),
    audienceTypes: mapWeightedList(audienceRaw.audienceTypes),
    audienceReachability: mapWeightedList(audienceRaw.audienceReachability),
    notable: audienceRaw.notable,
    credibility: audienceRaw.credibility,
  };

  // Language: use creator language if present, else top audience language
  const language =
    rp.language ||
    (audienceRaw.languages && audienceRaw.languages[0]
      ? {
          code: audienceRaw.languages[0].code,
          name: audienceRaw.languages[0].name,
        }
      : undefined);

  // Stats-by-content-type & stat history for the chart
  let statsByContentType: any = rp.statsByContentType
    ? { ...rp.statsByContentType }
    : {};
  if (!statsByContentType.all) statsByContentType.all = {};

  if (!statsByContentType.all.statHistory && Array.isArray(rp.statHistory)) {
    const hist: StatHistoryEntry[] = rp.statHistory.map((h) => ({
      month: h.month,
      // define "avgEngagements" as likes + comments
      avgEngagements: (h.avgLikes || 0) + (h.avgComments || 0),
    }));
    statsByContentType.all.statHistory = hist;
  }

  // Brand affinity (can live under audience or profile)
  let brandAffinity: WeightedItem[] = [];
  if (audienceRaw.brandAffinity && audienceRaw.brandAffinity.length) {
    brandAffinity = mapWeightedList(audienceRaw.brandAffinity);
  } else if (rp.brandAffinity && rp.brandAffinity.length) {
    brandAffinity = mapWeightedList(rp.brandAffinity);
  }

  const normalized: InfluencerProfile = {
    userId: rp.userId,

    profile: header,

    isVerified: rp.isVerified,
    isPrivate: rp.isPrivate,

    country: rp.country,
    city: rp.city,
    state: rp.state,
    description: rp.description,
    interests: rp.interests || [],
    contacts: rp.contacts || [],
    language,
    ageGroup: rp.ageGroup,
    gender: rp.gender,

    audience,

    avgLikes: rp.avgLikes,
    avgComments: rp.avgComments,
    averageViews: rp.averageViews ?? headerRaw.averageViews,
    avgReelsPlays: rp.avgReelsPlays,
    postsCount: rp.postsCount ?? headerRaw.postsCount,
    totalViews: rp.totalViews ?? headerRaw.totalViews,
    totalLikes: rp.totalLikes,

    brandAffinity,

    statsByContentType,

    popularPosts: mapPostList(rp.popularPosts),
    notableUsers: mapMiniUserList(audienceRaw.notableUsers),
    lookalikes: mapMiniUserList(rp.lookalikes),
    lookalikesByTopics: mapMiniUserList(rp.lookalikesByTopics),
    audienceLookalikes: mapMiniUserList(audienceRaw.audienceLookalikes),
  };

  return { profile: normalized };
}
