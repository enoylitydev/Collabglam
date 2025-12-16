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
import BrandTourModal from "@/components/common/BrandTourModal";

interface DashboardData {
  brandName: string;
  totalCreatedCampaigns: number;
  totalHiredInfluencers: number;
  budgetRemaining: number;
}

export default function BrandDashboardHome() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const today = format(new Date(), "MMMM d, yyyy");

  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const brandId = localStorage.getItem("brandId");
    if (!brandId) return;

    const key = `brand_tour_seen_${brandId}`;
    if (!localStorage.getItem(key)) setShowTour(true);
  }, []);

  const closeTour = () => {
    setShowTour(false);
  };

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

  const { brandName, totalCreatedCampaigns, totalHiredInfluencers, budgetRemaining } = data;
  const accentFrom = "#FFA135";
  const accentTo = "#FF7236";

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 flex flex-col overflow-y-auto">
        <main className="flex-1 px-6 py-8">

          <BrandTourModal open={showTour} onClose={closeTour} />

          {/* Zero campaigns CTA */}
          {totalCreatedCampaigns === 0 && (
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
              label="Created Campaigns"
              value={totalCreatedCampaigns}
              accentFrom={accentFrom}
              onClick={() => router.push("/brand/created-campaign")}
            />

            <StatCard
              icon={<HiOutlineUsers className="text-[#4f46e5]" size={32} />}
              label="Hired Influencers"
              value={totalHiredInfluencers.toLocaleString()}
              accentFrom={accentFrom}
            // onClick={() => router.push("/brand/browse-influencers")}
            />

            <StatCard
              icon={<HiOutlineCurrencyDollar className="text-[#10b981]" size={32} />}
              label="Budget Remaining"
              value={`$${budgetRemaining.toLocaleString()}`}
              accentFrom={accentFrom}
            // onClick={() => router.push("/brand/dashboard/settings")}
            />
          </div>
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