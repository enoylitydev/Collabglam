import { useState, useRef, useCallback } from 'react';
import type {
  Platform,
  InfluencerResult,
  SearchFilters,
  UiSortOption,
  SearchState,
} from '../types';
import { DEFAULT_SEARCH_FILTERS, DEFAULT_UI_SORT } from '../constants';
import { buildModashRequestBody } from '../components/buildModashBody';

interface UseModashSearchReturn {
  searchState: SearchState;
  setSearchState: React.Dispatch<React.SetStateAction<SearchState>>;
  runSearch: (
    query: string,
    platforms: Platform[],
    page: number,
    sortBy: UiSortOption,
    filters: SearchFilters
  ) => Promise<void>;
  abortSearch: () => void;
}

export function useModashSearch(favorites: string[] = []): UseModashSearchReturn {
  const abortRef = useRef<AbortController | null>(null);

  const [searchState, setSearchState] = useState<SearchState>({
    loading: false,
    error: null,
    hasSearched: false,
    noResults: false,
    results: [],
    total: 0,
    selectedPlatforms: ['youtube', 'tiktok', 'instagram'],
    sortBy: DEFAULT_UI_SORT,
    filters: { ...DEFAULT_SEARCH_FILTERS },
    page: 0,
    lastQuery: '',
    lastPlatforms: [],
    lastRaw: null,
  });

  const runSearch = useCallback(async (
    query: string,
    platforms: Platform[],
    page: number,
    sortBy: UiSortOption,
    filters: SearchFilters
  ) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setSearchState(s => ({ ...s, loading: true, error: null, noResults: false }));

    try {
      // If caller passes a plain "query" and no keywords, tuck it into keywords
      const mergedFilters: SearchFilters = {
        ...filters,
        keywords:
          (filters.keywords && filters.keywords.length)
            ? filters.keywords
            : (query?.trim() ? [query.trim()] : undefined),
      };

      // Use first platform to resolve any platform-specific sort/filters;
      // server will fan out same body to all requested platforms.
      const firstPlatform = platforms[0] ?? 'instagram';
      const body = buildModashRequestBody(firstPlatform, page, sortBy, mergedFilters);

      const res = await fetch('/api/modash/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current!.signal,
        body: JSON.stringify({ platforms, body }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.message || `Search failed (${res.status})`);

      const serverList: any[] = data.results || data.items || [];
      const list: InfluencerResult[] = serverList.map((r: any) => {
        const platform = (r.platform ?? r.source) as Platform;

        const followers =
          r.followers ??
          r.profile?.followers ??
          r.stats?.followers ??
          0;

        const engagementRate =
          r.engagementRate ??
          r.profile?.engagementRate ??
          r.stats?.engagementRate ??
          0;

        return {
          id: r.id || r.userId || `${platform}-${r.username || r.handle || r.name}`,
          name: r.name || r.fullname || r.username || r.handle || '',
          username: r.username || r.handle || r.channelHandle || '',
          platform,
          followers,
          engagementRate,
          avatar: r.avatar || r.profile?.picture || r.profileImage,
          verifiedStatus: r.verified || r.isVerified || r.profile?.verified,
          location: r.location || r.profile?.location,
          categories: r.categories || r.topics || r.tags,
          link: r.url || r.profileUrl || r.link,
        };
      });

      setSearchState(s => ({
        ...s,
        loading: false,
        results: page === 0 ? list : [...s.results, ...list],
        total: Number(data.total || list.length || 0),
        hasSearched: true,
        noResults: page === 0 && list.length === 0,
        page,
        lastQuery: query,
        lastPlatforms: platforms,
        lastRaw: data?.raw ?? null,
      }));
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setSearchState(s => ({ ...s, loading: false, error: e?.message || 'Search failed' }));
    }
  }, [favorites]);

  const abortSearch = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  return { searchState, setSearchState, runSearch, abortSearch };
}
