"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { post } from "@/lib/api";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { HiChevronLeft, HiChevronRight, HiSearch } from "react-icons/hi";
import { Info } from "lucide-react";

const PAGE_SIZE = 10;

const toast = (opts: { icon: "success" | "error"; title: string; text?: string }) =>
  Swal.fire({
    showConfirmButton: false,
    timer: 1200,
    timerProgressBar: true,
    background: "white",
    ...opts,
  });

type InvitationRow = {
  invitationId: string;
  influencerName: string;
  handle: string;
  platform: string;
  modashUserId?: string | null; // ✅ used as userId for mediakit
  influencerId?: string | null;
  createdAt?: string;
  status?: string;
  brandId?: string;
};

type ApiMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

const normPlatform = (p?: string | null) =>
  String(p || "youtube").toLowerCase();

const LoadingSkeleton = ({ rows }: { rows: number }) => (
  <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg animate-pulse">
    <div className="p-6 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-md" />
      ))}
    </div>
  </div>
);

export default function AdminFavoriteInfluencersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ✅ campaignsId coming from link: /admin/brands/fav-influencer?id=<campaignsId>&brandId=<brandId>
  const campaignsId = searchParams.get("id") || searchParams.get("campaignsId");
  const brandId = searchParams.get("brandId");

  const [rows, setRows] = useState<InvitationRow[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const withBrandId = useCallback(
    (url: string) => {
      if (!brandId) return url;
      const join = url.includes("?") ? "&" : "?";
      return `${url}${join}brandId=${encodeURIComponent(brandId)}`;
    },
    [brandId]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search.trim());
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchInvitations = useCallback(async () => {
    if (!campaignsId) {
      setError("campaignsId missing in URL.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resp = await post<any>("/admin-invitations/get-by-campaign", {
        campaignsId,
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined, // if backend supports it
      });

      const body = resp?.data && typeof resp.data === "object" ? resp.data : resp;
      const invitationsRaw: any[] = Array.isArray(body?.invitations) ? body.invitations : [];

      // ✅ Normalize
      let normalized: InvitationRow[] = invitationsRaw.map((x: any) => ({
        invitationId: String(x?.invitationId || x?._id || x?.id || ""),
        influencerName: String(x?.influencerName || "—"),
        handle: String(x?.handle || "—"),
        platform: String(x?.platform || "—"),
        modashUserId: x?.modashUserId ?? null,
        influencerId: x?.influencerId ?? null,
        createdAt: x?.createdAt,
        status: x?.status,
        brandId: x?.brandId,
      }));

      // ✅ If admin page is brand-scoped, filter by brandId (safe)
      if (brandId) {
        normalized = normalized.filter((r) => String(r.brandId || "") === String(brandId));
      }

      // ✅ If backend doesn't support `search`, also do client-side search
      const term = debouncedSearch.trim().toLowerCase();
      if (term) {
        normalized = normalized.filter((r) =>
          [r.influencerName, r.handle, r.platform].join(" ").toLowerCase().includes(term)
        );
      }

      setRows(normalized);

      // ✅ Use backend meta if present, else compute
      const total = Number(body?.total ?? normalized.length) || 0;
      const pages = Number(body?.pages ?? Math.max(1, Math.ceil(total / PAGE_SIZE))) || 1;

      setMeta({
        page: Number(body?.page ?? page) || page,
        limit: Number(body?.limit ?? PAGE_SIZE) || PAGE_SIZE,
        total,
        pages,
      });
    } catch (e: any) {
      console.error(e);
      setRows([]);
      setMeta({ page: 1, limit: PAGE_SIZE, total: 0, pages: 1 });
      setError(e?.response?.data?.message || e?.message || "Failed to load favorite influencers.");
      toast({ icon: "error", title: "Error", text: "Failed to load favorites." });
    } finally {
      setLoading(false);
    }
  }, [campaignsId, brandId, page, debouncedSearch]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const totalPages = meta.pages || 1;

  return (
    <div className="p-6 min-h-screen bg-white text-black">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Favorite Influencers</h1>
          <p className="text-xs text-gray-600 mt-1">
            Campaigns ID: <span className="font-semibold text-black">{campaignsId || "—"}</span>
            {brandId ? (
              <>
                {" "}
                · Brand ID: <span className="font-semibold text-black">{brandId}</span>
              </>
            ) : null}
            {" "}
            · Total: <span className="font-semibold text-black">{meta.total}</span>
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="bg-white text-black border border-gray-300 hover:bg-gray-100"
          onClick={() => router.back()}
        >
          Back
        </Button>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-md">
        <div className="relative">
          <HiSearch className="absolute inset-y-0 left-3 my-auto text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search favorites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black text-sm"
          />
        </div>
      </div>

      {!campaignsId ? (
        <div className="mb-3 rounded-lg border border-gray-300 bg-white p-3 text-sm">
          <span className="font-semibold">Error:</span> campaignsId missing in URL.
        </div>
      ) : null}

      {error ? (
        <div className="mb-3 rounded-lg border border-gray-300 bg-white p-3 text-sm">
          <span className="font-semibold">Error:</span> {error}
        </div>
      ) : null}

      {/* Table */}
      {loading ? (
        <LoadingSkeleton rows={PAGE_SIZE} />
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-700">No favorite influencers found.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader className="bg-black text-white">
                <TableRow>
                  <TableHead className="font-medium text-white">Influencer</TableHead>
                  <TableHead className="font-medium text-white text-center">Handle</TableHead>
                  <TableHead className="font-medium text-white text-center">Platform</TableHead>
                  <TableHead className="font-medium text-white text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((r, idx) => {
                  const userId = r.modashUserId || null;
                  const platform = normPlatform(r.platform);
                  const handle = String(r.handle || "");

                  return (
                    <TableRow
                      key={r.invitationId || `${idx}`}
                      className={[
                        "border-b last:border-b-0",
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50",
                        "hover:bg-gray-100 transition-colors",
                      ].join(" ")}
                    >
                      <TableCell className="font-semibold text-black">
                        {r.influencerName}
                      </TableCell>

                      <TableCell className="text-center">{r.handle}</TableCell>

                      <TableCell className="text-center">{r.platform}</TableCell>

                      <TableCell className="text-center">
                        {userId ? (
                          <Link
                            href={`/mediakit/${encodeURIComponent(
                              userId
                            )}?platform=${encodeURIComponent(platform)}&handle=${encodeURIComponent(
                              handle
                            )}`}
                            className="inline-flex px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg transition-colors items-center justify-center gap-2"
                            title="View MediaKit"
                          >
                            <Info className="w-4 h-4" />
                            View
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex px-4 py-2 border border-slate-200 text-slate-400 text-sm font-medium rounded-lg cursor-not-allowed items-center justify-center gap-2"
                            disabled
                            title="No modashUserId found"
                          >
                            <Info className="w-4 h-4" />
                            View
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-end items-center p-4 space-x-3">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
            className="p-2 border border-gray-300 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-white"
          >
            <HiChevronLeft size={20} />
          </button>

          <span className="text-sm text-gray-700">
            Page <span className="font-semibold text-black">{page}</span> of{" "}
            <span className="font-semibold text-black">{totalPages}</span>
          </span>

          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            className="p-2 border border-gray-300 rounded-full hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-white"
          >
            <HiChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}