'use client';

import React, { useCallback, useState } from 'react';
import FilterSidebar from './components/FilterSidebar';
import ModashSearch from './components/ModashSearch';
import { Platform, SearchFilters } from './types';
import { DEFAULT_SEARCH_FILTERS } from './constants';
import { useModashSearch } from './hooks/useModashSearch';
import { useBrandSidebar } from '@/components/common/brand-sidebar-context';

export default function BrowseInfluencersPage() {
  const [query, setQuery] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([
    'youtube',
    'tiktok',
    'instagram',
  ]);

  // Subscribe so this page re-renders when the sidebar collapses/expands
  const { collapsed } = useBrandSidebar();

  const { searchState, setSearchState, runSearch } = useModashSearch([]);

  const onApplyFilters = useCallback(
    (filters: SearchFilters) => {
      setSearchState((s) => ({ ...s, filters }));
      runSearch(query, selectedPlatforms, 0, searchState.sortBy, filters);
    },
    [query, selectedPlatforms, runSearch, searchState.sortBy, setSearchState]
  );

  const onSearch = useCallback(
    (q: string) => {
      setQuery(q);
      runSearch(q, selectedPlatforms, 0, searchState.sortBy, searchState.filters);
    },
    [runSearch, searchState.filters, searchState.sortBy, selectedPlatforms]
  );

  const onLoadMore = useCallback(() => {
    runSearch(
      query,
      selectedPlatforms,
      searchState.page + 1,
      searchState.sortBy,
      searchState.filters
    );
  }, [query, runSearch, searchState.filters, searchState.page, searchState.sortBy, selectedPlatforms]);

  return (
    <div className="flex min-h-screen" data-collapsed={collapsed}>
      {/* Filters: positioned just to the right of the sidebar */}
      <div className="hidden md:block fixed left-[var(--brand-sidebar-w)] top-16 bottom-0 border-l-2">
        <FilterSidebar
          selectedPlatforms={selectedPlatforms}
          onPlatformsChange={setSelectedPlatforms}
          initialFilters={searchState.filters || DEFAULT_SEARCH_FILTERS}
          onApply={onApplyFilters}
        />
      </div>

      {/* Main: margin-left matches current sidebar width on md+ */}
      <div className="flex-1 flex flex-col ml-[var(--brand-sidebar-w)]">
        <div className="px-6 pt-6">
          <div className="rounded-lg bg-white p-6 mb-6">
            <h1
              className="text-3xl font-semibold mb-1 bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(to right, #FFA135, #FF7236)' }}
            >
              Browse Influencers
            </h1>
            <p className="text-gray-700">
              Discover creators and open detailed performance without leaving this page.
            </p>
          </div>
        </div>

        <ModashSearch
          query={query}
          setQuery={setQuery}
          results={searchState.results}
          loading={searchState.loading}
          total={searchState.total}
          onSearch={onSearch}
          onLoadMore={onLoadMore}
        />
      </div>
    </div>
  );
}
