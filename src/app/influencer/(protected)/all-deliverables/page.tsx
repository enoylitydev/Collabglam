"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { get } from "@/lib/api";

type UrlItem = { label?: string; url?: string };

type DeliverableItem = {
  delieverableApprovalId?: string;
  title?: string;
  milestoneTitle?: string;
  description?: string;
  status?: "pending" | "approved" | "revision" | string;
  comments?: string;
  url?: UrlItem[];
  createdAt?: string;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  page?: number;
  limit?: number;
  total?: number;
  count?: number;
  data?: DeliverableItem[];
};

function normalizeApiResponse(maybeAxios: any): ApiResponse {
  if (
    maybeAxios?.data &&
    typeof maybeAxios.data === "object" &&
    ("success" in maybeAxios.data || "data" in maybeAxios.data)
  ) {
    return maybeAxios.data as ApiResponse;
  }
  return maybeAxios as ApiResponse;
}

const statusBadge = (status?: string) => {
  const s = String(status || "").toLowerCase();

  const base =
    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border";

  if (s === "approved")
    return (
      <span className={`${base} bg-green-50 text-green-700 border-green-200`}>
        Approved
      </span>
    );

  if (s === "revision")
    return (
      <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}>
        Revision
      </span>
    );

  if (s === "pending")
    return (
      <span className={`${base} bg-gray-50 text-gray-700 border-gray-200`}>
        Pending
      </span>
    );

  return (
    <span className={`${base} bg-gray-50 text-gray-700 border-gray-200`}>
      {s || "—"}
    </span>
  );
};

export default function AllDeliverablesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [influencerId, setInfluencerId] = useState<string>("");

  // data state
  const [items, setItems] = useState<DeliverableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // filters
  const [status, setStatus] = useState<string>(""); // "" means All
  const [searchText, setSearchText] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // pagination
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);

  const requestSeq = useRef(0);

  // ✅ Resolve influencerId from query first, else localStorage
  useEffect(() => {
    const qId = String(searchParams.get("influencerId") || "").trim();
    const lsId =
      typeof window !== "undefined"
        ? String(localStorage.getItem("influencerId") || "").trim()
        : "";

    const id = qId || lsId;
    setInfluencerId(id);

    if (!id) {
      setBanner("influencerId missing. Pass it in URL or set it in localStorage.");
      setItems([]);
      setTotal(0);
    }
  }, [searchParams]);

  // ✅ Debounce search: "use on type search"
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchText.trim());
      setPage(1); // reset to first page on new search
    }, 450);

    return () => clearTimeout(t);
  }, [searchText]);

  // reset to page 1 when status changes
  useEffect(() => {
    setPage(1);
  }, [status]);

  // reset to page 1 when limit changes
  useEffect(() => {
    setPage(1);
  }, [limit]);

  const fetchAllDeliverables = async () => {
    if (!influencerId) return;

    setLoading(true);
    setBanner(null);

    const seq = ++requestSeq.current;

    try {
      const qp = new URLSearchParams();
      qp.set("influencerId", influencerId);
      qp.set("page", String(page));
      qp.set("limit", String(limit));

      if (status) qp.set("status", status);
      if (debouncedSearch) qp.set("search", debouncedSearch);

      // NOTE: update base path if your backend is mounted differently
      const raw = await get<ApiResponse>(`/deliverable/getall?${qp.toString()}`);
      const res = normalizeApiResponse(raw);

      // ignore stale responses (typing fast)
      if (seq !== requestSeq.current) return;

      const arr = Array.isArray(res?.data) ? res.data : [];
      const t = Number(res?.total || 0);

      setItems(arr);
      setTotal(t);

      if (!arr.length) {
        setBanner("No deliverables found.");
      }
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setBanner("Could not fetch deliverables from API.");
      setItems([]);
      setTotal(0);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  };

  // Fetch whenever filters/pagination changes
  useEffect(() => {
    if (influencerId) fetchAllDeliverables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [influencerId, page, limit, status, debouncedSearch]);

  const rows = useMemo(() => items, [items]);

  const totalPages = Math.max(1, Math.ceil((total || 0) / (limit || 20)));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">All Deliverables</h1>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => router.back()}
              className="text-sm px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer"
            >
              Back
            </button>

            <button
              onClick={fetchAllDeliverables}
              disabled={loading || !influencerId}
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-900 border border-gray-200 bg-white hover:bg-gradient-to-r hover:from-[#FFBF00] hover:to-[#FFDB58] transition-colors disabled:opacity-50 cursor-pointer"
            >
              Refresh
            </button>
          </div>

          {/* Filters row */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Search */}
            <div className="relative">
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search title / milestone / campaign..."
                className="w-[260px] md:w-[320px] rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#FFBF00]/40"
              />
              {searchText.trim() && (
                <button
                  onClick={() => setSearchText("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
                  title="Clear"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status filter */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#FFBF00]/40"
              title="Filter by status"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="revision">Revision</option>
            </select>

            {/* Limit */}
            <select
              value={String(limit)}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#FFBF00]/40"
              title="Rows per page"
            >
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Banner */}
      <div>
        {loading && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Fetching deliverables...
          </div>
        )}
        {!loading && banner && (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
            {banner.includes("Could not") ? (
              <span className="text-red-700">{banner}</span>
            ) : (
              <span className="text-gray-800">{banner}</span>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-medium text-gray-800">
            Deliverables{" "}
            <span className="text-gray-400">
              ({rows.length} shown / {total} total)
            </span>
          </p>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => canPrev && setPage((p) => Math.max(1, p - 1))}
              disabled={!canPrev || loading}
              className="text-sm px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
            >
              Prev
            </button>

            <div className="text-sm text-gray-700">
              Page <b>{page}</b> of <b>{totalPages}</b>
            </div>

            <button
              onClick={() => canNext && setPage((p) => p + 1)}
              disabled={!canNext || loading}
              className="text-sm px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr className="text-xs font-semibold text-gray-600">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Milestone Title</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {rows.map((d, idx) => {
                const title = String(d?.title || "—");
                const milestoneTitle = String(d?.milestoneTitle || "—");
                const description = String(d?.description || "—");
                const statusVal = String(d?.status || "—");
                const reason = String(d?.comments || "").trim() || "—";

                return (
                  <tr
                    key={d?.delieverableApprovalId || `${idx}`}
                    className="text-sm text-gray-800"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{title}</div>
                    </td>

                    <td className="px-4 py-3 text-gray-700">{milestoneTitle}</td>

                    <td className="px-4 py-3 text-gray-700">{description}</td>

                    <td className="px-4 py-3">{statusBadge(statusVal)}</td>

                    <td className="px-4 py-3 text-gray-700">{reason}</td>
                  </tr>
                );
              })}

              {!rows.length && !loading && (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-sm text-gray-500"
                    colSpan={5}
                  >
                    No deliverables found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}