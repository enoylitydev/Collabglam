"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { get } from "@/lib/api";
import { Platform, Category, Country, Option, CountryOption, SearchFilters, SortOption } from './types';

// Hooks
import { useInfluencersData } from './hooks/useInfluencersData';
import { useModashSearch } from './hooks/useModashSearch';
import { useInfluencerReport } from './hooks/useInfluencerReport';

// Components
import { FilterSidebar } from './components/FilterSidebar';
import { ModashSearch } from './components/ModashSearch';
import { DirectorySearch } from './components/DirectorySearch';
import { InfluencersTable } from './components/InfluencersTable';
import { DetailPanel } from './components/DetailPanel';

export default function BrowseInfluencersInline() {
  const router = useRouter();

  // ===== State =====
  const [favorites, setFavorites] = useState<string[]>([]);

  // Filter options
  const [categories, setCategories] = useState<Category[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [platformOptions, setPlatformOptions] = useState<Option[]>([]);
  const [audienceSizeOptions, setAudienceSizeOptions] = useState<{ _id: string; range: string }[]>([]);
  const [ageOptions, setAgeOptions] = useState<Option[]>([]);

  // Filter state
  const [tempCategories, setTempCategories] = useState<string[]>([]);
  const [tempPlatform, setTempPlatform] = useState<string>("all");
  const [tempAgeGroup, setTempAgeGroup] = useState<string>("all");
  const [tempAudienceSize, setTempAudienceSize] = useState<string>("all");
  const [tempCountries, setTempCountries] = useState<CountryOption[]>([]);
  const [tempMaleSplit, setTempMaleSplit] = useState<string>("all");
  const [tempFemaleSplit, setTempFemaleSplit] = useState<string>("all");
  const [directoryQuery, setDirectoryQuery] = useState<string>("");
  const [tempVerifiedOnly, setTempVerifiedOnly] = useState<boolean>(false);
  const [tempMinEngagement, setTempMinEngagement] = useState<number>(0);

  // UI state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    category: false,
    audience: false,
    country: false,
    platform: false,
    gender: false,
    age: false,
    more: true,
  });

  // Detail panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [calculationMethod, setCalculationMethod] = useState<"median" | "average">("median");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // ===== Helpers: category recognition from free-text =====
  const categoryByName = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.name.trim().toLowerCase(), c._id));
    return m;
  }, [categories]);

  const normalizeToken = (t: string) => t.replace(/^#/, "").trim().toLowerCase();

  const extractCategoryIdsFromText = useCallback(
    (text: string) => {
      if (!text) return [] as string[];
      const tokens = Array.from(
        new Set(
          text
            .split(/[\s,]+/)
            .map(normalizeToken)
            .filter(Boolean)
        )
      );
      return tokens
        .map((tok) => categoryByName.get(tok))
        .filter((x): x is string => Boolean(x));
    },
    [categoryByName]
  );

  // ===== Hooks =====
  const influencersParams = {
    directoryQuery,
    tempCategories,
    tempCountries,
    tempPlatform,
    tempAgeGroup,
    tempAudienceSize,
    tempMaleSplit,
    tempFemaleSplit,
  };

  const {
    influencers,
    loading: loadingTable,
    error: tableError,
    totalPages,
    currentPage,
    setCurrentPage,
    fetchInfluencers,
  } = useInfluencersData(influencersParams);

  const {
    searchState,
    setSearchState,
    runSearch,
  } = useModashSearch(favorites);

  const {
    report,
    rawReport,
    loading: loadingReport,
    error: reportError,
    fetchReport,
  } = useInfluencerReport();

  // ===== Effects =====
  useEffect(() => {
    fetchInfluencers();
    get<Category[]>("/interest/getlist").then(setCategories).catch(() => { });
    get<Country[]>("/country/getall").then(setCountries).catch(() => { });
    get<{ _id: string; name: string; platformId: string }[]>("/platform/getall")
      .then((arr) => setPlatformOptions(arr.map((p) => ({ value: p.platformId, label: p.name }))))
      .catch(() => { });
    get<{ _id: string; range: string }[]>("/audience/getlist").then(setAudienceSizeOptions).catch(() => { });
    get<{ _id: string; range: string; audienceId: string }[]>("/audienceRange/getall")
      .then((arr) => setAgeOptions(arr.map((r) => ({ value: r.audienceId, label: r.range }))))
      .catch(() => { });
  }, []);

  // ===== Handlers =====
  const toggleSection = useCallback((key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const applyFilters = useCallback(() => {
    // Derive categories from both search boxes
    const derivedFromModash = extractCategoryIdsFromText(searchQuery);
    const derivedFromDirectory = extractCategoryIdsFromText(directoryQuery);
    const mergedCategoryIds = Array.from(new Set([...tempCategories, ...derivedFromModash, ...derivedFromDirectory]));

    // Reflect merged selection in state so checkboxes stay in sync
    setTempCategories(mergedCategoryIds);

    // 1) Refresh directory (uses ids/_id) — fetch after state flush
    setCurrentPage(1);
    setTimeout(() => fetchInfluencers(), 0);

    // 2) Refresh Modash search (labels, not ids)
    const firstCountryName = tempCountries[0]?.country?.countryName || "";
    const selectedCategoryNames = mergedCategoryIds
      .map((id) => categories.find((c) => c._id === id)?.name)
      .filter((x): x is string => Boolean(x));

    // Extend SearchFilters with audienceSizeId + keywords for the hook
    const updatedModashFilters: SearchFilters & { audienceSizeId?: string; keywords?: string[] } = {
      ...searchState.filters,
      verifiedOnly: tempVerifiedOnly,
      minEngagement: Number.isFinite(tempMinEngagement)
        ? Math.max(0, Math.min(100, tempMinEngagement))
        : 0,
      location: firstCountryName,
      categories: selectedCategoryNames,
      audienceSizeId: tempAudienceSize !== 'all' ? tempAudienceSize : undefined,
      keywords: selectedCategoryNames, // send keywords into filters; hook mirrors into query too
    };

    setSearchState((s) => ({ ...s, filters: updatedModashFilters }));

    runSearch(
      searchQuery,
      searchState.selectedPlatforms,
      0,
      searchState.sortBy,
      updatedModashFilters
    );
  }, [
    categories,
    directoryQuery,
    extractCategoryIdsFromText,
    fetchInfluencers,
    runSearch,
    searchQuery,
    searchState.filters,
    searchState.selectedPlatforms,
    searchState.sortBy,
    setCurrentPage,
    setSearchState,
    tempCategories,
    tempCountries,
    tempMinEngagement,
    tempVerifiedOnly,
    tempAudienceSize,
  ]);

  const handleDirectorySearch = useCallback(() => {
    // Also derive categories from quick directory box
    const derivedIds = extractCategoryIdsFromText(directoryQuery);
    if (derivedIds.length) {
      setTempCategories((prev) => Array.from(new Set([...prev, ...derivedIds])));
    }
    setCurrentPage(1);
    setTimeout(() => fetchInfluencers(), 0);
  }, [directoryQuery, extractCategoryIdsFromText, fetchInfluencers, setCurrentPage]);

  const openPanel = useCallback((id: string, platform: Platform) => {
    setSelectedId(id);
    setSelectedPlatform(platform);
    setPanelOpen(true);
    fetchReport(id, platform, calculationMethod);
  }, [calculationMethod, fetchReport]);

  const handleCalcChange = useCallback((calc: "median" | "average") => {
    setCalculationMethod(calc);
    if (selectedId && selectedPlatform) {
      fetchReport(selectedId, selectedPlatform, calc);
    }
  }, [selectedId, selectedPlatform, fetchReport]);

  const handleToggleFavorite = useCallback((id: string) => {
    setFavorites(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : [...prev, id]
    );
  }, []);

  const handleMessageInfluencer = useCallback((id: string) => {
    router.push(`/brand/messages/new?to=${id}`);
  }, [router]);

  // Wrap Modash onSearch to auto-derive categories from typed query
  const onSearchWithCategoryDerive = useCallback(
    (
      query: string,
      platforms: Platform[],
      page: number,
      sortBy: SortOption,
      filters: SearchFilters
    ) => {
      const derivedIds = extractCategoryIdsFromText(query);
      let effectiveFilters: SearchFilters & { audienceSizeId?: string; keywords?: string[] } = {
        ...filters,
        audienceSizeId: tempAudienceSize !== 'all' ? tempAudienceSize : undefined,
      };

      if (derivedIds.length) {
        const mergedIds = Array.from(new Set([...tempCategories, ...derivedIds]));
        setTempCategories(mergedIds);

        const names = mergedIds
          .map((id) => categories.find((c) => c._id === id)?.name)
          .filter((x): x is string => Boolean(x));

        effectiveFilters = { ...effectiveFilters, categories: names, keywords: names };
        setSearchState((s) => ({ ...s, filters: effectiveFilters }));
      }

      return runSearch(query, platforms, page, sortBy, effectiveFilters);
    },
    [categories, extractCategoryIdsFromText, runSearch, setSearchState, tempCategories, tempAudienceSize]
  );

  // ===== Render =====
  const today = format(new Date(), "MMMM d, yyyy");

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:block fixed left-[21rem] top-16 w-72 h-screen border-r bg-white z-40">
        <FilterSidebar
          categories={categories}
          audienceSizeOptions={audienceSizeOptions}
          countries={countries}
          platformOptions={platformOptions}
          ageOptions={ageOptions}
          tempCategories={tempCategories}
          setTempCategories={setTempCategories}
          tempAudienceSize={tempAudienceSize}
          setTempAudienceSize={setTempAudienceSize}
          tempCountries={tempCountries}
          setTempCountries={setTempCountries}
          tempPlatform={tempPlatform}
          setTempPlatform={setTempPlatform}
          tempMaleSplit={tempMaleSplit}
          setTempMaleSplit={setTempMaleSplit}
          tempFemaleSplit={tempFemaleSplit}
          setTempFemaleSplit={setTempFemaleSplit}
          tempAgeGroup={tempAgeGroup}
          setTempAgeGroup={setTempAgeGroup}
          openSections={openSections}
          toggleSection={toggleSection}
          applyFilters={applyFilters}
          tempVerifiedOnly={tempVerifiedOnly}
          setTempVerifiedOnly={setTempVerifiedOnly}
          tempMinEngagement={tempMinEngagement}
          setTempMinEngagement={setTempMinEngagement}
          tempMaxEngagement={0}
          setTempMaxEngagement={() => {}}
          tempMinFollowers={0}
          setTempMinFollowers={() => {}}
          tempMaxFollowers={0}
          setTempMaxFollowers={() => {}}
          /* Removed unsupported props: tempMinLikes, setTempMinLikes, tempMaxLikes, setTempMaxLikes, tempMinComments, setTempMinComments, tempMaxComments, setTempMaxComments, tempMinViews, setTempMinViews, tempMaxViews, setTempMaxViews, tempMinShares, setTempMinShares, tempMaxShares, setTempMaxShares, tempMinReach, setTempMinReach, tempMaxReach, setTempMaxReach, tempMinStoryViews, setTempMinStoryViews, tempMaxStoryViews, setTempMaxStoryViews, tempMinSaves, setTempMinSaves, tempMaxSaves, setTempMaxSaves, tempMinProfileVisits, setTempMinProfileVisits, tempMaxProfileVisits, setTempMaxProfileVisits, tempMinWebsiteClicks, setTempMinWebsiteClicks, tempMaxWebsiteClicks, setTempMaxWebsiteClicks, tempMinEmailClicks, setTempMinEmailClicks, tempMaxEmailClicks, setTempMaxEmailClicks, tempMinPhoneClicks, setTempMinPhoneClicks, tempMaxPhoneClicks, setTempMaxPhoneClicks, tempMinImpressions, setTempMinImpressions, tempMaxImpressions, setTempMaxImpressions */
        />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-72">
        {/* Header */}
        <div className="px-6 pt-6">
          <div className="rounded-lg bg-white p-6 mb-6">
            <h1
              className="text-4xl font-semibold mb-2 bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(to right, #FFA135, #FF7236)" }}
            >
              Browse Influencers
            </h1>
            <p className="text-gray-700">
              Discover creators and open detailed performance without leaving this page. Updated {today}.
            </p>
          </div>
        </div>

        {/* Modash Search */}
        <ModashSearch
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchState={searchState}
          setSearchState={setSearchState}
          onSearch={onSearchWithCategoryDerive}
          onOpenPanel={openPanel}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
        />

        {/* Directory Search */}
        <DirectorySearch
          query={directoryQuery}
          onQueryChange={setDirectoryQuery}
          onSearch={handleDirectorySearch}
        />

        {/* Directory Table */}
        <InfluencersTable
          influencers={influencers}
          loading={loadingTable}
          error={tableError}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onViewInfluencer={openPanel}
          onMessageInfluencer={handleMessageInfluencer}
        />
      </div>

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
        onChangeCalc={handleCalcChange}
      />
    </div>
  );
}
