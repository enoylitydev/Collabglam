// src/components/BrandTopbar.tsx
"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  HiSearch,
  HiUserCircle,
  HiChevronDown,
  HiMenu,
  HiCreditCard,
  HiBell,
  HiRefresh,
  HiCheckCircle,
  HiExclamationCircle,
  HiLightningBolt,
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
  id: string;
  title: string;
  message?: string;
  createdAt: string;
  isRead: boolean;
  actionPath?: string;
  type?: string;
  entityId?: string;
};

function normalizeNotif(n: any): NotificationItem {
  return {
    id: String(n?.id || n?._id || n?.notificationId || `${Date.now()}`),
    title: String(n?.title || ""),
    message: n?.message ? String(n.message) : "",
    createdAt: String(n?.createdAt || new Date().toISOString()),
    isRead: Boolean(n?.isRead),
    actionPath: n?.actionPath ? String(n.actionPath) : "",
    type: n?.type ? String(n.type) : "",
    entityId: n?.entityId != null ? String(n.entityId) : undefined,
  };
}

type BrandDashResp = {
  brandName?: string;
  budgetRemaining?: number;
};

type SubscriptionFeature = {
  key: string;
  limit?: number;
  value?: number;
  used?: number;
};

type LegacyBrandResp = {
  name?: string;
  email?: string;
  walletBalance?: number;

  // ✅ logo fields (new + legacy)
  logoUrl?: string;
  logoProfileUrl?: string;
  logoProfileurl?: string;
  logoFilename?: string;
  logoFileId?: string;

  subscription?: {
    planName?: string;
    expiresAt?: string;
    features?: SubscriptionFeature[];
  };
};

export default function BrandTopbar({
  onSidebarOpen,
}: {
  onSidebarOpen: () => void;
}) {
  const router = useRouter();

  // IDs
  const [brandId, setBrandId] = useState<string | null>(null);

  // Profile / subscription
  const [loading, setLoading] = useState(true);
  const [brandName, setBrandName] = useState("");
  const [budgetRemaining, setBudgetRemaining] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [subscriptionName, setSubscriptionName] = useState("");
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState("");

  // ✅ Brand logo in topbar
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [logoBroken, setLogoBroken] = useState(false);

  // Profile menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Notifications
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifInFlightRef = useRef(false);

  // Credits dropdown
  const [creditsOpen, setCreditsOpen] = useState(false);
  const creditsRef = useRef<HTMLDivElement | null>(null);

  // Credits: searches / profile views
  const [searchLimit, setSearchLimit] = useState<number | null>(null);
  const [searchUsed, setSearchUsed] = useState<number | null>(null);
  const [profileLimit, setProfileLimit] = useState<number | null>(null);
  const [profileUsed, setProfileUsed] = useState<number | null>(null);

  // Desktop vs Mobile
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const update = () => setIsDesktop(window.innerWidth >= 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Bootstrap from localStorage
  useEffect(() => {
    try {
      const id = localStorage.getItem("brandId");
      const mail = localStorage.getItem("userEmail") || "";
      const plan =
        localStorage.getItem("brandPlanName") ||
        localStorage.getItem("planName") ||
        "";
      setBrandId(id);
      if (mail) setEmail(mail);
      if (plan) setSubscriptionName(plan.toLowerCase());
    } catch {
      // ignore
    }
  }, []);

  // Helper to extract a feature by key
  const extractFeature = useCallback(
    (features: SubscriptionFeature[] | undefined, key: string) => {
      if (!Array.isArray(features)) return { limit: null as number | null, used: null as number | null };
      const row = features.find((f) => f.key === key);
      if (!row) return { limit: null, used: null };

      const rawLimit = row.limit ?? row.value;
      const limit =
        rawLimit === undefined || rawLimit === null
          ? null
          : Number.isFinite(Number(rawLimit))
          ? Number(rawLimit)
          : null;

      const used =
        row.used === undefined || row.used === null
          ? 0
          : Number.isFinite(Number(row.used))
          ? Number(row.used)
          : 0;

      return { limit, used };
    },
    []
  );

  // ✅ Load brand details (dash + legacy to get logo/credits)
  useEffect(() => {
    let cancelled = false;
    if (!brandId) return;

    (async () => {
      setLoading(true);

      // 1) dashboard (fast)
      try {
        const dash = await post<BrandDashResp>(`/dash/brand`);
        if (cancelled) return;
        if (dash?.brandName) setBrandName(dash.brandName);
        if (typeof dash?.budgetRemaining === "number") {
          setBudgetRemaining(dash.budgetRemaining);
        }
      } catch {
        // ignore
      }

      // 2) legacy (logo + subscription + credits + fallback name/budget)
      try {
        const legacy = await get<LegacyBrandResp>(
          `/brand?id=${encodeURIComponent(brandId)}`
        );
        if (cancelled) return;

        if (legacy?.name) setBrandName((prev) => prev || legacy.name || "");
        if (typeof legacy?.walletBalance === "number") {
          setBudgetRemaining((prev) =>
            prev == null ? legacy.walletBalance! : prev
          );
        }

        if (legacy?.email) setEmail((prev) => prev || legacy.email || "");

        const plan = legacy?.subscription?.planName;
        if (plan) setSubscriptionName((prev) => prev || plan.toLowerCase());

        const exp = legacy?.subscription?.expiresAt;
        if (exp) setSubscriptionExpiresAt(exp);

        // ✅ logo (new field + legacy fallbacks)
        const logo =
          legacy?.logoUrl ||
          legacy?.logoProfileUrl ||
          legacy?.logoProfileurl ||
          "";
        if (logo) {
          setBrandLogoUrl(logo);
          setLogoBroken(false);
        }

        // credits
        const features = legacy?.subscription?.features;
        const searchFeat = extractFeature(features, "searches_per_month");
        const profileFeat = extractFeature(features, "profile_views_per_month");

        setSearchLimit(searchFeat.limit);
        setSearchUsed(searchFeat.used);

        setProfileLimit(profileFeat.limit);
        setProfileUsed(profileFeat.used);
      } catch {
        // ignore; UI can still render with dash values
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brandId, extractFeature]);

  // click-outside to close menus/dropdowns
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
      if (creditsRef.current && !creditsRef.current.contains(target)) setCreditsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Notifications helpers
  const reloadNotifications = useCallback(async () => {
    if (!brandId) return;
    if (notifInFlightRef.current) return;

    notifInFlightRef.current = true;
    setNotifLoading(true);
    setNotifError(null);

    try {
      const resp = await get<{ data?: any[]; unread?: number }>(
        `/notifications/brand?recipientType=brand&brandId=${encodeURIComponent(
          brandId
        )}&limit=15`
      );
      const list = (resp?.data ?? []).map(normalizeNotif);
      setNotifications(list);
      setUnreadCount(
        typeof resp?.unread === "number"
          ? resp.unread
          : list.filter((n) => !n.isRead).length
      );
    } catch (err) {
      console.error("Failed to load notifications", err);
      setNotifError("Could not load notifications. Please try again.");
    } finally {
      notifInFlightRef.current = false;
      setNotifLoading(false);
    }
  }, [brandId]);

  const reloadCredits = useCallback(async () => {
    if (!brandId) return;

    try {
      const legacy = await get<LegacyBrandResp>(
        `/brand?id=${encodeURIComponent(brandId)}`
      );

      const features = legacy?.subscription?.features;

      const searchFeat = extractFeature(features, "searches_per_month");
      const profileFeat = extractFeature(features, "profile_views_per_month");

      setSearchLimit(searchFeat.limit);
      setSearchUsed(searchFeat.used);

      setProfileLimit(profileFeat.limit);
      setProfileUsed(profileFeat.used);

      const plan = legacy?.subscription?.planName;
      if (plan) setSubscriptionName(plan.toLowerCase());

      const exp = legacy?.subscription?.expiresAt;
      if (exp) setSubscriptionExpiresAt(exp);

      // refresh logo too (nice-to-have)
      const logo =
        legacy?.logoUrl ||
        legacy?.logoProfileUrl ||
        legacy?.logoProfileurl ||
        "";
      if (logo) {
        setBrandLogoUrl(logo);
        setLogoBroken(false);
      }
    } catch (err) {
      console.error("Failed to reload credits", err);
    }
  }, [brandId, extractFeature]);

  // Notifications: fetch on load + when brandId changes
  useEffect(() => {
    if (!brandId) return;
    reloadNotifications();
  }, [brandId, reloadNotifications]);

  // 🔁 AUTO-POLL NOTIFICATIONS EVERY 5 SECONDS
  useEffect(() => {
    if (!brandId) return;
    const intervalId = window.setInterval(() => {
      reloadNotifications();
    }, 5000);
    return () => window.clearInterval(intervalId);
  }, [brandId, reloadNotifications]);

  // Refresh when dropdown opens
  useEffect(() => {
    if (notifOpen) reloadNotifications();
  }, [notifOpen, reloadNotifications]);

  // Reload credits when credits dropdown opens
  useEffect(() => {
    if (creditsOpen) reloadCredits();
  }, [creditsOpen, reloadCredits]);

  const onNotifClick = useCallback(
    async (n: NotificationItem) => {
      try {
        if (!n.isRead && brandId) {
          setNotifications((prev) =>
            prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
          );
          setUnreadCount((c) => Math.max(0, c - 1));
          await post(`/notifications/brand/mark-read`, { id: n.id, brandId });
        }
      } catch {
        // revert by reloading
        reloadNotifications();
      } finally {
        const path = n.actionPath || "/brand/notifications";
        router.push(path.startsWith("/") ? path : `/${path}`);
      }
    },
    [brandId, router, reloadNotifications]
  );

  const markAllRead = useCallback(async () => {
    if (!brandId || notifications.length === 0) return;

    const hadUnread = notifications.some((n) => !n.isRead);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (hadUnread) setUnreadCount(0);

    try {
      await post(`/notifications/brand/mark-all-read`, { brandId });
    } catch {
      await reloadNotifications();
    }
  }, [brandId, notifications, reloadNotifications]);

  const formatWhen = (iso: string) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleString();
    } catch {
      return "";
    }
  };


  const formattedExpiry = useMemo(() => {
    if (!subscriptionExpiresAt) return "";
    try {
      return new Date(subscriptionExpiresAt).toLocaleDateString();
    } catch {
      return "";
    }
  }, [subscriptionExpiresAt]);

  // Credits math
  const hasSearchCap = searchLimit != null && searchLimit > 0;
  const hasProfileCap = profileLimit != null && profileLimit > 0;

  const searchPercent =
    hasSearchCap && searchUsed != null && searchLimit
      ? Math.min(100, (searchUsed / searchLimit) * 100)
      : 0;

  const profilePercent =
    hasProfileCap && profileUsed != null && profileLimit
      ? Math.min(100, (profileUsed / profileLimit) * 100)
      : 0;

  const searchRemaining =
    hasSearchCap && searchUsed != null && searchLimit
      ? Math.max(0, searchLimit - searchUsed)
      : null;

  const profileRemaining =
    hasProfileCap && profileUsed != null && profileLimit
      ? Math.max(0, profileLimit - profileUsed)
      : null;

  const hasAnyCredits =
    (searchLimit != null && searchLimit >= 0) ||
    (profileLimit != null && profileLimit >= 0);

  const avatar = brandLogoUrl && !logoBroken ? (
    <img
      src={brandLogoUrl}
      alt="Brand logo"
      className="h-7 w-7 rounded-full object-cover border border-gray-200"
      onError={() => setLogoBroken(true)}
    />
  ) : (
    <HiUserCircle size={24} className="text-gray-600" />
  );

  return (
    <header className="w-full bg-white shadow-sm relative z-20">
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        {/* Left side: Hamburger + Search */}
        <div className="flex items-center gap-3">
          {/* Hamburger (mobile) */}
          <button
            onClick={onSidebarOpen}
            className="md:hidden p-2 rounded-md hover:bg-gray-100 focus:outline-none"
            aria-label="Open sidebar"
          >
            <HiMenu size={24} className="text-gray-600" />
          </button>
        </div>

        {/* Right side: Notifications, Credits, Budget, Brand name, Profile */}
        <div className="flex items-center space-x-6">
          {/* Notifications */}
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
                  <p className="text-lg font-semibold text-gray-800">
                    Notifications
                  </p>

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

          {/* Credits (Desktop) – icon + dropdown */}
          {isDesktop && !loading && hasAnyCredits && (
            <div className="hidden md:block relative" ref={creditsRef}>
              <button
                type="button"
                onClick={() => setCreditsOpen((o) => !o)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-xs text-gray-700 shadow-sm"
                title="View plan credits"
              >
                <HiLightningBolt className="text-yellow-500" size={18} />
                <span className="font-semibold">Credits</span>
              </button>

              {creditsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-lg z-[900] overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-800">
                        Plan credits
                      </span>
                      {formattedExpiry && (
                        <span className="text-[11px] text-gray-500">
                          Renews / ends: {formattedExpiry}
                        </span>
                      )}
                    </div>
                    {subscriptionName && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                        {subscriptionName.charAt(0).toUpperCase() +
                          subscriptionName.slice(1)}
                      </span>
                    )}
                  </div>

                  <div className="px-4 py-3 space-y-3">
                    {/* Searches */}
                    {searchLimit != null && (
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] text-gray-500">
                            Searches / month
                          </span>
                          <span className="text-[11px] font-medium text-gray-800">
                            {searchLimit === 0
                              ? "Unlimited"
                              : `${searchUsed ?? 0}/${searchLimit}`}
                          </span>
                        </div>

                        {hasSearchCap ? (
                          <>
                            <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  searchPercent > 80
                                    ? "bg-red-500"
                                    : searchPercent > 50
                                    ? "bg-yellow-400"
                                    : "bg-green-500"
                                }`}
                                style={{ width: `${searchPercent}%` }}
                              />
                            </div>
                            {searchRemaining != null && (
                              <p className="mt-1 text-[11px] text-gray-500">
                                {searchRemaining} search
                                {searchRemaining === 1 ? "" : "es"} left this month
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="mt-1 text-[11px] text-gray-500">
                            Unlimited searches on this plan.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Profile views */}
                    {profileLimit != null && (
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] text-gray-500">
                            Profile views / month
                          </span>
                          <span className="text-[11px] font-medium text-gray-800">
                            {profileLimit === 0
                              ? "Unlimited"
                              : `${profileUsed ?? 0}/${profileLimit}`}
                          </span>
                        </div>

                        {hasProfileCap ? (
                          <>
                            <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  profilePercent > 80
                                    ? "bg-red-500"
                                    : profilePercent > 50
                                    ? "bg-yellow-400"
                                    : "bg-green-500"
                                }`}
                                style={{ width: `${profilePercent}%` }}
                              />
                            </div>
                            {profileRemaining != null && (
                              <p className="mt-1 text-[11px] text-gray-500">
                                {profileRemaining} profile view
                                {profileRemaining === 1 ? "" : "s"} left this month
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="mt-1 text-[11px] text-gray-500">
                            Unlimited profile views on this plan.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Budget Remaining */}
          {!loading && budgetRemaining !== null && (
            <button
              className="flex items-center space-x-1 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md text-md"
              title="Budget remaining"
              type="button"
            >
              <HiCreditCard size={20} className="text-gray-600" />
              <span className="font-medium text-gray-800">
                ${budgetRemaining.toFixed(2)}
              </span>
            </button>
          )}

          {/* Brand name */}
          {loading ? (
            <span className="text-gray-500 text-sm">Loading…</span>
          ) : (
            <span className="text-gray-800 font-medium text-lg break-words max-w-[180px] md:max-w-xs text-right line-clamp-1">
              {brandName || "—"}
            </span>
          )}

          {/* Profile dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center space-x-1 p-2 rounded-md hover:bg-gray-100 focus:outline-none"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Profile menu"
            >
              {/* ✅ show logo if present else icon */}
              {avatar}
              <HiChevronDown size={16} className="text-gray-600" />
            </button>

            {menuOpen && !loading && (
              <div className="absolute right-0 mt-2 w-68 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0">
                      <p className="text-md font-semibold text-gray-700 break-words">
                        {brandName || "Brand"}
                      </p>
                      {email && (
                        <p className="text-sm text-gray-500 break-words">
                          {email}
                        </p>
                      )}
                    </div>
                  </div>

                  {subscriptionName && (
                    <p className="text-sm text-gray-500 break-words mt-2">
                      Plan:{" "}
                      {subscriptionName.charAt(0).toUpperCase() +
                        subscriptionName.slice(1)}
                    </p>
                  )}
                  {formattedExpiry && (
                    <p className="text-sm text-gray-500">
                      Expires: {formattedExpiry}
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
