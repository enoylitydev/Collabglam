// useInfluencerSearch.tsx
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Platform } from './filters';
import { FilterState, createDefaultFilters } from './filters';

type Percent01 = number;

export interface NormalizedInfluencer {
  id?: string | number;
  platform?: Platform | string;
  userId?: string | number;
  username?: string;
  url?: string;
  handle?: string;
  [k: string]: unknown;
}

interface SearchResponse {
  results?: NormalizedInfluencer[];
  error?: string;
  page?: number;
  totalPages?: number;
  nextCursor?: string;
  total?: number;
}

interface SearchState {
  loading: boolean;
  error?: string;
  results: NormalizedInfluencer[];
  rawResponse: SearchResponse | null;
  total?: number;
  page?: number;
  totalPages?: number;
  nextCursor?: string | null;
  hasMore: boolean;
}

const normalizePlatform = (p: unknown, fallback: Platform): Platform => {
  const s = typeof p === 'string' ? p.toLowerCase() : p;
  return (s === 'youtube' || s === 'instagram' || s === 'tiktok') ? (s as Platform) : fallback;
};

const keyFor = (x: NormalizedInfluencer) => {
  const base =
    (x.userId != null && String(x.userId).toLowerCase()) ||
    (x.username && String(x.username).toLowerCase()) ||
    (x.url && String(x.url).toLowerCase());
  const p = x.platform ? String(x.platform).toLowerCase() : 'unknown';
  return base ? `${p}:${base}` : undefined;
};

const dedupeClient = (list: NormalizedInfluencer[]) => {
  const map = new Map<string, NormalizedInfluencer>();
  for (const it of list || []) {
    const k = keyFor(it);
    if (!k) continue;
    if (!map.has(k)) map.set(k, it);
  }
  return Array.from(map.values());
};

export function useInfluencerSearch(platforms: Platform[]) {
  const [searchState, setSearchState] = useState<SearchState>({
    loading: false,
    results: [],
    rawResponse: null,
    hasMore: false,
  });
  const [filters, setFilters] = useState<FilterState>(createDefaultFilters());

  const reqIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateFilter = useCallback((path: string, value: unknown) => {
    setFilters(prev => {
      const keys = path.split('.');
      const next: any = { ...prev };
      let cur: any = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...cur[keys[i]] };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return next as FilterState;
    });
  }, []);

  const payloadDefaults = useMemo(() => ({
    followersMin: 0,
    followersMax: 50_000_000,
    ageMin: 13,
    ageMax: 100,
    credibility: 0.5 as Percent01,
  }), []);

  const buildPayload = useCallback((options?: { page?: number; cursor?: string | null }) => {
    const inf: any = (filters as any).influencer || {};
    const aud: any = (filters as any).audience || {};

    const hasIG = platforms.includes('instagram');
    const hasTT = platforms.includes('tiktok');
    const hasYT = platforms.includes('youtube');

    const influencer: any = {
      followers: {
        min: inf.followersMin ?? payloadDefaults.followersMin,
        max: inf.followersMax ?? payloadDefaults.followersMax,
      },
      age: {
        min: inf.ageMin ?? payloadDefaults.ageMin,
        max: inf.ageMax ?? payloadDefaults.ageMax,
      },
      isVerified: !!inf.isVerified,
    };

    // Common & optional influencer filters
    if (typeof inf.engagementRate === 'number') {
      influencer.engagementRate = Math.max(0, Math.min(1, inf.engagementRate));
    }
    if (inf.language) influencer.language = inf.language;
    if (inf.gender) influencer.gender = inf.gender;

    // Use 'lastposted' to match the Modash examples
    if (typeof inf.lastPostedWithinDays === 'number') {
      influencer.lastposted = Math.max(0, Math.floor(inf.lastPostedWithinDays));
    } else if (typeof inf.lastposted === 'number') {
      influencer.lastposted = Math.max(0, Math.floor(inf.lastposted));
    }

    // Followers growth rate (percent → fraction)
    if (typeof inf.followersGrowthRatePct === 'number') {
      influencer.followersGrowthRate = {
        interval: 'i6months',
        value: inf.followersGrowthRatePct / 100,
        operator: 'gt'
      };
    } else if (typeof inf.followerGrowthMin === 'number' || typeof inf.followerGrowthMax === 'number') {
      influencer.followersGrowthRate = {
        min: inf.followerGrowthMin,
        max: inf.followerGrowthMax
      };
    }

    if (typeof inf.bio === 'string' && inf.bio.trim()) influencer.bio = inf.bio.trim();
    if (typeof inf.keywords === 'string' && inf.keywords.trim()) influencer.keywords = inf.keywords.trim();

    if (inf.hasContactDetails === true) {
      influencer.hasContactDetails = [{ contactType: 'email', filterAction: 'must' as const }];
    }

    if (typeof inf.engagementsMin === 'number' || typeof inf.engagementsMax === 'number') {
      influencer.engagements = {
        ...(inf.engagementsMin != null ? { min: inf.engagementsMin } : {}),
        ...(inf.engagementsMax != null ? { max: inf.engagementsMax } : {}),
      };
    }

    // relevance / audienceRelevance / filterOperations passthrough
    if (Array.isArray(inf.relevance) && inf.relevance.length) {
      influencer.relevance = inf.relevance;
    }
    if (Array.isArray(inf.audienceRelevance) && inf.audienceRelevance.length) {
      influencer.audienceRelevance = inf.audienceRelevance;
    }
    if (Array.isArray(inf.filterOperations) && inf.filterOperations.length) {
      influencer.filterOperations = inf.filterOperations;
    }

    // ---------- Common "Video Plays / Views" control ----------
    const setViews = (min?: number, max?: number) => {
      if (min == null && max == null) return;
      influencer.views = {
        ...(min != null ? { min } : {}),
        ...(max != null ? { max } : {}),
      };
    };
    const setReels = (min?: number, max?: number) => {
      if (min == null && max == null) return;
      influencer.reelsPlays = {
        ...(min != null ? { min } : {}),
        ...(max != null ? { max } : {}),
      };
    };

    // If user filled the common control, map it:
    if (inf.videoPlaysMin != null || inf.videoPlaysMax != null) {
      if (hasIG) setReels(inf.videoPlaysMin, inf.videoPlaysMax);
      if (hasTT || hasYT) setViews(inf.videoPlaysMin, inf.videoPlaysMax);
    }

    // ---------- Platform-specific overrides ----------
    // IG override for Reels Plays
    if (hasIG && (inf.reelsPlaysMin != null || inf.reelsPlaysMax != null)) {
      setReels(inf.reelsPlaysMin, inf.reelsPlaysMax);
    }

    // TT/YT: combine per-platform views into one "views" range
    const ttMin = hasTT ? inf.ttViewsMin : undefined;
    const ttMax = hasTT ? inf.ttViewsMax : undefined;
    const ytMin = hasYT ? inf.ytViewsMin : undefined;
    const ytMax = hasYT ? inf.ytViewsMax : undefined;
    const anyTT = ttMin != null || ttMax != null;
    const anyYT = ytMin != null || ytMax != null;
    if (anyTT || anyYT) {
      const mins = [ttMin, ytMin].filter((v) => typeof v === 'number') as number[];
      const maxs = [ttMax, ytMax].filter((v) => typeof v === 'number') as number[];
      const min = mins.length ? Math.max(...mins) : undefined;
      const max = maxs.length ? Math.min(...maxs) : undefined;
      setViews(min, max);
    }

    // IG-only extras
    if (hasIG) {
      if (typeof inf.hasSponsoredPosts === 'boolean') influencer.hasSponsoredPosts = inf.hasSponsoredPosts;
      if (typeof inf.hasYouTube === 'boolean') influencer.hasYouTube = inf.hasYouTube;
      if (Array.isArray(inf.accountTypes) && inf.accountTypes.length) influencer.accountTypes = inf.accountTypes;
      if (Array.isArray(inf.brands) && inf.brands.length) influencer.brands = inf.brands;
      if (Array.isArray(inf.interests) && inf.interests.length) influencer.interests = inf.interests;
    }

    // TT-only extras
    if (hasTT) {
      if (typeof inf.likesGrowthRatePct === 'number') {
        influencer.likesGrowthRate = { interval: 'i1month', value: inf.likesGrowthRatePct / 100, operator: 'gt' };
      }
      if (inf.sharesMin != null || inf.sharesMax != null) {
        influencer.shares = {
          ...(inf.sharesMin != null ? { min: inf.sharesMin } : {}),
          ...(inf.sharesMax != null ? { max: inf.sharesMax } : {}),
        };
      }
      if (inf.savesMin != null || inf.savesMax != null) {
        influencer.saves = {
          ...(inf.savesMin != null ? { min: inf.savesMin } : {}),
          ...(inf.savesMax != null ? { max: inf.savesMax } : {}),
        };
      }
    }

    // YT-only extras
    if (hasYT) {
      if (inf.isOfficialArtist === true) influencer.isOfficialArtist = true;
      if (typeof inf.viewsGrowthRatePct === 'number') {
        influencer.viewsGrowthRate = { interval: 'i1month', value: inf.viewsGrowthRatePct / 100, operator: 'gt' };
      }
    }

    // IG + TT only: textTags
    if ((hasIG || hasTT) && Array.isArray(inf.textTags) && inf.textTags.length) {
      influencer.textTags = inf.textTags; // [{type:'hashtag'|'mention', value: string}]
    }

    // ---------- Audience ----------
    const audience: any = {};

    // location: accept number | number[] | {id, weight}[]
    if (Array.isArray(aud.location)) {
      if (typeof aud.location[0] === 'number') {
        audience.location = aud.location.map((id: number) => ({ id, weight: 0.2 }));
      } else {
        audience.location = aud.location; // already weighted
      }
    } else if (typeof aud.location === 'number') {
      audience.location = [{ id: aud.location, weight: 0.2 }];
    }

    if (aud.language?.id) audience.language = { id: aud.language.id, weight: aud.language.weight ?? 0.2 };
    if (aud.gender?.id) audience.gender = { id: aud.gender.id, weight: aud.gender.weight ?? 0.5 };

    // age list (weighted buckets) OR a simple range
    if (Array.isArray(aud.age) && aud.age.length) {
      audience.age = aud.age; // e.g. [{id:'18-24', weight:0.3}, ...]
    }
    if (aud.ageRange?.min != null && aud.ageRange?.max != null) {
      audience.ageRange = {
        min: String(aud.ageRange.min),
        max: String(aud.ageRange.max),
        weight: 0.3
      };
    }

    // IG-only audience extras
    if (hasIG) {
      if (Array.isArray(aud.interests) && aud.interests.length) {
        audience.interests = aud.interests.map((x: any) =>
          typeof x === 'number' ? ({ id: x, weight: 0.2 }) : x
        );
      }
      if (typeof aud.credibility === 'number') {
        audience.credibility = Math.max(0, Math.min(1, aud.credibility));
      }
    }

    const base: any = {
      page: options?.page ?? 0,
      calculationMethod: 'median',
      sort: { field: 'followers', value: 123, direction: 'desc' as const },
      filter: {
        influencer,
        ...(Object.keys(audience).length ? { audience } : {}),
      },
    };

    // Strip IG-only fields if IG not selected
    if (!hasIG) {
      delete base.filter.influencer.reelsPlays;
      delete base.filter.influencer.hasSponsoredPosts;
      delete base.filter.influencer.hasYouTube;
      delete base.filter.influencer.accountTypes;
      delete base.filter.influencer.brands;
      delete base.filter.influencer.interests;
      if (base.filter.audience) {
        delete base.filter.audience?.interests;
        delete base.filter.audience?.credibility; // 🔒 ensure credibility is Instagram-only
      }
    }

    // Strip TT-only extras if TT not selected
    if (!hasTT) {
      delete base.filter.influencer.likesGrowthRate;
      delete base.filter.influencer.shares;
      delete base.filter.influencer.saves;
    }

    // Strip YT-only extras if YT not selected
    if (!hasYT) {
      delete base.filter.influencer.isOfficialArtist;
      delete base.filter.influencer.viewsGrowthRate;
    }

    // No TT/YT → remove views
    if (!(hasTT || hasYT)) {
      delete base.filter.influencer.views;
    }

    // YT-only case → remove textTags
    if (hasYT && !(hasIG || hasTT)) {
      delete base.filter.influencer.textTags;
    }

    if (options?.cursor) base.cursor = options.cursor;
    return base;
  }, [filters, payloadDefaults, platforms]);

  const parseServerPageInfo = (data: SearchResponse) => {
    const page = typeof data.page === 'number' ? data.page : undefined;
    const totalPages = typeof data.totalPages === 'number' ? data.totalPages : undefined;
    const nextCursor = typeof data.nextCursor === 'string' ? data.nextCursor : undefined;

    let hasMore = false;
    if (typeof totalPages === 'number' && typeof page === 'number') {
      hasMore = page + 1 < totalPages;
    } else if (nextCursor) {
      hasMore = true;
    }
    return { page, totalPages, nextCursor: nextCursor ?? null, hasMore };
  };

  const startRequest = () => {
    const id = ++reqIdRef.current;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return { id, signal: abortRef.current.signal };
  };

  const serverFetch = async (payload: any) => {
    const endpoint = '/api/modash/search';
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platforms, body: payload }),
      signal: abortRef.current?.signal,
    });
    const text = await resp.text();
    let data: SearchResponse;
    try { data = text ? JSON.parse(text) : {}; } catch { data = { error: 'Invalid server response' }; }
    if (!resp.ok) throw new Error(data?.error || 'Search failed');
    return data;
  };

  const runSearch = useCallback(async (opts?: { reset?: boolean }) => {
    const { id } = startRequest();

    setSearchState(prev => ({
      ...prev,
      loading: true,
      error: undefined,
      ...(opts?.reset ? { results: [], page: 0, totalPages: undefined, nextCursor: null } : {}),
    }));

    try {
      const payload = buildPayload({ page: 0, cursor: null });
      const data = await serverFetch(payload);

      const serverResults = Array.isArray(data?.results) ? data.results : [];
      const normalized = serverResults.map(r => ({
        ...r,
        platform: normalizePlatform((r as any).platform, platforms[0] ?? 'youtube'),
      }));
      const unique = dedupeClient(normalized);

      const { page, totalPages, nextCursor, hasMore } = parseServerPageInfo(data);

      if (id !== reqIdRef.current) return;
      setSearchState({
        loading: false,
        results: unique,
        rawResponse: data,
        total: data.total,
        page,
        totalPages,
        nextCursor,
        hasMore,
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setSearchState(prev => ({ ...prev, loading: false, error: e?.message || 'Search failed' }));
    }
  }, [platforms, buildPayload]);

  const loadMore = useCallback(async () => {
    if (!searchState.hasMore || searchState.loading) return;
    const { id } = startRequest();
    setSearchState(prev => ({ ...prev, loading: true, error: undefined }));

    try {
      const nextPage = typeof searchState.page === 'number' ? searchState.page + 1 : undefined;
      const payload = buildPayload({ page: nextPage, cursor: searchState.nextCursor ?? undefined });

      const data = await serverFetch(payload);

      const serverResults = Array.isArray(data?.results) ? data.results : [];
      const normalized = serverResults.map(r => ({
        ...r,
        platform: normalizePlatform((r as any).platform, platforms[0] ?? 'youtube'),
      }));

      const merged = dedupeClient([...searchState.results, ...normalized]);

      const { page, totalPages, nextCursor, hasMore } = parseServerPageInfo(data);

      if (id !== reqIdRef.current) return;
      setSearchState({
        loading: false,
        results: merged,
        rawResponse: data,
        total: data.total,
        page,
        totalPages,
        nextCursor,
        hasMore,
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setSearchState(prev => ({ ...prev, loading: false, error: e?.message || 'Search failed' }));
    }
  }, [searchState, platforms, buildPayload]);

  const loadAll = useCallback(async () => {
    let safety = 200;
    while (safety-- > 0 && !abortRef.current?.signal.aborted) {
      if (!searchState.hasMore) break;
      await loadMore();
      await new Promise(r => setTimeout(r, 0));
    }
  }, [loadMore, searchState.hasMore]);

  const resetFilters = useCallback(() => setFilters(createDefaultFilters()), []);

  return {
    searchState,
    filters,
    updateFilter,
    runSearch,     // filters-only
    loadMore,
    loadAll,
    resetFilters,
    buildPayload,
  };
}
