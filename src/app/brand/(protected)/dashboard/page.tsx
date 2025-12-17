"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  HiOutlineChartBar,
  HiOutlineUsers,
  HiOutlineCurrencyDollar,
  HiSearch,
} from "react-icons/hi";
import { format } from "date-fns";
import { post } from "@/lib/api";

type CampaignRow = {
  id: string;
  campaignsId: string;
  productOrServiceName: string;
  goal: string;
  budget: number;
  isActive: number;
  createdAt: string | null;

  hasAcceptedInfluencer: boolean;
  influencerId: string | null;
  contractId: string | null;

  // ✅ per-campaign applied influencers (distinct)
  appliedInfluencersCount: number;
};

type BrandDashboardHomePayload = {
  brandName: string;
  totalCreatedCampaigns: number;
  totalHiredInfluencers: number;

  // ✅ sum of per-campaign applied counts (matches table totals)
  totalAppliedInfluencers: number;

  budgetRemaining: number;

  campaignsMode: "all" | "accepted";
  campaigns: CampaignRow[];
};

export default function BrandDashboardHome() {
  const router = useRouter();

  const [data, setData] = useState<BrandDashboardHomePayload | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const today = format(new Date(), "MMMM d, yyyy");
  const accentFrom = "#FFA135";
  const accentTo = "#FF7236";

  useEffect(() => {
    const brandId =
      typeof window !== "undefined" ? localStorage.getItem("brandId") : null;

    if (!brandId) {
      setFatalError("No brandId found in localStorage");
      return;
    }

    (async () => {
      try {
        const json = await post<BrandDashboardHomePayload>("/dash/brand", {
          brandId,
        });
        setData(json);
      } catch (err: any) {
        setFatalError(
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Could not load dashboard"
        );
      }
    })();
  }, []);

  const filteredCampaigns = useMemo(() => {
    if (!data?.campaigns?.length) return [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return data.campaigns;

    return data.campaigns.filter((c) => {
      const hay = `${c.productOrServiceName || ""} ${c.goal || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, searchTerm]);

  if (fatalError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-red-500">{fatalError}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading dashboard…</p>
      </div>
    );
  }

  const {
    brandName,
    totalCreatedCampaigns,
    totalHiredInfluencers,
    totalAppliedInfluencers,
    budgetRemaining,
    campaignsMode,
  } = data;

  const truncate = (text: string, max = 100) => {
    const t = (text || "").trim();
    return t.length > max ? t.slice(0, max) + "…" : t;
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 flex flex-col overflow-y-auto">
        <main className="flex-1 px-6 py-8">
          {/* Welcome */}
          <div className="rounded-lg bg-white p-6 mb-8 mt-4 md:mt-6">
            <h2
              className="text-xl font-semibold mb-2"
              style={{
                background: `linear-gradient(to right, ${accentFrom}, ${accentTo})`,
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              Welcome Back, {brandName}!
            </h2>
            <p className="text-gray-700">
              Here's a quick overview of your account as of {today}.
            </p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              icon={<HiOutlineChartBar className="text-[#ef2f5b]" size={32} />}
              label="Created Campaigns"
              value={totalCreatedCampaigns}
              accentFrom={accentFrom}
            />

            <StatCard
              icon={<HiOutlineUsers className="text-[#4f46e5]" size={32} />}
              label="Hired Influencers"
              value={totalHiredInfluencers.toLocaleString()}
              accentFrom={accentFrom}
            />

            <StatCard
              icon={<HiOutlineUsers className="text-[#f59e0b]" size={32} />}
              label="Total Applied"
              value={totalAppliedInfluencers.toLocaleString()}
              accentFrom={accentFrom}
            />

            <StatCard
              icon={<HiOutlineCurrencyDollar className="text-[#10b981]" size={32} />}
              label="Budget Remaining"
              value={`$${budgetRemaining.toLocaleString()}`}
              accentFrom={accentFrom}
            />
          </div>

          {/* 2 Boxes */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 2/3: Campaign Table */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
              <div className="flex items-start sm:items-center justify-between gap-4 mb-4 flex-col sm:flex-row">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Campaigns</h2>
                  <p className="text-xs text-gray-500">
                    Showing{" "}
                    <span className="font-semibold">{campaignsMode}</span>{" "}
                    campaigns
                  </p>
                </div>

                <div className="relative w-full sm:max-w-xs">
                  <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search campaigns…"
                    className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
                  />
                </div>
              </div>

              {!filteredCampaigns.length ? (
                <div className="py-10 text-center text-gray-500 flex flex-wrap items-center justify-center gap-4">
                  {/* Secondary */}
                  <button
                    onClick={() => router.push("/brand/browse-influencers")}
                    className="w-64 rounded-xl px-5 py-3 font-semibold shadow-sm transition border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 cursor-pointer"
                  >
                    Browse Influencers
                  </button>

                  {/* Primary */}
                  <button
                    onClick={() => router.push("/brand/add-edit-campaign")}
                    className="w-64 rounded-xl px-4 py-3 text-white font-semibold shadow hover:shadow-md transition cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, ${accentFrom}, ${accentTo})`,
                    }}
                  >
                    Create New Campaign
                  </button>
                </div>
              ) : (
                <div className="overflow-auto max-h-[440px]">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-gray-500 border-b">
                        <th className="py-3 pr-4">Campaign</th>
                        <th className="py-3 pr-4">Goal</th>
                        <th className="py-3 pr-4">Budget</th>
                        <th className="py-3 pr-4">Applied</th>
                        <th className="py-3 pr-4">Influencer</th>
                        <th className="py-3 text-right">Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredCampaigns.map((c) => (
                        <tr key={c.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 pr-4 font-medium text-gray-800">
                            {truncate(c.productOrServiceName || "—", 50)}
                            {c.createdAt ? (
                              <div className="text-xs text-gray-500">
                                {format(new Date(c.createdAt), "MMM d, yyyy")}
                              </div>
                            ) : null}
                          </td>

                          <td className="py-3 pr-4 text-gray-700">{c.goal || "—"}</td>

                          <td className="py-3 pr-4 text-gray-700">
                            ${Number(c.budget || 0).toLocaleString()}
                          </td>

                          <td className="py-3 pr-4">
                            <button
                              type="button"
                              onClick={() => {
                                const id = c.campaignsId || c.id;
                                if (c.hasAcceptedInfluencer) {
                                  router.push(`/brand/active-campaign/active-inf?id=${id}`);
                                } else {
                                  router.push(`/brand/created-campaign/applied-inf?id=${id}`);
                                }
                              }}
                              className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 hover:border-gray-300 transition cursor-pointer"
                              title={
                                c.hasAcceptedInfluencer
                                  ? "Open active influencers"
                                  : "Open applied influencers"
                              }
                            >
                              {/* count bubble */}
                              <span
                                className={`inline-flex min-w-[28px] justify-center rounded-full px-2 py-0.5 text-xs font-bold ${Number(c.appliedInfluencersCount || 0) > 0
                                    ? "bg-gray-900 text-white"
                                    : "bg-gray-100 text-gray-500"
                                  }`}
                              >
                                {Number(c.appliedInfluencersCount || 0).toLocaleString()}
                              </span>

                              {/* label */}
                              <span className="text-gray-700 group-hover:text-gray-900">
                                Applied
                              </span>

                              {/* small hint */}
                              <span className="text-[11px] font-medium text-gray-400 group-hover:text-gray-500">
                                {c.hasAcceptedInfluencer ? "→ Active" : "→ List"}
                              </span>
                            </button>
                          </td>

                          <td className="py-3 pr-4">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${c.hasAcceptedInfluencer
                                ? "bg-indigo-100 text-indigo-700"
                                : "bg-yellow-100 text-yellow-700"
                                }`}
                            >
                              {c.hasAcceptedInfluencer ? "Accepted" : "Not accepted"}
                            </span>
                          </td>

                          <td className="py-3 text-right">
                            <button
                              className="text-sm font-semibold"
                              style={{
                                background: `linear-gradient(to right, ${accentFrom}, ${accentTo})`,
                                WebkitBackgroundClip: "text",
                                color: "transparent",
                              }}
                              onClick={() =>
                                router.push(
                                  `/brand/created-campaign/view-campaign?id=${c.campaignsId || c.id}`
                                )
                              }
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 1/3: Quick Actions */}
            <div className="lg:col-span-1 bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Quick Actions</h3>

              <button
                onClick={() => router.push("/brand/add-edit-campaign")}
                className="w-full mt-3 rounded-xl px-4 py-3 text-white font-semibold shadow hover:shadow-md transition"
                style={{
                  background: `linear-gradient(to right, ${accentFrom}, ${accentTo})`,
                }}
              >
                Create New Campaign
              </button>

              <button
                onClick={() => router.push("/brand/browse-influencers")}
                className="w-full mt-3 rounded-xl px-4 py-3 font-semibold shadow-sm transition border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
              >
                Browse Influencers
              </button>

              <div className="mt-4 text-sm text-gray-600">
                <p className="mb-1">
                  <span className="font-semibold">Tip:</span> If any campaign has no accepted
                  influencer, we show the full list so you can quickly spot gaps.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ---------------- components ---------------- */

const StatCard = ({ icon, label, value, accentFrom, onClick }: any) => (
  <div
    className={`bg-white rounded-lg shadow p-5 flex items-center space-x-4 transition-shadow ${onClick ? "cursor-pointer hover:shadow-lg" : ""
      }`}
    onClick={onClick}
  >
    <div className="p-3 rounded-full" style={{ backgroundColor: `${accentFrom}20` }}>
      {icon}
    </div>
    <div>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
      <p className="text-gray-600">{label}</p>
    </div>
  </div>
);
