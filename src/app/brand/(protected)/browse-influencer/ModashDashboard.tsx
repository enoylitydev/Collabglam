// src/app/brand/(protected)/browse-influencer/ModashDashboard.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { SearchHeader } from './SearchHeader';
import { FilterSidebar } from './FilterSidebar';
import { ResultsGrid } from './ResultsGrid';
import { useInfluencerSearch } from './useInfluencerSearch';
import { Platform } from './platform';

export default function ModashDashboard() {
  const [platforms, setPlatforms] = useState<Platform[]>(['youtube']);
  const [queryText, setQueryText] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const {
    searchState,
    filters,
    updateFilter,
    runSearch,
    resetFilters,
    loadMore,
    loadAll,
  } = useInfluencerSearch(platforms);

  // For UI theming/placeholders where a single platform is needed
  const primaryPlatform: Platform = useMemo(
    () => platforms[0] ?? 'youtube',
    [platforms]
  );

  const toggleFilters = useCallback(() => setShowFilters((s) => !s), []);
  const onResetAll = useCallback(() => {
    // If you want to also reset platforms, uncomment the next line:
    // setPlatforms(['youtube']);
    resetFilters();
  }, [resetFilters]);

  // SearchHeader expects onSearch(query: string)
  const onSearch = useCallback(
    (q: string) => {
      const query = q?.trim() ?? '';
      if (!query) return;
      runSearch({ queryText: query, reset: true });
    },
    [runSearch]
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Mobile filter toggle */}
            <button
              onClick={toggleFilters}
              className="lg:hidden inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              aria-expanded={showFilters}
              aria-controls="filter-sidebar"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"
                />
              </svg>
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Filters */}
          <aside
            id="filter-sidebar"
            className={`lg:w-80 ${showFilters ? 'block' : 'hidden lg:block'}`}
            aria-label="Filters"
          >
            <FilterSidebar
              platforms={platforms}          // multi-select
              setPlatforms={setPlatforms}    // setter for array
              filters={filters}
              updateFilter={updateFilter}
              onReset={onResetAll}
            />
          </aside>

          {/* Main Content */}
          <main className="flex-1 space-y-6 mt-2">
            <SearchHeader
              platform={primaryPlatform}      // single for UI theming/placeholder
              queryText={queryText}
              setQueryText={setQueryText}
              loading={searchState.loading}
              onSearch={onSearch}
              showDebug={showDebug}
              setShowDebug={setShowDebug}
            />

            <ResultsGrid
  platform={primaryPlatform}
  results={searchState.results}
  loading={searchState.loading}
  error={searchState.error}
  total={searchState.total}
  hasMore={searchState.hasMore}
  onLoadMore={loadMore}
  onLoadAll={loadAll}
/>

          </main>
        </div>
      </div>
    </div>
  );
}
