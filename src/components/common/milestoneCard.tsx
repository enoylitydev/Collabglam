"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { post } from "@/lib/api";
import { motion } from "framer-motion";
import Swal from "sweetalert2";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface MilestoneEntry {
  milestoneHistoryId: string;
  milestoneId: string;
  influencerId: string;
  campaignId: string;
  milestoneTitle: string;
  amount: number;
  milestoneDescription?: string;
  createdAt: string;
  /** payout status coming from backend: 'pending' | 'initiated' | 'paid' */
  status?: string;
  /** legacy flag: brand has released funds from their wallet */
  released?: boolean;
}

interface MilestoneHistoryCardProps {
  role: "brand" | "influencer";
  brandId?: string | null;
  influencerId?: string | null;
  campaignId?: string;
  className?: string;
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const formatCurrency = (amt: number) =>
  amt.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

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
          <span
            className={`w-4 h-4 rounded-full ${palette[role].dotSoft} animate-pulse`}
          />
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
  const [milestones, setMilestones] = useState<MilestoneEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* fetcher */
  const fetchMilestones = async () => {
    setLoading(true);
    setError(null);

    let endpoint = "";
    const body: Record<string, any> = {};

    // route logic mirrors original, but uses props
    if (role === "brand" && brandId) {
      body.brandId = brandId;
      if (campaignId) {
        endpoint = "/milestone/byCampaign";
        body.campaignId = campaignId;
      } else {
        endpoint = "/milestone/byBrand";
      }
    } else if (role === "influencer" && influencerId) {
      body.influencerId = influencerId;
      if (campaignId) {
        endpoint = "/milestone/getMilestome"; // influencer + campaign
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
      setMilestones(res.milestones);
    } catch (err: any) {
      setError(err.message || "Failed to load milestones");
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

  // ─── Status Renderer (brand + influencer) ───────────────────────────
  const renderStatus = (m: MilestoneEntry) => {
    // support either `status` or backend using `payoutStatus`
    const rawStatus: string | undefined =
      m.status || (m as any).payoutStatus || undefined;

    const badgeBase =
      "inline-block px-3 py-0.5 text-xs font-semibold rounded-full";

    // INFLUENCER VIEW
    if (role === "influencer") {
      // Admin approved → fully paid
      if (rawStatus === "paid") {
        return (
          <span className={`${badgeBase} bg-emerald-100 text-emerald-700`}>
            Paid
          </span>
        );
      }

      // Brand released, waiting on admin → initiated
      if (rawStatus === "initiated" || (m.released && !rawStatus)) {
        return (
          <span
            className={`${badgeBase} ${palette[role].full} text-gray-800`}
          >
            Initiated – expected within 24-48 Hrs
          </span>
        );
      }

      // Default: nothing released yet
      return (
        <span className={`${badgeBase} bg-gray-100 text-gray-600`}>
          Not received yet
        </span>
      );
    }

    // BRAND VIEW
    if (!m.released) {
      // Brand has not released this milestone yet → show CTA
      return (
        <div className="flex items-center gap-2 mt-2">
          <Button
            className={`${palette[role].full} text-white cursor-pointer`}
            onClick={() => releaseMilestone(m)}
          >
            Release Fund
          </Button>
        </div>
      );
    }

    // Brand has released funds
    if (rawStatus === "paid") {
      return (
        <span className={`${badgeBase} bg-emerald-100 text-emerald-700`}>
          Paid to influencer
        </span>
      );
    }

    // Released but admin has not yet marked as paid
    return (
      <span className={`${badgeBase} ${palette[role].full} text-white`}>
        Released (pending admin payout)
      </span>
    );
  };

  return (
    <div
      className={`relative p-6 bg-white/80 backdrop-blur-md border border-gray-100 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 ${className}`}
    >
      {/* header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className={`w-12 h-12 flex items-center justify-center rounded-full ${palette[role].full} shadow-md`}
        >
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414L9 13.414l4.707-4.707z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h3
          className={`text-xl font-extrabold bg-clip-text text-transparent ${palette[role].textGrad}`}
        >
          Milestone Timeline
        </h3>
      </div>

      {/* states */}
      {loading && <TimelineSkeleton role={role} rows={3} />}

      {!loading && error && (
        <div className="space-y-3">
          <p className="text-red-600 font-medium">{error}</p>
          <Button
            size="sm"
            variant="outline"
            className="border-red-400 text-red-600 hover:bg-red-50"
            onClick={fetchMilestones}
          >
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

      {/* timeline */}
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
                    <h4
                      className={`text-base font-semibold text-gray-900 transition-colors group-hover:${
                        role === "brand" ? "text-[#FF7236]" : "text-[#FFDB58]"
                      }`}
                    >
                      {m.milestoneTitle}
                    </h4>
                    <span className={`text-base font-bold ${palette[role].text}`}>
                      {formatCurrency(m.amount)}
                    </span>
                  </div>
                  <time className="block text-xs text-gray-500 italic">
                    {formatDate(m.createdAt)}
                  </time>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {m.milestoneDescription || "–"}
                  </p>

                  {/* ✅ Payment status / CTA */}
                  <div className="mt-2">
                    {renderStatus(m)}
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default MilestoneHistoryCard;
