// src/components/BrandTopbar.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  HiSearch,
  HiUserCircle,
  HiChevronDown,
  HiMenu,
  HiCreditCard,
  HiX,
  HiBell,
  HiRefresh,
  HiCheckCircle,
  HiExclamationCircle,
} from "react-icons/hi";
import { get, post } from "@/lib/api";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

type NotificationItem = {
  id: string; // normalized from _id/notificationId
  title: string;
  message?: string;
  createdAt: string;
  isRead?: boolean;
  actionPath?: string;
  type?: string;
  entityId?: string;
};

function normalizeNotif(n: any): NotificationItem {
  return {
    id: n?.id || n?._id || n?.notificationId || `${Date.now()}`,
    title: n?.title || "",
    message: n?.message || "",
    createdAt: n?.createdAt || new Date().toISOString(),
    isRead: Boolean(n?.isRead),
    actionPath: n?.actionPath || "",
    type: n?.type || "",
    entityId: n?.entityId ? String(n.entityId) : undefined,
  };
}

type BrandDashResp = {
  brandName: string;
  totalActiveCampaigns?: number;
  totalInfluencers?: number;
  budgetRemaining?: number;
};

type LegacyBrandResp = {
  name: string;
  email: string;
  walletBalance: number;
  subscription: { planName: string; expiresAt: string };
};

export default function BrandTopbar({ onSidebarOpen }: { onSidebarOpen: () => void }) {
  const router = useRouter();

  // IDs
  const [brandId, setBrandId] = useState<string | null>(null);

  // Profile / subscription state
  const [brandName, setBrandName] = useState("");
  const [budgetRemaining, setBudgetRemaining] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [subscriptionName, setSubscriptionName] = useState("");
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Search state (kept, but unchanged)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // Track desktop vs mobile
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const update = () => setIsDesktop(window.innerWidth >= 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Read brandId from localStorage
  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
    setBrandId(id);
  }, []);

  // Load brand details (dash → legacy fallback)
  useEffect(() => {
    if (!brandId) {
      setError("No brandId in localStorage");
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const dash = await post<BrandDashResp>(`/dash/brand`);

        if (cancelled) return;

        if (dash && (dash.brandName || dash.budgetRemaining !== undefined)) {
          setBrandName(dash.brandName || "");
          setBudgetRemaining(
            typeof dash.budgetRemaining === "number" ? dash.budgetRemaining : null
          );
          setError(null);
        } else {
          const legacy = await get<LegacyBrandResp>(
            `/brand?id=${encodeURIComponent(brandId)}`
          );
          if (cancelled) return;

          setBrandName(legacy?.name || "");
          setEmail(legacy?.email || "");
          setBudgetRemaining(
            typeof legacy?.walletBalance === "number" ? legacy.walletBalance : null
          );
          setSubscriptionName(legacy?.subscription?.planName || "");
          setSubscriptionExpiresAt(legacy?.subscription?.expiresAt || "");
          setError(null);
        }
      } catch (err: any) {
        console.error("Brand details load failed:", err);
        try {
          const legacy = await get<LegacyBrandResp>(
            `/brand?id=${encodeURIComponent(brandId)}`
          );
          if (!cancelled) {
            setBrandName(legacy?.name || "");
            setEmail(legacy?.email || "");
            setBudgetRemaining(
              typeof legacy?.walletBalance === "number" ? legacy.walletBalance : null
            );
            setSubscriptionName(legacy?.subscription?.planName || "");
            setSubscriptionExpiresAt(legacy?.subscription?.expiresAt || "");
            setError(null);
          }
        } catch (e2) {
          if (!cancelled) {
            console.error("Legacy brand load failed:", e2);
            setError("Failed to load brand info");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brandId]);

  // click-outside close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const results = await get<SearchResult[]>(
          `/search/brand?query=${encodeURIComponent(searchQuery)}`
        );
        setSearchResults(results);
      } catch (err) {
        console.error("Search error", err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [searchQuery]);

  // --- Notifications helpers ---
  async function reloadNotifications() {
    if (!brandId) return;
    setNotifLoading(true);
    setNotifError(null);
    try {
      const resp = await get<{ data?: any[]; unread?: number }>(
        `/notifications/brand?recipientType=brand&brandId=${encodeURIComponent(brandId)}&limit=15`
      );
      const list = (resp?.data ?? []).map(normalizeNotif);
      setNotifications(list);
      setUnreadCount(
        typeof resp?.unread === "number" ? resp.unread : list.filter((n) => !n.isRead).length
      );
    } catch (err) {
      console.error("Failed to load notifications", err);
      setNotifError("Could not load notifications. Please try again.");
    } finally {
      setNotifLoading(false);
    }
  }

  // Notifications: fetch on load
  useEffect(() => {
    if (!brandId) return;
    reloadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  // Refresh when dropdown opens
  useEffect(() => {
    if (notifOpen) reloadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifOpen]);

  // Mark single read (optimistic)
  async function onNotifClick(n: NotificationItem) {
    try {
      if (!n.isRead && brandId) {
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
        await post(`notifications/brand/mark-read`, { id: n.id, brandId });
      }
    } catch (e) {
      // rollback
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: n.isRead } : x)));
      if (!n.isRead) setUnreadCount((c) => c + 1);
    } finally {
      const path = n.actionPath || "/brand/notifications";
      router.push(path);
    }
  }

  // Mark all read (with UI button)
  async function markAllRead() {
    if (!brandId || notifications.length === 0) return;
    const hadUnread = notifications.some((n) => !n.isRead);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (hadUnread) setUnreadCount(0);
    try {
      await post(`notifications/brand/mark-all-read`, { brandId });
    } catch (err) {
      // soft refresh on failure
      await reloadNotifications();
    }
  }

  function formatWhen(iso: string) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString();
    } catch {
      return "";
    }
  }

  const formattedExpiry = subscriptionExpiresAt
    ? new Date(subscriptionExpiresAt).toLocaleDateString()
    : "";

  return (
    <header className="w-full bg-white shadow-sm relative z-20">
      <div className="flex items-center justify-end h-16 px-4 border-b border-gray-200">
        {/* Left: Hamburger */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onSidebarOpen}
            className="md:hidden p-2 rounded-md hover:bg-gray-100 focus:outline-none"
          >
            <HiMenu size={24} className="text-gray-600" />
          </button>
        </div>

        {/* Right: Notifications, Budget Remaining, Name, Profile */}
        <div className="flex items-center space-x-6">
          {/* Notifications bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className="relative p-2 rounded-md hover:bg-gray-100 focus:outline-none"
              aria-haspopup="menu"
              aria-expanded={notifOpen}
              aria-label="Notifications"
              title="Notifications"
            >
              <HiBell size={22} className="text-gray-700" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] leading-none rounded-full bg-red-600 text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-96 max-w-[95vw] bg-white border border-gray-200 rounded-md shadow-lg z-[1000]">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-lg font-semibold text-gray-800">Notifications</p>

                  <div className="flex items-center gap-3">
                    {notifError ? (
                      <button
                        onClick={reloadNotifications}
                        className="inline-flex items-center text-sm text-red-600 hover:underline"
                        title="Retry loading"
                      >
                        <HiRefresh className="mr-1" /> Retry
                      </button>
                    ) : (
                      <button
                        onClick={markAllRead}
                        disabled={notifLoading || unreadCount === 0}
                        className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                        title="Mark all as read"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                </div>

                {notifError && (
                  <div className="px-4 py-2 text-sm text-red-700 bg-red-50 border-b border-red-100 flex items-center gap-2">
                    <HiExclamationCircle className="flex-shrink-0" />
                    <span className="break-words">{notifError}</span>
                  </div>
                )}

                <div className="max-h-96 overflow-auto">
                  {notifLoading ? (
                    <ul className="divide-y divide-gray-100">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <li key={i} className="px-4 py-3 animate-pulse">
                          <div className="h-3 w-2/3 bg-gray-200 rounded mb-2" />
                          <div className="h-3 w-1/2 bg-gray-200 rounded mb-1" />
                          <div className="h-2 w-1/3 bg-gray-200 rounded" />
                        </li>
                      ))}
                    </ul>
                  ) : notifications.length === 0 ? (
                    <div className="p-6 text-sm text-gray-500 flex items-center gap-2">
                      <HiCheckCircle className="text-green-500" />
                      You’re all caught up.
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {notifications.map((n) => (
                        <li
                          key={n.id}
                          className={`px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                            n.isRead ? "bg-white" : "bg-yellow-50"
                          }`}
                          onClick={() => onNotifClick(n)}
                        >
                          <div className="flex items-start gap-2">
                            {!n.isRead && (
                              <span
                                className="mt-1 inline-block h-2 w-2 rounded-full bg-red-500 flex-shrink-0"
                                aria-label="unread"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 break-words">
                                {n.title}
                              </p>
                              {n.message && (
                                <p className="text-sm text-gray-600 mt-0.5 break-words whitespace-normal">
                                  {n.message}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                {formatWhen(n.createdAt)}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="px-4 py-2 border-t border-gray-100">
                  <a
                    href="/brand/notifications"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    View all
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Budget Remaining */}
          {!loading && !error && budgetRemaining !== null && (
            <button
              onClick={() => router.push("/brand/milestone-history")}
              className="flex items-center space-x-1 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md text-md cursor-pointer"
              title="Budget remaining"
            >
              <HiCreditCard size={20} className="text-gray-600" />
              <span className="font-large text-gray-800">
                ${budgetRemaining.toFixed(2)}
              </span>
            </button>
          )}

          {/* Brand name */}
          {loading ? (
            <span className="text-gray-500 text-sm">Loading…</span>
          ) : error ? (
            <span className="text-red-500 text-sm break-words">{error}</span>
          ) : (
            <span className="text-gray-800 font-medium text-lg break-words">{brandName || "—"}</span>
          )}

          {/* Profile dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center space-x-1 p-2 rounded-md hover:bg-gray-100 focus:outline-none"
            >
              <HiUserCircle size={24} className="text-gray-600" />
              <HiChevronDown size={16} className="text-gray-600" />
            </button>
            {menuOpen && !loading && !error && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-md font-semibold text-gray-700 break-words">{brandName}</p>
                  {email && <p className="text-sm text-gray-500 break-words">{email}</p>}
                  {subscriptionName && (
                    <p className="text-md text-gray-500 break-words">
                      Plan: {subscriptionName.charAt(0).toUpperCase() + subscriptionName.slice(1)}
                    </p>
                  )}
                  {subscriptionExpiresAt && (
                    <p className="text-md text-gray-500">
                      Expires: {new Date(subscriptionExpiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <ul className="py-1">
                  <li className="px-4 py-2 hover:bg-gray-100 text-md">
                    <a href="/brand/profile">View Profile</a>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
