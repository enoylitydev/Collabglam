"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  HiSearch,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineDocumentText,
  HiChevronRight as HiChevronRightIcon,
  HiOutlineStar,
} from "react-icons/hi";
import { get, post } from "@/lib/api";

type CampaignStatus = "open" | "paused";

interface Campaign {
  id: string;
  productOrServiceName: string;
  description: string;
  timeline: { startDate: string; endDate: string };
  isActive: number;
  budget: number;
  campaignType?: string;

  campaignStatus?: CampaignStatus;
  influencerWorking?: boolean;
  hasPendingUpdate?: boolean;

  publishStatus?: string;
  isApproved?: boolean;
  createdByRole?: string;

  shortlistedCount?: number;
  favoriteCount?: number;

  raw?: any;
}

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

const getShortlistedCountFromDeliverablesResp = (res: any) => {
  const body = res?.data && typeof res.data === "object" ? res.data : res;

  const cnt = Number(body?.count ?? body?.total);
  if (!Number.isNaN(cnt)) return cnt;

  const arr = Array.isArray(body?.data) ? body.data : [];
  return arr.length;
};

const getFavoriteTotalFromInvitationsResp = (res: any) => {
  const body = res?.data && typeof res.data === "object" ? res.data : res;

  const total = Number(body?.total);
  if (!Number.isNaN(total)) return total;

  const invitations = Array.isArray(body?.invitations) ? body.invitations : [];
  return invitations.length;
};

export default function AdminReviewCampaignsPage() {
  const searchParams = useSearchParams();
  const brandIdFromQuery = searchParams.get("brandId");

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const countsReqRef = useRef(0);
  const campaignsReqRef = useRef(0);

  const brandId = useMemo(() => {
    if (brandIdFromQuery) return brandIdFromQuery;
    if (typeof window !== "undefined") return localStorage.getItem("brandId");
    return null;
  }, [brandIdFromQuery]);

  const withBrandId = useCallback(
    (url: string) => {
      if (!brandId) return url;
      const join = url.includes("?") ? "&" : "?";
      return `${url}${join}brandId=${encodeURIComponent(brandId)}`;
    },
    [brandId]
  );

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

  const hydrateCounts = useCallback(async (list: Campaign[]) => {
    const reqId = ++countsReqRef.current;

    const results = await Promise.allSettled(
      list.map(async (c) => {
        const campaignsId = c.id;

        let shortlistedCount = c.shortlistedCount ?? 0;
        let favoriteCount = c.favoriteCount ?? 0;


        try {
          const r1 = await get(
            `/deliverable/influencer/campaign/${encodeURIComponent(campaignsId)}`
          );
          shortlistedCount = getShortlistedCountFromDeliverablesResp(r1);
        } catch {
          // keep existing
        }


        try {
          const favResp = await post(`/admin-invitations/get-by-campaign`, {
            campaignsId,
            page: 1,
            limit: 1,
          });
          favoriteCount = getFavoriteTotalFromInvitationsResp(favResp);
        } catch {
          // keep existing
        }

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
  }, []);

  const fetchCampaigns = useCallback(
    async (page: number, term: string) => {
      const reqId = ++campaignsReqRef.current;

      setLoading(true);
      setError(null);

      try {
        if (!brandId) throw new Error("brandId missing in URL.");

        const listEndpoint = `/campaign/created-by-admin/${encodeURIComponent(
          brandId
        )}`;

        const qs = new URLSearchParams();
        if (term.trim()) qs.set("search", term.trim());
        qs.set("page", String(page));
        qs.set("limit", String(limit));

        const res: any = await get(`${listEndpoint}?${qs.toString()}`);

        if (campaignsReqRef.current !== reqId) return;

        const body = res?.data && typeof res.data === "object" ? res.data : res;

        const rawList: any[] = Array.isArray(body?.data)
          ? body.data
          : Array.isArray(body)
            ? body
            : [];

        const respLimit = Number(body?.limit ?? limit) || limit;

        const apiTotalPages = Number(
          body?.totalPages ??
          body?.pagination?.totalPages ??
          body?.meta?.totalPages
        );

        const apiTotal = Number(
          body?.total ??
          body?.totalCount ??
          body?.count ??
          body?.meta?.total ??
          body?.pagination?.total
        );

        const hasPaginationMeta =
          (Number.isFinite(apiTotalPages) && apiTotalPages > 0) ||
          (Number.isFinite(apiTotal) && apiTotal > 0);

        const serverIgnoredPagination =
          !hasPaginationMeta && rawList.length > respLimit;

        const effectiveList = serverIgnoredPagination
          ? rawList.slice((page - 1) * respLimit, page * respLimit)
          : rawList;

        const normalized: Campaign[] = effectiveList.map((c: any) => {
          const merged = applyPendingPatch(c);

          const rawStatus = String(merged.campaignStatus || "open")
            .toLowerCase()
            .trim();

          const safeStatus: CampaignStatus =
            rawStatus === "paused" || rawStatus === "closed" ? "paused" : "open";

          const createdByRole = Array.isArray(merged.createdBy)
            ? merged.createdBy?.[0]?.role
            : merged.createdBy?.role;

          const publishStatus = String(merged.publishStatus || "")
            .toLowerCase()
            .trim();

          const isApproved =
            publishStatus === "brand_confirmed" || publishStatus === "approved";

          const shortlistCount =
            merged.shortlistedCount ??
            merged.shortListedCount ??
            merged.shortlistedInfluencersCount ??
            merged.shortlistedInfluencerCount ??
            (Array.isArray(merged.shortlistedInfluencers)
              ? merged.shortlistedInfluencers.length
              : undefined) ??
            (Array.isArray(merged.shortlisted)
              ? merged.shortlisted.length
              : 0);

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

          return {
            id: String(merged.campaignsId ?? merged.id ?? merged._id),
            productOrServiceName: merged.productOrServiceName ?? "",
            description: merged.description ?? "",
            timeline: merged.timeline ?? { startDate: "", endDate: "" },
            isActive: merged.isActive ?? 0,
            budget: merged.budget ?? 0,
            campaignType: merged.campaignType ?? "",
            campaignStatus: safeStatus,
            publishStatus: merged.publishStatus ?? "",
            isApproved,
            createdByRole,
            shortlistedCount:
              typeof shortlistCount === "number" ? shortlistCount : 0,
            favoriteCount: typeof favCount === "number" ? favCount : 0,
            raw: merged,
          };
        });

        setCampaigns(normalized);
        hydrateCounts(normalized);

        let computedTotalPages = 1;

        if (serverIgnoredPagination) {
          computedTotalPages = Math.max(
            1,
            Math.ceil(rawList.length / respLimit)
          );
        } else if (Number.isFinite(apiTotalPages) && apiTotalPages > 0) {
          computedTotalPages = apiTotalPages;
        } else if (Number.isFinite(apiTotal) && apiTotal > 0) {
          computedTotalPages = Math.max(1, Math.ceil(apiTotal / respLimit));
        } else {
          computedTotalPages = Math.max(
            1,
            page + (rawList.length === respLimit ? 1 : 0)
          );
        }

        setTotalPages(computedTotalPages);

        if (page > computedTotalPages) {
          setCurrentPage(computedTotalPages);
        }
      } catch (err: any) {
        if (campaignsReqRef.current !== reqId) return;

        setError(err.message || "Failed to load review campaigns.");
        setCampaigns([]);
        setTotalPages(1);
      } finally {
        if (campaignsReqRef.current === reqId) setLoading(false);
      }
    },
    [limit, brandId, hydrateCounts]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1);
      setDebouncedSearch(search.trim());
      setTotalPages(1);
    }, 400);

    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!brandId) return;
    fetchCampaigns(currentPage, debouncedSearch);
  }, [fetchCampaigns, currentPage, debouncedSearch, brandId]);

  return (
    <div className="p-6 min-h-screen bg-white text-black">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Review Campaigns</h1>
      </div>

      <div className="mb-4 max-w-md">
        <div className="relative">
          <HiSearch
            className="absolute inset-y-0 left-3 my-auto text-gray-500"
            size={20}
          />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-sm"
          />
        </div>
      </div>

      {!brandId ? (
        <div className="mb-3 rounded-lg border border-gray-300 bg-white p-3 text-sm">
          <span className="font-semibold">Error:</span> brandId missing in URL.
        </div>
      ) : null}

      {error ? (
        <div className="mb-3 rounded-lg border border-gray-300 bg-white p-3 text-sm">
          <span className="font-semibold">Error:</span> {error}
        </div>
      ) : null}

      {loading ? (
        <SkeletonTable />
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-gray-700">No campaigns found.</p>
      ) : (
        <TableView data={campaigns} withBrandId={withBrandId} />
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPrev={() => setCurrentPage((p) => Math.max(p - 1, 1))}
        onNext={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
        onPageChange={(page) => setCurrentPage(page)}
      />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg animate-pulse">
      <div className="p-6 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
      </div>
    </div>
  );
}

function TableView({
  data,
  withBrandId,
}: {
  data: Campaign[];
  withBrandId: (url: string) => string;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-gray-700 border-collapse">
          <thead className="bg-black text-white">
            <tr>
              {[
                "Campaign",
                "Type",
                "Budget",
                "Campaign Timeline",
                "Shortlisted Influencers",
                "Favorite Influencers",
                "Status",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-center font-medium whitespace-nowrap"
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
                    "hover:bg-gray-100 transition-colors",
                  ].join(" ")}
                >
                  <td className="px-4 py-3 align-top">
                    <div className="text-center">
                      <Link
                        href={withBrandId(
                          `/admin/brand/created-campaign/view-campaign?id=${encodeURIComponent(
                            c.id
                          )}`
                        )}
                        className="inline-flex items-center gap-2 group"
                        title={c.productOrServiceName}
                      >
                        <span className="font-semibold text-black group-hover:underline">
                          {sliceText(c.productOrServiceName, 40)}
                        </span>
                      </Link>
                    </div>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap align-top text-center">
                    {c.campaignType && c.campaignType.trim() !== ""
                      ? sliceText(c.campaignType, 30)
                      : "—"}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap align-top text-center font-medium text-black">
                    {safeCurrency(c.budget)}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap align-top text-center">
                    {safeDateLabel(c.timeline?.startDate)} –{" "}
                    {safeDateLabel(c.timeline?.endDate)}
                  </td>

                  <td className="px-4 py-3 align-top text-center">
                    <Link
                      href={withBrandId(
                        `/admin/brands/shortlisted-inf?id=${encodeURIComponent(
                          c.id
                        )}`
                      )}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition border-gray-300 bg-white text-black hover:border-black hover:bg-gray-50"
                      title="View shortlisted influencers"
                      aria-label={`View shortlisted influencers (${shortlistCount})`}
                    >
                      <HiOutlineDocumentText size={18} className="opacity-70" />
                      <span className="underline-offset-2 hover:underline">
                        Shortlisted
                      </span>
                      <HiChevronRightIcon size={18} className="opacity-60" />
                    </Link>
                  </td>

                  <td className="px-4 py-3 align-top text-center">
                    <Link
                      href={withBrandId(
                        `/admin/brands/fav-influencer?id=${encodeURIComponent(
                          c.id
                        )}`
                      )}
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition border-gray-300 bg-white text-black hover:border-black hover:bg-gray-50"
                      title="View favorite influencers"
                      aria-label={`View favorite influencers (${favCount})`}
                    >
                      <HiOutlineStar size={18} className="opacity-70" />
                      <span className="underline-offset-2 hover:underline">
                        Favorites
                      </span>
                      <span className="ml-1 inline-flex min-w-[2rem] justify-center rounded-full bg-black px-2 py-0.5 text-xs font-bold text-white">
                        {favCount}
                      </span>
                      <HiChevronRightIcon size={18} className="opacity-60" />
                    </Link>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap align-top text-center">
                    <div className="inline-flex items-center justify-center rounded-full border border-gray-300 px-3 py-1 text-sm font-semibold text-black bg-white">
                      {statusLabel}
                    </div>

                    {String(c.createdByRole || "").toLowerCase() === "admin" ? (
                      <div className="mt-1 text-xs font-medium text-gray-600">
                        By Admin
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPrev,
  onNext,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  onPageChange: (page: number) => void;
}) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex justify-end items-center p-4 gap-2 flex-wrap">
      <button
        onClick={onPrev}
        disabled={currentPage === 1}
        className="p-2 border border-gray-300 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-white"
      >
        <HiChevronLeft size={20} />
      </button>

      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`min-w-[40px] h-10 px-3 rounded-full border text-sm font-medium transition ${currentPage === page
              ? "bg-black text-white border-black"
              : "bg-white text-black border-gray-300 hover:bg-gray-100"
            }`}
        >
          {page}
        </button>
      ))}

      <button
        onClick={onNext}
        disabled={currentPage >= totalPages}
        className="p-2 border border-gray-300 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-white"
      >
        <HiChevronRight size={20} />
      </button>
    </div>
  );
}