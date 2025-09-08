// FilterSidebar.tsx
import React from 'react';
import { RefreshCw } from 'lucide-react';
import { PlatformSelector } from './PlatformSelector';
import { InfluencerFilters } from './InfluencerFilters';
import { AudienceFilters } from './AudienceFilters';
import { Platform } from './platform';
import { FilterState } from './filters';

interface FilterSidebarProps {
  platforms: Platform[];                          // ← array
  setPlatforms: (platforms: Platform[]) => void;  // ← setter
  filters: FilterState;
  updateFilter: (path: string, value: any) => void;
  onReset: () => void;
}

export function FilterSidebar({
  platforms,
  setPlatforms,
  filters,
  updateFilter,
  onReset
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

        {/* Platform Selector */}
        <div className="mb-8">
          <PlatformSelector
            selected={platforms}
            onChange={setPlatforms}
          />
        </div>

        {/* Influencer Filters */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Influencer Criteria</h3>
          <InfluencerFilters
            // if your InfluencerFilters doesn't need platforms, you can drop this prop
            platform={platforms[0] ?? 'youtube'}
            filters={filters.influencer}
            updateFilter={(path, value) => updateFilter(`influencer.${path}`, value)}
          />
        </div>

        {/* Audience Filters */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Audience Demographics</h3>
          <AudienceFilters
            // Update AudienceFilters to accept platforms[] (see snippet below)
            platforms={platforms}
            filters={filters.audience}
            updateFilter={(path, value) => updateFilter(`audience.${path}`, value)}
          />
        </div>
      </div>
    </div>
  );
}
