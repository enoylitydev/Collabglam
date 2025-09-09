// ResultsGrid.tsx
import React, { useMemo } from 'react';
import { SlidersHorizontal, AlertCircle, ChevronDown, ChevronsDown } from 'lucide-react';
import { InfluencerCard } from './InfluencerCard';
import { Platform } from './platform';

type NormalizedInfluencer = {
  id?: string | number;
  platform?: Platform | string;
  username?: string;
  handle?: string;
  url?: string;
  [k: string]: any;
};

interface ResultsGridProps {
  platform: Platform;                 // fallback platform
  results: NormalizedInfluencer[];
  loading: boolean;
  error?: string;
  total?: number;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onLoadAll?: () => void;
  onRetry?: () => void;               // optional: retry last query (useful for 429)
}

const numberFmt = new Intl.NumberFormat(undefined);

const normalizePlatform = (p: unknown, fallback: Platform): Platform => {
  const s = typeof p === 'string' ? p.toLowerCase() : p;
  return (s === 'youtube' || s === 'instagram' || s === 'tiktok') ? (s as Platform) : fallback;
};

export function ResultsGrid({
  platform,
  results,
  loading,
  error,
  total,
  hasMore,
  onLoadMore,
  onLoadAll,
  onRetry,
}: ResultsGridProps) {
  // ----- Error state -----
  if (error) {
    const is429 = /Too Many Requests|429|ThrottlerException/i.test(error);
    return (
      <div
        className={`${is429 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'} border rounded-xl p-6`}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-center">
          <AlertCircle className={`h-5 w-5 mr-2 ${is429 ? 'text-yellow-600' : 'text-red-400'}`} aria-hidden="true" />
          <p className={`${is429 ? 'text-yellow-900' : 'text-red-800'} font-medium`}>
            {is429 ? 'Rate limit reached' : 'Search Error'}
          </p>
        </div>
        <p className={`${is429 ? 'text-yellow-800' : 'text-red-700'} text-sm mt-1`}>
          {is429
            ? 'We’re sending requests too fast. Please retry shortly or load results more slowly.'
            : error}
        </p>
        {is429 && onRetry && (
          <div className="mt-3">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  // ----- Loading skeleton (initial load) -----
  if (loading && results.length === 0) {
    return (
      <div
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6"
        aria-busy="true"
        aria-live="polite"
        role="status"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 animate-pulse">
            <div className="h-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded-t-xl" />
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-32" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-6 bg-gray-200 rounded w-24" />
                <div className="h-6 bg-gray-200 rounded w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ----- Empty state -----
  if (results.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <SlidersHorizontal className="mx-auto h-12 w-12 text-gray-400 mb-4" aria-hidden="true" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
        <p className="text-gray-500 max-w-sm mx-auto">
          Try adjusting your filters or search terms to find more creators.
        </p>
      </div>
    );
  }

  // ----- Counts -----
  const countLabel = useMemo(() => numberFmt.format(results.length), [results.length]);
  const totalLabel = total != null ? numberFmt.format(total) : undefined;

  return (
    <section aria-label="Search results">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Search Results ({countLabel}{totalLabel ? ` / ${totalLabel}` : ''})
          </h2>
          <p className="text-sm text-gray-500 mt-1">Showing influencers matching your criteria</p>
        </div>

        {/* Controls */}
        {(hasMore || loading) && (
          <div className="flex gap-2">
            {hasMore && onLoadMore && (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loading}
                className="inline-flex items-center px-3 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronDown className="w-4 h-4 mr-1" aria-hidden="true" />
                Load more
              </button>
            )}
            {hasMore && onLoadAll && (
              <button
                type="button"
                onClick={onLoadAll}
                disabled={loading}
                className="inline-flex items-center px-3 py-2 text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
                title="Fetch all remaining pages (may take time)"
              >
                <ChevronsDown className="w-4 h-4 mr-1" aria-hidden="true" />
                Load all
              </button>
            )}
            {loading && <span className="text-sm text-gray-500">Loading…</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {results.map((influencer, index) => {
          const p = normalizePlatform(influencer.platform, platform);
          const key =
            (influencer.id ??
              influencer.username ??
              influencer.handle ??
              influencer.url ??
              index).toString();

          return (
            <InfluencerCard
              key={key}
              platform={p}
              influencer={influencer}
            />
          );
        })}
      </div>
    </section>
  );
}
