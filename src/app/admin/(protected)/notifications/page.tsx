"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { get, post } from "@/lib/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import {
  HiOutlineBell,
  HiOutlineRefresh,
  HiOutlineCheck,
  HiOutlineTrash,
  HiOutlineSearch,
  HiOutlineExternalLink,
} from "react-icons/hi";

type ActionPath =
  | string
  | {
      admin?: string;
      brand?: string;
      influencer?: string;
    };

type AdminNotification = {
  _id: string;
  adminId: string; // could be "ALL"
  type: string; // e.g. "campaign.pending_update"
  title: string;
  message: string;

  entityType?: string; // "campaign"
  entityId?: string; // campaignsId
  actionPath?: ActionPath;

  isRead?: boolean; // or read=0/1 depending on your schema
  read?: number; // optional legacy
  createdAt?: string;
  updatedAt?: string;
};

type ListResponse =
  | AdminNotification[]
  | {
      data: AdminNotification[];
      pagination?: { total: number; page: number; limit: number; totalPages: number };
    };

function isUnread(n: AdminNotification) {
  // supports isRead boolean or read number
  if (typeof n.isRead === "boolean") return !n.isRead;
  if (typeof n.read === "number") return n.read !== 1;
  return false;
}

function formatTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function getAdminActionPath(actionPath?: ActionPath) {
  if (!actionPath) return "";
  if (typeof actionPath === "string") return actionPath;
  return actionPath.admin || actionPath.brand || actionPath.influencer || "";
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // optional: /admin/notifications?adminId=xxxx
  const adminIdFromQuery = searchParams.get("adminId") || "";

  const [adminId, setAdminId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<AdminNotification[]>([]);

  // UI filters
  const [mode, setMode] = useState<"all" | "unread">("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  // load adminId from localStorage OR query OR default "ALL"
  useEffect(() => {
    const ls = typeof window !== "undefined" ? localStorage.getItem("adminId") : null;
    const resolved = adminIdFromQuery || ls || "ALL";
    setAdminId(resolved);
  }, [adminIdFromQuery]);

  const fetchNotifications = useCallback(async () => {
    if (!adminId) return;
    setLoading(true);
    setError(null);
    try {
      /**
       * ✅ Expected endpoints (adjust to your backend routes):
       * GET /notification/admin/list?adminId=...&includeAll=1
       * returns either array OR {data, pagination}
       */
      const includeAll = 1; // include notifications for adminId="ALL" if your backend supports it
      const res = await get<ListResponse>(
        `/notifications/admin?adminId=${encodeURIComponent(adminId)}&includeAll=${includeAll}`
      );

      const list = Array.isArray(res) ? res : res?.data || [];
      // sort newest first
      list.sort((a, b) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });

      setRows(list);
    } catch (e: any) {
      console.error(e);
      setError(e?.response?.data?.message || "Failed to load notifications.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const types = useMemo(() => uniq(rows.map((r) => r.type)), [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((n) => {
      if (mode === "unread" && !isUnread(n)) return false;
      if (typeFilter && n.type !== typeFilter) return false;

      if (!term) return true;
      const hay = `${n.title} ${n.message} ${n.type} ${n.entityType || ""} ${n.entityId || ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [rows, mode, search, typeFilter]);

  const unreadCount = useMemo(() => rows.filter(isUnread).length, [rows]);

  const setBusy = (id: string, v: boolean) => setBusyIds((p) => ({ ...p, [id]: v }));

  const markRead = useCallback(
    async (id: string) => {
      setBusy(id, true);
      try {
        await post(`/notifications/admin/mark-read`, { id, adminId });
        setRows((prev) =>
          prev.map((n) =>
            n._id === id ? { ...n, isRead: true, read: 1 } : n
          )
        );
      } catch (e) {
        console.error(e);
      } finally {
        setBusy(id, false);
      }
    },
    []
  );

  const markAllRead = useCallback(async () => {
    setBusy("__ALL__", true);
    try {

      await post(`/notifications/admin/mark-all-read`, { adminId, includeAll: 1 });
      setRows((prev) => prev.map((n) => ({ ...n, isRead: true, read: 1 })));
    } catch (e) {
      console.error(e);
    } finally {
      setBusy("__ALL__", false);
    }
  }, [adminId]);

  const deleteOne = useCallback(async (id: string) => {
    setBusy(id, true);
    try {
      await post(`/notifications/admin/delete`, { id, adminId });
      setRows((prev) => prev.filter((n) => n._id !== id));
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(id, false);
    }
  }, []);

  const openNotification = useCallback(
    async (n: AdminNotification) => {
      // mark read first (optional)
      if (isUnread(n)) {
        await markRead(n._id);
      }

      const path = getAdminActionPath(n.actionPath);
      if (path) router.push(path);
    },
    [markRead, router]
  );

  return (
    <div className="min-h-screen p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center">
            <HiOutlineBell className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-600">
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center">
                  <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                    {unreadCount} unread
                  </Badge>
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={fetchNotifications}
            disabled={loading || !!busyIds["__ALL__"]}
          >
            <HiOutlineRefresh className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Button
            onClick={markAllRead}
            disabled={loading || unreadCount === 0 || !!busyIds["__ALL__"]}
            className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white"
          >
            <HiOutlineCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <Button
                variant={mode === "all" ? "default" : "outline"}
                onClick={() => setMode("all")}
                className={mode === "all" ? "bg-gray-900 text-white" : ""}
              >
                All
              </Button>
              <Button
                variant={mode === "unread" ? "default" : "outline"}
                onClick={() => setMode("unread")}
                className={mode === "unread" ? "bg-gray-900 text-white" : ""}
              >
                Unread
              </Button>
            </div>

            <div className="relative">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notifications…"
                className="pl-10 h-11"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="">All types</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              {typeFilter && (
                <Button variant="outline" onClick={() => setTypeFilter("")}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="border-b border-gray-100">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Inbox ({filtered.length})
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-gray-600">
              No notifications found.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((n) => {
                const unread = isUnread(n);
                const path = getAdminActionPath(n.actionPath);

                return (
                  <div
                    key={n._id}
                    className={`flex flex-col gap-3 py-4 px-2 rounded-lg transition-colors ${
                      unread ? "bg-orange-50/50" : "bg-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-gray-900 truncate">
                            {n.title}
                          </div>
                          {unread && (
                            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                              Unread
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-gray-600">
                            {n.type}
                          </Badge>
                        </div>
                        <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap break-words">
                          {n.message}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          {formatTime(n.createdAt)}
                          {n.entityType && n.entityId ? (
                            <span className="ml-2">
                              • {n.entityType}: {n.entityId}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {path && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openNotification(n)}
                            disabled={!!busyIds[n._id]}
                            title="Open"
                          >
                            <HiOutlineExternalLink className="mr-1 h-4 w-4" />
                            Open
                          </Button>
                        )}

                        {unread && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markRead(n._id)}
                            disabled={!!busyIds[n._id]}
                            title="Mark as read"
                          >
                            <HiOutlineCheck className="mr-1 h-4 w-4" />
                            Read
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteOne(n._id)}
                          disabled={!!busyIds[n._id]}
                          title="Delete"
                          className="text-red-600 hover:text-red-700"
                        >
                          <HiOutlineTrash className="mr-1 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>

                    <Separator />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}