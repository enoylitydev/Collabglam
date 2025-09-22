"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Filter, Calendar, Users, ChevronLeft, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { post2 } from "@/lib/api";

/**
 * Types matching the /missing/list backend contract
 */
export type MissingItem = {
  missingId: string; // kept for keys only; not rendered
  handle: string;
  platform: "youtube" | "instagram" | "tiktok" | string;
  createdAt: string; // ISO
};

export type MissingListResponse = {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  data: MissingItem[];
};

export type MissingListRequest = {
  page?: number;
  limit?: number; // default 50, max 200
  search?: string;
  platform?: string;
  handle?: string;
};

/** Thin typed wrapper around post2 */
async function listMissing(body: MissingListRequest): Promise<MissingListResponse> {
  return await post2<MissingListResponse>("/missing/list", body);
}

// --- Small utilities ---
const prettyDate = (iso: string) => new Date(iso).toLocaleString();

const useDebouncedValue = (value: string, delay = 400) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
};

const getPlatformColor = (platform: string) => {
  switch (platform.toLowerCase()) {
    case 'youtube':
    case 'yt':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'instagram':
    case 'ig':
      return 'bg-pink-100 text-pink-700 border-pink-200';
    case 'tiktok':
    case 'tt':
      return 'bg-gray-900 text-white border-gray-900';
    default:
      return 'bg-blue-100 text-blue-700 border-blue-200';
  }
};

const getPlatformIcon = (platform: string) => {
  const size = 14;
  switch (platform.toLowerCase()) {
    case 'youtube':
    case 'yt':
      return <div className="w-3.5 h-3.5 bg-red-600 rounded-sm"></div>;
    case 'instagram':
    case 'ig':
      return <div className="w-3.5 h-3.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg"></div>;
    case 'tiktok':
    case 'tt':
      return <div className="w-3.5 h-3.5 bg-black rounded-full"></div>;
    default:
      return <div className="w-3.5 h-3.5 bg-blue-500 rounded"></div>;
  }
};

// --- Page component ---
export default function MissingListPage() {
  const [items, setItems] = useState<MissingItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [handle, setHandle] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 500);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body: MissingListRequest = {
        page,
        limit,
        search: debouncedSearch.trim() || undefined,
        platform: platform.trim() || undefined,
        handle: handle.trim() || undefined,
      };

      const res = await listMissing(body);
      setItems(res.data);
      setTotal(res.total);
      setHasNext(res.hasNext);
    } catch (e: any) {
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, platform, handle]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, platform, handle]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / Math.max(1, limit))), [total, limit]);
  const hasActiveFilters = search || platform || handle;

  const clearFilters = () => {
    setSearch("");
    setPlatform("");
    setHandle("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Missing Details</h1>
              <p className="text-gray-600">Track and manage missing creator information</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-gray-900">{total.toLocaleString()}</span>
                <span className="text-gray-500">total items</span>
              </div>
            </div>
          </div>
        </header>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          {/* Main Search */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              placeholder="Search by handle or platform..."
              className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Filter className="w-4 h-4" />
              Advanced Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Advanced Filters */}
          {filtersOpen && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  <option value="">All platforms</option>
                  <option value="youtube">YouTube</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
              
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Handle</label>
                <input
                  placeholder="@handle or handle"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <Th>Handle</Th>
                  <Th>Platform</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && (
                  <tr>
                    <td colSpan={3} className="p-12 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        <span className="text-gray-600">Loading data...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-12 text-center">
                      <div className="text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p className="font-medium">No results found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && items.map((item, index) => (
                  <tr 
                    key={item.missingId} 
                    className="hover:bg-gray-50 transition-colors"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <Td>
                      <div className="font-medium text-gray-900">{item.handle}</div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getPlatformColor(item.platform)}`}>
                          {item.platform}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4 opacity-50" />
                        <span className="text-sm">{prettyDate(item.createdAt)}</span>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Show</span>
                  <select
                    className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                  >
                    {[25, 50, 100, 150, 200].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <span>per page</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  Page <span className="font-medium">{page}</span> of <span className="font-medium">{pageCount}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!hasNext || loading}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-xs text-gray-500 bg-white rounded-xl p-4 border border-gray-200">
          <p><strong>Tip:</strong> Platform accepts aliases (yt, ig, tt). Handle accepts with or without @ symbol. Use advanced filters for more precise results.</p>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
      {children}
    </th>
  );
}

function Td({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={`px-6 py-4 whitespace-nowrap ${mono ? "font-mono text-sm" : ""}`}>
      {children}
    </td>
  );
}