"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { HiSearch, HiChevronDown, HiChevronUp, HiAdjustments, HiOutlineUsers, HiChevronRight } from "react-icons/hi";
import { get, post } from "@/lib/api";

// ---- Types ----
type SortBy =
  | "createdAt"
  | "budget"
  | "campaignStatus"
  | "statusUpdatedAt"
  | "productOrServiceName"
  | "isActive";
type SortOrder = "asc" | "desc";
type TimelineState = "none" | "running" | "expired";
type Goal = "Brand Awareness" | "Sales" | "Engagement";
type CampaignStatus = "open" | "paused";

interface RawCampaign {
  campaignsId?: string;
  _id?: string;
  productOrServiceName: string;
  description?: string;
  timeline?: { startDate?: string; endDate?: string };
  budget: number;
  applicantCount?: number;

  isActive?: number;
  campaignStatus?: string;
  createdAt?: string;
  statusUpdatedAt?: string;
  goal?: string;

  computedIsActive?: number;
  timelineState?: TimelineState;
  influencerWorking?: boolean;
}

interface Campaign {
  id: string;
  productOrServiceName: string;
  description: string;
  timeline: { startDate?: string; endDate?: string };
  budget: number;
  applicantCount: number;

  isActive: number;
  campaignStatus: string;
  createdAt?: string;
  statusUpdatedAt?: string;
  goal?: string;

  timelineState: TimelineState;
  influencerWorking: boolean;
}

interface CampaignsApiResponse {
  data?: RawCampaign[];
}

type FilterState = {
  timelineState: "" | TimelineState;
  campaignStatus: "" | CampaignStatus;
  goal: "" | Goal;
  minBudget: string;
  maxBudget: string;
};

const DEFAULT_FILTERS: FilterState = {
  timelineState: "",
  campaignStatus: "",
  goal: "",
  minBudget: "",
  maxBudget: "",
};

const HISTORY_ENDPOINT = "/campaign/history";

// Theme helpers
const TABLE_GRADIENT_FROM = "#FFA135";
const TABLE_GRADIENT_TO = "#FF7236";

function sliceText(text: string, max = 40) {
  const t = String(text || "");
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n || 0));
}

function gradientStyle() {
  return { backgroundImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO})` };
}

function SortIcon({ active, order }: { active: boolean; order: SortOrder }) {
  if (!active) return <span className="text-white/70">↕</span>;
  return <span className="text-white font-extrabold">{order === "asc" ? "↑" : "↓"}</span>;
}

function Th({
  children,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <th
      onClick={onClick}
      className={[
        "px-6 py-3 font-semibold whitespace-nowrap",
        onClick ? "cursor-pointer select-none hover:opacity-95" : "",
        className,
      ].join(" ")}
    >
      <span className="inline-flex items-center gap-2">{children}</span>
    </th>
  );
}

function StatusBadge({ isActive }: { isActive: number }) {
  const active = isActive === 1;
  return (
    <span
      className={[
        "inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full",
        active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800",
      ].join(" ")}
    >
      {active ? "Active" : "Completed"}
    </span>
  );
}

function TimelineBadge({ state }: { state: TimelineState }) {
  const cls =
    state === "running"
      ? "bg-green-100 text-green-800"
      : state === "expired"
        ? "bg-gray-100 text-gray-800"
        : "bg-slate-100 text-slate-800";

  const label = state === "running" ? "Running" : state === "expired" ? "Expired" : "No Timeline";

  return <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full ${cls}`}>{label}</span>;
}

function CampaignStatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const cls =
    s === "open"
      ? "bg-blue-100 text-blue-800"
      : s === "paused"
        ? "bg-orange-100 text-orange-800"
        : "bg-gray-100 text-gray-800";

  return <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-full ${cls}`}>{status || "—"}</span>;
}

function useDebouncedValue<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function countActiveFilters(f: FilterState) {
  let n = 0;
  if (f.timelineState !== "") n++;
  if (f.campaignStatus !== "") n++;
  if (f.goal !== "") n++;
  if (f.minBudget || f.maxBudget) n++;
  return n;
}

function parseOptionalNumber(v: string) {
  const s = String(v ?? "").trim();
  if (!s) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-700 mb-1">{label}</div>
      {children}
    </div>
  );
}

// ------------------- Page -------------------
export default function BrandCampaignHistoryPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState<FilterState>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<FilterState>(DEFAULT_FILTERS);

  const activeFilterCount = useMemo(() => countActiveFilters(applied), [applied]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});

  const lastFetchKeyRef = useRef<string>("");

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const buildPayload = useCallback(
    (brandId: string) => {
      const f = applied;
      const payload: any = {
        brandId,
        page: 1,
        limit: 500,
        search: String(debouncedSearch || "").trim(),
        sortBy,
        sortOrder,

        includeDescription: 1,
        includeDrafts: 1,

        timelineState: f.timelineState || undefined,
        campaignStatus: f.campaignStatus || undefined,
        goal: f.goal || undefined,
      };

      const minB = parseOptionalNumber(f.minBudget);
      const maxB = parseOptionalNumber(f.maxBudget);
      if (minB !== undefined) payload.minBudget = minB;
      if (maxB !== undefined) payload.maxBudget = maxB;

      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
      return payload;
    },
    [applied, debouncedSearch, sortBy, sortOrder]
  );

  const fetchHistory = useCallback(
    async (opts?: { force?: boolean }) => {
      const brandId = typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
      if (!brandId) throw new Error("No brandId found in localStorage.");

      const payload = buildPayload(brandId);
      const fetchKey = JSON.stringify(payload);

      if (!opts?.force && fetchKey === lastFetchKeyRef.current) return;
      lastFetchKeyRef.current = fetchKey;

      setError(null);
      setUpdating(true);

      try {
        const res = await post<CampaignsApiResponse>(HISTORY_ENDPOINT, payload);
        const list = Array.isArray(res?.data) ? res.data! : [];

        const normalized: Campaign[] = list.map((c, idx) => {
          const id = String(c.campaignsId ?? c._id ?? `row-${idx}`);
          const tl = c.timeline || {};
          return {
            id,
            productOrServiceName: c.productOrServiceName,
            description: c.description ?? "",
            timeline: { startDate: tl.startDate, endDate: tl.endDate },
            budget: c.budget ?? 0,
            applicantCount: c.applicantCount ?? 0,
            isActive: Number(c.computedIsActive ?? c.isActive ?? 0),
            campaignStatus: c.campaignStatus ?? "",
            createdAt: c.createdAt,
            statusUpdatedAt: c.statusUpdatedAt,
            goal: c.goal,
            timelineState: (c.timelineState ?? "none") as TimelineState,
            influencerWorking: Boolean(c.influencerWorking),
          };
        });

        setCampaigns(normalized);
      } finally {
        setUpdating(false);
        setLoading(false);
      }
    },
    [buildPayload]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await fetchHistory();
      } catch (e: any) {
        if (!alive) return;
        setUpdating(false);
        setLoading(false);
        setError(e?.message || "Failed to load campaign history.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchHistory]);

  const onHeaderSort = (field: SortBy) => {
    if (sortBy === field) setSortOrder((p) => (p === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const openFilters = () => {
    setDraft(applied);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setApplied(draft);
    setFiltersOpen(false);
  };

  const clearFilters = () => setDraft(DEFAULT_FILTERS);

  const toggleExpand = async (campaign: Campaign) => {
    const id = campaign.id;

    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    if (!(id in counts)) {
      try {
        const res = await get<{ count: number }>("/campaign/influencers", { campaignId: id });
        setCounts((p) => ({ ...p, [id]: res.count }));
      } catch {
        setCounts((p) => ({ ...p, [id]: 0 }));
      }
    }
  };

  const rows = useMemo(() => campaigns, [campaigns]);

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Campaign History</h1>
        </div>

        {updating && (
          <div className="text-xs font-semibold px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 shadow-sm">
            Updating…
          </div>
        )}
      </div>

      {/* Search + Filters */}
      <div className="bg-white rounded-2xl shadow p-5 mb-4 border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 mb-2">Search</label>
            <div className="relative">
              <HiSearch className="absolute inset-y-0 left-3 my-auto text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#FFA135] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF7236] focus:border-[#FF7236] text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (filtersOpen ? setFiltersOpen(false) : openFilters())}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 bg-white"
            >
              <HiAdjustments />
              Filters
              {activeFilterCount ? (
                <span className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-2 text-[11px] font-extrabold rounded-full bg-gray-900 text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {/* Filters panel */}
        <div
          className={[
            "mt-4 overflow-hidden transition-all duration-200",
            filtersOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0",
          ].join(" ")}
        >
          <div className="mt-2 rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Timeline State">
                <select
                  value={draft.timelineState}
                  onChange={(e) => setDraft((p) => ({ ...p, timelineState: e.target.value as any }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white"
                >
                  <option value="">All</option>
                  <option value="none">None</option>
                  <option value="running">Running</option>
                  <option value="expired">Expired</option>
                </select>
              </Field>

              <Field label="Campaign Status">
                <select
                  value={draft.campaignStatus}
                  onChange={(e) => setDraft((p) => ({ ...p, campaignStatus: e.target.value as any }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white"
                >
                  <option value="">All</option>
                  <option value="open">Open</option>
                  <option value="paused">Paused</option>
                </select>
              </Field>

              <Field label="Goals">
                <select
                  value={draft.goal}
                  onChange={(e) => setDraft((p) => ({ ...p, goal: e.target.value as any }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white"
                >
                  <option value="">All</option>
                  <option value="Brand Awareness">Brand Awareness</option>
                  <option value="Sales">Sales</option>
                  <option value="Engagement">Engagement</option>
                </select>
              </Field>
            </div>

            <div className="mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Min Budget">
                  <input
                    value={draft.minBudget}
                    onChange={(e) => setDraft((p) => ({ ...p, minBudget: e.target.value }))}
                    type="number"
                    placeholder="e.g. 1000"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white"
                  />
                </Field>

                <Field label="Max Budget">
                  <input
                    value={draft.maxBudget}
                    onChange={(e) => setDraft((p) => ({ ...p, maxBudget: e.target.value }))}
                    type="number"
                    placeholder="e.g. 5000"
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white"
                  />
                </Field>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={clearFilters}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-white bg-transparent"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => {
                  setDraft(applied);
                  setFiltersOpen(false);
                }}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-white bg-transparent"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={updating}
                onClick={applyFilters}
                className={[
                  "ml-auto px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed",
                ].join(" ")}
                style={gradientStyle()}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow p-6 animate-pulse border border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-gray-200 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow p-6 border border-red-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-red-700">Couldn’t load campaign history</div>
              <div className="text-sm text-gray-600 mt-1">{error}</div>
            </div>

            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                setError(null);
                lastFetchKeyRef.current = ""; // allow refetch even if payload same
                try {
                  await fetchHistory({ force: true });
                } catch (e: any) {
                  setError(e?.message || "Failed to load campaign history.");
                  setLoading(false);
                  setUpdating(false);
                }
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-900 bg-white hover:bg-gray-50"
            >
              Retry
            </button>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl shadow p-8 text-center border border-gray-100">
          <p className="text-gray-900 font-semibold">No campaign history found</p>
          <p className="text-gray-600 text-sm mt-1">Try different keywords or change filters.</p>
        </div>
      ) : (
        <div className="p-[1.5px] rounded-2xl shadow" style={gradientStyle()}>
          <div className="overflow-x-auto bg-white rounded-[0.95rem]">
            <table className="w-full text-sm text-gray-700">
              <thead className="text-left text-white" style={gradientStyle()}>
                <tr>
                  {/* Campaign stays LEFT */}
                  <Th onClick={() => onHeaderSort("productOrServiceName")} className="text-left">
                    Campaign <SortIcon active={sortBy === "productOrServiceName"} order={sortOrder} />
                  </Th>

                  {/* Others centered */}
                  <Th onClick={() => onHeaderSort("budget")} className="text-center">
                    Budget <SortIcon active={sortBy === "budget"} order={sortOrder} />
                  </Th>

                  <Th onClick={() => onHeaderSort("isActive")} className="text-center">
                    Status <SortIcon active={sortBy === "isActive"} order={sortOrder} />
                  </Th>

                  <Th className="text-center">Timeline</Th>

                  <Th className="text-center">Total Influencers</Th>

                  <Th onClick={() => onHeaderSort("createdAt")} className="text-center">
                    Created <SortIcon active={sortBy === "createdAt"} order={sortOrder} />
                  </Th>
                </tr>
              </thead>

              <tbody>
                {rows.map((c, idx) => {
                  const isExpanded = expandedIds.has(c.id);
                  const lazyCount = counts[c.id];
                  const appliedCount =
                    typeof c.applicantCount === "number"
                      ? c.applicantCount
                      : typeof lazyCount === "number"
                        ? lazyCount
                        : 0;

                  return (
                    <React.Fragment key={c.id}>
                      <tr
                        onClick={() => toggleExpand(c)}
                        className={[
                          "border-b last:border-b-0",
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50",
                          "transition-all duration-200",
                          "hover:bg-gradient-to-r hover:from-[#FFA135]/10 hover:to-[#FF7236]/10",
                          "cursor-pointer",
                        ].join(" ")}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleExpand(c);
                          }
                        }}
                      >
                        {/* Campaign (LEFT aligned) */}
                        <td className="px-6 py-4 align-middle text-left">
                          <div className="flex items-start gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/brand/campaign-history/view-campaign?id=${c.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-2 group"
                                title={c.productOrServiceName}
                              >
                                <span className="font-bold text-gray-900 group-hover:text-[#FF7236] group-hover:underline underline-offset-4">
                                  {sliceText(c.productOrServiceName, 48)}
                                </span>
                                <span className="text-gray-400 group-hover:text-[#FF7236]">
                                  {isExpanded ? <HiChevronUp size={18} /> : <HiChevronDown size={18} />}
                                </span>
                              </Link>
                            </div>
                          </div>
                        </td>

                        {/* Budget (CENTER) */}
                        <td className="px-6 py-4 whitespace-nowrap align-middle text-center font-medium text-gray-900">
                          {formatCurrency(c.budget)}
                        </td>

                        {/* Status (CENTER) */}
                        <td className="px-6 py-4 whitespace-nowrap align-middle text-center">
                          <StatusBadge isActive={c.isActive} />
                        </td>

                        {/* Timeline (CENTER) */}
                        <td className="px-6 py-4 whitespace-nowrap align-middle text-center">
                          {formatDate(c.timeline.startDate)} – {formatDate(c.timeline.endDate)}
                        </td>

                        {/* Applicants (CENTER) */}
                        <td className="px-6 py-4 align-middle text-center">
                          {appliedCount > 0 ? (
                            <Link
                              href={`/brand/campaign-history/view-inf?id=${c.id}&name=${encodeURIComponent(
                                c.productOrServiceName
                              )}`}
                              onClick={(e) => e.stopPropagation()}
                              className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-900
                 hover:border-[#FF7236] hover:bg-white hover:shadow-sm transition
                 focus:outline-none focus:ring-2 focus:ring-[#FF7236]/40 focus:ring-offset-2"
                              title="View influencers"
                              aria-label={`View influencers (${appliedCount})`}
                            >
                              <HiOutlineUsers size={18} className="opacity-70 group-hover:text-[#FF7236]" />
                              <span className="group-hover:underline underline-offset-2">Influencers</span>

                              <span className="ml-1 inline-flex min-w-[2rem] justify-center rounded-full bg-gray-900 px-2 py-0.5 text-xs font-bold text-white group-hover:bg-[#FF7236]">
                                {appliedCount}
                              </span>

                              <HiChevronRight size={18} className="opacity-60 group-hover:opacity-100" />
                            </Link>
                          ) : (
                            <span
                              className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-400"
                              title="No influencers yet"
                              aria-label="No influencers yet"
                            >
                              <HiOutlineUsers size={18} className="opacity-60" />
                              <span>Influencers</span>
                              <span className="ml-1 inline-flex min-w-[2rem] justify-center rounded-full bg-gray-300 px-2 py-0.5 text-xs font-bold text-white">
                                0
                              </span>
                            </span>
                          )}
                        </td>

                        {/* Created (CENTER) */}
                        <td className="px-6 py-4 whitespace-nowrap align-middle text-center">
                          {formatDateTime(c.createdAt)}
                        </td>
                      </tr>

                      {/* Expanded */}
                      {isExpanded && (
                        <tr className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-6 pb-6 pt-2" colSpan={6}>
                            <div className="border-t border-gray-100 pt-5">
                              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-gray-900">Campaign Details</div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-gray-500">Campaign Status:</span>
                                    <CampaignStatusBadge status={c.campaignStatus} />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-gray-500">Timeline State:</span>
                                    <TimelineBadge state={c.timelineState} />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-gray-500">Status:</span>
                                    <StatusBadge isActive={c.isActive} />
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2 rounded-xl border border-gray-100 bg-white p-4">
                                  <div className="text-xs font-semibold text-gray-700 mb-1">Description</div>
                                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                    {c.description?.trim() ? c.description : "No description provided."}
                                  </div>
                                </div>

                                <div className="rounded-xl border border-gray-100 bg-white p-4">
                                  <div className="text-xs font-semibold text-gray-700 mb-3">Quick Info</div>

                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-gray-500">Budget</span>
                                      <span className="font-semibold text-gray-900">{formatCurrency(c.budget)}</span>
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-gray-500">Timeline</span>
                                      <span className="text-gray-900 text-xs text-right">
                                        {formatDate(c.timeline.startDate)} – {formatDate(c.timeline.endDate)}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-gray-500">Created</span>
                                      <span className="text-gray-900 text-xs text-right">
                                        {formatDateTime(c.createdAt)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="mt-4 w-full flex items-center justify-end gap-2">
                                    <div className="w-[200px]">
                                      <Link
                                        href={`/brand/campaign-history/view-campaign?id=${c.id}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-full inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold bg-white text-black border border-gray-900 hover:bg-gray-50"
                                      >
                                        View Campaign
                                      </Link>
                                    </div>

                                    <div className="w-[200px]">
                                      <Link
                                        href={`/brand/campaign-history/view-inf?id=${c.id}&name=${encodeURIComponent(
                                          c.productOrServiceName
                                        )}`}
                                        onClick={(e) => e.stopPropagation()}
                                        className={[
                                          "relative w-full inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold text-white",
                                          "bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:opacity-90",
                                        ].join(" ")}
                                      >
                                        View Influencers

                                        {/* badge doesn't change button width */}
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center min-w-[22px] h-[22px] px-2 text-[11px] font-extrabold bg-white/20 rounded-full">
                                          {appliedCount}
                                        </span>
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
