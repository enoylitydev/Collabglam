'use client';
import React from 'react';
import { Search as SearchIcon, Loader2 } from 'lucide-react';
import { Platform, SearchFilters, SortOption } from '../types';
import InfluencerCard from './InfluencerCard';

interface Props {
  query: string;
  setQuery: (q: string) => void;
  results: any[];
  loading: boolean;
  total: number;
  onSearch: (query: string) => void;
  onLoadMore: () => void;
}

export default function ModashSearch({ query, setQuery, results, loading, total, onSearch, onLoadMore }: Props) {
  return (
    <section className="px-6">
      <div className="rounded-2xl border border-orange-200 bg-white p-5 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            placeholder="Search creators by name, keyword, @mention or #hashtag…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSearch(query)}
            className="h-12 flex-1 min-w-[220px] border rounded-xl px-3"
          />
          <button onClick={() => onSearch(query)} disabled={loading} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <SearchIcon className="h-4 w-4"/>}
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          {results.map((r, i) => (
            <InfluencerCard key={`${r.platform}-${r.id}-${i}`} item={r} />
          ))}
        </div>
      )}

      {results.length > 0 && results.length < total && (
        <div className="mt-6 text-center">
          <button onClick={onLoadMore} disabled={loading} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : null}
            {loading ? 'Loading…' : `Load more (${Math.max(total - results.length, 0)} left)`}
          </button>
        </div>
      )}
    </section>
  );
}