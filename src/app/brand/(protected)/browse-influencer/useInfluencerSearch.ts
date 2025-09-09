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

    // Optional influencer filters
    if (typeof inf.engagementRate === 'number') {
      influencer.engagementRate = Math.max(0, Math.min(1, inf.engagementRate as number));
    }
    if (inf.language) influencer.language = inf.language;
    if (inf.gender) influencer.gender = inf.gender;

    if (typeof inf.lastPostedWithinDays === 'number') {
      influencer.lastPostedWithinDays = Math.max(0, Math.floor(inf.lastPostedWithinDays));
    }

    if (typeof inf.followerGrowthMin === 'number' || typeof inf.followerGrowthMax === 'number') {
      influencer.followerGrowthRate = {
        min: inf.followerGrowthMin ?? undefined,
        max: inf.followerGrowthMax ?? undefined,
      };
    }

    if (inf.hasContactDetails === true) {
      influencer.hasContactDetails = [{ contactType: 'email', filterAction: 'must' as const }];
    }

    if (typeof inf.engagementsMin === 'number' || typeof inf.engagementsMax === 'number') {
      influencer.engagements = {
        min: inf.engagementsMin ?? undefined,
        max: inf.engagementsMax ?? undefined,
      };
    }

    // IG-only fields (conditionally later)
    if (typeof inf.reelsPlaysMin === 'number' || typeof inf.reelsPlaysMax === 'number') {
      influencer.reelsPlays = {
        min: inf.reelsPlaysMin ?? undefined,
        max: inf.reelsPlaysMax ?? undefined,
      };
    }
    if (inf.hasSponsoredPosts === true) {
      influencer.hasSponsoredPosts = true;
    }

    // Audience
    const audience: any = {};
    if (aud.language?.id) audience.language = { id: aud.language.id, weight: aud.language.weight ?? 0.2 };
    if (aud.gender?.id) audience.gender = { id: aud.gender.id, weight: aud.gender.weight ?? 0.5 };
    if (aud.location) audience.location = aud.location;
    if (aud.country)  audience.country  = aud.country;
    if (aud.ageRange) audience.age = { min: aud.ageRange.min, max: aud.ageRange.max };
    if (typeof aud.credibility === 'number') {
      audience.credibility = Math.max(0, Math.min(1, aud.credibility as number));
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

    // 🚦 Only include IG-only fields when Instagram is selected
    if (!platforms.includes('instagram')) {
      delete base.filter.influencer.reelsPlays;
      delete base.filter.influencer.hasSponsoredPosts;
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
