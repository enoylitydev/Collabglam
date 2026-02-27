"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { post } from "@/lib/api";
import { motion } from "framer-motion";
import Swal from "sweetalert2";
import { HiPlus, HiTrash, HiXMark } from "react-icons/hi2";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface MilestoneEntry {
  milestoneHistoryId: string;
  milestoneId: string; // ✅ comes from getMilestome response
  influencerId: string;
  campaignId: string;
  milestoneTitle: string;
  amount: number;
  milestoneDescription?: string;
  createdAt: string;
  status?: string; // 'initiated' | 'paid' (or undefined)
  released?: boolean;
}

interface MilestoneHistoryCardProps {
  role: "brand" | "influencer";
  brandId?: string | null;
  influencerId?: string | null;
  campaignId?: string; // in your parent, you pass campaignsId UUID here
  className?: string;
}

type UrlItem = { label: string; url: string };

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const formatCurrency = (amt: number) =>
  amt.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

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

const palette = {
  brand: {
    full: "bg-gradient-to-r from-[#FFA135] to-[#FF7236]",
    soft: "bg-gradient-to-r from-[#FFA135]/15 to-[#FF7236]/15",
    line: "bg-gradient-to-b from-[#FFB64C]/50 to-[#FF7236]/50",
    dot: "bg-gradient-to-r from-[#FFA135] to-[#FF7236]",
    dotSoft: "bg-gradient-to-r from-[#FFA135]/30 to-[#FF7236]/30",
    textGrad: "bg-gradient-to-r from-[#FFA135] to-[#FF7236]",
    text: "text-gray-800",
  },
  influencer: {
    full: "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800",
    soft: "bg-gradient-to-r from-[#FFBF00]/15 to-[#FFDB58]/15",
    line: "bg-gradient-to-b from-[#FFBF00]/50 to-[#FFDB58]/50",
    dot: "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58]",
    dotSoft: "bg-gradient-to-r from-[#FFBF00]/30 to-[#FFDB58]/30",
    textGrad: "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800",
    text: "text-gray-800",
  },
};

// ─── Skeleton Loader ───────────────────────────────────────────────────────────
const TimelineSkeleton: React.FC<{ rows?: number; role: "brand" | "influencer" }> = ({
  rows = 3,
  role,
}) => (
  <div className="relative">
    <span className={`absolute left-5 top-6 bottom-0 w-[2px] ${palette[role].line}`} />
    <ol className="pl-16 space-y-8">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="relative flex gap-4 items-start">
          <span className={`w-4 h-4 rounded-full ${palette[role].dotSoft} animate-pulse`} />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-44 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
        </li>
      ))}
    </ol>
  </div>
);

/* ── Main Card ─────────────────────────────────────────────────────── */
const MilestoneHistoryCard: React.FC<MilestoneHistoryCardProps> = ({
  role,
  brandId,
  influencerId,
  campaignId,
  className = "",
}) => {
  const router = useRouter();

  const [milestones, setMilestones] = useState<MilestoneEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ modal state
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // ✅ store the "particular milestone" for which we are adding deliverables
  const [targetMilestone, setTargetMilestone] = useState<MilestoneEntry | null>(null);

  // ✅ helper: button should appear ONLY when payment NOT initiated AND NOT paid
  const canAddDeliverablesFor = (m: MilestoneEntry) => {
    const rawStatus: string | undefined = m.status || (m as any).payoutStatus || undefined;
    const initiatedLike = rawStatus === "initiated" || (m.released && !rawStatus);
    const paidLike = rawStatus === "paid";
    return !initiatedLike && !paidLike; // => "Not received yet"
  };

  /* fetcher */
  const fetchMilestones = async () => {
    setLoading(true);
    setError(null);

    let endpoint = "";
    const body: Record<string, any> = {};

    if (role === "brand" && brandId) {
      body.brandId = brandId;

      if (campaignId && !influencerId) {
        endpoint = "/milestone/byCampaign";
        body.campaignId = campaignId;
      } else if (campaignId && influencerId) {
        endpoint = "/milestone/getMilestome";
        body.campaignId = campaignId;
        body.influencerId = influencerId;
      } else {
        endpoint = "/milestone/byBrand";
      }
    } else if (role === "influencer" && influencerId) {
      body.influencerId = influencerId;

      if (campaignId) {
        endpoint = "/milestone/getMilestome";
        body.campaignId = campaignId;
      } else {
        endpoint = "/milestone/byInfluencer";
      }
    } else {
      setError("Missing required ID for the selected role.");
      setLoading(false);
      return;
    }

    try {
      const res = await post<{ milestones: MilestoneEntry[] }>(endpoint, body);
      const list = Array.isArray(res?.milestones) ? res.milestones : [];
      setMilestones(list);
    } catch (err: any) {
      setError(err.message || "Failed to load milestones");
      setMilestones([]);
    } finally {
      setLoading(false);
    }
  };

  /* release payment (brand → admin) */
  const releaseMilestone = async (m: MilestoneEntry) => {
    try {
      await post("/milestone/release", {
        milestoneHistoryId: m.milestoneHistoryId,
        milestoneId: m.milestoneId,
      });

      Swal.fire({
        icon: "success",
        title: "Milestone released",
        text: "Payment has been initiated and sent to admin for processing.",
        showConfirmButton: false,
        timer: 1800,
        timerProgressBar: true,
      });

      fetchMilestones();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message,
        showConfirmButton: false,
        timer: 1800,
        timerProgressBar: true,
      });
    }
  };

  useEffect(() => {
    fetchMilestones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, influencerId, campaignId, role]);

  // ✅ create deliverable from modal (campaignsId + milestoneId of THAT milestone)
  // ✅ create deliverable from modal (campaignId + milestoneHistoryId of THAT milestone)
  const handleCreateDeliverable = async (payload: {
    title: string;
    description: string;
    url: UrlItem[];
  }) => {
    const campaignsId = campaignId || targetMilestone?.campaignId; // UUID
    const milestoneId = targetMilestone?.milestoneId; // root milestoneId
    const milestoneHistoryId = targetMilestone?.milestoneHistoryId; // ✅ IMPORTANT

    if (!campaignsId || !milestoneHistoryId) return;

    const brandFromLS =
      brandId ||
      (typeof window !== "undefined" ? localStorage.getItem("brandId") : null) ||
      "B001";

    const influencerFromLS =
      influencerId ||
      (typeof window !== "undefined" ? localStorage.getItem("influencerId") : null) ||
      "I001";

    setSaving(true);
    setError(null);

    try {
      await post("/deliverable/create", {
        brandId: brandFromLS,
        influencerId: influencerFromLS,

        // ✅ keep both keys if your backend still supports both
        campaignId: campaignsId,
        campaignsId, // optional backward compat

        // ✅ send BOTH (backend can derive milestoneId from historyId too)
        milestoneHistoryId, // ✅ required for title fetch
        milestoneId,        // optional but good to send

        title: payload.title,
        description: payload.description,
        url: payload.url,
      });

      setAddOpen(false);
      setTargetMilestone(null);

      Swal.fire({
        icon: "success",
        title: "Deliverables added",
        text: "Your deliverables have been submitted successfully.",
        showConfirmButton: false,
        timer: 1600,
        timerProgressBar: true,
      });
    } catch {
      Swal.fire({
        icon: "error",
        title: "Failed",
        text: "Failed to add deliverables. Please try again.",
        showConfirmButton: false,
        timer: 1800,
        timerProgressBar: true,
      });
    } finally {
      setSaving(false);
    }
  };

  // ─── Status Renderer (brand + influencer) ───────────────────────────
  const renderStatus = (m: MilestoneEntry) => {
    const rawStatus: string | undefined = m.status || (m as any).payoutStatus || undefined;
    const badgeBase = "inline-block px-3 py-0.5 text-xs font-semibold rounded-full";

    // INFLUENCER VIEW
    if (role === "influencer") {
      const statusBadge =
        rawStatus === "paid" ? (
          <span className={`${badgeBase} ${palette[role].full} text-white`}>Paid</span>
        ) : rawStatus === "initiated" || (m.released && !rawStatus) ? (
          <span className={`${badgeBase} ${palette[role].full} text-white`}>
            Initiated – expected within 24-48 Hrs
          </span>
        ) : (
          <span className={`${badgeBase} ${palette[role].soft} ${palette[role].text}`}>
            Not received yet
          </span>
        );

      return (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* ✅ show button ONLY for this milestone when payment is NOT received yet */}
          {canAddDeliverablesFor(m) && (
            <Button
              className={`${palette[role].full} cursor-pointer`}
              onClick={() => {
                setTargetMilestone(m); // ✅ store this milestone (has milestoneId)
                setAddOpen(true);
              }}
            >
              Add Deliverables
            </Button>
          )}

          {statusBadge}
        </div>
      );
    }

    // BRAND VIEW
    if (!m.released) {
      return (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Button className={`${palette[role].full} text-white`} onClick={() => releaseMilestone(m)}>
            Release Fund
          </Button>

          <Button
            variant="outline"
            className="border-gray-300 text-gray-800 hover:bg-gray-50"
            onClick={() => router.push(`/brand/deleverables?campaignId=${m.campaignId}`)}
          >
            View Deliverables
          </Button>
        </div>
      );
    }

    if (rawStatus === "paid") {
      return <span className={`${badgeBase} ${palette[role].full} text-white`}>Paid</span>;
    }

    return <span className={`${badgeBase} ${palette[role].soft} ${palette[role].text}`}>Released</span>;
  };

  return (
    <div
      className={`relative p-6 bg-white/80 backdrop-blur-md border border-gray-100 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 ${className}`}
    >
      {/* header (✅ removed top button) */}
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-12 h-12 flex items-center justify-center rounded-full ${palette[role].full} shadow-md`}>
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414L9 13.414l4.707-4.707z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h3 className={`text-xl font-extrabold bg-clip-text text-transparent ${palette[role].textGrad}`}>
          Milestone Timeline
        </h3>
      </div>

      {loading && <TimelineSkeleton role={role} rows={3} />}

      {!loading && error && (
        <div className="space-y-3">
          <p className="text-red-600 font-medium">{error}</p>
          <Button size="sm" variant="outline" onClick={fetchMilestones}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && milestones.length === 0 && (
        <div className="space-y-3">
          <p className="text-gray-600 italic">No milestones found.</p>
          <Button size="sm" variant="outline" onClick={fetchMilestones}>
            Refresh
          </Button>
        </div>
      )}

      {!loading && !error && milestones.length > 0 && (
        <div className="relative">
          <span className={`absolute left-5 top-0 bottom-0 w-[2px] ${palette[role].line}`} />
          <ol className="pl-16 space-y-8">
            {milestones.map((m, idx) => (
              <motion.li
                key={m.milestoneHistoryId}
                className="relative flex gap-4 items-start group"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.4 }}
              >
                <span
                  className={`w-5 h-5 mt-1 rounded-full ${palette[role].dot} shadow-md group-hover:scale-110 transition-transform duration-300`}
                />

                <div
                  className={`flex-1 space-y-1 ${palette[role].soft} backdrop-blur-md p-4 rounded-xl shadow-md hover:shadow-lg transition-all duration-300`}
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-base font-semibold text-gray-900">{m.milestoneTitle}</h4>
                    <span className={`text-base font-bold ${palette[role].text}`}>
                      {formatCurrency(m.amount)}
                    </span>
                  </div>

                  <time className="block text-xs text-gray-500 italic">{formatDate(m.createdAt)}</time>

                  <p className="text-sm text-gray-700 leading-relaxed">{m.milestoneDescription || "–"}</p>

                  <div className="mt-2">{renderStatus(m)}</div>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      )}

      {/* ✅ Modal opens for the clicked milestone */}
      {addOpen && targetMilestone && (
        <AddDeliverablesModal
          saving={saving}
          onClose={() => {
            setAddOpen(false);
            setTargetMilestone(null);
          }}
          onSave={handleCreateDeliverable}
        />
      )}
    </div>
  );
};

export default MilestoneHistoryCard;

// ─── Modal (same as your deliverable page) ─────────────────────────────────────
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
    return { label: labelOk ? "" : "Label is required.", url: urlOk ? "" : "Valid URL is required." };
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
                className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FFA135] ${touched["title"] && titleErr ? "border-red-300" : "border-gray-300"
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
                className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FFA135] ${touched["desc"] && descErr ? "border-red-300" : "border-gray-300"
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
                          className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FFA135] disabled:opacity-60 ${showLabelErr ? "border-red-300" : "border-gray-300"
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
                          className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#FFA135] disabled:opacity-60 ${showUrlErr ? "border-red-300" : "border-gray-300"
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
              className={`rounded-md px-4 py-2 text-sm font-medium text-gray-900 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] hover:opacity-90 ${hasInvalid || saving ? "opacity-60 cursor-not-allowed" : ""
                }`}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}