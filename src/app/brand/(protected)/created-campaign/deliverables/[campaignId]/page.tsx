"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import api, { get } from "@/lib/api";

type ReviewStatus = "approved" | "pending" | "rejected" | "changes_needed";

type UrlItem = { label: string; url: string };

type DeliverableApi = {
  _id?: string;
  id?: string;

  campaignId?: string;

  influencerId?: string;
  influencerHandle?: string;
  username?: string;

  title?: string;
  description?: string;
  url?: UrlItem[];

  status?: ReviewStatus | string;
  comments?: string;
  reason?: string;

  createdAt?: string;
  updatedAt?: string;
};

type DeliverableRow = {
  rowKey: string; // unique in table (deliverableId + url index)
  deliverableId: string;

  influencerId: string;
  influencerHandle: string;

  title: string;
  description: string;

  draftLabel: string; // from url.label
  linkUrl: string; // shown inside Draft cell

  status: ReviewStatus;
  reason: string;

  submittedAt: string;
  updatedAt?: string;
};

const normalizeUrl = (value: string) => {
  const v = (value || "").trim();
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `https://${v}`;
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

const toStatus = (s: any): ReviewStatus => {
  const v = String(s || "pending").toLowerCase();
  if (v === "approved") return "approved";
  if (v === "rejected") return "rejected";
  if (v === "changes_needed" || v === "changes needed") return "changes_needed";
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
    case "changes_needed":
      return "bg-purple-50 text-purple-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const statusLabel = (s: ReviewStatus) =>
  s === "changes_needed" ? "Changes needed" : s[0].toUpperCase() + s.slice(1);

const makeApprovalId = () => {
  const y = new Date().getFullYear();
  const r = Math.floor(10000 + Math.random() * 90000);
  return `APR-${y}-${r}`;
};

// ✅ dummy rows until API returns something
const DUMMY: DeliverableRow[] = [
  {
    rowKey: "dummy_1",
    deliverableId: "DEL-001",
    influencerId: "inf_101",
    influencerHandle: "@riya.glow",
    title: "Instagram Reel - Product Demo",
    description: "30 sec reel with hook + CTA",
    draftLabel: "Draft 1",
    linkUrl: "https://drive.google.com/...",
    status: "changes_needed",
    reason: "Update hook + add product close-up + include hashtag.",
    submittedAt: "2026-02-22T09:10:00.000Z",
    updatedAt: "2026-02-22T10:10:00.000Z",
  },
  {
    rowKey: "dummy_2",
    deliverableId: "DEL-002",
    influencerId: "inf_102",
    influencerHandle: "@liftwitharjun",
    title: "YouTube Short - Gym Challenge",
    description: "60 sec short with routine + product mention",
    draftLabel: "Draft Link",
    linkUrl: "https://youtube.com/shorts/...",
    status: "approved",
    reason: "Looks good.",
    submittedAt: "2026-02-23T07:40:00.000Z",
    updatedAt: "2026-02-23T09:15:00.000Z",
  },
];

function mapApiToRows(items: DeliverableApi[]): DeliverableRow[] {
  const out: DeliverableRow[] = [];

  for (const it of items || []) {
    const deliverableId = String(it._id || it.id || "");
    if (!deliverableId) continue;

    const influencerId = String(it.influencerId || "—");
    const influencerHandle = String(it.influencerHandle || it.username || influencerId);

    const title = it.title || "Untitled";
    const description = it.description || "";

    const status = toStatus(it.status);
    const reason =
      it.comments || it.reason || (status === "pending" ? "Under review by brand." : "");

    const submittedAt = it.createdAt || new Date().toISOString();
    const updatedAt = it.updatedAt;

    const urls = Array.isArray(it.url) ? it.url : [];

    if (urls.length === 0) {
      out.push({
        rowKey: `${deliverableId}_0`,
        deliverableId,
        influencerId,
        influencerHandle,
        title,
        description,
        draftLabel: "Draft",
        linkUrl: "",
        status,
        reason,
        submittedAt,
        updatedAt,
      });
      continue;
    }

    urls.forEach((u, idx) => {
      out.push({
        rowKey: `${deliverableId}_${idx}`,
        deliverableId,
        influencerId,
        influencerHandle,
        title,
        description,
        draftLabel: u.label || `Draft ${idx + 1}`,
        linkUrl: u.url || "",
        status,
        reason,
        submittedAt,
        updatedAt,
      });
    });
  }

  return out;
}

export default function BrandCampaignDeliverablesPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = params?.campaignId;

  const [rows, setRows] = useState<DeliverableRow[]>(DUMMY);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>("all");
  const [influencerFilter, setInfluencerFilter] = useState<string>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  // edit per deliverableId (PATCH is per deliverable)
  const [edit, setEdit] = useState<Record<string, { status: ReviewStatus; comments: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const uniqueInfluencers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.influencerHandle));
    return Array.from(set).sort();
  }, [rows]);

  const getBaseForDeliverable = (deliverableId: string) => {
    const base = rows.find((r) => r.deliverableId === deliverableId);
    return base || null;
  };

  const initEditFromRows = (nextRows: DeliverableRow[]) => {
    const nextEdit: Record<string, { status: ReviewStatus; comments: string }> = {};
    for (const r of nextRows) {
      if (!nextEdit[r.deliverableId]) {
        nextEdit[r.deliverableId] = { status: r.status, comments: r.reason || "" };
      }
    }
    setEdit(nextEdit);
  };

  const fetchDeliverables = async () => {
    if (!campaignId) return;
    setLoading(true);
    setBanner(null);

    try {
      // ✅ GET /deliverable/campaign/:campaignId
      const res: any = await get<any>(`/deliverable/campaign/${campaignId}`);

      const arr =
        (Array.isArray(res) && res) ||
        (Array.isArray(res?.data) && res.data) ||
        (Array.isArray(res?.deliverables) && res.deliverables) ||
        (Array.isArray(res?.items) && res.items) ||
        [];

      if (Array.isArray(arr) && arr.length > 0) {
        const mapped = mapApiToRows(arr as DeliverableApi[]);
        if (mapped.length > 0) {
          setRows(mapped);
          initEditFromRows(mapped);
          setBanner(null);
        } else {
          setBanner("API returned data but could not map deliverables. Showing dummy data.");
        }
      } else {
        setBanner("No deliverables from API yet. Showing dummy data.");
      }
    } catch {
      setBanner("Could not fetch deliverables from API. Showing dummy data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // init edit for dummy
    initEditFromRows(rows);
    // then fetch real
    fetchDeliverables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const filtered = useMemo(() => {
    let list = [...rows];

    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (influencerFilter !== "all") list = list.filter((r) => r.influencerHandle === influencerFilter);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = `${r.influencerHandle} ${r.title} ${r.description} ${r.draftLabel} ${r.status} ${r.reason} ${r.linkUrl}`.toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      const ta = new Date(a.submittedAt).getTime();
      const tb = new Date(b.submittedAt).getTime();
      return sort === "newest" ? tb - ta : ta - tb;
    });

    return list;
  }, [rows, statusFilter, influencerFilter, search, sort]);

  const setEditField = (deliverableId: string, key: "status" | "comments", value: any) => {
    setEdit((prev) => ({
      ...prev,
      [deliverableId]: { ...prev[deliverableId], [key]: value },
    }));
  };

  const saveOne = async (deliverableId: string) => {
    const patch = edit[deliverableId];
    const base = getBaseForDeliverable(deliverableId);
    if (!patch || !base) return;

    const dirty = patch.status !== base.status || (patch.comments || "") !== (base.reason || "");
    if (!dirty) return;

    setSavingId(deliverableId);
    setBanner(null);

    try {
      const brandId =
        typeof window !== "undefined" ? localStorage.getItem("brandId") : null;

      // ✅ rule you gave:
      // if brandId NOT there -> Admin, else brand
      const approvedRole = brandId ? "brand" : "Admin";

      const payload = {
        status: patch.status,
        comments: patch.comments,
        approvedRole,
        approvalId: makeApprovalId(),
      };

      // ✅ PATCH /delieverable/:deliverableId/status  (note spelling)
      await api.patch(`/delieverable/${deliverableId}/status`, payload);

      // Update UI for ALL rows of that deliverable
      const now = new Date().toISOString();
      setRows((prev) =>
        prev.map((r) =>
          r.deliverableId !== deliverableId
            ? r
            : { ...r, status: patch.status, reason: patch.comments, updatedAt: now }
        )
      );

      setBanner("Updated successfully.");
    } catch (e: any) {
      setBanner("Update failed. Please verify endpoint/token/CORS and try again.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Campaign Deliverables</h1>
          <p className="mt-1 text-sm text-gray-600">Campaign ID: {campaignId}</p>
        </div>

        <Link
          href="/brand/created-campaign"
          className="rounded-md px-4 py-2 text-sm font-medium text-gray-900 border border-gray-200 hover:bg-gray-50"
        >
          Back
        </Link>
      </div>

      {/* Banner */}
      <div className="mt-4">
        {loading && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Fetching deliverables from API...
          </div>
        )}
        {!loading && banner && (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
            {banner.includes("failed") || banner.includes("Could not") ? (
              <span className="text-red-700">{banner}</span>
            ) : (
              <span className="text-gray-800">{banner}</span>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Filters */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="flex-1">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search influencer, title, draft, status, reason..."
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
                <option value="changes_needed">Changes needed</option>
              </select>

              <select
                value={influencerFilter}
                onChange={(e) => setInfluencerFilter(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FFA135]"
              >
                <option value="all">All Influencers</option>
                {uniqueInfluencers.map((x) => (
                  <option key={x} value={x}>
                    {x}
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

              <button
                onClick={fetchDeliverables}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-900 border border-gray-200 hover:bg-gray-50"
                title="Refresh from API"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Table (NO separate open link column) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-white">
              <tr className="text-xs font-semibold text-gray-600 border-b border-gray-200">
                <th className="px-4 py-3">Influencer</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Draft</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Comments / Reason</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 w-[140px]">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => {
                const current = edit[r.deliverableId] || { status: r.status, comments: r.reason || "" };
                const base = rows.find((x) => x.deliverableId === r.deliverableId);
                const dirty =
                  !!base &&
                  (current.status !== base.status || (current.comments || "") !== (base.reason || ""));

                return (
                  <tr key={r.rowKey} className="text-sm text-gray-800 align-top">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{r.influencerHandle}</div>
                      <div className="text-xs text-gray-500">ID: {r.influencerId}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{r.title}</div>
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">{r.description}</div>
                    </td>

                    {/* Draft cell includes the link (no separate column) */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{r.draftLabel}</div>
                      {r.linkUrl ? (
                        <a
                          href={normalizeUrl(r.linkUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs font-semibold text-gray-800 hover:underline break-all"
                        >
                          Open ↗
                        </a>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                      <div className="text-[11px] text-gray-400 mt-1">
                        Deliverable ID: {r.deliverableId}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <span
                          className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusPill(
                            r.status
                          )}`}
                        >
                          {statusLabel(r.status)}
                        </span>

                        <select
                          value={current.status}
                          onChange={(e) => setEditField(r.deliverableId, "status", e.target.value as ReviewStatus)}
                          className="rounded-md border border-gray-300 px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-[#FFA135]"
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                          <option value="changes_needed">Changes needed</option>
                        </select>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <textarea
                        value={current.comments}
                        onChange={(e) => setEditField(r.deliverableId, "comments", e.target.value)}
                        placeholder="Write comments / feedback..."
                        className="w-[260px] min-w-[220px] rounded-md border border-gray-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#FFA135]"
                        rows={3}
                      />
                      <div className="mt-1 text-xs text-gray-500">
                        Tip: For <b>Changes needed</b>, add clear steps.
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-gray-700">{formatIST(r.submittedAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{r.updatedAt ? formatIST(r.updatedAt) : "-"}</td>

                    <td className="px-4 py-3">
                      <button
                        onClick={() => saveOne(r.deliverableId)}
                        disabled={!dirty || savingId === r.deliverableId}
                        className={`rounded-md px-3 py-2 text-xs font-semibold border border-gray-200 ${
                          !dirty || savingId === r.deliverableId
                            ? "opacity-60 cursor-not-allowed bg-white"
                            : "bg-white hover:bg-gradient-to-r hover:from-[#FFA135] hover:to-[#FF7236] hover:text-white"
                        }`}
                        title={!dirty ? "No changes to update" : "Update status/comments"}
                      >
                        {savingId === r.deliverableId ? "Updating..." : "Update"}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={8}>
                    No deliverables match your filters.
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