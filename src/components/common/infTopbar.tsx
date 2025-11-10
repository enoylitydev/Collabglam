"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { HiUserCircle, HiChevronDown, HiMenu, HiBell } from "react-icons/hi";
import { get, post } from "@/lib/api";

interface InfluencerTopbarProps {
  onSidebarOpen: () => void;
}

type LiteInfluencerResp = {
  influencerId: string;
  name: string;
  email: string;
  planId: string | null;
  planName: string | null;
  expiresAt?: string | null;
};

type NotificationItem = {
  id: string;                 // normalized from _id/notificationId
  title: string;
  message?: string;
  createdAt: string;
  isRead?: boolean;
  actionPath?: string;
  type?: string;
  entityId?: string;
};

// normalize server docs to { id, ... }
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

export default function InfluencerTopbar({ onSidebarOpen }: InfluencerTopbarProps) {
  // ---------------- Profile ----------------
  const [influencerId, setInfluencerId] = useState<string | null>(null);
  const [influencerName, setInfluencerName] = useState("");
  const [email, setEmail] = useState("");
  const [subscriptionName, setSubscriptionName] = useState("");
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ---------------- Notifications ----------------
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // get influencerId (short retry for post-login timing)
  useEffect(() => {
    let retries = 0;
    const maxRetries = 10;
    const stepMs = 400;
    const attempt = () => {
      const id = typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
      if (id) {
        setInfluencerId(id);
      } else if (retries < maxRetries) {
        retries += 1;
        setTimeout(attempt, stepMs);
      } else {
        setError("No influencerId found");
        setLoading(false);
      }
    };
    attempt();
  }, []);

  // profile load
  useEffect(() => {
    if (!influencerId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const resp = await get<any>(`/influencer/lite?id=${encodeURIComponent(influencerId)}`);
        const data: LiteInfluencerResp = resp?.data ?? resp;
        if (cancelled) return;
        setInfluencerName(data?.name ?? "");
        setEmail(data?.email ?? "");
        setSubscriptionName(data?.planName ?? "");
        setSubscriptionExpiresAt(data?.expiresAt ?? "");
        setError(null);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError("Failed to load profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [influencerId]);

  // click-outside to close menus
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 🔔 LOAD NOTIFICATIONS ON PAGE LOAD (after influencerId is known)
  useEffect(() => {
    if (!influencerId) return;
    let cancelled = false;
    (async () => {
      setNotifLoading(true);
      try {
        const resp = await get<{ data?: any[]; unread?: number }>(
          `/notifications/influencer?recipientType=influencer&influencerId=${encodeURIComponent(influencerId)}&limit=15`
        );
        if (cancelled) return;
        const list = (resp?.data ?? []).map(normalizeNotif);
        setNotifications(list);
        setUnreadCount(
          typeof resp?.unread === "number" ? resp.unread : list.filter((n) => !n.isRead).length
        );
      } catch (err) {
        if (!cancelled) console.error("Failed to load notifications", err);
      } finally {
        if (!cancelled) setNotifLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [influencerId]);

  // optional realtime: bump unread & optionally prepend when dropdown open
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sock: any = (typeof window !== "undefined" && (window as any).socket) || null;
    if (!sock || !influencerId) return;
    const onNew = (payload: any) => {
      if (String(payload?.meta?.influencerId || payload?.influencerId) !== String(influencerId)) return;
      setUnreadCount((c) => c + 1);
      if (notifOpen && payload?.title) {
        setNotifications((prev) => [
          normalizeNotif({
            ...payload,
            createdAt: new Date().toISOString(),
            isRead: false,
          }),
          ...prev,
        ]);
      }
    };
    sock.on?.("notification:new", onNew);
    return () => sock.off?.("notification:new", onNew);
  }, [notifOpen, influencerId]);

  // mark one notification as read (optimistic) -> uses backend helper `post`
  async function markOneReadLocal(id: string) {
    if (!influencerId) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await post(`/notifications/influencer/mark-read`, {
        id,
        influencerId,
      });
    } catch (e) {
      console.error("Mark read failed", e);
      // rollback
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)));
      setUnreadCount((c) => c + 1);
    }
  }

  // mark all as read -> uses backend helper `post`
  async function markAllRead() {
    if (!influencerId || notifications.length === 0) return;
    const hadUnread = notifications.some((n) => !n.isRead);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (hadUnread) setUnreadCount(0);
    try {
      await post(`/notifications/influencer/mark-all-read`, {
        influencerId,
      });
    } catch (e) {
      console.error("Mark all read failed", e);
      // soft refetch
      try {
        const resp = await get<{ data?: any[]; unread?: number }>(
          `/notifications/influencer?recipientType=influencer&influencerId=${encodeURIComponent(influencerId)}&limit=15`
        );
        const list = (resp?.data ?? []).map(normalizeNotif);
        setNotifications(list);
        setUnreadCount(
          typeof resp?.unread === "number" ? resp.unread : list.filter((n) => !n.isRead).length
        );
      } catch {}
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

  async function onNotifClick(n: NotificationItem) {
    if (!n.isRead) await markOneReadLocal(n.id); // turn white + decrement bubble
    const path = n.actionPath || "/influencer/notifications";
    window.location.href = path;
  }

  const formattedExpiry = useMemo(
    () => (subscriptionExpiresAt ? new Date(subscriptionExpiresAt).toLocaleDateString() : ""),
    [subscriptionExpiresAt]
  );
  const planLabel = useMemo(
    () => (subscriptionName ? subscriptionName.charAt(0).toUpperCase() + subscriptionName.slice(1) : ""),
    [subscriptionName]
  );

  return (
    <header className="w-full bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] shadow-sm relative z-30">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-end h-16">
          {/* Left: Sidebar toggle */}
          <div className="flex items-center space-x-4">
            <button
              onClick={onSidebarOpen}
              className="md:hidden p-2 rounded-md hover:bg-gray-100 focus:outline-none"
              aria-label="Open sidebar"
            >
              <HiMenu size={24} className="text-gray-800" />
            </button>
          </div>

          {/* Right: Notifications, Profile & Name */}
          <div className="flex items-center space-x-6">
            {/* === Notifications bell === */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="relative p-2 rounded-md hover:bg-gray-100 focus:outline-none"
                aria-haspopup="menu"
                aria-expanded={notifOpen}
                aria-label="Notifications"
                title="Notifications"
              >
                <HiBell size={22} className="text-gray-900" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] leading-none rounded-full bg-red-600 text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-96 max-w-[95vw] bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-lg font-semibold text-gray-800">Notifications</p>
                    <button
                      onClick={markAllRead}
                      disabled={notifLoading || unreadCount === 0}
                      className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                      title="Mark all as read"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="max-h-96 overflow-auto">
                    {notifLoading ? (
                      <div className="p-4 text-sm text-gray-500">Loading…</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500">No notifications yet.</div>
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
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                                {n.message && (
                                  <p className="text-sm text-gray-700 mt-0.5">{n.message}</p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">{formatWhen(n.createdAt)}</p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="px-4 py-2 border-t border-gray-100">
                    <a
                      href="/influencer/notifications"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      View all
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* === Influencer name === */}
            {loading ? (
              <span className="text-gray-700 text-sm">Loading…</span>
            ) : error ? (
              <span className="text-red-600 text-sm">{error}</span>
            ) : (
              <span className="text-gray-900 font-medium text-lg">{influencerName || "—"}</span>
            )}

            {/* === Profile menu === */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center space-x-1 p-2 rounded-md hover:bg-gray-100 focus:outline-none"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <HiUserCircle size={24} className="text-gray-900" />
                <HiChevronDown size={16} className="text-gray-900" />
              </button>

              {menuOpen && !loading && !error && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-10"
                >
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-lg font-semibold text-gray-900">
                      {influencerName || "—"}
                    </p>
                    {email && <p className="text-sm text-gray-600">{email}</p>}
                    {planLabel && <p className="text-sm text-yellow-700">{planLabel} Plan</p>}
                    {formattedExpiry && <p className="text-xs text-gray-500">Expires: {formattedExpiry}</p>}
                  </div>
                  <ul className="py-1">
                    <li className="px-4 py-2 text-sm text-gray-800 hover:bg-gray-50">
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
