"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  HiOutlineRefresh,
  HiCheckCircle,
  HiExclamationCircle,
  HiSearch,
  HiChevronLeft,
  HiChevronRight,
} from "react-icons/hi";
import Swal from "sweetalert2";

// ───────────────── Types ─────────────────

type PayoutStatus = "initiated" | "paid";

interface AdminPayout {
  milestoneHistoryId: string;
  milestoneId: string;
  brandId: string;
  brandName?: string;
  influencerId: string;
  influencerName?: string;
  influencerEmail?: string;
  campaignId: string;
  campaignTitle?: string;
  amount: number;
  payoutStatus: PayoutStatus;
  createdAt: string;
  releasedAt?: string;
}

interface PayoutListResponse {
  message: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: AdminPayout[];
}

// ─────────────── Helpers ────────────────

const formatDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const formatCurrency = (amt: number) =>
  amt.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

const statusBadge = (status?: PayoutStatus) => {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <HiCheckCircle className="h-4 w-4" />
        Paid
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
      <HiExclamationCircle className="h-4 w-4" />
      Initiated (Pending)
    </span>
  );
};

// ───────────── Main Component ────────────

export default function AdminPaymentPage() {
  const router = useRouter();

  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [limit] = useState<number>(10);

  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | PayoutStatus>("all");

  // ── Fetch payouts from backend ──
  const fetchPayouts = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        page,
        limit,
      };

      if (search.trim()) {
        payload.search = search.trim();
      }

      // IMPORTANT: send `status` not `payoutStatus`
      if (statusFilter !== "all") {
        payload.status = statusFilter; // "initiated" | "paid"
      }

      const data = await post<PayoutListResponse>(
        "/admin/milestone/payout",
        payload
      );

      setPayouts(data.items || []);
      setPage(data.page);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || data.items?.length || 0);
    } catch (err: any) {
      setError(err.message || "Failed to load payouts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);


  // ── Mark milestone as paid (admin action) ──
  const handleMarkPaid = async (row: AdminPayout) => {
    const confirm = await Swal.fire({
      icon: "question",
      title: "Mark as paid?",
      text: `Are you sure you want to mark this payout as PAID to ${
        row.influencerName || row.influencerId
      }?`,
      showCancelButton: true,
      confirmButtonText: "Yes, mark as paid",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#22c55e",
    });

    if (!confirm.isConfirmed) return;

    try {
      await post("/admin/milestone/update", {
        milestoneId: row.milestoneId,
        milestoneHistoryId: row.milestoneHistoryId,
        payoutStatus: "paid",
      });

      Swal.fire({
        icon: "success",
        title: "Marked as paid",
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });

      fetchPayouts();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.message || "Failed to update payout status.",
      });
    }
  };

  // ── Navigation helpers (GET pages expect id in query params) ──

  const handleViewInfluencer = (influencerId: string) => {
    // /admin/influencer/getById? id   <-- page itself will call this GET
    router.push(`/admin/influencers/view?influencerId=${influencerId}`);
  };

  const handleViewBrand = (brandId: string) => {
    // /admin/brand/getById? id
    router.push(`/admin/brands/view?brandId=${brandId}`);
  };

  const handleViewCampaign = (campaignId: string) => {
    // /admin/campaign/getById? id
    router.push(`/admin/campaigns/view?id=${campaignId}`);
  };

  // ─────────────── Render ────────────────

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Milestone Payouts</h1>
          <p className="text-sm text-gray-500 mt-1">
            All milestones released by brands that require admin payout approval.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search brand / influencer / campaign..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  fetchPayouts();
                }
              }}
              className="pl-9"
            />
          </div>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val as "all" | PayoutStatus);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-40 bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="initiated">Initiated</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Card className="space-y-3 p-4">
          {Array.from({ length: limit }).map((_, i) => (
            <div
              key={i}
              className="h-6 w-full bg-gray-200 animate-pulse rounded"
            />
          ))}
        </Card>
      ) : error ? (
        <Card className="p-6 text-red-600 font-medium text-center">
          {error}
        </Card>
      ) : payouts.length === 0 ? (
        <Card className="p-10 text-center text-gray-500">
          No payouts found.
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden shadow-sm border border-gray-100">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Brand</TableHead>
                <TableHead>Influencer</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Released At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.map((p) => (
                <TableRow
                  key={p.milestoneHistoryId}
                  className="hover:bg-gray-50"
                >
                  {/* Brand */}
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      onClick={() => handleViewBrand(p.brandId)}
                      className="text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {p.brandName || p.brandId}
                    </button>
                  </TableCell>

                  {/* Influencer */}
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => handleViewInfluencer(p.influencerId)}
                      className="text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      {p.influencerName || p.influencerId}
                    </button>
                    {p.influencerEmail && (
                      <div className="text-xs text-gray-500">
                        {p.influencerEmail}
                      </div>
                    )}
                  </TableCell>

                  {/* Campaign */}
                  <TableCell className="max-w-xs">
                    <button
                      type="button"
                      onClick={() => handleViewCampaign(p.campaignId)}
                      className="text-blue-600 hover:text-blue-700 hover:underline text-left w-full"
                    >
                      <span
                        className="block truncate"
                        title={p.campaignTitle || p.campaignId}
                      >
                        {p.campaignTitle || p.campaignId}
                      </span>
                    </button>
                  </TableCell>

                  {/* Amount */}
                  <TableCell className="whitespace-nowrap">
                    {formatCurrency(p.amount)}
                  </TableCell>

                  {/* Released / Created */}
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(p.releasedAt || p.createdAt)}
                  </TableCell>

                  {/* Status */}
                  <TableCell>{statusBadge(p.payoutStatus)}</TableCell>

                  {/* Action */}
                  <TableCell className="text-right">
                    {p.payoutStatus === "paid" ? (
                      <span className="text-xs text-emerald-600 font-semibold">
                        Already paid
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => handleMarkPaid(p)}
                      >
                        Mark as Paid
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {!loading && !error && payouts.length > 0 && (
        <div className="flex justify-between items-center p-4">
          <div className="text-sm text-gray-700">
            Showing {(page - 1) * limit + 1}–
            {Math.min(page * limit, total)} of {total}
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
            >
              <HiChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            >
              <HiChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
