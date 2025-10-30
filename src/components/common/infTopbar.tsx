// src/components/InfluencerTopbar.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  HiSearch,
  HiUserCircle,
  HiChevronDown,
  HiMenu,
  HiX,
} from "react-icons/hi";
import { get } from "@/lib/api";

interface InfluencerTopbarProps {
  onSidebarOpen: () => void;
}

type LiteInfluencerResp = {
  influencerId: string;
  name: string;
  email: string;
  planId: string | null;
  planName: string | null;
  /** Optional – only if you later decide to include it in the lite payload */
  expiresAt?: string | null;
};

export default function InfluencerTopbar({ onSidebarOpen }: InfluencerTopbarProps) {
  // profile state
  const [influencerName, setInfluencerName] = useState("");
  const [email, setEmail] = useState("");
  const [subscriptionName, setSubscriptionName] = useState("");
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // profile menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // desktop vs mobile flag
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const update = () => setIsDesktop(window.innerWidth >= 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // fetch influencer lite info (new response shape)
  useEffect(() => {
    const infId = typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
    if (!infId) {
      setError("No influencerId found");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await get<LiteInfluencerResp>(`/influencer/lite?id=${infId}`);
        setInfluencerName(data?.name ?? "");
        setEmail(data?.email ?? "");
        setSubscriptionName(data?.planName ?? "");
        setSubscriptionExpiresAt(data?.expiresAt ?? "");
      } catch (err: any) {
        console.error(err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // close profile menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const formattedExpiry =
    subscriptionExpiresAt ? new Date(subscriptionExpiresAt).toLocaleDateString() : "";

  const planLabel =
    subscriptionName ? subscriptionName.charAt(0).toUpperCase() + subscriptionName.slice(1) : "";

  return (
    <header className="w-full bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] shadow-sm relative z-30 ">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-end h-16">
          {/* Left: Sidebar toggle */}
          <div className="flex items-center space-x-4">
            <button
              onClick={onSidebarOpen}
              className="md:hidden p-2 rounded-md hover:bg-gray-100 focus:outline-none"
              aria-label="Open sidebar"
            >
              <HiMenu size={24} className="text-gray-600" />
            </button>
          </div>

          {/* Right: Profile & Name */}
          <div className="flex items-center space-x-6">
            {loading ? (
              <span className="text-gray-500 text-sm">Loading…</span>
            ) : error ? (
              <span className="text-red-500 text-sm">{error}</span>
            ) : (
              <span className="text-gray-800 font-medium text-lg">
                {influencerName || "—"}
              </span>
            )}

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center space-x-1 p-2 rounded-md hover:bg-gray-100 focus:outline-none"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <HiUserCircle size={24} className="text-gray-600" />
                <HiChevronDown size={16} className="text-gray-600" />
              </button>

              {menuOpen && !loading && !error && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-10"
                >
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-lg font-semibold text-gray-700">
                      {influencerName || "—"}
                    </p>
                    {email && <p className="text-md text-gray-500">{email}</p>}
                    {planLabel && (
                      <p className="text-md text-yellow-600">
                        {planLabel} Plan
                      </p>
                    )}
                    {formattedExpiry && (
                      <p className="text-sm text-gray-500">
                        Expires: {formattedExpiry}
                      </p>
                    )}
                  </div>
                  <ul className="py-1 hover:bg-gradient-to-r from-[#FFBF00] to-[#FFDB58]">
                    <li className="px-4 py-2 text-md text-gray-700">
                      <a href="/influencer/profile">View Profile</a>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
