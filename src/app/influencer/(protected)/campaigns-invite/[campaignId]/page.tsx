"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { get } from "@/lib/api";

type ReviewStatus = "approved" | "pending" | "rejected" | "revision";
type UrlItem = { label: string; url: string };

type DeliverableApi = {
  _id?: string;
  id?: string;

  brandId?: string;
  influencerId?: string;

  campaignsId?: string;
  campaignId?: string;

  title?: string;
  description?: string;
  url?: UrlItem[];

  status?: string;

  comments?: string;
  reason?: string;

  createdAt?: string;
  updatedAt?: string;
  updatedDate?: string;

  // ✅ milestone title comes in response
  milestoneTitle?: string;
};

type DeliverableRow = {
  rowId: string;
  deliverableId?: string;
  deliverablesType: string;

  milestoneTitle: string;

  title: string;
  description: string;
  status: ReviewStatus;
  reason: string;
  linkUrl: string;
  createdAt: string;
};

const formatIST = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const normalizeUrl = (value: string) => {
  const v = (value || "").trim();
  if (!v) return "";
  const withProto =
    v.startsWith("http://") || v.startsWith("https://") ? v : `https://${v}`;
  return encodeURI(withProto);
};

const toStatus = (s: any): ReviewStatus => {
  const v = String(s || "pending").toLowerCase();
  if (v === "approved") return "approved";
  if (v === "rejected") return "rejected";
  if (v === "revision") return "revision";
  if (v === "changes_needed" || v === "changes needed" || v === "changes")
    return "revision";
  return "pending";
};

const statusPill = (s: ReviewStatus) => {
  switch (s) {
    case "approved":
      return "bg-green-50 text-green-700";
    case "pending":
      return "bg-amber-50 text-amber-700";
    case "rejected":
      return "bg-red-50 text-red-700";
    case "revision":
      return "bg-purple-50 text-purple-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const statusLabel = (s: ReviewStatus) => {
  if (s === "revision") return "Revision";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function mapApiToRows(items: DeliverableApi[]): DeliverableRow[] {
  const out: DeliverableRow[] = [];

  (items || []).forEach((it, itemIdx) => {
    const deliverableId = it._id || it.id;

    const title = it.title || "Untitled";
    const description = it.description || "";
    const status = toStatus(it.status);

    const reason =
      (it.comments?.trim() || it.reason?.trim()) ||
      (status === "pending" ? "Under review by brand." : "");

    const createdAt =
      it.createdAt || it.updatedDate || it.updatedAt || new Date().toISOString();

    const milestoneTitle = (it.milestoneTitle || "").trim() || "—";
    const urls = Array.isArray(it.url) ? it.url : [];

    // ✅ Unique base key: prefer real ID, otherwise fall back to index (and createdAt for extra safety)
    const baseKey = deliverableId ? String(deliverableId) : `noid_${itemIdx}_${createdAt}`;

    if (urls.length === 0) {
      out.push({
        rowId: `${baseKey}_0`,
        deliverableId,
        deliverablesType: "Draft",
        milestoneTitle,
        title,
        description,
        status,
        reason,
        linkUrl: "",
        createdAt,
      });
      return;
    }

    urls.forEach((u, urlIdx) => {
      out.push({
        rowId: `${baseKey}_${urlIdx}`,
        deliverableId,
        deliverablesType: u.label || `Draft ${urlIdx + 1}`,
        milestoneTitle,
        title,
        description,
        status,
        reason,
        linkUrl: u.url || "",
        createdAt,
      });
    });
  });

  return out;
}

export default function CampaignDeliverablesPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = params?.campaignId;

  const [rows, setRows] = useState<DeliverableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // filters
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>("all");
  const [titleFilter, setTitleFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const uniqueTitles = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.title));
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    let list = [...rows];

    if (statusFilter !== "all")
      list = list.filter((r) => r.status === statusFilter);
    if (titleFilter !== "all") list = list.filter((r) => r.title === titleFilter);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay =
          `${r.deliverablesType} ${r.milestoneTitle} ${r.title} ${r.description} ${r.status} ${r.reason} ${r.linkUrl}`.toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sort === "newest" ? tb - ta : ta - tb;
    });

    return list;
  }, [rows, statusFilter, titleFilter, search, sort]);

  const fetchDeliverables = async () => {
    if (!campaignId) return;

    setLoading(true);
    setApiError(null);

    try {
      const res: any = await get<any>(`/deliverable/campaign/${campaignId}`);

      const arr =
        (Array.isArray(res) && res) ||
        (Array.isArray(res?.data) && res.data) ||
        (Array.isArray(res?.deliverables) && res.deliverables) ||
        (Array.isArray(res?.items) && res.items) ||
        [];

      setRows(mapApiToRows(arr as DeliverableApi[]));
      setApiLoaded(true);
    } catch (e: any) {
      setApiError("Could not fetch deliverables from API.");
      setRows([]);
      setApiLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliverables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Deliverables</h1>
        </div>

        <Link
          href="/influencer/campaigns-invite"
          className="rounded-md px-4 py-2 text-sm font-medium text-gray-900 border border-gray-200 hover:bg-gray-50"
        >
          Back
        </Link>
      </div>

      {/* API Banner */}
      <div className="mt-4">
        {loading && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Fetching deliverables from API...
          </div>
        )}
        {!loading && apiLoaded && apiError && (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
            <span className="text-red-700">{apiError}</span>
          </div>
        )}
      </div>

      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-gray-800">
            Deliverables submissions
          </p>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="flex-1">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search milestone, draft, title, description, reason..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FFA135]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FFA135]"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="revision">Revision</option>
              </select>

              <select
                value={titleFilter}
                onChange={(e) => setTitleFilter(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FFA135]"
              >
                <option value="all">All Titles</option>
                {uniqueTitles.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FFA135]"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white">
              <tr className="text-xs font-semibold text-gray-600 border-b border-gray-200">
                <th className="px-4 py-3">Deliverables Type</th>
                <th className="px-4 py-3">Milestone</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((r) => (
                <tr key={r.rowId} className="text-sm text-gray-800 align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">
                      {r.deliverablesType}
                    </div>
                    <div className="text-xs text-gray-500">
                      Submitted: {formatIST(r.createdAt)}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-gray-900">
                      {r.milestoneTitle}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-gray-900">
                      {r.title}
                    </div>
                    <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                      {r.description}
                    </div>

                    {r.linkUrl && (
                      <a
                        href={normalizeUrl(r.linkUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs font-semibold text-gray-800 hover:underline break-all"
                      >
                        Open link ↗
                      </a>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusPill(
                        r.status
                      )}`}
                    >
                      {statusLabel(r.status)}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">
                      {r.reason}
                    </div>
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-sm text-gray-500"
                    colSpan={5}
                  >
                    No deliverables found for this campaign.
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