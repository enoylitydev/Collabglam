// useInfluencerSearch.tsx
import { useState, useCallback } from 'react';
import type { Platform } from './platform';
import { FilterState, createDefaultFilters } from './filters';

interface SearchState {
  loading: boolean;
  error?: string;
  results: any[];
  rawResponse: any;
}

function keyFor(x: any) {
  const base =
    (x.userId && String(x.userId).toLowerCase()) ||
    (x.username && String(x.username).toLowerCase()) ||
    (x.url && String(x.url).toLowerCase());
  return base ? `${x.platform}:${base}` : undefined;
}

function dedupeClient(list: any[]) {
  const map = new Map<string, any>();
  for (const it of list || []) {
    const k = keyFor(it);
    if (!k) continue;
    if (!map.has(k)) map.set(k, it);
  }
  return Array.from(map.values());
}

export function useInfluencerSearch(platforms: Platform[]) {
  const [searchState, setSearchState] = useState<SearchState>({
    loading: false,
    results: [],
    rawResponse: null
  });

  const [filters, setFilters] = useState<FilterState>(createDefaultFilters());

  const updateFilter = useCallback((path: string, value: any) => {
    setFilters(prev => {
      const keys = path.split('.');
      const next = { ...prev };
      let cur: any = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...cur[keys[i]] };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
      return next;
    });
  }, []);

  const buildPayload = useCallback(() => ({
    page: 0,
    calculationMethod: 'median',
    sort: { field: 'followers', value: 123, direction: 'desc' },
    filter: {
      influencer: {
        followers: {
          min: filters.influencer.followersMin || 1000,
          max: filters.influencer.followersMax || 1_000_000
        },
        engagementRate: filters.influencer.engagementRate || 0.01,
        language: filters.influencer.language || 'en',
        gender: filters.influencer.gender || 'MALE',
        age: {
          min: filters.influencer.ageMin || 18,
          max: filters.influencer.ageMax || 65
        },
        isVerified: filters.influencer.isVerified || false,
        hasContactDetails: filters.influencer.hasEmailMust
          ? [{ contactType: 'email', filterAction: 'must' }]
          : undefined
      },
      audience: {
        language: filters.audience.language
          ? { id: filters.audience.language.id, weight: filters.audience.language.weight }
          : undefined,
        gender: filters.audience.gender
          ? { id: filters.audience.gender.id, weight: filters.audience.gender.weight }
          : undefined,
        credibility: filters.audience.credibility || 0.5
      }
    }
  }), [filters]);

  const runSearch = useCallback(async (query?: string) => {
    setSearchState(prev => ({ ...prev, loading: true, error: undefined }));
    try {
      // IMPORTANT: if your file is /app/api/modash/route.ts, endpoint is '/api/modash'
      const endpoint = '/api/modash/search';
      const body = buildPayload();
      if (query?.trim()) body.filter.influencer.keywords = query.trim();

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms, body })
      });
      const data = await resp.json();

      if (!resp.ok) throw new Error(data?.error || 'Search failed');

      // Server should already be unique; client dedupe is a safeguard
      const serverResults = Array.isArray(data?.results) ? data.results : [];
      const normalized = dedupeClient(serverResults);

      setSearchState({
        loading: false,
        results: normalized,
        rawResponse: data
      });
    } catch (e: any) {
      setSearchState(prev => ({
        ...prev,
        loading: false,
        error: e?.message || 'Search failed'
      }));
    }
  }, [platforms, buildPayload]);

  const resetFilters = useCallback(() => setFilters(createDefaultFilters()), []);

  return { searchState, filters, updateFilter, runSearch, resetFilters, buildPayload };
}
