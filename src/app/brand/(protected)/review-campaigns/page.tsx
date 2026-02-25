"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  HiSearch,
  HiChevronLeft,
  HiChevronRight,
  HiOutlinePencil,
  HiOutlineDocumentText,
  HiCheckCircle,
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

  shortlistedCount?: number;
  campaignStatus?: CampaignStatus;
  influencerWorking?: boolean;
  hasPendingUpdate?: boolean;

  // ✅ store full campaign payload
  raw?: any;
}

const TABLE_GRADIENT_FROM = "#FFA135";
const TABLE_GRADIENT_TO = "#FF7236";

const APPROVE_ENDPOINT = "/campaign/approve";

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

export default function BrandReviewCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>(
    {}
  );
  const [approveUpdating, setApproveUpdating] = useState<
    Record<string, boolean>
  >({});

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

  const fetchCampaigns = useCallback(
    async (page: number, term: string) => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const brandId =
          typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
        if (!brandId) throw new Error("No brandId found in localStorage.");

        // ✅ brandId is part of the URL: /campaign/created-by-admin/:brandId
        const listEndpoint = `/campaign/created-by-admin/${encodeURIComponent(
          brandId
        )}`;

        const res: any = await get(listEndpoint, {
          search: term.trim() || undefined,
          page,
          limit,
        });

        // ✅ Handles both:
        // 1) get() returns axios response (res.data is body)
        // 2) get() returns body directly
        const body = res?.data && typeof res.data === "object" ? res.data : res;

        // backend body: { success, page, limit, total, data: [...] }
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
              : undefined);

          return {
            id: merged.campaignsId ?? merged.id ?? merged._id,
            productOrServiceName: merged.productOrServiceName ?? "",
            description: merged.description ?? "",
            timeline: merged.timeline ?? { startDate: "", endDate: "" },
            isActive: merged.isActive ?? 0,
            budget: merged.budget ?? 0,
            campaignType: merged.campaignType ?? "",
            shortlistedCount:
              typeof shortlistCount === "number" ? shortlistCount : 0,
            campaignStatus: safeStatus,
            influencerWorking: Boolean(merged.influencerWorking),
            hasPendingUpdate,
            raw: merged,
          };
        });

        setCampaigns(normalized);

        // ✅ Use backend pagination numbers
        const total = Number(body?.total ?? 0);
        const respLimit = Number(body?.limit ?? limit);
        const computedTotalPages = Math.max(
          1,
          Math.ceil(total / (respLimit || 1))
        );
        setTotalPages(computedTotalPages);
      } catch (err: any) {
        setError(err.message || "Failed to load review campaigns.");
        setCampaigns([]);
        setTotalPages(1);
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

  // fetch
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

    setCampaigns((prevList) =>
      prevList.map((c) => (c.id === id ? { ...c, campaignStatus: next } : c))
    );

    setStatusUpdating((p) => ({ ...p, [id]: true }));
    setError(null);
    setSuccess(null);

    try {
      await updateStatus(id, next);
      setSuccess("Campaign status updated.");
    } catch (e: any) {
      setCampaigns((prevList) =>
        prevList.map((c) => (c.id === id ? { ...c, campaignStatus: prev } : c))
      );
      setError(e?.message || "Failed to update status.");
    } finally {
      setStatusUpdating((p) => ({ ...p, [id]: false }));
    }
  };

  const approveCampaign = async (campaignId: string) => {
    const brandId =
      typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
    if (!brandId) throw new Error("No brandId found in localStorage.");

    const res = await post(APPROVE_ENDPOINT, { brandId, campaignId });
    return (res as any)?.data ?? res;
  };

  const onApprove = async (c: Campaign) => {
    const id = c.id;
    setApproveUpdating((p) => ({ ...p, [id]: true }));
    setError(null);
    setSuccess(null);

    try {
      await approveCampaign(id);
      setSuccess("Campaign approved successfully.");
      fetchCampaigns(currentPage, debouncedSearch);
    } catch (e: any) {
      setError(e?.message || "Failed to approve campaign.");
    } finally {
      setApproveUpdating((p) => ({ ...p, [id]: false }));
    }
  };

  return (
    <div className="p-6 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold">Review Campaigns</h1>
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
      {success ? <p className="text-green-700 mb-3">{success}</p> : null}

      {loading ? (
        <SkeletonTable />
      ) : campaigns.length === 0 ? (
        <p className="text-gray-700">No campaigns found.</p>
      ) : (
        <TableView
          data={campaigns}
          onChangeStatus={onChangeStatus}
          statusUpdating={statusUpdating}
          approveUpdating={approveUpdating}
          onApprove={onApprove}
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
  approveUpdating,
  onApprove,
}: {
  data: Campaign[];
  onChangeStatus: (c: Campaign, next: "open" | "paused") => void;
  statusUpdating: Record<string, boolean>;
  approveUpdating: Record<string, boolean>;
  onApprove: (c: Campaign) => void;
}) {
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
                const status = (c.campaignStatus || "open") as "open" | "paused";
                const isBusy = !!statusUpdating[c.id];
                const isApproving = !!approveUpdating[c.id];
                const shortlistCount = c.shortlistedCount ?? 0;

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

                    <td className="px-6 py-4 align-top text-center">
                      <Link
                        href={`/brand/created-campaign/shortlisted-inf?id=${c.id}`}
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

                        <span className="ml-1 inline-flex min-w-[2rem] justify-center rounded-full bg-gray-900 px-2 py-0.5 text-xs font-bold text-white group-hover:bg-[#FF7236]">
                          {shortlistCount}
                        </span>

                        <HiChevronRight
                          size={18}
                          className="opacity-60 group-hover:opacity-100"
                        />
                      </Link>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap align-top text-center">
                      <select
                        value={status}
                        disabled={isBusy}
                        onChange={(e) =>
                          onChangeStatus(c, e.target.value as "open" | "paused")
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

                    <td className="px-6 py-4 whitespace-nowrap align-top text-center">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <Link
                          href={`/brand/edit-review-campaign?id=${c.id}`}
                          className="inline-flex items-center bg-white border border-gray-900 text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-semibold"
                        >
                          <HiOutlinePencil className="mr-1" size={18} />
                          Edit
                        </Link>

                        <button
                          onClick={() => onApprove(c)}
                          disabled={isApproving}
                          className={[
                            "inline-flex items-center px-3 py-2 rounded-lg text-sm font-semibold text-white",
                            "bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:opacity-90",
                            isApproving ? "opacity-60 cursor-wait" : "",
                          ].join(" ")}
                          title="Approve campaign"
                        >
                          <HiCheckCircle className="mr-1" size={18} />
                          {isApproving ? "Approving..." : "Approve"}
                        </button>
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