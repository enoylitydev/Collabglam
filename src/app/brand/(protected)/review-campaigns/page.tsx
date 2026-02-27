"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  HiSearch,
  HiChevronLeft,
  HiChevronRight,
  HiOutlinePencil,
  HiOutlineDocumentText,
  HiChevronRight as HiChevronRightIcon,
  HiOutlineStar,
} from "react-icons/hi";
import { get, post } from "@/lib/api";

type CampaignStatus = "open" | "paused";

interface Campaign {
  id: string; // campaignsId (UUID)
  productOrServiceName: string;
  description: string;
  timeline: { startDate: string; endDate: string };
  isActive: number;
  budget: number;
  campaignType?: string;

  campaignStatus?: CampaignStatus;
  influencerWorking?: boolean;
  hasPendingUpdate?: boolean;

  createdByRole?: string;

  shortlistedCount?: number;
  favoriteCount?: number;

  raw?: any;
}

const TABLE_GRADIENT_FROM = "#FFA135";
const TABLE_GRADIENT_TO = "#FF7236";

const sliceText = (text: string, max = 40) =>
  text?.length > max ? `${text.slice(0, max - 3)}...` : text;

const safeDateLabel = (dateStr: string) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
};

const safeCurrency = (amt: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(amt) ? amt : 0);

/** ✅ Deliverables response => { success:true, count:number, data:[...] } */
const getShortlistedCountFromDeliverablesResp = (res: any) => {
  const body = res?.data && typeof res.data === "object" ? res.data : res;

  const cnt = Number(body?.count ?? body?.total);
  if (!Number.isNaN(cnt)) return cnt;

  const arr = Array.isArray(body?.data) ? body.data : [];
  return arr.length;
};

/** ✅ Invitations response => { status:"success", total:number, invitations:[...] } */
const getFavoriteTotalFromInvitationsResp = (res: any) => {
  const body = res?.data && typeof res.data === "object" ? res.data : res;

  const total = Number(body?.total);
  if (!Number.isNaN(total)) return total;

  const invitations = Array.isArray(body?.invitations) ? body.invitations : [];
  return invitations.length;
};

const uniqKeys = (keys: any[]) => {
  const out: string[] = [];
  const set = new Set<string>();
  keys.forEach((k) => {
    const v = String(k || "").trim();
    if (!v) return;
    if (set.has(v)) return;
    set.add(v);
    out.push(v);
  });
  return out;
};

const isDeliverablesOk = (res: any) => {
  const body = res?.data && typeof res.data === "object" ? res.data : res;
  return (
    body &&
    (body.success === true ||
      body.status === "success" ||
      typeof body.count === "number" ||
      Array.isArray(body.data))
  );
};

export default function BrandReviewCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // request-guard for counts hydration (prevents stale overwrite)
  const countsReqRef = useRef(0);

  const applyPendingPatch = (c: any) => {
    const pending =
      c?.pendingUpdate?.status === "pending" && c?.pendingUpdate?.patch;
    const patch = pending ? c.pendingUpdate.patch : null;

    return {
      ...c,
      ...(patch || {}),
      timeline: {
        ...(c.timeline || {}),
        ...(patch?.timeline || {}),
      },
      targetAudience: {
        ...(c.targetAudience || {}),
        ...(patch?.targetAudience || {}),
      },
    };
  };

  /** ✅ Try deliverables endpoint with multiple base paths + ids (campaign vs campaign2) */
  const fetchShortlistedCount = useCallback(async (c: Campaign) => {
    const candidates = uniqKeys([
      c.id, // campaignsId (UUID)
      c?.raw?.campaignsId,
      c?.raw?.campaignsID,
      c?.raw?.campaignId, // mongo campaignId (fallback)
      c?.raw?._id,
      c?.raw?.id,
    ]);

    const bases = [
      "/deliverable/influencer/campaign",
      "/deliverable/influencer/campaign",
    ];

    for (const base of bases) {
      for (const key of candidates) {
        try {
          const resp = await get(`${base}/${encodeURIComponent(key)}`);
          if (isDeliverablesOk(resp)) {
            return getShortlistedCountFromDeliverablesResp(resp);
          }
        } catch {
          // keep trying
        }
      }
    }

    return 0;
  }, []);

  /** ✅ Favorites endpoint expects campaignsId */
  const fetchFavoriteCount = useCallback(async (campaignsId: string) => {
    try {
      const resp = await post(`/admin-invitations/get-by-campaign`, {
        campaignsId,
        page: 1,
        limit: 1,
      });
      return getFavoriteTotalFromInvitationsResp(resp);
    } catch {
      return 0;
    }
  }, []);

  const hydrateCounts = useCallback(
    async (list: Campaign[]) => {
      const reqId = ++countsReqRef.current;

      const results = await Promise.allSettled(
        list.map(async (c) => {
          const campaignsId = c.id;

          const [shortlistedCount, favoriteCount] = await Promise.all([
            fetchShortlistedCount(c),
            fetchFavoriteCount(campaignsId),
          ]);

          return { id: campaignsId, shortlistedCount, favoriteCount };
        })
      );

      if (countsReqRef.current !== reqId) return;

      const map = new Map<
        string,
        { shortlistedCount: number; favoriteCount: number }
      >();

      results.forEach((r) => {
        if (r.status === "fulfilled") {
          map.set(r.value.id, {
            shortlistedCount: r.value.shortlistedCount,
            favoriteCount: r.value.favoriteCount,
          });
        }
      });

      setCampaigns((prev) =>
        prev.map((p) => {
          const found = map.get(p.id);
          return found ? { ...p, ...found } : p;
        })
      );
    },
    [fetchFavoriteCount, fetchShortlistedCount]
  );

  const fetchCampaigns = useCallback(
    async (page: number, term: string) => {
      setLoading(true);
      setError(null);

      try {
        const brandId =
          typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
        if (!brandId) throw new Error("No brandId found in localStorage.");

        const listEndpoint = `/campaign/created-by-admin/${encodeURIComponent(
          brandId
        )}`;

        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", String(limit));
        if (term.trim()) params.set("search", term.trim());

        const res: any = await get(`${listEndpoint}?${params.toString()}`);

        const body = res?.data && typeof res.data === "object" ? res.data : res;

        const rawList: any[] = Array.isArray(body?.data)
          ? body.data
          : Array.isArray(body)
            ? body
            : [];

        const normalized: Campaign[] = rawList.map((c: any) => {
          const merged = applyPendingPatch(c);

          const rawStatus = String(merged.campaignStatus || "open")
            .toLowerCase()
            .trim();

          const safeStatus: CampaignStatus =
            rawStatus === "paused" || rawStatus === "closed" ? "paused" : "open";

          const hasPendingUpdate =
            c?.pendingUpdate?.status === "pending" && !!c?.pendingUpdate?.patch;

          const createdByRole = Array.isArray(merged.createdBy)
            ? merged.createdBy?.[0]?.role
            : merged.createdBy?.role;

          const shortlistCount =
            merged.shortlistedCount ??
            merged.shortListedCount ??
            merged.shortlistedInfluencersCount ??
            merged.shortlistedInfluencerCount ??
            (Array.isArray(merged.shortlistedInfluencers)
              ? merged.shortlistedInfluencers.length
              : undefined) ??
            (Array.isArray(merged.shortlisted) ? merged.shortlisted.length : 0);

          const favCount =
            merged.favoriteCount ??
            merged.favouriteCount ??
            merged.favCount ??
            merged.favoriteInfluencersCount ??
            merged.favouriteInfluencersCount ??
            merged.favInfluencersCount ??
            (Array.isArray(merged.favoriteInfluencers)
              ? merged.favoriteInfluencers.length
              : undefined) ??
            (Array.isArray(merged.favorites) ? merged.favorites.length : 0);

          // ✅ IMPORTANT: keep campaignsId as id (UUID)
          const id =
            merged.campaignsId ?? merged.campaignsID ?? merged.id ?? merged._id;

          return {
            id: String(id),
            productOrServiceName: merged.productOrServiceName ?? "",
            description: merged.description ?? "",
            timeline: merged.timeline ?? { startDate: "", endDate: "" },
            isActive: merged.isActive ?? 0,
            budget: merged.budget ?? 0,
            campaignType: merged.campaignType ?? "",
            campaignStatus: safeStatus,
            influencerWorking: Boolean(merged.influencerWorking),
            hasPendingUpdate,
            createdByRole,
            shortlistedCount: typeof shortlistCount === "number" ? shortlistCount : 0,
            favoriteCount: typeof favCount === "number" ? favCount : 0,
            raw: merged,
          };
        });

        setCampaigns(normalized);
        hydrateCounts(normalized);

        const respLimit = Number(body?.limit ?? limit) || limit;

        // 1) Prefer API-provided totalPages if present
        const apiTotalPages = Number(body?.totalPages ?? body?.meta?.totalPages);
        if (Number.isFinite(apiTotalPages) && apiTotalPages > 0) {
          setTotalPages(apiTotalPages);
        } else {
          // 2) Else compute from total if present
          const total = Number(body?.total ?? body?.count ?? body?.totalCount ?? body?.meta?.total);
          if (Number.isFinite(total) && total > 0) {
            setTotalPages(Math.max(1, Math.ceil(total / respLimit)));
          } else {
            // 3) Else: optimistic next-page (enable Next if page returned full limit)
            setTotalPages(Math.max(1, page + (rawList.length === respLimit ? 1 : 0)));
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to load campaigns.");
        setCampaigns([]);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    [limit, hydrateCounts]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1);
      setDebouncedSearch(search.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchCampaigns(currentPage, debouncedSearch);
  }, [fetchCampaigns, currentPage, debouncedSearch]);

  return (
    <div className="p-6 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold">Campaigns</h1>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-md">
        <div className="relative">
          <HiSearch
            className="absolute inset-y-0 left-3 my-auto text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#FFA135] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF7236] focus:border-[#FF7236] text-sm"
          />
        </div>
      </div>

      {error ? <p className="text-red-600 mb-3">{error}</p> : null}

      {loading ? (
        <SkeletonTable />
      ) : campaigns.length === 0 ? (
        <p className="text-gray-700">No campaigns found.</p>
      ) : (
        <TableView data={campaigns} />
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPrev={() => setCurrentPage((p) => Math.max(p - 1, 1))}
        onNext={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
      />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="overflow-x-auto bg-white shadow rounded-lg animate-pulse">
      <div className="p-6">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-full" />
      </div>
    </div>
  );
}

function TableView({ data }: { data: Campaign[] }) {
  return (
    <div
      className="p-[1.5px] rounded-lg shadow"
      style={{
        backgroundImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO})`,
      }}
    >
      <div className="bg-white rounded-[0.5rem] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-600 border-collapse">
            <thead
              className="text-white"
              style={{
                backgroundImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO})`,
              }}
            >
              <tr>
                {[
                  "Campaign",
                  "Type",
                  "Budget",
                  "Campaign Timeline",
                  "Shortlisted Influencers",
                  "Favorite Influencers",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-center font-medium whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {data.map((c, idx) => {
                const statusLabel =
                  (c.campaignStatus || "open").toLowerCase() === "paused"
                    ? "Paused"
                    : "Open";

                const shortlistCount = c.shortlistedCount ?? 0;
                const favCount = c.favoriteCount ?? 0;

                return (
                  <tr
                    key={c.id}
                    className={[
                      "border-b last:border-b-0",
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50",
                      "transition-all duration-200",
                      "hover:bg-gradient-to-r hover:from-[#FFA135]/10 hover:to-[#FF7236]/10",
                    ].join(" ")}
                  >
                    <td className="px-6 py-4 align-top">
                      <div className="text-center">
                        <Link
                          href={`/brand/created-campaign/view-campaign?id=${c.id}`}
                          className="inline-flex items-center gap-2 group"
                          title={c.productOrServiceName}
                        >
                          <span className="font-bold text-gray-900 group-hover:text-[#FF7236] group-hover:underline">
                            {sliceText(c.productOrServiceName, 40)}
                          </span>
                        </Link>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap align-top text-center">
                      {c.campaignType && c.campaignType.trim() !== ""
                        ? sliceText(c.campaignType, 30)
                        : "—"}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap align-top text-center font-medium text-gray-900">
                      {safeCurrency(c.budget)}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap align-top text-center">
                      {safeDateLabel(c.timeline?.startDate)} –{" "}
                      {safeDateLabel(c.timeline?.endDate)}
                    </td>

                    {/* Shortlisted */}
                    <td className="px-6 py-4 align-top text-center">
                      <Link
                        href={`/brand/shortlisted-inf?id=${c.id}`}
                        className={[
                          "group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                          shortlistCount > 0
                            ? "border-gray-200 bg-gray-50 text-gray-900 hover:border-[#FF7236] hover:bg-white hover:shadow-sm"
                            : "border-gray-200 bg-gray-100 text-gray-500 hover:bg-white hover:border-[#FF7236]",
                        ].join(" ")}
                        title="View shortlisted influencers"
                        aria-label={`View shortlisted influencers (${shortlistCount})`}
                      >
                        <HiOutlineDocumentText
                          size={18}
                          className="opacity-70 group-hover:text-[#FF7236]"
                        />
                        <span className="group-hover:underline underline-offset-2">
                          Shortlisted
                        </span>
                        <HiChevronRightIcon
                          size={18}
                          className="opacity-60 group-hover:opacity-100"
                        />
                      </Link>
                    </td>

                    {/* Favorites */}
                    <td className="px-6 py-4 align-top text-center">
                      <Link
                        href={`/brand/fav-influencer?id=${c.id}`}
                        className={[
                          "group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition",
                          favCount > 0
                            ? "border-gray-200 bg-gray-50 text-gray-900 hover:border-[#FF7236] hover:bg-white hover:shadow-sm"
                            : "border-gray-200 bg-gray-100 text-gray-500 hover:bg-white hover:border-[#FF7236]",
                        ].join(" ")}
                        title="View favorite influencers"
                        aria-label={`View favorite influencers (${favCount})`}
                      >
                        <HiOutlineStar
                          size={18}
                          className="opacity-70 group-hover:text-[#FF7236]"
                        />
                        <span className="group-hover:underline underline-offset-2">
                          Favorites
                        </span>
                        <span className="ml-1 inline-flex min-w-[2rem] justify-center rounded-full bg-gray-900 px-2 py-0.5 text-xs font-bold text-white group-hover:bg-[#FF7236]">
                          {favCount}
                        </span>
                        <HiChevronRightIcon
                          size={18}
                          className="opacity-60 group-hover:opacity-100"
                        />
                      </Link>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap align-top text-center">
                      <div className="inline-flex items-center justify-center rounded-full border px-3 py-1 text-sm font-semibold text-gray-900 bg-white">
                        {statusLabel}
                      </div>

                      {String(c.createdByRole || "").toLowerCase() === "admin" ? (
                        <div className="mt-1 text-xs font-semibold text-gray-500">
                          By Admin
                        </div>
                      ) : null}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap align-top text-center">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <Link
                          href={`/brand/edit-review-campaign?id=${c.id}`}
                          className="inline-flex items-center bg-white border border-gray-900 text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-semibold"
                        >
                          <HiOutlinePencil className="mr-1" size={18} />
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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
      <span className="text-gray-700">
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