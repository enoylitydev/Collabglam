"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  HiSearch,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineUsers,
  HiOutlineUserGroup,
} from "react-icons/hi";
import { get } from "@/lib/api";

const TABLE_GRADIENT_FROM = "#FFA135";
const TABLE_GRADIENT_TO = "#FF7236";

interface ApiMeta {
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
  pages?: number;
}

interface RawCampaign {
  _id?: string;
  campaignsId?: string;
  productOrServiceName: string;
  description?: string;
  timeline?: { startDate: string; endDate: string };
  isActive?: number;
  budget?: number;
  applicantCount?: number;
  totalAcceptedMembers?: number;
  campaignType?: string;

  shortlistedInfluencersCount?: number;
}

interface Campaign {
  id: string;
  productOrServiceName: string;
  description: string;
  timeline: { startDate?: string; endDate?: string };
  isActive: number;
  budget: number;
  applicantCount: number;
  totalAcceptedMembers: number;
  campaignType?: string;
  shortlistedInfluencersCount: number;
}

interface CampaignsApiResponse {
  meta?: ApiMeta;
  pagination?: ApiMeta;
  data?: RawCampaign[];
}

export default function BrandShortlistedCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  };

  const formatCurrency = (amt: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
      Number.isFinite(amt) ? amt : 0
    );

  const truncate = (value?: string, len = 32) => {
    if (!value) return "—";
    const v = value.trim();
    if (v.length <= len) return v;
    return v.slice(0, len) + "…";
  };

  const normalize = (list: RawCampaign[]): Campaign[] =>
    list.map((c) => ({
      id: (c.campaignsId ?? c._id ?? "").toString(),
      productOrServiceName: c.productOrServiceName,
      description: c.description ?? "",
      timeline: {
        startDate: c.timeline?.startDate,
        endDate: c.timeline?.endDate,
      },
      isActive: c.isActive ?? 0,
      budget: c.budget ?? 0,
      applicantCount: c.applicantCount ?? 0,
      totalAcceptedMembers: c.totalAcceptedMembers ?? 0,
      campaignType: c.campaignType ?? "",
      shortlistedInfluencersCount: c.shortlistedInfluencersCount ?? 0,
    }));

  const fetchShortlisted = useCallback(
    async (page: number, term: string) => {
      setLoading(true);
      setError(null);

      try {
        const brandId =
          typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
        if (!brandId) throw new Error("No brandId found in localStorage.");

        // ✅ Your controller: GET /deliverable/brand/:brandId/campaigns/shortlisted?page=&limit=&search=
        const res = await get<CampaignsApiResponse>(
          `/deliverable/brand/${brandId}/campaigns/shortlisted`,
          {
            page,
            limit,
            search: term.trim() || undefined,
          }
        );

        const list: RawCampaign[] = Array.isArray(res?.data) ? res.data! : [];
        setCampaigns(normalize(list));

        const meta = res.meta || res.pagination;
        setTotalPages(meta?.totalPages || meta?.pages || 1);
      } catch (err: any) {
        setError(err?.message || "Failed to load shortlisted campaigns.");
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1);
      setDebouncedSearch(search.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchShortlisted(currentPage, debouncedSearch);
  }, [fetchShortlisted, currentPage, debouncedSearch]);

  return (
    <div className="p-6 min-h-screen space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold text-gray-900">Live Campaigns</h1>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <div className="relative">
          <HiSearch className="absolute inset-y-0 left-3 my-auto text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#FFA135] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF7236] focus:border-[#FF7236] text-sm"
          />
        </div>
      </div>

      {loading ? (
        <SkeletonTable />
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : campaigns.length === 0 ? (
        <p className="text-gray-700">No campaigns found.</p>
      ) : (
        <div
          className="p-[1.5px] rounded-lg shadow"
          style={{
            backgroundImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO})`,
          }}
        >
          <div className="overflow-x-auto bg-white rounded-[0.5rem]">
            <table className="w-full text-sm text-gray-700">
              <thead
                className="text-white"
                style={{
                  backgroundImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO})`,
                }}
              >
                <tr>
                  {[
                    "Campaign",
                    "Campaign Type",
                    "Budget",
                    "Campaign Timeline",
                    "Shortlisted Influencers",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-center font-semibold whitespace-nowrap transition-colors hover:text-black cursor-default"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {campaigns.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} transition-colors`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${TABLE_GRADIENT_FROM}11, ${TABLE_GRADIENT_TO}11)`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundImage = "";
                    }}
                  >
                    <td className="px-6 py-4 text-center align-middle">
                      <Link
                        href={`/brand/active-campaign/view-campaign?id=${c.id}`}
                        className="font-semibold text-gray-900 underline-offset-4 transition-colors"
                        style={{ textDecoration: "none" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = TABLE_GRADIENT_TO)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "")}
                        title={c.productOrServiceName}
                      >
                        {truncate(c.productOrServiceName, 32)}
                      </Link>
                    </td>

                    <td className="px-6 py-4 text-center align-middle">
                      <span className={c.campaignType ? "text-gray-900" : "text-gray-400"}>
                        {c.campaignType ? truncate(c.campaignType, 26) : "—"}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center align-middle whitespace-nowrap">
                      {formatCurrency(c.budget)}
                    </td>

                    <td className="px-6 py-4 text-center align-middle whitespace-nowrap">
                      {formatDate(c.timeline?.startDate)} – {formatDate(c.timeline?.endDate)}
                    </td>

                    {/* Shortlisted Influencers */}
                    <td className="px-6 py-4 align-top text-center">
                      {c.shortlistedInfluencersCount > 0 ? (
                        <Link
                          href={`/brand/shortlisted-inf?id=${c.id}&name=${encodeURIComponent(
                            c.productOrServiceName
                          )}`}
                          className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-900
                          hover:border-[#FF7236] hover:bg-white hover:shadow-sm transition
                          focus:outline-none focus:ring-2 focus:ring-[#FF7236]"
                          title="View influencers"
                        >
                          <HiOutlineUsers size={18} className="opacity-70 group-hover:text-[#FF7236]" />
                          <span className="group-hover:underline underline-offset-2">View Influencers</span>

                          {/* <span className="ml-1 inline-flex min-w-[2rem] justify-center rounded-full bg-gray-900 px-2 py-0.5 text-xs font-bold text-white group-hover:bg-[#FF7236]">
                            {c.shortlistedInfluencersCount}
                          </span> */}

                          <HiChevronRight size={18} className="opacity-60 group-hover:opacity-100" />
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-400">
                          <HiOutlineUsers size={18} className="opacity-60" />
                          <span>Influencers</span>
                          <span className="ml-1 inline-flex min-w-[2rem] justify-center rounded-full bg-gray-300 px-2 py-0.5 text-xs font-bold text-white">
                            0
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
      <div className="p-6 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-2/3" />
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
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
    <div className="flex justify-end items-center p-2 space-x-3">
      <button
        onClick={onPrev}
        disabled={currentPage === 1}
        className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-gray-100 transition"
        aria-label="Previous page"
      >
        <HiChevronLeft size={20} />
      </button>

      <span className="text-gray-700 text-sm">
        Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
      </span>

      <button
        onClick={onNext}
        disabled={currentPage === totalPages}
        className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-gray-100 transition"
        aria-label="Next page"
      >
        <HiChevronRight size={20} />
      </button>
    </div>
  );
}