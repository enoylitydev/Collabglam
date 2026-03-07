"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { get, post } from "@/lib/api";
import Swal from "sweetalert2";
import { HiPlus, HiTrash, HiXMark } from "react-icons/hi2";

type ReviewStatus = "approved" | "pending" | "rejected" | "revision";
type UrlItem = { label: string; url: string };

type DeliverableApi = {
  _id?: string;
  id?: string;

  // ✅ your model id
  delieverableApprovalId?: string;

  brandId?: string;
  influencerId?: string;

  campaignsId?: string;
  campaignId?: string;

  milestoneId?: string;
  milestoneHistoryId?: string;

  title?: string;
  description?: string;
  url?: UrlItem[];

  status?: string;

  comments?: string;
  reason?: string;

  createdAt?: string;
  updatedAt?: string;
  updatedDate?: string;

  milestoneTitle?: string;
};

type DeliverableRow = {
  rowId: string;

  // group key info
  deliverableId?: string; // _id/id (if present)
  delieverableApprovalId?: string;

  campaignId?: string;
  milestoneId?: string;
  milestoneHistoryId?: string;

  // show only once per deliverable
  isFirstRow: boolean;

  deliverablesType: string;
  milestoneTitle: string;

  title: string;
  description: string;
  status: ReviewStatus;
  reason: string;

  linkUrl: string;
  createdAt: string;

  // full urls for modal prefill
  urls: UrlItem[];
};

const UPDATE_REVISION_ENDPOINT = "/deliverable/updateRevision";

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

const normalizeUrlForView = (value: string) => {
  const v = (value || "").trim();
  if (!v) return "";
  const withProto =
    v.startsWith("http://") || v.startsWith("https://") ? v : `https://${v}`;
  return encodeURI(withProto);
};

const normalizeUrlForSave = (value: string) => {
  const v = (value || "").trim();
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `https://${v}`;
};

const isValidUrlOrEmpty = (value: string) => {
  const v = (value || "").trim();
  if (!v) return true;
  try {
    const u = new URL(normalizeUrlForSave(v));
    return Boolean(u.hostname);
  } catch {
    return false;
  }
};

const toStatus = (s: any): ReviewStatus => {
  const v = String(s || "pending").toLowerCase();
  if (v === "approved" || v === "aproved") return "approved";
  if (v === "rejected") return "rejected";
  if (v === "revision") return "revision";
  if (v === "changes_needed" || v === "changes needed" || v === "changes")
    return "revision";
  return "pending";
};

const isApprovedStatus = (s: any) => {
  const v = String(s || "").trim().toLowerCase();
  return v === "approved" || v === "aproved";
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
    const approvalId = it.delieverableApprovalId;

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

    // unique base key
    const baseKey = approvalId
      ? String(approvalId)
      : deliverableId
      ? String(deliverableId)
      : `noid_${itemIdx}_${createdAt}`;

    if (urls.length === 0) {
      out.push({
        rowId: `${baseKey}_0`,
        deliverableId,
        delieverableApprovalId: approvalId,
        campaignId: it.campaignId || it.campaignsId,
        milestoneId: it.milestoneId,
        milestoneHistoryId: it.milestoneHistoryId,
        isFirstRow: true,
        deliverablesType: "Draft",
        milestoneTitle,
        title,
        description,
        status,
        reason,
        linkUrl: "",
        createdAt,
        urls: [],
      });
      return;
    }

    urls.forEach((u, urlIdx) => {
      out.push({
        rowId: `${baseKey}_${urlIdx}`,
        deliverableId,
        delieverableApprovalId: approvalId,
        campaignId: it.campaignId || it.campaignsId,
        milestoneId: it.milestoneId,
        milestoneHistoryId: it.milestoneHistoryId,
        isFirstRow: urlIdx === 0,
        deliverablesType: u.label || `Draft ${urlIdx + 1}`,
        milestoneTitle,
        title,
        description,
        status,
        reason,
        linkUrl: u.url || "",
        createdAt,
        urls,
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

  // ✅ modal state (revision)
  const [revOpen, setRevOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [target, setTarget] = useState<DeliverableRow | null>(null);

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
    } catch {
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

  // ✅ open revision modal from row
  const openRevision = (r: DeliverableRow) => {
    setTarget(r);
    setRevOpen(true);
  };

  const closeRevision = () => {
    if (saving) return;
    setRevOpen(false);
    setTarget(null);
  };

  const handleSubmitRevision = async (payload: { title: string; description: string; url: UrlItem[] }) => {
    if (!target) return;

    const approvalId = target.delieverableApprovalId;
    if (!approvalId) {
      Swal.fire({
        icon: "error",
        title: "Missing deliverable ID",
        text: "delieverableApprovalId not found for this deliverable.",
        timer: 1800,
        showConfirmButton: false,
      });
      return;
    }

    setSaving(true);
    try {
      await post(UPDATE_REVISION_ENDPOINT, {
        delieverableApprovalId: approvalId,
        campaignId: target.campaignId || campaignId,
        milestoneHistoryId: target.milestoneHistoryId,
        milestoneId: target.milestoneId,

        // locked title
        title: payload.title,
        description: payload.description,
        url: payload.url,
      });

      Swal.fire({
        icon: "success",
        title: "Revision submitted",
        text: "Your revision has been submitted successfully.",
        showConfirmButton: false,
        timer: 1600,
        timerProgressBar: true,
      });

      closeRevision();
      fetchDeliverables();
    } catch (e: any) {
      Swal.fire({
        icon: "error",
        title: "Failed",
        text: e?.message || "Failed to submit revision.",
        showConfirmButton: false,
        timer: 1800,
        timerProgressBar: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const revisionInitial = useMemo(() => {
    if (!target) return null;

    const base = (target.title || "Deliverable").trim();
    const revisedTitle = base.toLowerCase().startsWith("revised") ? base : `Revised - ${base}`;

    const urls = Array.isArray(target.urls) && target.urls.length ? target.urls : [{ label: "", url: "" }];

    return {
      title: revisedTitle,
      description: target.description || "",
      url: urls,
    };
  }, [target]);

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
          <p className="text-sm font-medium text-gray-800">Deliverables submissions</p>
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
              {filteredRows.map((r) => {
                const showRevisionButton = r.isFirstRow && !isApprovedStatus(r.status);

                return (
                  <tr key={r.rowId} className="text-sm text-gray-800 align-top">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{r.deliverablesType}</div>
                      <div className="text-xs text-gray-500">Submitted: {formatIST(r.createdAt)}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-gray-900">{r.milestoneTitle}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-gray-900">{r.title}</div>
                      <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{r.description}</div>

                      {r.linkUrl && (
                        <a
                          href={normalizeUrlForView(r.linkUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-xs font-semibold text-gray-800 hover:underline break-all"
                        >
                          Open link ↗
                        </a>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusPill(
                            r.status
                          )}`}
                        >
                          {statusLabel(r.status)}
                        </span>

                        {/* ✅ Add Revision button UNDER the status pill */}
                        {showRevisionButton && (
                          <button
                            onClick={() => openRevision(r)}
                            disabled={saving}
                            className="rounded-md px-3 py-1.5 text-xs font-semibold border border-gray-300 text-gray-900 hover:bg-gray-50 disabled:opacity-60"
                            title="Add Revision"
                          >
                            Add Revision
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-800 whitespace-pre-wrap">{r.reason}</div>
                    </td>
                  </tr>
                );
              })}

              {filteredRows.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={5}>
                    No deliverables found for this campaign.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ✅ Same modal for Add Revision */}
      {revOpen && target && revisionInitial && (
        <AddDeliverablesModal
          saving={saving}
          onClose={closeRevision}
          onSave={handleSubmitRevision}
          initialTitle={revisionInitial.title}
          initialDescription={revisionInitial.description}
          initialUrls={revisionInitial.url}
          lockTitle={true}
        />
      )}
    </div>
  );
}

// ─── Modal (same as before) ───────────────────────────────────────────
function AddDeliverablesModal({
  saving,
  onClose,
  onSave,
  initialTitle,
  initialDescription,
  initialUrls,
  lockTitle,
}: {
  saving: boolean;
  onClose: () => void;
  onSave: (payload: { title: string; description: string; url: UrlItem[] }) => void;
  initialTitle?: string;
  initialDescription?: string;
  initialUrls?: UrlItem[];
  lockTitle?: boolean;
}) {
  const [title, setTitle] = useState(initialTitle || "");
  const [description, setDescription] = useState(initialDescription || "");
  const [rows, setRows] = useState<Array<{ label: string; url: string }>>(
    initialUrls && initialUrls.length ? initialUrls : [{ label: "", url: "" }]
  );
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setTitle(initialTitle || "");
    setDescription(initialDescription || "");
    setRows(initialUrls && initialUrls.length ? initialUrls : [{ label: "", url: "" }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTitle, initialDescription, JSON.stringify(initialUrls || [])]);

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
    return { label: labelOk ? "" : "Label is required.", url: urlOk ? "" : "Valid URL is required." };
  });

  const hasInvalid = Boolean(titleErr || descErr || rowErrors.some((e) => e.label || e.url));

  const handleSave = () => {
    if (hasInvalid) return;

    const url: UrlItem[] = rows.map((r) => ({
      label: r.label.trim(),
      url: normalizeUrlForSave(r.url),
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
            <h2 className="text-lg font-semibold text-gray-900">{lockTitle ? "Add Revision" : "Add Deliverables"}</h2>
            <p className="text-sm text-gray-600 mt-1">Title, description, and one or more draft links.</p>
          </div>

          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-md hover:bg-gray-100 focus:outline-none disabled:opacity-60"
            title="Close"
          >
            <HiXMark size={20} className="text-gray-800" />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => markTouched("title")}
                placeholder="Instagram Reel - Product Demo"
                readOnly={!!lockTitle}
                disabled={saving || !!lockTitle}
                className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FFA135] disabled:opacity-60 ${
                  touched["title"] && titleErr ? "border-red-300" : "border-gray-300"
                }`}
              />
              {touched["title"] && titleErr && <p className="mt-1 text-xs font-medium text-red-600">{titleErr}</p>}
              {lockTitle && (
                <p className="mt-1 text-[11px] text-gray-500">
                  Title is locked for revision (auto-prefixed with “Revised -”).
                </p>
              )}
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

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 text-xs font-semibold text-gray-600">Draft Links</div>

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
            >
              {saving ? "Saving..." : "Submit Revision"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}