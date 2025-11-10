"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { get, post } from "@/lib/api";
import { HiBell, HiCheckCircle, HiTrash } from "react-icons/hi";
import Swal from "sweetalert2";

type NotificationItem = {
  id: string;
  title: string;
  message?: string;
  createdAt: string;
  isRead?: boolean;
  actionPath?: string;
  type?: string;
  entityId?: string;
};

type ListResp = {
  data: any[];
  total?: number;
  unread?: number;
};

function normalize(n: any): NotificationItem {
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

export default function InfluencerNotificationsPage() {
  const router = useRouter();

  const [influencerId, setInfluencerId] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
    setInfluencerId(id);
  }, []);

  useEffect(() => {
    if (!influencerId) {
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const resp = await get<ListResp>(
          `/notifications/influencer?recipientType=influencer&influencerId=${encodeURIComponent(
            influencerId
          )}&page=${page}&limit=${limit}`,
          { signal: ac.signal as any } as any
        );

        const list = (resp?.data ?? []).map(normalize);
        setItems((prev) => (page === 1 ? list : [...prev, ...list]));
        setTotal(typeof resp?.total === "number" ? resp.total : null);
        setUnreadCount(
          typeof resp?.unread === "number" ? resp.unread : list.filter((n) => !n.isRead).length
        );
      } catch (e) {
        if ((e as any)?.name !== "AbortError") console.error("Load notifications failed", e);
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [influencerId, page, limit]);

  const filtered = useMemo(() => {
    if (filter === "unread") return items.filter((i) => !i.isRead);
    if (filter === "read") return items.filter((i) => i.isRead);
    return items;
  }, [items, filter]);

  const canLoadMore = useMemo(() => {
    if (filter !== "all") return false;
    if (total !== null) return items.length < total;
    return items.length >= page * limit;
  }, [items.length, total, page, limit, filter]);

  function formatWhen(iso: string) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      if (hrs < 24) return `${hrs}h ago`;
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString();
    } catch {
      return "";
    }
  }

  async function markOneRead(id: string) {
    if (!influencerId) return;
    setBusy(true);
    const wasUnread = items.find((n) => n.id === id && !n.isRead) ? 1 : 0;

    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await post(`/notifications/influencer/mark-read`, { id, influencerId });
    } catch (e) {
      console.error("Mark read failed", e);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)));
      if (wasUnread) setUnreadCount((c) => c + 1);
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    if (!influencerId) return;
    setBusy(true);
    const hadUnread = items.some((n) => !n.isRead);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (hadUnread) setUnreadCount(0);
    try {
      await post(`/notifications/influencer/mark-all-read`, { influencerId });
      await Swal.fire({
        icon: "success",
        title: "Marked all as read",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (e) {
      console.error("Mark all read failed", e);
      setPage(1);
      await Swal.fire({
        icon: "error",
        title: "Failed to mark all as read",
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteNotification(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!influencerId) return;

    const confirm = await Swal.fire({
      title: "Delete this notification?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      reverseButtons: true,
      focusCancel: true,
    });

    if (!confirm.isConfirmed) return;

    setBusy(true);
    const removedItem = items.find((n) => n.id === id) || null;
    const wasUnread = removedItem && !removedItem.isRead ? 1 : 0;

    setItems((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await post(`/notifications/influencer/delete`, { id, influencerId });
      await Swal.fire({
        icon: "success",
        title: "Deleted",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (e) {
      console.error("Delete failed", e);
      if (removedItem) setItems((prev) => [removedItem, ...prev]);
      if (wasUnread) setUnreadCount((c) => c + 1);
      await Swal.fire({
        icon: "error",
        title: "Failed to delete",
      });
    } finally {
      setBusy(false);
    }
  }

  async function openItem(n: NotificationItem) {
    if (!n.isRead) await markOneRead(n.id);
    const path = n.actionPath || "/influencer/notifications";
    router.push(path);
  }

  return (
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] rounded-xl flex items-center justify-center shadow-lg">
                  <HiBell className="text-gray-800" size={24} />
                </div>
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg animate-pulse">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Notifications
                </h1>
                <p className="text-sm text-slate-500 mt-0.5">Stay updated with your activity</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={markAllRead}
                disabled={busy || unreadCount === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 text-sm font-medium hover:from-[#FFB800] hover:to-[#FFD040] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <HiCheckCircle size={18} />
                <span>Mark all read</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="inline-flex items-center rounded-xl bg-slate-100 p-1 gap-1">
            {(["all", "unread", "read"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  filter === f
                    ? "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 shadow-md"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {f === "all" ? "All" : f === "unread" ? "Unread" : "Read"}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {loading && page === 1 ? (
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-12 text-center">
              <div className="inline-block w-12 h-12 border-4 border-slate-200 border-t-[#FFBF00] rounded-full animate-spin"></div>
              <p className="mt-4 text-slate-600">Loading notifications...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-12 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HiBell className="text-slate-400" size={40} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No notifications</h3>
              <p className="text-slate-500">You're all caught up!</p>
            </div>
          ) : (
            <>
              {filtered.map((n, idx) => (
                <div
                  key={n.id}
                  onClick={() => openItem(n)}
                  style={{ animationDelay: `${idx * 50}ms` }}
                  className={`group relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border transition-all duration-300 cursor-pointer hover:shadow-xl hover:scale-[1.01] animate-[slideIn_0.3s_ease-out_forwards] ${
                    n.isRead
                      ? "border-white/20"
                      : "border-yellow-300 bg-gradient-to-r from-yellow-50/60 to-yellow-100/60"
                  }`}
                >
                  {/* Unread indicator bar (brand yellow) */}
                  {!n.isRead && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#FFBF00] to-[#FFDB58]"></div>
                  )}

                  <div className="p-5 flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                        n.isRead
                          ? "bg-slate-100"
                          : "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58]"
                      }`}
                    >
                      <HiBell className={n.isRead ? "text-slate-500" : "text-gray-900"} size={20} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <h3
                          className={`text-base font-semibold ${
                            n.isRead ? "text-slate-700" : "text-slate-900"
                          }`}
                        >
                          {n.title}
                        </h3>
                        <span className="flex-shrink-0 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {formatWhen(n.createdAt)}
                        </span>
                      </div>
                      {n.message && (
                        <p
                          className={`text-sm leading-relaxed ${
                            n.isRead ? "text-slate-600" : "text-slate-700"
                          }`}
                        >
                          {n.message}
                        </p>
                      )}
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => deleteNotification(e, n.id)}
                      disabled={busy}
                      className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200 disabled:opacity-50 opacity-0 group-hover:opacity-100"
                      title="Delete notification"
                    >
                      <HiTrash size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Load More */}
        {filtered.length > 0 && filter === "all" && (
          <div className="flex justify-center pt-6">
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={loading || !canLoadMore}
              className="px-8 py-3 text-sm font-medium rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-[#FFBF00] rounded-full animate-spin"></div>
                  Loading...
                </span>
              ) : canLoadMore ? (
                "Load more"
              ) : (
                "No more notifications"
              )}
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
