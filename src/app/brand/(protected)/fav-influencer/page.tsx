"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

const TABLE_GRADIENT_FROM = "#FFA135";
const TABLE_GRADIENT_TO = "#FF7236";
const PAGE_SIZE = 10;

const toast = (opts: { icon: "success" | "error"; title: string; text?: string }) =>
  Swal.fire({
    showConfirmButton: false,
    timer: 1200,
    timerProgressBar: true,
    background: "white",
    ...opts,
  });

interface FavInfluencerRow {
  rowId: string;
  invitationId?: string;

  // from API
  influencerId?: string | null; // may be null
  modashUserId?: string | null; // ✅ use this as userId for mediakit route
  influencerName: string;
  handle: string;
  platform: string;

  status?: string;
  createdAt?: string;
}

interface ApiMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const safeRowId = () => {
  const c: any = globalThis.crypto;
  return c?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeInvitationList = (list: any[]): FavInfluencerRow[] => {
  const arr = Array.isArray(list) ? list : [];
  return arr.map((x: any) => ({
    rowId: safeRowId(),
    invitationId: x?.invitationId || x?._id || x?.id,

    influencerId: x?.influencerId ?? null,
    modashUserId: x?.modashUserId ?? null,

    influencerName: String(x?.influencerName || "—"),
    handle: String(x?.handle || "—"),
    platform: String(x?.platform || "—"),

    status: x?.status,
    createdAt: x?.createdAt,
  }));
};

const normPlatform = (p?: string | null) =>
  String(p || "youtube").toLowerCase();

export default function FavoriteInfluencersPage() {
  const searchParams = useSearchParams();

  // NOTE: coming from table => /brand/fav-influencer?id=${c.id}
  // and c.id is campaignsId (uuid style) in your campaigns table
  const campaignsId = searchParams.get("id") || searchParams.get("campaignsId");

  const [rows, setRows] = useState<FavInfluencerRow[]>([]);
  const [meta, setMeta] = useState<ApiMeta>({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    pages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // ✅ Fetch favorites (POST)
  useEffect(() => {
    if (!campaignsId) {
      setError("Campaign id missing.");
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const endpoint = "/admin-invitations/get-by-campaign";

        const resp = await post<any>(endpoint, {
          campaignsId,
          page,
          limit: PAGE_SIZE,
          search: searchTerm.trim() || undefined,
        });

        const body = resp?.data && typeof resp.data === "object" ? resp.data : resp;

        const invitations = Array.isArray(body?.invitations) ? body.invitations : [];
        setRows(normalizeInvitationList(invitations));

        setMeta({
          total: Number(body?.total ?? invitations.length) || 0,
          page: Number(body?.page ?? page) || 1,
          limit: Number(body?.limit ?? PAGE_SIZE) || PAGE_SIZE,
          pages: Number(body?.pages ?? 1) || 1,
        });
      } catch (e: any) {
        console.error(e);
        setError(
          e?.response?.data?.message ||
            e?.message ||
            "Failed to load favorite influencers."
        );
        toast({ icon: "error", title: "Error", text: "Failed to load favorites." });
        setRows([]);
        setMeta({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignsId, page, searchTerm]);

  // If API doesn’t support search, still filter client-side safely:
  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((r) =>
      [r.influencerName, r.handle, r.platform].join(" ").toLowerCase().includes(term)
    );
  }, [rows, searchTerm]);

  const totalPages = meta?.pages || Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-4 rounded-md">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-gray-800">Favorite Influencers</h1>
        </div>
      </header>

      {/* Search */}
      <div className="mb-6 w-full">
        <div className="relative w-full sm:max-w-md">
          <HiSearch className="absolute inset-y-0 left-3 my-auto text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search favorites..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-6 space-y-2">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <p className="p-6 text-center text-destructive">{error}</p>
      ) : (
        <div className="bg-white rounded-md shadow-sm overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader
              className="text-white"
              style={{
                backgroundImage: `linear-gradient(
                  to right,
                  ${TABLE_GRADIENT_FROM},
                  ${TABLE_GRADIENT_TO}
                )`,
              }}
            >
              <TableRow>
                <TableHead className="font-semibold">Influencer Name</TableHead>
                <TableHead className="font-semibold text-center">Handle</TableHead>
                <TableHead className="font-semibold text-center">Platform</TableHead>
                <TableHead className="font-semibold text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredRows.length > 0 ? (
                filteredRows.map((r, idx) => {
                  const hoverGradient = `linear-gradient(to right, ${TABLE_GRADIENT_FROM}11, ${TABLE_GRADIENT_TO}11)`;

                  // ✅ Use modashUserId as userId for mediakit
                  const userId = r.modashUserId || null;
                  const platform = normPlatform(r.platform);
                  const handle = String(r.handle || "");

                  return (
                    <TableRow
                      key={r.rowId}
                      className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} transition-colors`}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundImage = hoverGradient)
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundImage = "")}
                    >
                      <TableCell className="font-medium">{r.influencerName}</TableCell>
                      <TableCell className="text-center">{r.handle}</TableCell>
                      <TableCell className="text-center">{r.platform}</TableCell>

                      {/* ✅ Actions: View (MediaKit) */}
                      <TableCell className="text-center">
                        {userId ? (
                          <Link
                            href={`/mediakit/${encodeURIComponent(userId)}?platform=${encodeURIComponent(
                              platform
                            )}&handle=${encodeURIComponent(handle)}`}
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
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    No favorite influencers found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center md:justify-end items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
          >
            <HiChevronLeft />
          </Button>

          <span className="text-sm">
            Page <strong>{page}</strong> of {totalPages}
          </span>

          <Button
            variant="outline"
            size="icon"
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
          >
            <HiChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}