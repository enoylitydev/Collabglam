"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  HiSearch,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineUserAdd,
  HiOutlinePencil,
  HiOutlineUsers
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
  applicantCount: number;
  campaignType?: string;

  campaignStatus?: CampaignStatus; // open | paused
  influencerWorking?: boolean; // ✅ from backend
}

interface CampaignsResponse {
  data: any[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages?: number;
    totalPages?: number;
  };
}

const TABLE_GRADIENT_FROM = "#FFA135";
const TABLE_GRADIENT_TO = "#FF7236";

const sliceText = (text: string, max = 40) =>
  text?.length > max ? `${text.slice(0, max - 3)}...` : text;

export default function BrandCreatedCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ✅ per-row status update loading
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>(
    {}
  );

  const fetchCampaigns = useCallback(
    async (page: number, term: string) => {
      setLoading(true);
      setError(null);

      try {
        const brandId =
          typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
        if (!brandId) throw new Error("No brandId found in localStorage.");

        const res = await get<CampaignsResponse>("/campaign/active", {
          brandId,
          search: term.trim() || undefined,
          page,
          limit,
        });

        const raw = Array.isArray(res?.data) ? res.data : [];
        const active = raw.filter((c: any) => c.isActive === 1);

        const normalized: Campaign[] = active.map((c: any) => {
          const rawStatus = String(c.campaignStatus || "open")
            .toLowerCase()
            .trim();

          // ✅ closed removed: if legacy "closed" ever comes, treat it as paused
          const safeStatus: CampaignStatus =
            rawStatus === "paused" || rawStatus === "closed" ? "paused" : "open";

          return {
            id: c.campaignsId ?? c.id ?? c._id,
            productOrServiceName: c.productOrServiceName ?? "",
            description: c.description ?? "",
            timeline: c.timeline ?? { startDate: "", endDate: "" },
            isActive: c.isActive ?? 0,
            budget: c.budget ?? 0,
            applicantCount: c.applicantCount ?? 0,
            campaignType: c.campaignType ?? "",
            campaignStatus: safeStatus,
            influencerWorking: Boolean(c.influencerWorking),
          };
        });

        setCampaigns(normalized);
        setTotalPages(res?.pagination?.totalPages ?? res?.pagination?.pages ?? 1);
      } catch (err: any) {
        setError(err.message || "Failed to load campaigns.");
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

  const updateStatus = async (campaignId: string, next: CampaignStatus) => {
    const brandId =
      typeof window !== "undefined" ? localStorage.getItem("brandId") : null;

    if (!brandId) throw new Error("No brandId found in localStorage.");

    try {
      const res = await post("/campaign/status", {
        brandId,
        campaignId,
        status: next,
      });

      // your api wrapper might return {data: ...} or raw
      return (res as any)?.data ?? res;
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update campaign status.";
      throw new Error(msg);
    }
  };

  const onChangeStatus = async (campaign: Campaign, next: CampaignStatus) => {
    const id = campaign.id;
    const prev = (campaign.campaignStatus || "open") as CampaignStatus;

    // optimistic update
    setCampaigns((prevList) =>
      prevList.map((c) => (c.id === id ? { ...c, campaignStatus: next } : c))
    );

    setStatusUpdating((p) => ({ ...p, [id]: true }));
    setError(null);

    try {
      await updateStatus(id, next);
    } catch (e: any) {
      // rollback
      setCampaigns((prevList) =>
        prevList.map((c) => (c.id === id ? { ...c, campaignStatus: prev } : c))
      );
      setError(e?.message || "Failed to update status.");
    } finally {
      setStatusUpdating((p) => ({ ...p, [id]: false }));
    }
  };

  const formatDate = (dateStr: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(dateStr));

  const formatCurrency = (amt: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amt);

  return (
    <div className="p-6 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold">Created Campaigns</h1>
      </div>

      {/* Search */}
      <div className="mb-6 max-w-md">
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

      {loading ? (
        <SkeletonTable />
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : campaigns.length === 0 ? (
        <p className="text-gray-700">No campaigns found.</p>
      ) : (
        <TableView
          data={campaigns}
          onChangeStatus={onChangeStatus}
          statusUpdating={statusUpdating}
          formatDate={formatDate}
          formatCurrency={formatCurrency}
        />
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

function TableView({
  data,
  onChangeStatus,
  statusUpdating,
  formatDate,
  formatCurrency,
}: {
  data: Campaign[];
  onChangeStatus: (c: Campaign, next: CampaignStatus) => void;
  statusUpdating: Record<string, boolean>;
  formatDate: (d: string) => string;
  formatCurrency: (n: number) => string;
}) {
  return (
    // ✅ same clean wrapper as Active Campaign table (no extra left space)
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
                  "Influencers List",
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
                const status = (c.campaignStatus || "open") as CampaignStatus;
                const isBusy = !!statusUpdating[c.id];

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
                    {/* Campaign */}
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

                    {/* Type */}
                    <td className="px-6 py-4 whitespace-nowrap align-top text-center">
                      {c.campaignType && c.campaignType.trim() !== ""
                        ? sliceText(c.campaignType, 30)
                        : "—"}
                    </td>

                    {/* Budget */}
                    <td className="px-6 py-4 whitespace-nowrap align-top text-center font-medium text-gray-900">
                      {formatCurrency(c.budget)}
                    </td>

                    {/* Timeline */}
                    <td className="px-6 py-4 whitespace-nowrap align-top text-center">
                      {formatDate(c.timeline.startDate)} –{" "}
                      {formatDate(c.timeline.endDate)}
                    </td>

                    <td className="px-6 py-4 align-top text-center">
                      {(c.applicantCount ?? 0) > 0 ? (
                        <Link
                          href={`/brand/created-campaign/applied-inf?id=${c.id}`}
                          className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-900
                 hover:border-[#FF7236] hover:bg-white hover:shadow-sm transition
                 focus:outline-none focus:ring-2 focus:ring-[#FF7236]"
                          title="View influencers"
                          aria-label={`View influencers (${c.applicantCount ?? 0})`}
                        >
                          <HiOutlineUsers size={18} className="opacity-70 group-hover:text-[#FF7236]" />
                          <span className="group-hover:underline underline-offset-2">Influencers</span>

                          <span className="ml-1 inline-flex min-w-[2rem] justify-center rounded-full bg-gray-900 px-2 py-0.5 text-xs font-bold text-white group-hover:bg-[#FF7236]">
                            {c.applicantCount ?? 0}
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

                    {/* Status (open/paused) */}
                    <td className="px-6 py-4 whitespace-nowrap align-top text-center">
                      <select
                        value={status}
                        disabled={isBusy}
                        onChange={(e) =>
                          onChangeStatus(c, e.target.value as CampaignStatus)
                        }
                        className={[
                          "px-3 py-2 rounded-lg text-sm font-semibold border",
                          "bg-white",
                          "focus:outline-none focus:ring focus:ring-[#FF7236] focus:border-[#FF7236]",
                          isBusy ? "opacity-60 cursor-wait" : "",
                        ].join(" ")}
                        title="Update campaign status"
                      >
                        <option value="open">Open</option>
                        <option value="paused">Paused</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap align-top text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/brand/add-edit-campaign?id=${c.id}`}
                          className="inline-flex items-center bg-white border border-gray-900 text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-semibold"
                        >
                          <HiOutlinePencil className="mr-1" size={18} />
                          Edit
                        </Link>

                        <Link
                          href={`/brand/browse-influencer?campaignId=${c.id}`}
                          className="inline-flex items-center bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:opacity-90 px-3 py-2 rounded-lg text-sm font-semibold"
                        >
                          <HiOutlineUserAdd className="mr-1" size={18} />
                          Invite
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
