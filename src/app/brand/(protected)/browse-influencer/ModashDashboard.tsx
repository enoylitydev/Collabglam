import React, { useState } from 'react';
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

  // ✅ Updated: pass the array to the hook (hook should POST { platforms, body } to /api/modash)
  const {
    searchState,
    filters,
    updateFilter,
    runSearch,
    resetFilters,
  } = useInfluencerSearch(platforms);

  // For UI theming/placeholders where a single platform is needed
  const primaryPlatform: Platform = platforms[0] ?? 'youtube';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Mobile filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
              </svg>
              Filters
            </button>
          </div>
        </div>
      </div>

      <div className="">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Filters */}
          <div className={`lg:w-80 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <FilterSidebar
              platforms={platforms}          // ← multi-select
              setPlatforms={setPlatforms}    // ← setter for array
              filters={filters}
              updateFilter={updateFilter}
              onReset={resetFilters}
            />
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-6 mt-6">
            <SearchHeader
              platform={primaryPlatform}      // ← single for UI theming/placeholder
              queryText={queryText}
              setQueryText={setQueryText}
              loading={searchState.loading}
              onSearch={runSearch}
              showDebug={showDebug}
              setShowDebug={setShowDebug}
            />

            <ResultsGrid
              platform={primaryPlatform}      // ← fallback theme; each result may carry its own .platform
              results={searchState.results}
              loading={searchState.loading}
              error={searchState.error}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
