"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { HiSearch, HiChevronLeft, HiChevronRight, HiOutlineUserGroup } from "react-icons/hi";
import { post } from "@/lib/api";

// ✅ Theme
const TABLE_GRADIENT_FROM = "#FFA135";
const TABLE_GRADIENT_TO = "#FF7236";

// ---- Types ----
interface ApiMeta {
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
  pages?: number;
}

interface RawCampaign {
  _id: string;
  campaignsId?: string;
  productOrServiceName: string;
  description: string;
  timeline: { startDate: string; endDate: string };
  isActive: number;
  budget: number;
  applicantCount?: number;
  totalAcceptedMembers?: number;
  campaignType?: string;
}

interface Campaign {
  id: string;
  productOrServiceName: string;
  description: string;
  timeline: { startDate: string; endDate: string };
  isActive: number;
  budget: number;
  applicantCount: number;
  totalAcceptedMembers?: number;
  campaignType?: string;
}

interface CampaignsApiResponse {
  meta?: ApiMeta;
  pagination?: ApiMeta;
  campaigns?: RawCampaign[];
  data?: RawCampaign[];
}

export default function BrandActiveCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // ---- Helpers ----
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

  // ---- Fetch ----
  const fetchCampaigns = useCallback(
    async (page: number, term: string) => {
      setLoading(true);
      setError(null);

      try {
        const brandId =
          typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
        if (!brandId) throw new Error("No brandId found in localStorage.");

        const res = await post<CampaignsApiResponse>("/campaign/accepted", {
          brandId,
          search: term.trim() || undefined,
          page,
          limit,
        });

        const list: RawCampaign[] = Array.isArray(res?.campaigns)
          ? res.campaigns!
          : Array.isArray(res?.data)
            ? res.data!
            : [];

        const active = list.filter((c) => c.isActive === 1);

        const normalized: Campaign[] = active.map((c) => ({
          id: c.campaignsId ?? c._id,
          productOrServiceName: c.productOrServiceName,
          description: c.description ?? "",
          timeline: {
            startDate: c.timeline?.startDate,
            endDate: c.timeline?.endDate,
          },
          isActive: c.isActive,
          budget: c.budget,
          applicantCount: c.applicantCount ?? 0,
          totalAcceptedMembers: c.totalAcceptedMembers ?? 0,
          campaignType: c.campaignType,
        }));

        setCampaigns(normalized);

        const meta = res.meta || res.pagination;
        setTotalPages(meta?.totalPages || meta?.pages || 1);
      } catch (err: any) {
        setError(err?.message || "Failed to load campaigns.");
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  // debounce search (also resets to page 1)
  useEffect(() => {
    const t = setTimeout(() => {
      setCurrentPage(1);
      setDebouncedSearch(search.trim());
    }, 400);

    return () => clearTimeout(t);
  }, [search]);

  // single source of truth for fetching
  useEffect(() => {
    fetchCampaigns(currentPage, debouncedSearch);
  }, [fetchCampaigns, currentPage, debouncedSearch]);

  return (
    <div className="p-6 min-h-screen space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold text-gray-900">Active Campaigns</h1>
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
                    "Status",
                    "Campaign Timeline",
                    "Active Influencers",
                    "Actions",
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
                    {/* Campaign Name (CLICKABLE => View Campaign) */}
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

                    {/* Campaign Type */}
                    <td className="px-6 py-4 text-center align-middle">
                      <span className={c.campaignType ? "text-gray-900" : "text-gray-400"}>
                        {c.campaignType ? truncate(c.campaignType, 26) : "—"}
                      </span>
                    </td>

                    {/* Budget */}
                    <td className="px-6 py-4 text-center align-middle whitespace-nowrap">
                      {formatCurrency(c.budget)}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center align-middle whitespace-nowrap">
                      <span
                        className={`inline-flex items-center justify-center px-3 py-1 text-xs font-semibold rounded-full ${c.isActive === 1
                          ? "text-white"
                          : "bg-red-100 text-red-800"
                          }`}
                        style={
                          c.isActive === 1
                            ? {
                              backgroundImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO})`,
                            }
                            : undefined
                        }
                      >
                        {c.isActive === 1 ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Timeline */}
                    <td className="px-6 py-4 text-center align-middle whitespace-nowrap">
                      {formatDate(c.timeline?.startDate)} – {formatDate(c.timeline?.endDate)}
                    </td>

                    {/* Active Influencers (hover text = gradient color) */}
                    <td className="px-6 py-4 text-center align-middle">
                      <Link
                        href={`/brand/active-campaign/active-inf?id=${c.id}&name=${encodeURIComponent(
                          c.productOrServiceName
                        )}`}
                        className="inline-flex items-center justify-center rounded-full bg-gray-100 px-5 py-1.5 text-sm font-bold text-gray-900 transition-colors"
                        onMouseEnter={(e) => (e.currentTarget.style.color = TABLE_GRADIENT_TO)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "")}
                        title="View active influencers"
                      >
                        {c.totalAcceptedMembers ?? 0}
                      </Link>
                    </td>

                    {/* Actions (button bg = gradient, hover keeps it) */}
                    <td className="px-6 py-4 text-center align-middle whitespace-nowrap">
                      <Link
                        href={`/brand/created-campaign/applied-inf?id=${c.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-[0.99]"
                        style={{
                          backgroundImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO})`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.filter = "brightness(0.97)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.filter = "";
                        }}
                      >
                        <HiOutlineUserGroup size={18} />
                        View Applicants
                        {c.applicantCount > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-[#ef2f5b] rounded-full">
                            {c.applicantCount}
                          </span>
                        ) : null}
                      </Link>
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

// ---- UI Bits ----
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
