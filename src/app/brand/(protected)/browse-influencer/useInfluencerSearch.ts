// useInfluencerSearch.tsx
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Platform } from './platform';
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

  // EITHER page-based
  page?: number;
  totalPages?: number;

  // OR cursor-based
  nextCursor?: string;

  // Optional helpful fields
  total?: number;
}

interface SearchState {
  loading: boolean;
  error?: string;
  results: NormalizedInfluencer[];
  rawResponse: SearchResponse | null;
  total?: number;
  page?: number;            // current page (if page-based)
  totalPages?: number;      // total pages (if page-based)
  nextCursor?: string | null; // next cursor (if cursor-based)
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
    followersMin: 1_000,
    followersMax: 1_000_000,
    engagementRate: 0.01 as Percent01,
    language: 'en',
    gender: 'MALE',
    ageMin: 18,
    ageMax: 65,
    credibility: 0.5 as Percent01,
  }), []);

  const buildPayload = useCallback((options?: { page?: number; cursor?: string | null }) => {
    const inf = filters.influencer;
    const aud = filters.audience;

    const base: any = {
      page: options?.page ?? 0, // if your API uses pages
      calculationMethod: 'median',
      sort: { field: 'followers', value: 123, direction: 'desc' as const },
      filter: {
        influencer: {
          followers: {
            min: inf.followersMin ?? payloadDefaults.followersMin,
            max: inf.followersMax ?? payloadDefaults.followersMax,
          },
          engagementRate: inf.engagementRate ?? payloadDefaults.engagementRate,
          language: inf.language ?? payloadDefaults.language,
          gender: inf.gender ?? payloadDefaults.gender,
          age: {
            min: inf.ageMin ?? payloadDefaults.ageMin,
            max: inf.ageMax ?? payloadDefaults.ageMax,
          },
          isVerified: inf.isVerified ?? false,
          hasContactDetails: (inf as any).hasEmailMust
            ? [{ contactType: 'email', filterAction: 'must' as const }]
            : undefined,
        },
        audience: {
          language: aud.language
            ? { id: aud.language.id, weight: aud.language.weight }
            : undefined,
          gender: aud.gender
            ? { id: aud.gender.id, weight: aud.gender.weight }
            : undefined,
          credibility: aud.credibility ?? payloadDefaults.credibility,
        },
      },
    };

    // If your API uses cursor-based pagination, send it here:
    if (options?.cursor) base.cursor = options.cursor;

    return base;
  }, [filters, payloadDefaults]);

  const parseServerPageInfo = (data: SearchResponse) => {
    // Supports both page-based & cursor-based
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

  const runSearch = useCallback(async (opts?: { queryText?: string; reset?: boolean }) => {
    const { id } = startRequest();

    setSearchState(prev => ({
      ...prev,
      loading: true,
      error: undefined,
      ...(opts?.reset ? { results: [], page: 0, totalPages: undefined, nextCursor: null } : {}),
    }));

    try {
      const payload = buildPayload({ page: 0, cursor: null });
      const q = opts?.queryText?.trim();
      if (q) payload.filter.influencer.keywords = q;

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
      // Decide next page/cursor
      const nextPage = typeof searchState.page === 'number' ? searchState.page + 1 : undefined;
      const payload = buildPayload({ page: nextPage, cursor: searchState.nextCursor ?? undefined });

      // keep same query if you injected it earlier (optional: store last query in a ref)

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
    // Stream pages until done; add a safety cap to avoid endless loops
    let safety = 200; // max pages
    while (safety-- > 0 && !abortRef.current?.signal.aborted) {
      if (!searchState.hasMore) break;
      await loadMore();
      // allow paint between batches
      await new Promise(r => setTimeout(r, 0));
    }
  }, [loadMore, searchState.hasMore]);

  const resetFilters = useCallback(() => setFilters(createDefaultFilters()), []);

  return {
    searchState,
    filters,
    updateFilter,
    runSearch,     // (opts?: { queryText?: string; reset?: boolean })
    loadMore,      // call to fetch next page
    loadAll,       // call to fetch ALL remaining pages (with safety cap)
    resetFilters,
    buildPayload,
  };
}
