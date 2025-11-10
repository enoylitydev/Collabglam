"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  HiOutlineSearch,
  HiChevronDown,
  HiChevronUp,
  HiFilter,
  HiChevronLeft,
  HiChevronRight,
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
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
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
  const [tempGoal, setTempGoal] = useState("all");
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
    <div className="w-full md:w-72 h-screen overflow-y-auto bg-white p-6 flex flex-col border-l-2 border-r">
      <h2 className="text-xl font-semibold mb-6 text-gray-800">
        Filter Campaigns
      </h2>
      <div className="flex-1 space-y-6 pr-2">
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
              <SelectTrigger className="w-full">
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
            <UiSelect value={tempGoal} onValueChange={setTempGoal}>
              <SelectTrigger className="w-full">
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
    <div className="flex min-h-screen">
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
                <div className="flex-1 overflow-auto p-6">{filterContent}</div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="my-6 px-6 flex items-center">
          <div className="relative w-full max-w-3xl bg-white rounded-full">
            <Input
              placeholder="Search for campaign..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-6 pr-20 h-16 text-lg rounded-full border border-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none">
              <span className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] p-3 rounded-full shadow">
                <HiOutlineSearch className="w-6 h-6 text-gray-800" />
              </span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-x-auto overflow-y-auto px-6 pb-6">
          <Table className="min-w-full border rounded-lg bg-white overflow-x-auto">
            <TableHeader className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 sticky top-0">
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead>Product / Service</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-4">
                    Loading campaigns…
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-4 text-red-600">
                    {error}
                  </TableCell>
                </TableRow>
              ) : campaigns.length ? (
                campaigns.map((c) => (
                  <TableRow key={c.id} className="hover:bg-yellow-50">
                    <TableCell>{c.brand}</TableCell>
                    <TableCell>{c.product}</TableCell>
                    <TableCell>{c.goal}</TableCell>
                    <TableCell>${c.budget.toLocaleString()}</TableCell>
                    <TableCell>{genderLabel(c.gender)}</TableCell>
                    <TableCell>{c.ageRange}</TableCell>
                    <TableCell>{c.locations}</TableCell>
                    <TableCell>{c.timeline}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
                        onClick={() =>
                          router.push(
                            `/influencer/new-collab/view-campaign?id=${c.campaignId}`
                          )
                        }
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-4">
                    No campaigns found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPrev={() => setCurrentPage((p) => Math.max(1, p - 1))}
            onNext={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          />
        </div>
      </div>
    </div>
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
  return (
    <div className="flex justify-end items-center p-4 space-x-2">
      <button
        onClick={onPrev}
        disabled={currentPage === 1}
        className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50"
      >
        <HiChevronLeft size={20} />
      </button>
      <span className="text-gray-800">
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={onNext}
        disabled={currentPage === totalPages}
        className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50"
      >
        <HiChevronRight size={20} />
      </button>
    </div>
  );
}
