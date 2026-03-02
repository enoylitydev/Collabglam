"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import Swal from "sweetalert2";

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface MilestoneEntry {
  milestoneHistoryId?: string;
  milestoneId?: string; // ✅ required for /milestone/release
  influencerId?: string;
  campaignId?: string;
  milestoneTitle?: string;
  amount?: number;
  milestoneDescription?: string;
  createdAt?: string;
  status?: string; // 'initiated' | 'paid' | etc
  released?: boolean;
}

type Props = {
  brandId: string;
  campaignId: string;
  influencerId: string;
  className?: string;
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const formatCurrency = (amt?: number) =>
  (Number.isFinite(Number(amt)) ? Number(amt) : 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

/* ─── Skeleton Loader (black/white) ──────────────────────────────────────── */
const TimelineSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="relative">
    <span className="absolute left-5 top-6 bottom-0 w-[2px] bg-gray-200" />
    <ol className="pl-16 space-y-8">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="relative flex gap-4 items-start">
          <span className="w-4 h-4 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-44 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />
            <div className="h-5 w-28 bg-gray-200 rounded animate-pulse" />
          </div>
        </li>
      ))}
    </ol>
  </div>
);

/* ─── Admin Milestone Card (Black/White UI) ─────────────────────────────── */
export default function AdminMilestoneHistoryCard({
  brandId,
  campaignId,
  influencerId,
  className = "",
}: Props) {
  const [milestones, setMilestones] = useState<MilestoneEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [releasingKey, setReleasingKey] = useState<string | null>(null);

  const canFetch = useMemo(
    () => Boolean(brandId && campaignId && influencerId),
    [brandId, campaignId, influencerId]
  );

  const fetchMilestones = useCallback(async () => {
    if (!canFetch) {
      setError("Missing brandId / campaignId / influencerId.");
      setMilestones([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await post<{ milestones: MilestoneEntry[] }>("/milestone/getMilestome", {
        brandId,
        campaignId,
        influencerId,
      });

      setMilestones(Array.isArray(res?.milestones) ? res.milestones : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load milestones.");
      setMilestones([]);
    } finally {
      setLoading(false);
    }
  }, [brandId, campaignId, influencerId, canFetch]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  const releaseMilestone = async (m: MilestoneEntry, key: string) => {
    const milestoneHistoryId = m.milestoneHistoryId;
    const milestoneId = m.milestoneId;

    if (!milestoneHistoryId || !milestoneId) {
      Swal.fire({
        icon: "error",
        title: "Missing IDs",
        text: "milestoneHistoryId / milestoneId is missing for this entry.",
        showConfirmButton: false,
        timer: 1800,
        timerProgressBar: true,
      });
      return;
    }

    try {
      setReleasingKey(key);

      await post("/milestone/release", {
        milestoneHistoryId,
        milestoneId,
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
        text: err?.message || "Failed to release milestone.",
        showConfirmButton: false,
        timer: 1800,
        timerProgressBar: true,
      });
    } finally {
      setReleasingKey(null);
    }
  };

  const renderStatus = (m: MilestoneEntry) => {
    const rawStatus: string | undefined = m.status || (m as any).payoutStatus || undefined;
    const badgeBase =
      "inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full border";

    if (rawStatus === "paid") {
      return <span className={`${badgeBase} bg-black text-white border-black`}>Paid</span>;
    }

    if (rawStatus === "initiated" || (m.released && !rawStatus)) {
      return (
        <span className={`${badgeBase} bg-black text-white border-black`}>
          Initiated – expected within 24-48 Hrs
        </span>
      );
    }

    if (m.released) {
      return (
        <span className={`${badgeBase} bg-white text-black border-gray-300`}>Released</span>
      );
    }

    return (
      <span className={`${badgeBase} bg-white text-black border-gray-300`}>
        Not released
      </span>
    );
  };

  return (
    <div
      className={`relative p-6 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 ${className}`}
    >
      {/* Header (black/white) */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 flex items-center justify-center rounded-full bg-black shadow-sm">
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414L9 13.414l4.707-4.707z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h3 className="text-xl font-extrabold text-black">Milestone Timeline</h3>
      </div>

      {!canFetch && (
        <div className="space-y-3">
          <p className="text-red-600 font-medium">Missing brandId / campaignId / influencerId.</p>
        </div>
      )}

      {canFetch && loading && <TimelineSkeleton rows={3} />}

      {canFetch && !loading && error && (
        <div className="space-y-3">
          <p className="text-red-600 font-medium">{error}</p>
          <Button size="sm" variant="outline" onClick={fetchMilestones}>
            Retry
          </Button>
        </div>
      )}

      {canFetch && !loading && !error && milestones.length === 0 && (
        <div className="space-y-3">
          <p className="text-gray-600 italic">No milestones found.</p>
          <Button size="sm" variant="outline" onClick={fetchMilestones}>
            Refresh
          </Button>
        </div>
      )}

      {canFetch && !loading && !error && milestones.length > 0 && (
        <div className="relative">
          <span className="absolute left-5 top-0 bottom-0 w-[2px] bg-gray-200" />
          <ol className="pl-16 space-y-8">
            {milestones.map((m, idx) => {
              const key =
                m.milestoneHistoryId || m.milestoneId || `${idx}-${m.createdAt || "na"}`;
              const isReleasing = releasingKey === key;

              return (
                <motion.li
                  key={key}
                  className="relative flex gap-4 items-start group"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.35 }}
                >
                  {/* No white dot, keep simple black dot */}
                  <span className="w-4 h-4 mt-1 rounded-full bg-black" />

                  {/* White card, black text */}
                  <div className="flex-1 space-y-1 bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="flex justify-between items-center gap-3">
                      <h4 className="text-base font-semibold text-black">
                        {m.milestoneTitle || "—"}
                      </h4>
                      <span className="text-base font-bold text-black">
                        {formatCurrency(m.amount)}
                      </span>
                    </div>

                    <time className="block text-xs text-gray-600 italic">
                      {formatDate(m.createdAt)}
                    </time>

                    <p className="text-sm text-gray-800 leading-relaxed">
                      {m.milestoneDescription || "–"}
                    </p>

                    {/* Status + Release button logic */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {!m.released && (
                        <Button
                          className="bg-black text-white hover:bg-black/90"
                          onClick={() => releaseMilestone(m, key)}
                          disabled={isReleasing}
                        >
                          {isReleasing ? "Releasing..." : "Release Fund"}
                        </Button>
                      )}

                      {renderStatus(m)}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}