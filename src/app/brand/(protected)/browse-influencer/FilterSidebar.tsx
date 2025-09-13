'use client';

import React, { useEffect, useState } from 'react';
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
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <aside
      role="complementary"
      aria-label="Filter sidebar"
      className={[
        // layout: fill the sticky wrapper and let the panel scroll internally
        'flex flex-col h-full min-h-0 max-h-full overflow-y-auto overscroll-contain',
        'flex-shrink-0 bg-white rounded-none shadow-sm border-r border-gray-200',
        // width
        'w-full sm:w-auto lg:w-[20rem] xl:w-[22rem] 2xl:w-[24rem]',
        // mount animation (safe-respects reduced motion)
        'motion-safe:transition-[opacity,transform] motion-safe:duration-300 motion-safe:ease-out will-change-transform',
        entered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3',
      ].join(' ')}
    >
      <div className="p-4 md:p-5 lg:p-5 xl:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 md:mb-5">
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
        <div className="mb-5 md:mb-6">
          <PlatformSelector selected={platforms} onChange={setPlatforms} />
        </div>

        {/* Influencer Filters */}
        <div className="mb-6 md:mb-7">
          <h3 className="text-sm font-medium text-gray-900 mb-3 md:mb-4">
            Influencer Criteria
          </h3>
          <InfluencerFilters
            platforms={platforms}
            filters={filters.influencer}
            updateFilter={(path, value) => updateFilter(`influencer.${path}`, value)}
          />
        </div>

        {/* Audience Filters */}
        <div className="mb-5 md:mb-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3 md:mb-4">
            Audience Demographics
          </h3>
          <AudienceFilters
            platforms={platforms}
            filters={filters.audience}
            updateFilter={(path, value) => updateFilter(`audience.${path}`, value)}
          />
        </div>

        {/* Apply */}
        <div className="pt-1 md:pt-2">
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
    </aside>
  );
}
