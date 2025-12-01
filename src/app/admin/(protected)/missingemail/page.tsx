"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Filter,
  Calendar,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Plus
} from "lucide-react";
import Swal from "sweetalert2";
import { post, post2 } from "@/lib/api";

/**
 * Types for /missing/list (handles without email yet; isAvailable = 0)
 */
export type MissingItem = {
  missingId: string;
  handle: string;
  platform: "youtube" | "instagram" | "tiktok" | string;
  createdAt: string; // ISO
  isAvailable?: number; // 0 or 1
};

export type MissingListResponse = {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  data: MissingItem[];
};

export type MissingListRequest = {
  page?: number;
  limit?: number; // default 50, max 200
  search?: string;
  platform?: string;
  handle?: string;
};

/**
 * Types for /admin/listMissingEmail (handles that already have email)
 */
export type MissingEmailItem = {
  missingEmailId: string;
  email: string;
  handle: string;
  platform: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  createdByAdminId?: string | null;
  youtube?: any;
};

export type MissingEmailListResponse = {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  data: MissingEmailItem[];
};

export type MissingEmailListRequest = {
  page?: number;
  limit?: number;
  search?: string;
  email?: string;
  handle?: string;
  createdByAdminId?: string;
};

/** UPDATED: reflect backend data with missingEmailId */
type AdminAddYouTubeEmailResponse = {
  message: string;
  data?: {
    missingEmailId: string;
    email: string;
    handle: string;
    platform: string;
    youtube?: any;
    createdAt?: string;
    updatedAt?: string;
  };
};

type SetAvailableResponse = {
  status: string;
  message: string;
  data?: any;
};

type UpdateMissingEmailResponse = {
  status: string;
  message: string;
  data?: any;
};

/** NEW: /newinvitations/update response */
type UpdateInvitationStatusResponse = {
  status: string;
  message: string;
  data?: any;
};

type ViewMode = "missing" | "available";

/** Thin typed wrapper around /missing/list */
async function listMissing(body: MissingListRequest): Promise<MissingListResponse> {
  return await post2<MissingListResponse>("/missing/list", body);
}

/** Wrapper for /admin/listMissingEmail */
async function listMissingEmails(
  body: MissingEmailListRequest
): Promise<MissingEmailListResponse> {
  return await post<MissingEmailListResponse>("/admin/listMissingEmail", body);
}

/** Wrapper for backend API to add missing handle/email + YouTube enrichment */
async function addMissingYouTubeDetails(body: {
  email: string;
  handle: string;
  createdByAdminId?: string;
}): Promise<AdminAddYouTubeEmailResponse> {
  return await post<AdminAddYouTubeEmailResponse>("/admin/addYouTubeEmail", body);
}

/** Wrapper for /missing/available to set isAvailable = 1 */
async function markMissingAvailable(missingId: string): Promise<SetAvailableResponse> {
  return await post2<SetAvailableResponse>("/missing/available", { missingId });
}

/** Wrapper for /admin/updateMissingEmail */
async function updateMissingEmail(body: {
  missingEmailId: string;
  email: string;
}): Promise<UpdateMissingEmailResponse> {
  return await post<UpdateMissingEmailResponse>("/admin/updateMissingEmail", body);
}

async function updateInvitationStatus(body: {
  handle: string;
  platform: string;
  status: "available";
  missingEmailId?: string;
}): Promise<UpdateInvitationStatusResponse> {
  return await post<UpdateInvitationStatusResponse>("/invitation/updateStatus", body);
}

// --- Small utilities ---
const prettyDate = (iso: string) => new Date(iso).toLocaleString();

const useDebouncedValue = (value: string, delay = 400) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
};

const getPlatformColor = (platform: string) => {
  switch (platform.toLowerCase()) {
    case "youtube":
    case "yt":
      return "bg-red-100 text-red-700 border-red-200";
    case "instagram":
    case "ig":
      return "bg-pink-100 text-pink-700 border-pink-200";
    case "tiktok":
    case "tt":
      return "bg-gray-900 text-white border-gray-900";
    default:
      return "bg-blue-100 text-blue-700 border-blue-200";
  }
};

const getPlatformIcon = (platform: string) => {
  switch (platform.toLowerCase()) {
    case "youtube":
    case "yt":
      return <div className="w-3.5 h-3.5 bg-red-600 rounded-sm"></div>;
    case "instagram":
    case "ig":
      return (
        <div className="w-3.5 h-3.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg"></div>
      );
    case "tiktok":
    case "tt":
      return <div className="w-3.5 h-3.5 bg-black rounded-full"></div>;
    default:
      return <div className="w-3.5 h-3.5 bg-blue-500 rounded"></div>;
  }
};

// --- Page component ---
export default function MissingListPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("missing");

  const [items, setItems] = useState<(MissingItem | MissingEmailItem)[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const [handle, setHandle] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 500);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"row" | "manual">("row");
  const [modalHandle, setModalHandle] = useState("");
  const [modalEmail, setModalEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [modalMissingId, setModalMissingId] = useState<string | null>(null); // for Missing
  const [modalMissingEmailId, setModalMissingEmailId] = useState<string | null>(
    null
  ); // for MissingEmail
  /** store platform for the modal row (so we can hit invitations/update) */
  const [modalPlatform, setModalPlatform] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (viewMode === "missing") {
        // Show only missing handles where isAvailable = 0 (backend already filtered)
        const body: MissingListRequest = {
          page,
          limit,
          search: debouncedSearch.trim() || undefined,
          platform: platform.trim() || undefined,
          handle: handle.trim() || undefined
        };

        const res = await listMissing(body);
        setItems(res.data);
        setTotal(res.total);
        setHasNext(res.hasNext);
      } else {
        // Available emails + handles (from MissingEmail)
        const body: MissingEmailListRequest = {
          page,
          limit,
          search: debouncedSearch.trim() || undefined,
          handle: handle.trim() || undefined
          // email filter could be added separately if needed
        };

        const res = await listMissingEmails(body);
        setItems(res.data);
        setTotal(res.total);
        setHasNext(res.hasNext);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, platform, handle, viewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset to first page when filters or view change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, platform, handle, viewMode]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(total / Math.max(1, limit))),
    [total, limit]
  );
  const hasActiveFilters = search || platform || handle;

  const clearFilters = () => {
    setSearch("");
    setPlatform("");
    setHandle("");
  };

  // --- Modal open helpers ---

  // For "Missing" table -> Add details (attach email to handle)
  const openModalForMissingRow = (row: MissingItem) => {
    setModalMode("row");
    setModalHandle(row.handle);
    setModalMissingId(row.missingId);
    setModalMissingEmailId(null);
    setModalEmail("");
    setModalPlatform(row.platform || "youtube"); // capture platform for invitations/update
    setModalOpen(true);
  };

  // For "Available" table -> Update email
  const openModalForAvailableRow = (row: MissingEmailItem) => {
    setModalMode("row");
    setModalHandle(row.handle);
    setModalEmail(row.email || "");
    setModalMissingEmailId(row.missingEmailId);
    setModalMissingId(null);
    setModalPlatform(row.platform || "youtube");
    setModalOpen(true);
  };

  // Manual add (no link to Missing or MissingEmail IDs)
  const openModalManual = () => {
    setModalMode("manual");
    setModalHandle("");
    setModalEmail("");
    setModalMissingId(null);
    setModalMissingEmailId(null);
    setModalPlatform(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setModalHandle("");
    setModalEmail("");
    setModalMissingId(null);
    setModalMissingEmailId(null);
    setModalPlatform(null);
  };

  // --- Save handler (calls backend) ---
  const handleSaveDetails = async () => {
    const email = modalEmail.trim();
    let handleVal = modalHandle.trim();

    if (!handleVal) {
      await Swal.fire("Missing handle", "Please enter a handle.", "warning");
      return;
    }
    if (!email) {
      await Swal.fire("Missing email", "Please enter an email address.", "warning");
      return;
    }

    if (!handleVal.startsWith("@")) handleVal = `@${handleVal}`;

    setSaving(true);
    try {
      // CASE A: We are editing an existing MissingEmail record -> UPDATE email
      if (modalMissingEmailId) {
        const res = await updateMissingEmail({
          missingEmailId: modalMissingEmailId,
          email
        });

        await Swal.fire(
          "Updated",
          res?.message || "Email updated successfully.",
          "success"
        );
      } else {
        // CASE B: We are creating / enriching a YouTube email entry
        const res = await addMissingYouTubeDetails({
          email,
          handle: handleVal
        });

        const missingEmailId = res?.data?.missingEmailId as string | undefined;

        // If the handle came from a Missing row, mark that missing record as available
        if (modalMissingId) {
          try {
            await markMissingAvailable(modalMissingId);
          } catch (e) {
            console.error("Failed to mark missing as available", e);
            // don't block overall success
          }

          // Also update invitation status to 'available' and attach missingEmailId
          if (modalPlatform) {
            try {
              await updateInvitationStatus({
                handle: handleVal,
                platform: modalPlatform.toLowerCase(),
                status: "available",
                ...(missingEmailId ? { missingEmailId } : {})
              });
            } catch (e) {
              console.error("Failed to update invitation status", e);
              // log but don't block success
            }
          }
        }

        await Swal.fire(
          "Saved",
          res?.message || "Details saved successfully.",
          "success"
        );
      }

      closeModal();
      fetchData();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save details. Please try again.";
      await Swal.fire("Error", msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = modalMissingEmailId
    ? "Update email for handle"
    : modalMode === "row"
      ? "Add details for missing handle"
      : "Add new handle & email";

  const primaryButtonLabel = modalMissingEmailId ? "Update email" : "Save details";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Missing Details</h1>
              <p className="text-gray-600">
                Track and manage missing or available creator information
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-sm">
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-gray-900">
                  {total.toLocaleString()}
                </span>
                <span className="text-gray-500">total items</span>
              </div>

              {/* View mode dropdown */}
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as ViewMode)}
                className="px-4 py-2 rounded-full bg-white border shadow-sm text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="missing">Missing emails / handles</option>
                <option value="available">Available email & handle</option>
              </select>

              {/* AddHandle button (works in both modes; manual add) */}
              <button
                onClick={openModalManual}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium shadow-sm hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>AddHandle</span>
              </button>
            </div>
          </div>
        </header>

        {/* Search and Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          {/* Main Search */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              placeholder={
                viewMode === "missing"
                  ? "Search by handle, platform or note..."
                  : "Search by handle, email or admin..."
              }
              className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filter Toggle */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <Filter className="w-4 h-4" />
              Advanced Filters
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Advanced Filters */}
          {filtersOpen && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Platform
                </label>
                <select
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  disabled={viewMode === "available"} // available list is YouTube-only in schema
                >
                  <option value="">All platforms</option>
                  <option value="youtube">YouTube</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                </select>
                {viewMode === "available" && (
                  <p className="mt-1 text-xs text-gray-400">
                    Available emails are currently stored only for YouTube.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Handle
                </label>
                <input
                  placeholder="@handle or handle"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                {viewMode === "missing" ? (
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <Th>Handle</Th>
                    <Th>Platform</Th>
                    <Th>Created</Th>
                    <Th>Actions</Th>
                  </tr>
                ) : (
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <Th>Handle</Th>
                    <Th>Email</Th>
                    <Th>Created</Th>
                    <Th>Actions</Th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && (
                  <tr>
                    <td colSpan={4} className="p-12 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        <span className="text-gray-600">Loading data...</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-12 text-center">
                      <div className="text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p className="font-medium">No results found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Missing view */}
                {!loading &&
                  viewMode === "missing" &&
                  (items as MissingItem[]).map((item, index) => (
                    <tr
                      key={item.missingId || `${item.handle}-${item.platform}-${index}`}
                      className="hover:bg-gray-50 transition-colors"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <Td>
                        <div className="font-medium text-gray-900">{item.handle}</div>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(item.platform)}
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getPlatformColor(
                              item.platform
                            )}`}
                          >
                            {item.platform}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4 opacity-50" />
                          <span className="text-sm">{prettyDate(item.createdAt)}</span>
                        </div>
                      </Td>
                      <Td>
                        <button
                          onClick={() => openModalForMissingRow(item)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                        >
                          Add details
                        </button>
                      </Td>
                    </tr>
                  ))}


                {/* Available view */}
                {!loading &&
                  viewMode === "available" &&
                  (items as MissingEmailItem[]).map((item, index) => (
                    <tr
                      key={item.missingEmailId || `${item.handle}-${index}`}
                      className="hover:bg-gray-50 transition-colors"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <Td>
                        <div className="font-medium text-gray-900">{item.handle}</div>
                      </Td>
                      <Td mono>
                        <span className="text-gray-800">{item.email}</span>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4 opacity-50" />
                          <span className="text-sm">{prettyDate(item.createdAt)}</span>
                        </div>
                      </Td>
                      <Td>
                        <button
                          onClick={() => openModalForAvailableRow(item)}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                        >
                          Update email
                        </button>
                      </Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Show</span>
                  <select
                    className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value, 10))}
                  >
                    {[25, 50, 100, 150, 200].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span>per page</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  Page <span className="font-medium">{page}</span> of{" "}
                  <span className="font-medium">{pageCount}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <button
                    className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!hasNext || loading}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-xs text-gray-500 bg-white rounded-xl p-4 border border-gray-200">
          <p>
            <strong>Tip:</strong> Use the view selector to switch between{" "}
            <span className="font-semibold">Missing emails/handles</span> and{" "}
            <span className="font-semibold">Available email &amp; handle</span>. In
            the Missing tab you can add details; in the Available tab you can update
            emails.
          </p>
        </div>
      </div>

      {/* Modal: Add details / AddHandle / Update email */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{modalTitle}</h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
                disabled={saving}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Handle
                </label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="@creatorhandle"
                  value={modalHandle}
                  onChange={(e) => setModalHandle(e.target.value)}
                  // When coming from a row (missing or available), handle is fixed
                  readOnly={modalMode === "row"}
                />
                {modalMode === "row" && (
                  <p className="mt-1 text-xs text-gray-500">
                    Handle is prefilled from the list.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="creator@example.com"
                  value={modalEmail}
                  onChange={(e) => setModalEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDetails}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {saving
                    ? modalMissingEmailId
                      ? "Updating..."
                      : "Saving..."
                    : primaryButtonLabel}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
      {children}
    </th>
  );
}

function Td({
  children,
  mono = false
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <td
      className={`px-6 py-4 whitespace-nowrap ${mono ? "font-mono text-sm" : ""
        }`}
    >
      {children}
    </td>
  );
}
