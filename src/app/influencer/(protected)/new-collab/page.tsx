"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  HiOutlineSearch,
  HiChevronDown,
  HiChevronUp,
  HiFilter,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineLocationMarker,
  HiOutlineCalendar,
  HiOutlineUser,
  HiOutlineCash,
} from "react-icons/hi";
import { get, post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select as UiSelect,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import ReactSelect from "react-select";

/* ──────────────────────────────────────────────────────────────────── */
/* Constants                                                           */
/* ──────────────────────────────────────────────────────────────────── */
const GOALS = ["Brand Awareness", "Sales", "Engagement"] as const;
const BUDGET_MIN = 0;
const BUDGET_MAX = 100_000;
const STEP = 1_000;

/* ──────────────────────────────────────────────────────────────────── */
/* Types                                                               */
/* ──────────────────────────────────────────────────────────────────── */
interface UICampaign {
  id: string;
  campaignId: string;
  brand: string;
  product: string;
  goal: string;
  budget: number;
  gender: number; // 0=female 1=male
  ageRange: string;
  locations: string; // "India, Afghanistan"
  timeline: string;
}

interface Country {
  _id: string;
  countryName: string;
  callingCode: string;
  countryCode: string;
  flag: string;
}
interface CountryOption {
  value: string; // countryId
  label: string; // "🇳🇱 Netherlands"
}
const buildCountryOptions = (list: Country[]): CountryOption[] =>
  list.map((c) => ({
    value: c._id,
    label: `${c.flag} ${c.countryName}`,
  }));

/* ──────────────────────────────────────────────────────────────────── */
/* Helpers                                                             */
/* ──────────────────────────────────────────────────────────────────── */
// 0 = Male, 1 = Female, 2 = All
const genderToEnum = (g: string): 0 | 1 | 2 | undefined =>
  g === "male" ? 1 : g === "female" ? 0 : g === "all" ? 2 : undefined;

const genderLabel = (n: number) =>
  n === 1 ? "Male" : n === 0 ? "Female" : n === 2 ? "All" : "—";

const fmtDate = (d: string) => dayjs(d).format("DD-MMM-YY");

const mapResponse = (raw: any): UICampaign => ({
  id: raw._id,
  campaignId: raw.campaignsId,
  brand: raw.brandName,
  product: raw.productOrServiceName,
  goal: raw.goal,
  budget: raw.budget,
  gender: raw.targetAudience.gender,
  ageRange: `${raw.targetAudience.age.MinAge}-${raw.targetAudience.age.MaxAge}`,
  locations: raw.targetAudience.locations
    .map((l: any) => l.countryName)
    .join(", "),
  timeline: `${fmtDate(raw.timeline.startDate)} → ${fmtDate(
    raw.timeline.endDate
  )}`,
});

/* ──────────────────────────────────────────────────────────────────── */
/* Component                                                            */
/* ──────────────────────────────────────────────────────────────────── */
export default function BrowseCampaignsPage() {
  const router = useRouter();

  /* pagination */
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [totalPages, setTotalPages] = useState(1);

  /* filters */
  const [tempGender, setTempGender] = useState("all");
  const [tempAge, setTempAge] = useState<{ min?: number; max?: number }>({});
  const [tempGoal, setTempGoal] = useState<string>("all");
  const [tempBudgetRange, setTempBudgetRange] = useState<[number, number]>([
    BUDGET_MIN,
    BUDGET_MAX,
  ]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<CountryOption[]>(
    []
  );
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    gender: false,
    age: false,
    location: false,
    goal: false,
    budget: false,
  });
  const toggleSection = (s: string) =>
    setOpenSections((p) => ({ ...p, [s]: !p[s] }));

  /* data */
  const [campaigns, setCampaigns] = useState<UICampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* fetch countries once */
  useEffect(() => {
    get<Country[]>("/country/getall")
      .then((res) => setCountries(buildCountryOptions(res)))
      .catch(() => setCountries([])); // silent fail
  }, []);

  /* fetch campaigns */
  const fetchCampaigns = useCallback(() => {
    setLoading(true);
    setError(null);

    const body: Record<string, unknown> = {
      page: currentPage,
      limit: pageSize,
      sortBy: "createdAt",
      sortOrder: "desc",
      search: searchQuery.trim() || undefined,
      gender: genderToEnum(tempGender),
      minAge: tempAge.min,
      maxAge: tempAge.max,
      countryId: selectedCountries.map((c) => c.value),
      goal: tempGoal !== "all" ? tempGoal : undefined,
      minBudget: tempBudgetRange[0],
      maxBudget: tempBudgetRange[1],
    };

    post<{
      data: any[];
      pagination: { totalPages: number };
    }>("/campaign/filter", body)
      .then((res) => {
        setCampaigns(res.data.map(mapResponse));
        setTotalPages(res.pagination.totalPages || 1);
      })
      .catch(() => setError("Unable to load campaigns."))
      .finally(() => setLoading(false));
  }, [
    currentPage,
    pageSize,
    searchQuery,
    tempGender,
    tempAge,
    selectedCountries,
    tempGoal,
    tempBudgetRange,
  ]);

  useEffect(fetchCampaigns, [fetchCampaigns]);

  const applyFilters = () => {
    setCurrentPage(1);
    fetchCampaigns();
  };

  /* ────────────────────────────────────────────────────────────────── */
  /* Sidebar (filters)                                                 */
  /* ────────────────────────────────────────────────────────────────── */
  const filterContent = (
    <div className="border-l-2 w-full md:w-72 h-full md:h-screen overflow-y-auto bg-white p-6 flex flex-col border-r">
      <h2 className="text-xl font-semibold mb-6 text-gray-800">
        Filter Campaigns
      </h2>
      <div className="flex-1 space-y-6 pr-1">
        {/* Gender */}
        <div>
          <button
            onClick={() => toggleSection("gender")}
            className="flex w-full justify-between items-center py-2 font-medium border-b"
          >
            <span>Gender</span>
            {openSections.gender ? <HiChevronUp /> : <HiChevronDown />}
          </button>
          {openSections.gender && (
            <UiSelect value={tempGender} onValueChange={setTempGender}>
              <SelectTrigger className="w-full mt-2">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </UiSelect>
          )}
        </div>

        {/* Age */}
        <div>
          <button
            onClick={() => toggleSection("age")}
            className="flex w-full justify-between items-center py-2 font-medium border-b"
          >
            <span>Age Range</span>
            {openSections.age ? <HiChevronUp /> : <HiChevronDown />}
          </button>
          {openSections.age && (
            <div className="mt-2 space-y-2">
              <Input
                type="number"
                placeholder="Min age"
                className="w-full"
                value={tempAge.min ?? ""}
                onChange={(e) =>
                  setTempAge((a) => ({
                    ...a,
                    min: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
              <Input
                type="number"
                placeholder="Max age"
                className="w-full"
                value={tempAge.max ?? ""}
                onChange={(e) =>
                  setTempAge((a) => ({
                    ...a,
                    max: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </div>
          )}
        </div>

        {/* Location */}
        <div>
          <button
            onClick={() => toggleSection("location")}
            className="flex w-full justify-between items-center py-2 font-medium border-b"
          >
            <span>Location</span>
            {openSections.location ? <HiChevronUp /> : <HiChevronDown />}
          </button>
          {openSections.location && (
            <div className="mt-2">
              <ReactSelect
                isMulti
                options={countries}
                value={selectedCountries}
                onChange={(v) => setSelectedCountries(v as CountryOption[])}
                classNamePrefix="react-select"
                placeholder="Select countries…"
              />
            </div>
          )}
        </div>

        {/* Goal */}
        <div>
          <button
            onClick={() => toggleSection("goal")}
            className="flex w-full justify-between items-center py-2 font-medium border-b"
          >
            <span>Goal</span>
            {openSections.goal ? <HiChevronUp /> : <HiChevronDown />}
          </button>
          {openSections.goal && (
            <UiSelect
              value={tempGoal}
              onValueChange={(v) => setTempGoal(v as string)}
            >
              <SelectTrigger className="w-full mt-2">
                <SelectValue placeholder="All Goals" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Goals</SelectItem>
                {GOALS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </UiSelect>
          )}
        </div>

        {/* Budget */}
        <div>
          <button
            onClick={() => toggleSection("budget")}
            className="flex w-full justify-between items-center py-2 font-medium border-b"
          >
            <span>
              Budget (${tempBudgetRange[0].toLocaleString()} – $
              {tempBudgetRange[1].toLocaleString()})
            </span>
            {openSections.budget ? <HiChevronUp /> : <HiChevronDown />}
          </button>

          {openSections.budget && (
            <div className="mt-4 space-y-4">
              {/* Min */}
              <div>
                <label className="text-xs text-gray-600">Min</label>
                <input
                  type="range"
                  min={BUDGET_MIN}
                  max={tempBudgetRange[1]}
                  step={STEP}
                  value={tempBudgetRange[0]}
                  onChange={(e) =>
                    setTempBudgetRange([
                      Number(e.target.value),
                      tempBudgetRange[1],
                    ])
                  }
                  className="w-full h-2 rounded-full appearance-none"
                  style={{
                    background: "linear-gradient(to right,#FFBF00,#FFDB58)",
                  }}
                />
              </div>

              {/* Max */}
              <div>
                <label className="text-xs text-gray-600">Max</label>
                <input
                  type="range"
                  min={tempBudgetRange[0]}
                  max={BUDGET_MAX}
                  step={STEP}
                  value={tempBudgetRange[1]}
                  onChange={(e) =>
                    setTempBudgetRange([
                      tempBudgetRange[0],
                      Number(e.target.value),
                    ])
                  }
                  className="w-full h-2 rounded-full appearance-none"
                  style={{
                    background: "linear-gradient(to right,#FFBF00,#FFDB58)",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Apply */}
        <Button
          onClick={applyFilters}
          className="w-full mt-4 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
        >
          Apply Filters
        </Button>
      </div>
    </div>
  );

  /* ────────────────────────────────────────────────────────────────── */
  /* Layout                                                            */
  /* ────────────────────────────────────────────────────────────────── */
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:block fixed h-screen w-72 overflow-y-auto bg-white border-r z-10">
        {filterContent}
      </aside>

      {/* Content */}
      <div className="flex-1 md:ml-72 flex flex-col">
        {/* Mobile Filters */}
        <div className="md:hidden flex justify-end p-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center space-x-2">
                <HiFilter className="w-5 h-5" />
                <span>Filters</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="fixed inset-0 p-0 bg-white">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-4 border-b">
                  <DialogTitle className="text-lg font-semibold">
                    Filters
                  </DialogTitle>
                  <DialogClose className="text-gray-600" />
                </div>
                <div className="flex-1 overflow-auto p-0">
                  {filterContent}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Header + Search + Quick Goal Filters */}
        <section className="px-4 md:px-6 mt-2 md:mt-4 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
                Browse Campaigns
              </h1>
              <p className="text-sm text-gray-500">
                Discover collaboration opportunities that match your audience.
              </p>
            </div>

            <div className="w-full md:w-auto flex justify-center md:justify-end">
              <div className="relative w-full max-w-md md:max-w-lg">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <HiOutlineSearch className="w-5 h-5 text-gray-400" />
                </div>
                <Input
                  placeholder="Search by brand, product, or goal..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 h-12 md:h-14 text-sm md:text-base rounded-full border border-yellow-200 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>
            </div>
          </div>

          {/* Quick goal filter chips */}
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            {["all", ...GOALS].map((g) => {
              const value = g === "all" ? "all" : g;
              const isActive = tempGoal === value;
              const label = g === "all" ? "All Goals" : g;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setTempGoal(value);
                    setCurrentPage(1);
                  }}
                  className={
                    "px-3 py-1.5 rounded-full text-xs md:text-sm border transition-colors " +
                    (isActive
                      ? "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900 border-transparent"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6 pt-4">
          {loading ? (
            <div className="flex justify-center items-center py-16 text-gray-500">
              Loading campaigns…
            </div>
          ) : error ? (
            <div className="flex justify-center items-center py-16 text-red-600">
              {error}
            </div>
          ) : campaigns.length ? (
            <>
              <div className="grid gap-5 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {campaigns.map((c) => (
                  <CampaignCard
                    key={c.id}
                    campaign={c}
                    onView={() =>
                      router.push(
                        `/influencer/new-collab/view-campaign?id=${c.campaignId}`
                      )
                    }
                  />
                ))}
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
                onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <p className="text-lg font-medium">No campaigns found</p>
              <p className="text-sm mt-1">
                Try adjusting your filters or search keywords.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Campaign Card                                                       */
/* ──────────────────────────────────────────────────────────────────── */
function CampaignCard({
  campaign,
  onView,
}: {
  campaign: UICampaign;
  onView: () => void;
}) {
  return (
    <Card className="flex flex-col h-full rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
              {campaign.brand}
            </span>
            <CardTitle className="mt-3 text-lg md:text-xl text-gray-900 line-clamp-2">
              {campaign.product}
            </CardTitle>
          </div>
          <span className="inline-flex items-center rounded-full bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-800">
            {campaign.goal}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-sm text-gray-700">
        {/* Budget & Timeline */}
        <div className="flex flex-wrap gap-3 justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center rounded-full bg-gray-100 p-2">
              <HiOutlineCash className="w-4 h-4 text-gray-700" />
            </span>
            <div>
              <p className="text-xs text-gray-500">Budget</p>
              <p className="font-semibold">
                ${campaign.budget.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center rounded-full bg-gray-100 p-2">
              <HiOutlineCalendar className="w-4 h-4 text-gray-700" />
            </span>
            <div>
              <p className="text-xs text-gray-500">Timeline</p>
              <p className="font-semibold">{campaign.timeline}</p>
            </div>
          </div>
        </div>

        {/* Audience */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Target Audience
            </p>
            <div className="flex items-center gap-2 text-sm">
              <HiOutlineUser className="w-4 h-4 text-gray-600" />
              <span>{genderLabel(campaign.gender)}</span>
              <span className="mx-1 text-gray-300">•</span>
              <span>Age {campaign.ageRange}</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Locations
            </p>
            <div className="flex items-start gap-2 text-sm">
              <HiOutlineLocationMarker className="w-4 h-4 mt-0.5 text-gray-600" />
              <span className="line-clamp-2">{campaign.locations}</span>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="mt-auto flex items-center justify-end pt-3 border-t border-gray-100">
        <Button
          size="sm"
          className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900 font-semibold rounded-full px-4"
          onClick={onView}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Pagination                                                          */
/* ──────────────────────────────────────────────────────────────────── */
function Pagination({
  currentPage,
  totalPages,
  onPrev,
  onNext,
}: {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  // Always show pagination, even if there's only 1 page
  return (
    <div className="flex justify-end items-center mt-6 space-x-3">
      <button
        onClick={onPrev}
        disabled={currentPage === 1}
        className="inline-flex items-center justify-center px-3 py-2 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <HiChevronLeft size={18} />
      </button>
      <span className="text-sm text-gray-700">
        Page <span className="font-semibold">{currentPage}</span> of{" "}
        <span className="font-semibold">{totalPages}</span>
      </span>
      <button
        onClick={onNext}
        disabled={currentPage === totalPages}
        className="inline-flex items-center justify-center px-3 py-2 rounded-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <HiChevronRight size={18} />
      </button>
    </div>
  );
}
