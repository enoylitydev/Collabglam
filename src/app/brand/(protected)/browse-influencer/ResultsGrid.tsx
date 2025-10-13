// src/app/brand/(protected)/browse-influencer/ResultsGrid.tsx
import React from 'react';
import { SlidersHorizontal, AlertCircle, ChevronDown, ChevronsDown } from 'lucide-react';
import { InfluencerCard } from './InfluencerCard';
import type { Platform } from './filters';

interface ResultsGridProps {
  platform: Platform;
  results: any[];
  loading: boolean;
  error?: string;
  total?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onLoadAll?: () => void;
  onViewProfile?: (influencer: any) => void;
}

export function ResultsGrid({
  platform,
  results,
  loading,
  error,
  total,
  hasMore,
  onLoadMore,
  onLoadAll,
  onViewProfile,
}: ResultsGridProps) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6" role="alert" aria-live="assertive">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
          <p className="text-red-800 font-medium">Search Error</p>
        </div>
        <p className="text-red-700 text-xs sm:text-sm mt-1">{error}</p>
      </div>
    );
  }

  // Skeleton: show full height (no clipping)
  if (loading && results.length === 0) {
    return (
      <div
        className="grid grid-cols-1 min-[1400px]:grid-cols-2 min-[1680px]:grid-cols-3 gap-4 sm:gap-6"
        aria-busy="true"
        aria-live="polite"
        role="status"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 animate-pulse">
            <div className="h-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded-t-xl" />
            <div className="p-4 sm:p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded w-16 sm:w-20 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-24 sm:w-32" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-6 bg-gray-200 rounded w-20 sm:w-24" />
                <div className="h-6 bg-gray-200 rounded w-14 sm:w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state: keep no-scroll (as you requested earlier)
  if (results.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 sm:p-12 text-center overflow-hidden">
        <SlidersHorizontal className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400 mb-4" />
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No results found</h3>
        <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
          Try adjusting your filters to find more creators.
        </p>
      </div>
    );
  }

  const countLabel = new Intl.NumberFormat().format(results.length);
  const totalLabel = total != null ? new Intl.NumberFormat().format(total) : undefined;

  return (
    <section aria-label="Search results">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">
            {`Search Results (${countLabel}${totalLabel ? ` / ${totalLabel}` : ''})`}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Showing influencers matching your criteria</p>
        </div>

        {(hasMore || loading) && (
          <div className="flex gap-2">
            {hasMore && onLoadMore && (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loading}
                className="inline-flex items-center px-3 py-2 text-xs sm:text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronDown className="w-4 h-4 mr-1" />
                Load more
              </button>
            )}
            {hasMore && onLoadAll && (
              <button
                type="button"
                onClick={onLoadAll}
                disabled={loading}
                className="inline-flex items-center px-3 py-2 text-xs sm:text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                title="Fetch all remaining pages"
              >
                <ChevronsDown className="w-4 h-4 mr-1" />
                Load all
              </button>
            )}
            {loading && <span className="text-xs sm:text-sm text-gray-500">Loading…</span>}
          </div>
        )}
      </div>

      {/* 1 card <1400px, 2 cards ≥1400px, 3 cards ≥1680px */}
      <div className="grid grid-cols-1 min-[1400px]:grid-cols-2 min-[1680px]:grid-cols-3 gap-4 sm:gap-6">
        {results.map((influencer, index) => (
          <InfluencerCard
            key={(influencer.id ?? influencer.username ?? influencer.url ?? index).toString()}
            platform={influencer.platform || platform}
            influencer={influencer}
            onViewProfile={onViewProfile}
          />
        ))}
      </div>
    </section>
  );
}
