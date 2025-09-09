// ModashDashboard.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { FilterSidebar } from './FilterSidebar';
import { ResultsGrid } from './ResultsGrid';
import { useInfluencerSearch } from './useInfluencerSearch';
import type { Platform } from './filters';

export default function ModashDashboard() {
  const [platforms, setPlatforms] = useState<Platform[]>(['youtube']);
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

  const primaryPlatform: Platform = useMemo(
    () => platforms[0] ?? 'youtube',
    [platforms]
  );

  const toggleFilters = useCallback(() => setShowFilters(s => !s), []);
  const onResetAll = useCallback(() => resetFilters(), [resetFilters]);
  const onApply = useCallback(() => runSearch({ reset: true }), [runSearch]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={toggleFilters}
              className="lg:hidden inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              aria-expanded={showFilters}
              aria-controls="filter-sidebar"
            >
              {/* funnel icon */}
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
              </svg>
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-4">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <aside
            id="filter-sidebar"
            className={`lg:w-80 ${showFilters ? 'block' : 'hidden lg:block'}`}
            aria-label="Filters"
          >
            <FilterSidebar
              platforms={platforms}
              setPlatforms={setPlatforms}
              filters={filters}
              updateFilter={updateFilter}
              onReset={onResetAll}
              onApply={onApply}
              loading={searchState.loading}
            />
          </aside>

          {/* Main */}
          <main className="relative flex-1 space-y-6 mt-2">
            {searchState.loading && (
              <div className="absolute top-0 right-0 left-0 flex justify-center z-10 pointer-events-none">
                <div className="mt-2 inline-block h-2 w-40 rounded bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300 animate-pulse" />
              </div>
            )}

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
