"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface MilestoneEntry {
  milestoneHistoryId?: string;
  milestoneId?: string;
  influencerId?: string;
  campaignId?: string;
  milestoneTitle?: string;
  amount?: number;
  milestoneDescription?: string;
  createdAt?: string;
  status?: string;
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
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
};

const formatCurrency = (amt?: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(Number(amt)) ? Number(amt) : 0);

export default function AdminMilestoneHistoryCard({
  brandId,
  campaignId,
  influencerId,
  className = "",
}: Props) {
  const [milestones, setMilestones] = useState<MilestoneEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canFetch = useMemo(
    () => Boolean(brandId && campaignId && influencerId),
    [brandId, campaignId, influencerId]
  );

  const fetchMilestones = useCallback(async () => {
    if (!canFetch) {
      setError("Missing brandId / campaignId / influencerId.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ✅ REQUIRED PAYLOAD
      const res = await post<{ milestones: MilestoneEntry[] }>(
        "/milestone/getMilestome",
        {
          brandId,
          campaignId,
          influencerId,
        }
      );

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

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-black">Milestones</h3>
        <Button
          variant="outline"
          size="sm"
          className="border-gray-300 hover:bg-gray-100"
          onClick={fetchMilestones}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {!canFetch ? (
        <p className="text-sm text-red-600">
          Missing brandId / campaignId / influencerId.
        </p>
      ) : loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : milestones.length === 0 ? (
        <p className="text-sm text-gray-600">No milestones found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
            <thead className="bg-black text-white">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Title</th>
                <th className="px-3 py-2 text-left font-medium">Amount</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m, idx) => {
                const key =
                  m.milestoneHistoryId ||
                  m.milestoneId ||
                  `${idx}-${m.createdAt || "na"}`;

                return (
                  <tr
                    key={key}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-black">
                        {m.milestoneTitle || "—"}
                      </div>
                      {m.milestoneDescription ? (
                        <div className="text-xs text-gray-600">
                          {m.milestoneDescription}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-black">
                      {formatCurrency(m.amount)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full border border-gray-300 px-2 py-0.5 text-xs font-semibold text-black bg-white">
                        {m.status || (m.released ? "Released" : "—")}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">
                      {formatDate(m.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}