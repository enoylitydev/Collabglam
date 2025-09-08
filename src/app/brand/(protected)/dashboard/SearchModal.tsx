"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  X, Search, Users, Filter, ChevronDown, Loader2, Info, Bookmark, BookmarkCheck,
} from "lucide-react";

export type Platform = "youtube" | "tiktok" | "instagram";
export type SortOption = "relevance" | "followers" | "engagement" | "recent";
export type ViewMode = "grid" | "list";

export interface InfluencerResult {
  id: string;
  name: string;
  username: string;
  platform: Platform;
  followers: number;
  engagement: number;
  engagementRate: number;
  avatar?: string;
  verifiedStatus: boolean;
  bio?: string;
  location?: string;
  categories?: string[];
  joinedDate?: string;
  averageViews?: number;
  recentPosts?: number;
  isFavorite?: boolean;
}

export interface SearchFilters {
  minFollowers: number;
  maxFollowers: number;
  minEngagement: number; // percent 0..100
  maxEngagement: number; // percent 0..100
  location: string;
  categories: string[];
  verifiedOnly: boolean;
}

export interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectInfluencer: (influencer: InfluencerResult) => void;
  onBulkSelect?: (influencers: InfluencerResult[]) => void;
  favorites?: string[];
  onToggleFavorite?: (influencerId: string) => void;
}

const PLATFORMS: Record<Platform, { label: string; icon: string; gradient: string }> = {
  youtube: { label: "YouTube", icon: "📺", gradient: "from-red-500 to-red-600" },
  tiktok: { label: "TikTok", icon: "🎵", gradient: "from-gray-800 to-black" },
  instagram: { label: "Instagram", icon: "📸", gradient: "from-pink-500 to-purple-600" },
};

const SEARCH_SUGGESTIONS = [
  "Tech reviewers",
  "Beauty influencers",
  "Gaming streamers",
  "Fitness coaches",
  "Food bloggers",
  "Travel vloggers",
  "Fashion creators",
  "Music artists",
];

export default function EnhancedSearchModal({
  isOpen,
  onClose,
  onSelectInfluencer,
  onBulkSelect,
  favorites = [],
  onToggleFavorite,
}: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["youtube", "tiktok", "instagram"]);
  const [results, setResults] = useState<InfluencerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noResults, setNoResults] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(0); // 0-based for Modash
  const [totalResults, setTotalResults] = useState(0);

  // NEW: Guard to only show results after explicit user action (click search)
  const [hasSearched, setHasSearched] = useState(false);
  const [lastSearchParams, setLastSearchParams] = useState<{ query: string; platforms: Platform[] }>({ query: "", platforms: [] });

  const [filters, setFilters] = useState<SearchFilters>({
    minFollowers: 0,
    maxFollowers: 10_000_000,
    minEngagement: 0,
    maxEngagement: 100,
    location: "",
    categories: [],
    verifiedOnly: false,
  });

  const searchBoxRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bodyScrollY = useRef<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    // lock scroll
    bodyScrollY.current = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${bodyScrollY.current}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    setTimeout(() => searchBoxRef.current?.focus(), 120);
    return () => {
      // unlock
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, bodyScrollY.current || 0);
    };
  }, [isOpen]);

  const processedResults = useMemo(() => {
    let filtered = results.filter((r) => {
      if (filters.minFollowers && r.followers < filters.minFollowers) return false;
      if (filters.maxFollowers && r.followers > filters.maxFollowers) return false;
      const er = r.engagementRate * 100; // convert to percent
      if (filters.minEngagement && er < filters.minEngagement) return false;
      if (filters.maxEngagement && er > filters.maxEngagement) return false;
      if (filters.verifiedOnly && !r.verifiedStatus) return false;
      if (filters.location && !(r.location || "").toLowerCase().includes(filters.location.toLowerCase())) return false;
      if (filters.categories.length) {
        const hay = (r.categories || []).map((c) => c.toLowerCase());
        const ok = filters.categories.some((c) => hay.some((h) => h.includes(c.toLowerCase())));
        if (!ok) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "followers":
          return (b.followers || 0) - (a.followers || 0);
        case "engagement":
          return (b.engagementRate || 0) - (a.engagementRate || 0);
        case "recent":
          return new Date(b.joinedDate || 0).getTime() - new Date(a.joinedDate || 0).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [results, filters, sortBy]);

  const performSearch = useCallback(
    async (q: string, platforms: Platform[], page: number) => {
      if (!q.trim()) {
        setResults([]);
        setNoResults(false);
        setTotalResults(0);
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      setError(null);
      setNoResults(false);

      try {
        const res = await fetch("/api/modash/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q,
            platforms,
            page,            // 0-based
            sortBy,
            filters,
          }),
          signal: abortRef.current.signal,
        });

        let data: any = null;
        try { data = await res.json(); } catch {}
        if (!res.ok) {
          const msg = (data && (data.error || data.message)) || `Search failed (${res.status})`;
          throw new Error(msg);
        }

        const enriched: InfluencerResult[] = (data.results || []).map((r: InfluencerResult) => ({
          ...r,
          isFavorite: favorites.includes(r.id),
        }));

        if (page === 0) setResults(enriched);
        else setResults((prev) => [...prev, ...enriched]);

        setTotalResults(data.total || enriched.length);
        setNoResults(page === 0 && enriched.length === 0);
        setHasSearched(true);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e?.message || "Search failed");
      } finally {
        setLoading(false);
      }
    },
    [favorites, filters, sortBy]
  );

  // IMPORTANT CHANGE: remove auto-search effects. No API calls on typing or changing filters/sort/platforms.
  // All searches happen ONLY when the user clicks the Search button.

  const handleSearchClick = useCallback(() => {
    setCurrentPage(0);
    setHasSearched(!!searchQuery.trim());
    setLastSearchParams({ query: searchQuery, platforms: selectedPlatforms });
    if (searchQuery.trim()) {
      performSearch(searchQuery, selectedPlatforms, 0);
    } else {
      setResults([]);
      setTotalResults(0);
      setNoResults(false);
    }
  }, [performSearch, searchQuery, selectedPlatforms]);

  const loadMore = () => {
    const next = currentPage + 1;
    setCurrentPage(next);
    // Use the last explicit search params to avoid accidental API calls when UI changed
    performSearch(lastSearchParams.query, lastSearchParams.platforms, next);
  };

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) => {
      const next = prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p];
      return next.length ? next : [p];
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedResults((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-6xl max-h-[88vh] bg-white/95 rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200/60">
            <div className="px-6 pt-4 pb-3 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-[#FFA135] to-[#FF7236] rounded-xl">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <input
                  ref={searchBoxRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search creators by name, keyword, @mention or #hashtag…"
                  className="w-full h-12 px-4 rounded-xl bg-white/90 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>

              {/* NEW: explicit Search button. No auto-search */}
              <button
                onClick={handleSearchClick}
                disabled={loading || !searchQuery.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white disabled:opacity-50"
                aria-label="Run search"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Searching…" : "Search"}
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Controls */}
            <div className="px-6 pb-4 flex flex-wrap items-center gap-2">
              {/* Platforms */}
              {(Object.keys(PLATFORMS) as Platform[]).map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition ${
                    selectedPlatforms.includes(p)
                      ? `text-white bg-gradient-to-r ${PLATFORMS[p].gradient}`
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                  aria-pressed={selectedPlatforms.includes(p)}
                >
                  <span className="mr-1">{PLATFORMS[p].icon}</span>
                  {PLATFORMS[p].label}
                </button>
              ))}

              {/* Sort */}
              <div className="ml-auto relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="appearance-none bg-white border border-gray-200 rounded-xl px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                >
                  <option value="relevance">Relevance</option>
                  <option value="followers">Followers</option>
                  <option value="engagement">Engagement</option>
                  <option value="recent">Recent</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              </div>

              {/* Filters */}
              <button
                onClick={() => setShowFilters((s) => !s)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm border ${
                  showFilters
                    ? "text-white bg-gradient-to-r from-orange-400 to-orange-500 border-transparent"
                    : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                <Filter className="h-4 w-4" /> Filters
              </button>

              {/* Result count - only after an explicit search */}
              {hasSearched && (
                <div className="text-sm text-gray-600">
                  {loading ? "Searching…" : `${Math.min(processedResults.length, 15)} of ${totalResults} results`}
                </div>
              )}
            </div>

            {/* Filter panel */}
            {showFilters && (
              <div className="px-6 pb-4 grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-gray-100 bg-white/70">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Followers</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.minFollowers || ""}
                      onChange={(e) => setFilters((f) => ({ ...f, minFollowers: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white/90"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.maxFollowers || ""}
                      onChange={(e) => setFilters((f) => ({ ...f, maxFollowers: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white/90"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Engagement Rate (%)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={filters.minEngagement || ""}
                      onChange={(e) => setFilters((f) => ({ ...f, minEngagement: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white/90"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={filters.maxEngagement || ""}
                      onChange={(e) => setFilters((f) => ({ ...f, maxEngagement: Number(e.target.value) }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white/90"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Location (free text)</label>
                  <input
                    type="text"
                    placeholder="e.g., Berlin, Germany"
                    value={filters.location}
                    onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white/90"
                  />
                  <label className="mt-2 block text-xs font-semibold text-gray-700 mb-1">Categories (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g., tech, gaming"
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        categories: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white/90"
                  />
                  <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={filters.verifiedOnly}
                      onChange={(e) => setFilters((f) => ({ ...f, verifiedOnly: e.target.checked }))}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    Verified only
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="overflow-y-auto max-h-[calc(88vh-170px)] p-6">
            {error && (
              <div className="mb-4 p-3 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>
            )}

            {/* Show guidance until the user explicitly searches */}
            {!hasSearched && !loading && (
              <div className="text-center py-16">
                <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center">
                  <Search className="h-12 w-12 text-orange-500" />
                </div>
                <h3 className="text-lg font-semibold">Start your search</h3>
                <p className="text-gray-500">Type a query and click <span className="font-semibold">Search</span> to fetch results.</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {SEARCH_SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => setSearchQuery(s)} className="px-3 py-1.5 rounded-full text-sm bg-white border border-gray-200 hover:bg-gray-50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading && results.length === 0 && (
              <div className="grid md:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-36 rounded-2xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            )}

            {hasSearched && !loading && noResults && (
              <div className="text-center py-16">
                <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Users className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold">No influencers found</h3>
                <p className="text-gray-500">Try broadening your filters or searching different keywords.</p>
              </div>
            )}

            {hasSearched && processedResults.length > 0 && (
              <div className={`grid gap-4 ${viewMode === "grid" ? "md:grid-cols-2" : "grid-cols-1"}`}>
                {processedResults.map((inf) => (
                  <div
                    key={`${inf.platform}-${inf.id}`}
                    className="group relative p-5 rounded-2xl border border-gray-200 bg-white hover:shadow-xl hover:border-transparent hover:bg-gradient-to-br from-white to-orange-50 transition"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectInfluencer(inf)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelectInfluencer(inf)}
                  >
                    {/* bulk checkbox */}
                    {onBulkSelect && (
                      <div className="absolute top-4 right-4 z-10">
                        <input
                          type="checkbox"
                          checked={selectedResults.has(inf.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSelect(inf.id);
                          }}
                          className="w-5 h-5 text-orange-500 rounded border-gray-300"
                        />
                      </div>
                    )}

                    <div className="flex items-start gap-4">
                      {inf.avatar ? (
                        <img src={inf.avatar} alt={inf.name} className="w-16 h-16 rounded-full object-cover ring-2 ring-white" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                          <Users className="h-7 w-7 text-gray-500" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold truncate">{inf.name}</h4>
                          {inf.verifiedStatus && (
                            <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] rounded-full bg-blue-500 text-white">✓</span>
                          )}
                          {onToggleFavorite && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite?.(inf.id);
                              }}
                              className="p-1 rounded hover:bg-gray-100"
                              aria-label={inf.isFavorite ? "Remove bookmark" : "Save bookmark"}
                            >
                              {inf.isFavorite ? <BookmarkCheck className="w-4 h-4 text-orange-500" /> : <Bookmark className="w-4 h-4 text-gray-400" />}
                            </button>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 truncate">@{inf.username}</div>

                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg bg-gray-50 p-2">
                            <div className="text-[11px] text-gray-500">Followers</div>
                            <div className="text-sm font-semibold">{formatNumber(inf.followers)}</div>
                          </div>
                          <div className="rounded-lg bg-gray-50 p-2">
                            <div className="text-[11px] text-gray-500">Engage. rate</div>
                            <div className="text-sm font-semibold">{formatER(inf.engagementRate)}</div>
                          </div>
                          <div className="rounded-lg bg-gray-50 p-2">
                            <div className="text-[11px] text-gray-500">Platform</div>
                            <div className="text-sm font-semibold">{PLATFORMS[inf.platform].label}</div>
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                          {inf.location && <span className="px-2 py-1 rounded-full bg-gray-100">{inf.location}</span>}
                          {(inf.categories || []).slice(0, 3).map((c, i) => (
                            <span key={i} className="px-2 py-1 rounded-full bg-orange-100 text-orange-700">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasSearched && processedResults.length > 0 && processedResults.length < totalResults && (
              <div className="mt-6 text-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? "Loading…" : `Load more (${Math.max(totalResults - processedResults.length, 0)} left)`}
                </button>
              </div>
            )}
          </div>

          {/* Footer tips */}
          {hasSearched && processedResults.length > 0 && (
            <div className="border-t border-gray-100 px-6 py-3 text-xs text-gray-600 flex items-center gap-2 bg-white/80">
              <Info className="w-4 h-4" /> Use @ and # in your query to match mentions & hashtags. Results per page are provided by Modash (15 / platform).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function formatER(x: number) {
  return `${(x * 100).toFixed(1)}%`;
}
