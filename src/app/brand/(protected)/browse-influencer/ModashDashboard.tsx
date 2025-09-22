import React, { useCallback, useMemo, useState } from 'react';
import { FilterSidebar } from './FilterSidebar';
import { ResultsGrid } from './ResultsGrid';
import { useInfluencerSearch } from './useInfluencerSearch';
import type { Platform } from './filters';
import { SearchHeader } from './SearchHeader';
import { DetailPanel } from './DetailPanel';
import { useInfluencerReport } from './useInfluencerReport';
import type { Platform as ReportPlatform } from './types';
import { useEmailStatus } from './useEmailStatus';

export default function ModashDashboard() {
  const [platforms, setPlatforms] = useState<Platform[]>(['youtube']);
  const [showFilters, setShowFilters] = useState(false);

  // search header state
  const [queryText, setQueryText] = useState('');
  const [showDebug, setShowDebug] = useState(false);

  // detail panel state (reuse browse-influencers implementation)
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<ReportPlatform | null>(null);
  const [calculationMethod, setCalculationMethod] = useState<"median" | "average">('median');
  const { report, rawReport, loading: loadingReport, error: reportError, fetchReport } = useInfluencerReport();
  const { exists: emailExists, loading: loadingEmail, error: emailError, checkStatus } = useEmailStatus();

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

  const toggleFilters = useCallback(() => setShowFilters((s) => !s), []);
  const onResetAll = useCallback(() => resetFilters(), [resetFilters]);

  const onSearchFromHeader = useCallback(
    (q: string) => {
      const clean = q.trim();
      setQueryText(clean);
      // update your filter key used by the search hook
      updateFilter('influencer.query', clean);
      runSearch({ reset: true });
    },
    [updateFilter, runSearch]
  );

  const onApply = useCallback(() => runSearch({ reset: true }), [runSearch]);

  const onViewProfile = useCallback((influencer: any) => {
    // 1) infer platform
    const inferredPlatform: ReportPlatform =
      (influencer?.platform as ReportPlatform) ||
      (platforms[0] as unknown as ReportPlatform) ||
      'youtube';

    // 2) choose an id for the Modash report call
    const idCandidate =
      influencer?.id ||
      influencer?.userId ||
      influencer?.username ||
      influencer?.handle ||
      influencer?.url;
    if (!idCandidate) return;
    const id = String(idCandidate);

    // 3) extract a handle for the email/status call
    const extractHandle = (it: any): string | null => {
      let h: string | null =
        it?.username ??
        null;

      if (!h && typeof it?.url === 'string' && it.url) {
        try {
          const u = new URL(it.url);
          // last non-empty path segment as a best-effort handle
          const segments = u.pathname.split('/').filter(Boolean);
          if (segments.length) h = segments[segments.length - 1];
        } catch { /* ignore */ }
      }

      if (!h) return null;
      h = String(h).trim();
      if (!h) return null;

      // normalize to '@handle' and validate like your server
      const core = h.replace(/^@/, '');
      if (!/^[A-Za-z0-9._\-]+$/.test(core)) return null;
      return '@' + core.toLowerCase();
    };

    const handleForStatus = extractHandle(influencer);

    // 4) open panel and fire both requests
    setSelectedId(id);
    setSelectedPlatform(inferredPlatform);
    setPanelOpen(true);

    // A) Modash report
    fetchReport(id, inferredPlatform, calculationMethod);

    // B) Email status (only if we could infer a clean handle)
    if (handleForStatus) {
      checkStatus(handleForStatus, inferredPlatform);
    }
  }, [calculationMethod, fetchReport, platforms, checkStatus]);


  return (
    <div className="min-h-screen">
      {/* Mobile: open filters button */}
      <div className="px-4 sm:px-6 lg:px-0">
        <button
          onClick={toggleFilters}
          className="lg:hidden inline-flex items-center mt-4 px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          aria-expanded={showFilters}
          aria-controls="filter-sidebar"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"
            />
          </svg>
          Filters
        </button>
      </div>

      {/* Layout */}
      <div className="px-4 sm:px-6 lg:px-0">
        {/* Fixed grid layout that prevents shifting */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[352px_1fr] 2xl:grid-cols-[384px_1fr] gap-4 lg:gap-6 items-start">
          {/* Desktop fixed sidebar wrapper - prevents any shifting */}
          <div className="hidden lg:block">
            <div className="border-l-2 fixed top-4 w-[320px] xl:w-[352px] 2xl:w-[384px] h-[calc(100vh-2rem)] z-10 bg-white">
              <FilterSidebar
                platforms={platforms}
                setPlatforms={setPlatforms}
                filters={filters}
                updateFilter={updateFilter}
                onReset={onResetAll}
                onApply={onApply}
                loading={searchState.loading}
              />
            </div>
          </div>

          {/* Right column: search header + results */}
          <main className="relative flex-1 min-w-0 space-y-6 lg:ml-0">
            {/* Search header pinned to the top of the results column */}
            <SearchHeader
              platform={primaryPlatform}
              queryText={queryText}
              setQueryText={setQueryText}
              loading={searchState.loading}
               onSearch={(q) => runSearch({ reset: true, queryText: q })}
              showDebug={showDebug}
              setShowDebug={setShowDebug}
            />

            {/* Optional top loading indicator (doesn't affect layout) */}
            {searchState.loading && (
              <div className="absolute top-[88px] right-0 left-0 flex justify-center z-10 pointer-events-none">
                <div className="inline-block h-2 w-40 rounded bg-gradient-to-r from-gray-300 via-gray-400 to-gray-300 animate-pulse" />
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
              onViewProfile={onViewProfile}
            />
          </main>
        </div>
      </div>

      {/* Mobile drawer (slides over content) */}
      {showFilters && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowFilters(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-[85vw] max-w-[22rem]">
            <FilterSidebar
              platforms={platforms}
              setPlatforms={setPlatforms}
              filters={filters}
              updateFilter={updateFilter}
              onReset={onResetAll}
              onApply={() => {
                onApply();
                setShowFilters(false); // close drawer after applying
              }}
              loading={searchState.loading}
            />
          </div>
        </div>
      )}

      {/* Detail Panel */}
      <DetailPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        loading={loadingReport}
        error={reportError}
        data={report}
        raw={rawReport}
        platform={selectedPlatform}
        calc={calculationMethod}
        onChangeCalc={(calc) => {
          setCalculationMethod(calc);
          if (selectedId && selectedPlatform) {
            fetchReport(selectedId, selectedPlatform, calc);
          }
        }}
        emailExists={emailExists}
      />

    </div>
  );
}