"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { post } from "@/lib/api";

type Milestone = {
  influencerId: string;
  campaignId: string;
  milestoneTitle: string;
  amount: number;
  milestoneDescription: string;
  razorpayFee: number;
  totalWithFee: number;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  released: boolean;
  payoutStatus: "pending" | "processing" | "paid" | "failed" | string;
  createdAt: string;
  milestoneHistoryId: string;
  updatedAt: string;
  brandId: string;
  milestoneId: string;
  walletBalance?: number;

  // ✅ coming from your API now
  influencerName?: string;
};

type ApiResponse = {
  message: string;
  milestones: Milestone[];
};

function formatINR(value: number) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `₹${value}`;
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ value }: { value: string }) {
  const cls =
    value === "paid"
      ? "bg-green-50 text-green-700 ring-green-200"
      : value === "failed"
      ? "bg-red-50 text-red-700 ring-red-200"
      : value === "processing"
      ? "bg-blue-50 text-blue-700 ring-blue-200"
      : "bg-yellow-50 text-yellow-800 ring-yellow-200";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ${cls}`}>
      {value}
    </span>
  );
}

function YesNoPill({ yes }: { yes: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ${
        yes ? "bg-green-50 text-green-700 ring-green-200" : "bg-neutral-100 text-neutral-700 ring-neutral-200"
      }`}
    >
      {yes ? "Yes" : "No"}
    </span>
  );
}

/**
 * ✅ Supports BOTH:
 * 1) /campaign/milestone/[campaignId]
 * 2) /campaign/milestone?campaignId=xxx
 *
 * ✅ Hides ALL IDs from UI
 * ✅ Shows Influencer Name in table + details
 */
export default function CampaignMilestonePage() {
  const params = useParams<{ campaignId?: string }>();
  const searchParams = useSearchParams();

  const campaignId =
    (typeof params?.campaignId === "string" && params.campaignId) ||
    searchParams.get("campaignId") ||
    "";

  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Milestone | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return milestones;

    return milestones.filter((m) => {
      return (
        (m.milestoneTitle || "").toLowerCase().includes(q) ||
        (m.milestoneDescription || "").toLowerCase().includes(q) ||
        String(m.payoutStatus || "").toLowerCase().includes(q) ||
        (m.influencerName || "").toLowerCase().includes(q)
      );
    });
  }, [milestones, query]);

  const fetchMilestones = useCallback(async () => {
    if (!campaignId) {
      setError("Campaign ID missing in route or query params.");
      setMilestones([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await post<ApiResponse>("/milestone/byCampaign", { campaignId });
      setMilestones(Array.isArray(data?.milestones) ? data.milestones : []);
    } catch (e: any) {
      setError(e?.message || "Something went wrong while fetching milestones.");
      setMilestones([]);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  const totalAmount = useMemo(() => milestones.reduce((sum, m) => sum + (m.amount || 0), 0), [milestones]);
  const totalFee = useMemo(() => milestones.reduce((sum, m) => sum + (m.razorpayFee || 0), 0), [milestones]);
  const totalWithFee = useMemo(() => milestones.reduce((sum, m) => sum + (m.totalWithFee || 0), 0), [milestones]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900">Milestones</h1>
            {/* ✅ hide campaignId from UI */}
            <p className="mt-1 text-sm text-neutral-600">All milestones for this campaign</p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title / status / influencer..."
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-200"
              />
            </div>
            <button
              onClick={fetchMilestones}
              className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 active:scale-[0.99]"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Totals */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
            <div className="text-xs text-neutral-500">Total Amount</div>
            <div className="mt-1 text-lg font-semibold text-neutral-900">{formatINR(totalAmount)}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
            <div className="text-xs text-neutral-500">Total Razorpay Fee</div>
            <div className="mt-1 text-lg font-semibold text-neutral-900">{formatINR(totalFee)}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
            <div className="text-xs text-neutral-500">Total With Fee</div>
            <div className="mt-1 text-lg font-semibold text-neutral-900">{formatINR(totalWithFee)}</div>
          </div>
        </div>

        {/* Table Card */}
        <div className="mt-6 rounded-2xl bg-white shadow-sm ring-1 ring-neutral-200">
          <div className="border-b border-neutral-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-neutral-900">
                Results <span className="text-neutral-500">({filtered.length})</span>
              </div>
              {loading ? <div className="text-xs text-neutral-500">Loading…</div> : null}
            </div>
          </div>

          {error ? (
            <div className="px-4 py-4">
              <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">{error}</div>
            </div>
          ) : null}

          {!loading && !error && filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-neutral-600">No milestones found for this campaign.</div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-600">
                <tr>
                  <th className="px-4 py-3">Influencer</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Fee</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Released</th>
                  <th className="px-4 py-3">Payout</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-200">
                {filtered.map((m) => (
                  <tr key={m.milestoneHistoryId} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-medium text-neutral-900">
                      {m.influencerName?.trim() ? m.influencerName : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-neutral-900">{m.milestoneTitle || "—"}</td>
                    <td className="px-4 py-3 text-neutral-700">{m.milestoneDescription || "—"}</td>
                    <td className="px-4 py-3">{formatINR(m.amount || 0)}</td>
                    <td className="px-4 py-3">{formatINR(m.razorpayFee || 0)}</td>
                    <td className="px-4 py-3">{formatINR(m.totalWithFee || 0)}</td>
                    <td className="px-4 py-3">
                      <YesNoPill yes={!!m.released} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={m.payoutStatus || "pending"} />
                    </td>
                    <td className="px-4 py-3 text-neutral-700">{m.createdAt ? formatDate(m.createdAt) : "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(m)}
                        className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-100"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {milestones.length > 0 && (
            <div className="border-t border-neutral-200 px-4 py-3 text-xs text-neutral-500">
              Tip: Search by influencer name, title, description, or payout status.
            </div>
          )}
        </div>
      </div>

      {/* Details Modal (NO IDs) */}
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-neutral-200">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
              <div>
                <div className="text-sm text-neutral-500">Milestone Details</div>
                <h2 className="mt-1 text-lg font-semibold text-neutral-900">{selected.milestoneTitle || "—"}</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Influencer:{" "}
                  <span className="font-medium text-neutral-800">
                    {selected.influencerName?.trim() ? selected.influencerName : "—"}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Close
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <StatBox label="Amount" value={formatINR(selected.amount || 0)} />
                <StatBox label="Razorpay Fee" value={formatINR(selected.razorpayFee || 0)} />
                <StatBox label="Total With Fee" value={formatINR(selected.totalWithFee || 0)} />
                <div className="rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
                  <div className="text-xs text-neutral-500">Payout Status</div>
                  <div className="mt-1">
                    <StatusPill value={selected.payoutStatus || "pending"} />
                  </div>
                </div>
                <StatBox label="Released" value={selected.released ? "Yes" : "No"} />
                <StatBox label="Created At" value={selected.createdAt ? formatDate(selected.createdAt) : "—"} />
                <StatBox label="Updated At" value={selected.updatedAt ? formatDate(selected.updatedAt) : "—"} />
                <StatBox
                  label="Wallet Balance"
                  value={typeof selected.walletBalance === "number" ? formatINR(selected.walletBalance) : "—"}
                />
              </div>

              <div className="mt-4 rounded-xl border border-neutral-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Description</div>
                <div className="mt-2 text-sm text-neutral-800">{selected.milestoneDescription || "—"}</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-4">
              <button
                onClick={() => setSelected(null)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-0.5 font-semibold text-neutral-900">{value}</div>
    </div>
  );
}