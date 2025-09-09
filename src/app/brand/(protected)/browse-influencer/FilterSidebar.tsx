// FilterSidebar.tsx
import React from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { InfluencerFilters } from './InfluencerFilters';
import { AudienceFilters } from './AudienceFilters';
import type { FilterState, Platform } from './filters';
import { PlatformSelector } from './PlatformSelector';

interface FilterSidebarProps {
  platforms: Platform[];
  setPlatforms: (p: Platform[]) => void;
  filters: FilterState;
  updateFilter: (path: string, value: any) => void;
  onReset: () => void;
  onApply: () => void;
  loading?: boolean;
}

export function FilterSidebar({
  platforms,
  setPlatforms,
  filters,
  updateFilter,
  onReset,
  onApply,
  loading,
}: FilterSidebarProps) {
  return (
    <div className="bg-white shadow-sm border border-gray-200 sticky top-24 max-h-[calc(100vh)] overflow-y-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          <button
            onClick={onReset}
            className="inline-flex items-center px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Reset
          </button>
        </div>

        {/* Platform Selector (for conditional UI like IG-only fields) */}
        <div className="mb-6">
          <PlatformSelector selected={platforms} onChange={setPlatforms} />
        </div>

        {/* Influencer Filters */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Influencer Criteria</h3>
          <InfluencerFilters
            platforms={platforms}
            filters={filters.influencer}
            updateFilter={(path, value) => updateFilter(`influencer.${path}`, value)}
          />
        </div>

        {/* Audience Filters */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Audience Demographics</h3>
          <AudienceFilters
            filters={filters.audience}
            updateFilter={(path, value) => updateFilter(`audience.${path}`, value)}
          />
        </div>

        {/* Apply */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onApply}
            disabled={loading}
            className="w-full inline-flex items-center justify-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
