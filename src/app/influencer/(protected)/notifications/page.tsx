// src/app/influencer/notifications/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { get, post } from "@/lib/api";
import { HiBell, HiCheckCircle, HiOutlineRefresh, HiTrash } from "react-icons/hi";
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

// normalize server docs to { id, ... }
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

  // Load page
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
      return d.toLocaleString();
    } catch {
      return "";
    }
  }

  // mark one read (optimistic) using backend helper
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
      // rollback
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: false } : n)));
      if (wasUnread) setUnreadCount((c) => c + 1);
    } finally {
      setBusy(false);
    }
  }

  // mark all read (optimistic)
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
      // on failure refresh
      setPage(1);
      await Swal.fire({
        icon: "error",
        title: "Failed to mark all as read",
      });
    } finally {
      setBusy(false);
    }
  }

  // delete notification (destructive) with swal confirm
  async function deleteNotification(e: React.MouseEvent, id: string) {
    e.stopPropagation(); // don't open the tile
    if (!influencerId) return;

    const confirm = await Swal.fire({
      title: "Delete this notification?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626", // red-600
    });

    if (!confirm.isConfirmed) return;

    setBusy(true);
    const removedItem = items.find((n) => n.id === id) || null;
    const wasUnread = removedItem && !removedItem.isRead ? 1 : 0;

    // optimistic remove
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
      // rollback if we have the item
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

  // open -> mark read then navigate
  async function openItem(n: NotificationItem) {
    if (!n.isRead) await markOneRead(n.id);
    const path = n.actionPath || "/influencer/notifications";
    router.push(path);
  }

  function refresh() {
    setItems([]);
    setTotal(null);
    setPage(1);
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <HiBell className="text-gray-800" size={24} />
          <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
          <span className="ml-2 text-sm rounded-full bg-gray-100 px-2 py-0.5 text-gray-800">
            Unread: {unreadCount}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50"
            title="Refresh"
          >
            <HiOutlineRefresh /> Refresh
          </button>
          <button
            onClick={markAllRead}
            disabled={busy || unreadCount === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border text-sm hover:bg-gray-50 disabled:opacity-50"
            title="Mark all as read"
          >
            <HiCheckCircle /> Mark all read
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 inline-flex items-center rounded-md border bg-white">
        {(["all", "unread", "read"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm border-r last:border-r-0 ${
              filter === f ? "bg-gray-100 font-medium" : "hover:bg-gray-50"
            }`}
          >
            {f === "all" ? "All" : f === "unread" ? "Unread" : "Read"}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-lg border">
        {loading && page === 1 ? (
          <div className="p-6 text-sm text-gray-600">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-gray-600">No notifications.</div>
        ) : (
          <ul className="divide-y">
            {filtered.map((n) => (
              <li
                key={n.id}
                onClick={() => openItem(n)}
                className={`p-4 flex items-start gap-3 cursor-pointer ${
                  n.isRead ? "bg-white" : "bg-yellow-50"
                } hover:bg-gray-50`}
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-gray-900">{n.title}</h3>
                    <span className="text-xs text-gray-500">{formatWhen(n.createdAt)}</span>
                  </div>
                  {n.message && <p className="mt-1 text-sm text-gray-700">{n.message}</p>}
                </div>

                <button
                  onClick={(e) => deleteNotification(e, n.id)}
                  disabled={busy}
                  className="self-center inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-red-500 text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50"
                  title="Delete notification"
                >
                  <HiTrash />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pager */}
      {filtered.length > 0 && filter === "all" && (
        <div className="flex justify-center py-4">
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={loading || !canLoadMore}
            className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {canLoadMore ? "Load more" : "No more"}
          </button>
        </div>
      )}
    </main>
  );
}
