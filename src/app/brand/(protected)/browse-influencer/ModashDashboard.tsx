import React, { useCallback, useMemo, useState } from 'react';
import { FilterSidebar } from './FilterSidebar';
import { ResultsGrid } from './ResultsGrid';
import { useInfluencerSearch } from './useInfluencerSearch';
import type { Platform } from './filters';
import { SearchHeader } from './SearchHeader';

export default function ModashDashboard() {
  const [platforms, setPlatforms] = useState<Platform[]>(['youtube']);
  const [showFilters, setShowFilters] = useState(false);

  // 🔎 search header state
  const [queryText, setQueryText] = useState('');
  const [showDebug, setShowDebug] = useState(false);

  const {
    searchState,
    filters,
    updateFilter,
    runSearch,
    resetFilters,
    loadMore,
    loadAll,
  } = useInfluencerSearch(platforms);

  const primaryPlatform: Platform = useMemo(
    () => platforms[0] ?? 'youtube',
    [platforms]
  );

  const toggleFilters = useCallback(() => setShowFilters((s) => !s), []);
  const onResetAll = useCallback(() => resetFilters(), [resetFilters]);

  // ✅ Submit from the search header
  const onSearchFromHeader = useCallback(
    (q: string) => {
      const clean = q.trim();
      setQueryText(clean);
      // If your API expects a different key, change 'influencer.query' accordingly.
      updateFilter('influencer.query', clean);
      runSearch({ reset: true });
    },
    [updateFilter, runSearch]
  );

  const onApply = useCallback(() => runSearch({ reset: true }), [runSearch]);

  return (
    <div className="min-h-screen">
      {/* Mobile: open filters button */}
      <div className="px-4 sm:px-6 lg:px-0">
        <button
          onClick={toggleFilters}
          className="lg:hidden inline-flex items-center mt-4 px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          aria-expanded={showFilters}
          aria-controls="filter-sidebar"
        >
          <svg
            className="w-4 h-4 mr-2"
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

      {/* Layout */}
      <div className="px-4 sm:px-6 lg:px-0">
        {/* Grid lets the left column be sticky without affecting the right */}
        <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] xl:grid-cols-[22rem_1fr] 2xl:grid-cols-[24rem_1fr] gap-4 lg:gap-6 items-start">
          {/* Desktop sticky wrapper for the sidebar */}
          <div className="hidden lg:block sticky top-16 self-start h-[calc(100vh-4rem)] z-10">
            <FilterSidebar
              platforms={platforms}
              setPlatforms={setPlatforms}
              filters={filters}
              updateFilter={updateFilter}
              onReset={onResetAll}
              onApply={onApply}
              loading={searchState.loading}
            />
          </div>

          {/* Right column: search header + results */}
          <main className="relative flex-1 min-w-0 space-y-6 mt-2">
            {/* 🔎 Search header at the top of results column */}
            <SearchHeader
              platform={primaryPlatform}
              queryText={queryText}
              setQueryText={setQueryText}
              loading={searchState.loading}
              onSearch={onSearchFromHeader}
              showDebug={showDebug}
              setShowDebug={setShowDebug}
            />

            {/* Optional top loading indicator */}
            {searchState.loading && (
              <div className="absolute top-[84px] right-0 left-0 flex justify-center z-10 pointer-events-none">
                <div className="mt-2 inline-block h-2 w-40 rounded bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300 animate-pulse" />
              </div>
            )}

            {/* Results */}
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

      {/* Mobile drawer (slides over content) */}
      {showFilters && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowFilters(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-[85vw] max-w-[22rem]">
            <FilterSidebar
              platforms={platforms}
              setPlatforms={setPlatforms}
              filters={filters}
              updateFilter={updateFilter}
              onReset={onResetAll}
              onApply={() => {
                onApply();
                setShowFilters(false);
              }}
              loading={searchState.loading}
            />
          </div>
        </div>
      )}
    </div>
  );
}
