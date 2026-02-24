"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { HiPlus, HiTrash, HiXMark } from "react-icons/hi2";

import { get, post } from "@/lib/api";

type ReviewStatus = "approved" | "pending" | "rejected" | "changes_needed";

type UrlItem = { label: string; url: string };

type DeliverableApi = {
  _id?: string;
  id?: string;
  brandId?: string;
  influencerId?: string;
  campaignId?: string;
  title?: string;
  description?: string;
  url?: UrlItem[];
  status?: ReviewStatus | string;
  reason?: string; // brand feedback / reason
  createdAt?: string;
  updatedAt?: string;
};

type DeliverableRow = {
  rowId: string;
  deliverableId?: string;
  deliverablesType: string; // Draft 1/2/3 from url.label
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
  const v = value.trim();
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `https://${v}`;
};

const isValidUrlOrEmpty = (value: string) => {
  const v = value.trim();
  if (!v) return true;
  try {
    const u = new URL(normalizeUrl(v));
    return Boolean(u.hostname);
  } catch {
    return false;
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

const statusLabel = (s: ReviewStatus) => {
  if (s === "changes_needed") return "Changes needed";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function mapApiToRows(items: DeliverableApi[]): DeliverableRow[] {
  const out: DeliverableRow[] = [];

  for (const it of items || []) {
    const deliverableId = it._id || it.id;
    const title = it.title || "Untitled";
    const description = it.description || "";
    const status = toStatus(it.status);
    const reason = it.reason || (status === "pending" ? "Under review by brand." : "");

    const createdAt = it.createdAt || it.updatedAt || new Date().toISOString();

    const urls = Array.isArray(it.url) ? it.url : [];
    if (urls.length === 0) {
      out.push({
        rowId: `${deliverableId || "noid"}_0`,
        deliverableId,
        deliverablesType: "Draft",
        title,
        description,
        status,
        reason,
        linkUrl: "",
        createdAt,
      });
      continue;
    }

    urls.forEach((u, idx) => {
      out.push({
        rowId: `${deliverableId || "noid"}_${idx}`,
        deliverableId,
        deliverablesType: u.label || `Draft ${idx + 1}`,
        title,
        description,
        status,
        reason,
        linkUrl: u.url || "",
        createdAt,
      });
    });
  }

  return out;
}

export default function CampaignDeliverablesPage() {
  const params = useParams<{ campaignId: string }>();
  const searchParams = useSearchParams();

  const campaignId = params?.campaignId;

  // brandId comes from query param -> fallback localStorage -> fallback dummy
  const brandId =
    searchParams?.get("brandId") ||
    (typeof window !== "undefined" ? localStorage.getItem("brandId") : null) ||
    "B001";

  // influencerId from localStorage -> fallback dummy
  const influencerId =
    (typeof window !== "undefined" ? localStorage.getItem("influencerId") : null) || "I001";

  // table state
  const [rows, setRows] = useState<DeliverableRow[]>([]);

  // api state
  const [loading, setLoading] = useState(false);
  const [apiLoaded, setApiLoaded] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // modal state
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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

    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (titleFilter !== "all") list = list.filter((r) => r.title === titleFilter);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = `${r.deliverablesType} ${r.title} ${r.description} ${r.status} ${r.reason} ${r.linkUrl}`.toLowerCase();
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
      // GET /deliverable/campaign/campaignId
      const res: any = await get<any>(`/deliverable/campaign/${campaignId}`);

      // handle common shapes: [] OR {data:[]} OR {deliverables:[]} OR {items:[]}
      const arr =
        (Array.isArray(res) && res) ||
        (Array.isArray(res?.data) && res.data) ||
        (Array.isArray(res?.deliverables) && res.deliverables) ||
        (Array.isArray(res?.items) && res.items) ||
        [];

      if (Array.isArray(arr) && arr.length > 0) {
        const mapped = mapApiToRows(arr as DeliverableApi[]);
        setRows(mapped);
      }
      setApiLoaded(true);
    } catch (e: any) {
      setApiError("Could not fetch deliverables from API. Showing dummy data.");
      setApiLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliverables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const handleCreateDeliverable = async (payload: {
    title: string;
    description: string;
    url: UrlItem[];
  }) => {
    if (!campaignId) return;

    setSaving(true);
    setApiError(null);

    try {
      // POST /deliverable/create
      await post("/deliverable/create", {
        brandId,
        influencerId,
        campaignId,
        title: payload.title,
        description: payload.description,
        url: payload.url,
      });

      setAddOpen(false);

      // Re-fetch list to reflect API truth.
      await fetchDeliverables();
    } catch (e: any) {
      setApiError("Failed to add deliverables. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Deliverables</h1>
          <p className="mt-1 text-sm text-gray-600">
          </p>
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
        {!loading && apiLoaded && apiError &&(
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
              <span className="text-red-700">{apiError}</span>
          </div>
        )}
      </div>

      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header + Add button */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-gray-800">Deliverables submissions</p>

          <button
            onClick={() => setAddOpen(true)}
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-900 border border-gray-200 bg-white hover:bg-gradient-to-r hover:from-[#FFBF00] hover:to-[#FFDB58] transition-colors"
          >
            Add Deliverables
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="flex-1">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search draft, title, description, reason..."
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
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((r) => (
                <tr key={r.rowId} className="text-sm text-gray-800 align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-900">{r.deliverablesType}</div>
                    <div className="text-xs text-gray-500">Submitted: {formatIST(r.createdAt)}</div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-gray-900">{r.title}</div>
                    <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{r.description}</div>

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
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">{r.reason}</div>
                  </td>
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={4}>
                    No deliverables match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <AddDeliverablesModal
          saving={saving}
          onClose={() => setAddOpen(false)}
          onSave={handleCreateDeliverable}
        />
      )}
    </div>
  );
}

function AddDeliverablesModal({
  saving,
  onClose,
  onSave,
}: {
  saving: boolean;
  onClose: () => void;
  onSave: (payload: { title: string; description: string; url: UrlItem[] }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // multiple URLs
  const [rows, setRows] = useState<Array<{ label: string; url: string }>>([{ label: "", url: "" }]);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const addRow = () => setRows((prev) => [...prev, { label: "", url: "" }]);
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const setRow = (idx: number, key: "label" | "url", val: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  };

  const markTouched = (k: string) => setTouched((p) => ({ ...p, [k]: true }));

  const titleErr = !title.trim() ? "Title is required." : "";
  const descErr = !description.trim() ? "Description is required." : "";

  const rowErrors = rows.map((r) => {
    const labelOk = r.label.trim().length > 0;
    const urlOk = isValidUrlOrEmpty(r.url) && r.url.trim().length > 0;
    return {
      label: labelOk ? "" : "Label is required.",
      url: urlOk ? "" : "Valid URL is required.",
    };
  });

  const hasInvalid = Boolean(titleErr || descErr || rowErrors.some((e) => e.label || e.url));

  const handleSave = () => {
    if (hasInvalid) return;

    const url: UrlItem[] = rows.map((r) => ({
      label: r.label.trim(),
      url: normalizeUrl(r.url),
    }));

    onSave({
      title: title.trim(),
      description: description.trim(),
      url,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={saving ? undefined : onClose} />

      <div className="relative w-[92%] max-w-2xl bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add Deliverables</h2>
            <p className="text-sm text-gray-600 mt-1">Title, description, and one or more draft links.</p>
          </div>

          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFA135] disabled:opacity-60"
            title="Close"
          >
            <HiXMark size={20} className="text-gray-800" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Title + Description */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => markTouched("title")}
                placeholder="Instagram Reel - Product Demo"
                className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FFA135] ${
                  touched["title"] && titleErr ? "border-red-300" : "border-gray-300"
                }`}
              />
              {touched["title"] && titleErr && <p className="mt-1 text-xs font-medium text-red-600">{titleErr}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => markTouched("desc")}
                placeholder="30 sec reel with hook + CTA"
                className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FFA135] ${
                  touched["desc"] && descErr ? "border-red-300" : "border-gray-300"
                }`}
              />
              {touched["desc"] && descErr && <p className="mt-1 text-xs font-medium text-red-600">{descErr}</p>}
            </div>
          </div>

          {/* URL Rows */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-600">
              Draft Links
            </div>

            <div className="p-3 space-y-3">
              {rows.map((r, idx) => {
                const e = rowErrors[idx];
                const showLabelErr = touched[`label_${idx}`] && e.label;
                const showUrlErr = touched[`url_${idx}`] && e.url;

                return (
                  <div key={idx} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">Item {idx + 1}</p>

                      {rows.length > 1 && (
                        <button
                          onClick={() => removeRow(idx)}
                          disabled={saving}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-60"
                          title="Remove"
                        >
                          <HiTrash size={16} />
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Label</label>
                        <input
                          value={r.label}
                          onChange={(e2) => setRow(idx, "label", e2.target.value)}
                          onBlur={() => markTouched(`label_${idx}`)}
                          placeholder="Draft 1"
                          disabled={saving}
                          className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FFA135] disabled:opacity-60 ${
                            showLabelErr ? "border-red-300" : "border-gray-300"
                          }`}
                        />
                        {showLabelErr && <p className="mt-1 text-xs font-medium text-red-600">{e.label}</p>}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Url</label>
                        <input
                          value={r.url}
                          onChange={(e2) => setRow(idx, "url", e2.target.value)}
                          onBlur={() => markTouched(`url_${idx}`)}
                          placeholder="https://drive.google.com/..."
                          disabled={saving}
                          className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FFA135] disabled:opacity-60 ${
                            showUrlErr ? "border-red-300" : "border-gray-300"
                          }`}
                        />
                        {showUrlErr && <p className="mt-1 text-xs font-medium text-red-600">{e.url}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={addRow}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-900 border border-gray-200 hover:bg-gray-50 disabled:opacity-60"
              >
                <HiPlus size={18} />
                Add another URL
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500">All fields are required.</p>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-800 border border-gray-200 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={hasInvalid || saving}
              className={`rounded-md px-4 py-2 text-sm font-medium text-gray-900 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] hover:opacity-90 ${
                hasInvalid || saving ? "opacity-60 cursor-not-allowed" : ""
              }`}
              title={hasInvalid ? "Fill valid fields to save" : "Save"}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}