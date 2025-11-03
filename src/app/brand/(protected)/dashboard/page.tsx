"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  HiOutlineChartBar,
  HiOutlineUsers,
  HiOutlineCurrencyDollar,
  HiSearch,
} from "react-icons/hi";
import { format } from "date-fns";
import { post } from "@/lib/api";
import { ArrowRight, PlayCircle } from "lucide-react";
import EnhancedSearchModal, { InfluencerResult } from "./SearchModal";

interface DashboardData {
  brandName: string;
  totalActiveCampaigns: number;
  totalInfluencers: number;
  budgetRemaining: number;
}

export default function BrandDashboardHome() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  // Search modal state
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  const today = format(new Date(), "MMMM d, yyyy");

  useEffect(() => {
    const brandId = typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
    if (!brandId) {
      setFatalError("No brandId found in localStorage");
      return;
    }
    (async () => {
      try {
        const json = await post<DashboardData>("/dash/brand", { brandId });
        setData(json);
      } catch (err: any) {
        setFatalError(
          err?.response?.data?.error || err?.message || "Could not load dashboard data"
        );
      }
    })();
  }, []);

  const handleInfluencerSelect = (influencer: InfluencerResult) => {
    // Navigate to influencer profile
    router.push(`/brand/influencers/view?id=${influencer.id}&platform=${influencer.platform}`);
  };

  const handleBulkSelect = (influencers: InfluencerResult[]) => {
    // Implement add-to-campaign / comparison flow
    console.log("Bulk selected influencers:", influencers.length);
  };

  const handleToggleFavorite = (id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  if (fatalError)
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-red-500">{fatalError}</p>
      </div>
    );

  if (!data)
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading dashboard…</p>
      </div>
    );

  const { brandName, totalActiveCampaigns, totalInfluencers, budgetRemaining } = data;
  const accentFrom = "#FFA135";
  const accentTo = "#FF7236";

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 flex flex-col overflow-y-auto">
        <main className="flex-1 px-6 py-8">
          {/* Search trigger */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setIsSearchModalOpen(true)}
              className="w-full max-w-md bg-white rounded-full border border-orange-300 border-2 px-6 py-4 flex items-center space-x-3 hover:border-orange-400 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              aria-label="Open search modal"
            >
              <HiSearch className="h-5 w-5 text-gray-400" />
              <span className="text-gray-500 text-left flex-1">
                Search for influencers across platforms...
              </span>
              <div className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white p-2 rounded-full">
                <HiSearch className="w-4 h-4" />
              </div>
            </button>
          </div>

          {/* Zero campaigns CTA */}
          {totalActiveCampaigns === 0 && (
            <ZeroCampaignCTA
              onClick={() => router.push("/brand/add-edit-campaign")}
              accentFrom={accentFrom}
              accentTo={accentTo}
            />
          )}

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
            <p className="text-gray-700">Here's a quick overview of your account as of {today}.</p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              icon={<HiOutlineChartBar className="text-[#ef2f5b]" size={32} />}
              label="Active Campaigns"
              value={totalActiveCampaigns}
              accentFrom={accentFrom}
              onClick={() => router.push("/brand/active-campaign")}
            />

            {/* <StatCard
              icon={<HiOutlineUsers className="text-[#4f46e5]" size={32} />}
              label="Hired Influencers"
              value={totalInfluencers.toLocaleString()}
              accentFrom={accentFrom}
              onClick={() => router.push("/brand/browse-influencers")}
            /> */}

            <StatCard
              icon={<HiOutlineCurrencyDollar className="text-[#10b981]" size={32} />}
              label="Budget Remaining"
              value={`$${budgetRemaining.toLocaleString()}`}
              accentFrom={accentFrom}
              onClick={() => router.push("/brand/dashboard/settings")}
            />
          </div>

          {/* Recent Activity */}
          {totalActiveCampaigns > 0 && (
            <section className="mt-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Campaign</h3>
              <div className="bg-white rounded-lg shadow divide-y divide-gray-200">
                {[
                  {
                    title: 'Created a new campaign: "Back to School 2025"',
                    date: "Mar 1, 2025",
                    href: "/brand/prev-campaign",
                  },
                  {
                    title: 'Influencer "TechWithTom" accepted your collaboration',
                    date: "Feb 25, 2025",
                    href: "/brand/browse-influencers",
                  },
                  {
                    title: 'Campaign "Holiday Promo 2024" marked as Completed',
                    date: "Nov 20, 2024",
                    href: "/brand/prev-campaign",
                  },
                ].map((act, idx) => (
                  <div key={idx} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-700">{act.title}</p>
                      <p className="text-sm text-gray-500 mt-1">{act.date}</p>
                    </div>
                    <button
                      onClick={() => router.push(act.href)}
                      className="text-sm font-medium hover:underline"
                      style={{
                        background: `linear-gradient(to right, ${accentFrom}, ${accentTo})`,
                        WebkitBackgroundClip: "text",
                        color: "transparent",
                      }}
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Search Modal */}
          <EnhancedSearchModal
            isOpen={isSearchModalOpen}
            onClose={() => setIsSearchModalOpen(false)}
            onSelectInfluencer={handleInfluencerSelect}
            onBulkSelect={handleBulkSelect}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        </main>
      </div>
    </div>
  );
}

// --- Support components (unchanged) ---
const ZeroCampaignCTA = ({ onClick, accentFrom, accentTo }: any) => (
  <div className="w-full flex items-center py-8 px-4 md:py-0 md:px-0">
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      className="group flex flex-col sm:flex-row items-center justify-center text-center gap-4 w-full max-w-xl p-6 rounded-2xl shadow-md transform transition-all bg-gradient-to-r from-[#FF8C00] via-[#FF5E7E] to-[#D12E53] hover:scale-105 hover:shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF8C00]"
    >
      <PlayCircle className="h-8 w-8 text-white group-hover:animate-pulse" />
      <div className="space-y-1">
        <p className="text-white font-bold text-lg">Create New Campaign</p>
        <p className="text-white/90 text-sm">Find perfect Influencer for your brand</p>
      </div>
      <ArrowRight className="h-5 w-5 text-white transform transition-transform group-hover:translate-x-1" />
    </div>
  </div>
);

const StatCard = ({ icon, label, value, accentFrom, onClick }: any) => (
  <div className="bg-white rounded-lg shadow p-5 flex items-center space-x-4 cursor-pointer hover:shadow-lg transition-shadow" onClick={onClick}>
    <div className="p-3 rounded-full" style={{ backgroundColor: `${accentFrom}20` }}>
      {icon}
    </div>
    <div>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
      <p className="text-gray-600">{label}</p>
    </div>
  </div>
);
