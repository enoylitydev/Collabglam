/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { post } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  HiOutlineUser,
  HiOutlineCalendar,
  HiOutlineSearch,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
} from "react-icons/hi";
import { CheckCircle, Clock, XCircle, Copy, Dot, ShieldCheck, Hourglass, Ban } from "lucide-react";

interface Influencer {
  influencerId: string;
  name: string;
  handle: string;           // @handle
  category: string;         // e.g. "Electronics & Computers"
  audienceSize: number;     // present in API, hidden in UI
  createdAt: string;
  isAssigned: number;       // 1/0
  isContracted: number;     // 1/0
  contractId: string | null;
  feeAmount: string;        // string from API
  isAccepted: number;       // 1/0
  isRejected: number;       // 1/0
  rejectedReason: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type FilterKey = "all" | "approved" | "pending" | "rejected";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

export default function AppliedInfluencersPage() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaignId");
  const router = useRouter();

  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [applicantCount, setApplicantCount] = useState(0);

  const [meta, setMeta] = useState<Meta>({
    total: 0,
    page: 1,
    limit: PAGE_SIZE_OPTIONS[0],
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE_OPTIONS[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof Influencer>("createdAt");
  const [sortOrder, setSortOrder] = useState<1 | 0>(1);
  const [filter, setFilter] = useState<FilterKey>("all");

  // Navigate to details
  const handleViewDetails = (inf: Influencer) => {
    router.push(`/admin/influencers/view?influencerId=${inf.influencerId}`);
  };

  // Helpers
  const currency = (val?: string | number) => {
    const num = typeof val === "string" ? Number(val) : val ?? 0;
    if (Number.isNaN(num)) return "—";
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const copyText = async (text?: string | null) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const statusKey = (inf: Influencer): FilterKey => {
    if (inf.isRejected === 1) return "rejected";
    if (inf.isAccepted === 1) return "approved";
    if (inf.isAssigned === 1 && inf.isContracted === 1) return "pending";
    return "pending"; // treat unassigned/uncontracted as pending-review
  };

  // Fetch applicants
  useEffect(() => {
    if (!campaignId) {
      setError("No campaign selected.");
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const {
          meta: m,
          influencers: list,
          applicantCount: cnt,
        } = await post<{
          meta: Meta;
          influencers: Influencer[];
          applicantCount: number;
        }>("apply/list", {
          campaignId,
          page,
          limit,
          search: searchTerm.trim(),
          sortField,
          sortOrder,
        });
        setInfluencers(list);
        setApplicantCount(cnt);
        setMeta(m);
      } catch {
        setError("Failed to load applicants.");
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId, page, limit, searchTerm, sortField, sortOrder]);

  // Sorting helpers
  const toggleSort = (field: keyof Influencer) => {
    setPage(1);
    if (sortField === field) setSortOrder((o) => (o === 1 ? 0 : 1));
    else {
      setSortField(field);
      setSortOrder(1);
    }
  };

  const SortIndicator = ({ field }: { field: keyof Influencer }) =>
    sortField === field ? (
      sortOrder === 1 ? (
        <HiOutlineChevronDown className="inline ml-1 w-4 h-4" />
      ) : (
        <HiOutlineChevronUp className="inline ml-1 w-4 h-4" />
      )
    ) : null;

  // Stats + filtered list (client-side visual filters)
  const { approvedCount, pendingCount, rejectedCount, shown } = useMemo(() => {
    const approved = influencers.filter((i) => statusKey(i) === "approved");
    const pending = influencers.filter((i) => statusKey(i) === "pending");
    const rejected = influencers.filter((i) => statusKey(i) === "rejected");

    const shownList =
      filter === "all"
        ? influencers
        : filter === "approved"
        ? approved
        : filter === "pending"
        ? pending
        : rejected;

    return {
      approvedCount: approved.length,
      pendingCount: pending.length,
      rejectedCount: rejected.length,
      shown: shownList,
    };
  }, [influencers, filter]);

  // Render rows
  const rows = useMemo(
    () =>
      shown.map((inf) => {
        const initials = inf.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

        const statusBadge = (() => {
          const key = statusKey(inf);
          if (key === "rejected") {
            return (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
                <Dot className="h-5 w-5 -mx-1 text-red-500" />
                Rejected
              </span>
            );
          }
          if (key === "approved") {
            return (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">
                <Dot className="h-5 w-5 -mx-1 text-green-500" />
                Approved
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-xs text-yellow-800">
              <Dot className="h-5 w-5 -mx-1 text-yellow-500" />
              Pending
            </span>
          );
        })();

        return (
          <TableRow
            key={inf.influencerId}
            className="hover:bg-indigo-50/50 transition-colors"
          >
            {/* Name */}
            <TableCell className="whitespace-nowrap">
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold ring-1 ring-indigo-200">
                  {initials}
                </span>
                <span className="font-medium">{inf.name}</span>
              </span>
            </TableCell>

            {/* Handle */}
            <TableCell>
              <Badge variant="secondary" className="font-mono">
                {inf.handle}
              </Badge>
            </TableCell>

            {/* Category */}
            <TableCell>
              <Badge variant="secondary" className="capitalize">
                {inf.category}
              </Badge>
            </TableCell>

            {/* Date */}
            <TableCell className="whitespace-nowrap">
              <HiOutlineCalendar className="inline mr-1" />
              {new Date(inf.createdAt).toLocaleDateString()}
            </TableCell>

            {/* Contract ID with copy */}
            <TableCell className="font-mono text-xs">
              <div className="flex items-center gap-2">
                <span
                  className="truncate max-w-[220px]"
                  title={inf.contractId ?? ""}
                >
                  {inf.contractId ? inf.contractId : "—"}
                </span>
                {inf.contractId && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => copyText(inf.contractId)}
                    title="Copy Contract ID"
                    aria-label="Copy Contract ID"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </TableCell>

            {/* Fee */}
            <TableCell className="whitespace-nowrap">
              {currency(inf.feeAmount)}
            </TableCell>

            {/* Status */}
            <TableCell className="whitespace-nowrap">{statusBadge}</TableCell>

            {/* Actions */}
            <TableCell className="text-right">
              <Button
                size="sm"
                variant="outline"
                className="border-indigo-500 text-indigo-600 hover:bg-indigo-50"
                onClick={() => handleViewDetails(inf)}
              >
                View
              </Button>
            </TableCell>
          </TableRow>
        );
      }),
    [shown]
  );

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8 bg-gradient-to-b from-white to-indigo-50/40">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 rounded-xl border bg-gradient-to-r from-indigo-50 to-white p-4 shadow-sm">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900 tracking-tight">
            Applied Influencers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and review applicants for your campaign
          </p>
        </div>

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
          <StatCard
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Approved"
            value={approvedCount}
            tone="green"
          />
          <StatCard
            icon={<Hourglass className="h-4 w-4" />}
            label="Pending"
            value={pendingCount}
            tone="yellow"
          />
          <StatCard
            icon={<Ban className="h-4 w-4" />}
            label="Rejected"
            value={rejectedCount}
            tone="red"
          />
          <StatCard
            icon={<HiOutlineUser className="h-4 w-4" />}
            label="Applicants"
            value={applicantCount}
            tone="indigo"
          />
        </div>
      </header>

      {/* Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name, handle, category..."
              value={searchTerm}
              onChange={(e) => {
                setPage(1);
                setSearchTerm(e.target.value);
              }}
              className="pl-10 w-full"
            />
          </div>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="h-10 rounded-md border bg-white px-3 text-sm self-end sm:self-auto"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "approved", "pending", "rejected"] as FilterKey[]).map(
            (k) => (
              <Button
                key={k}
                variant={filter === k ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(k)}
                className={
                  filter === k
                    ? "bg-indigo-600 hover:bg-indigo-600 text-white"
                    : ""
                }
              >
                {k[0].toUpperCase() + k.slice(1)}
              </Button>
            )
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            Showing <strong>{shown.length}</strong> of {meta.total} results
          </span>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingSkeleton rows={limit} />
      ) : error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : shown.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-xl border bg-white shadow-sm overflow-x-auto">
          <Table className="min-w-[1160px]">
            <TableHeader className="sticky top-0 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-10">
              <TableRow>
                <TableHead
                  onClick={() => toggleSort("name")}
                  className="cursor-pointer select-none"
                >
                  Name <SortIndicator field="name" />
                </TableHead>
                <TableHead
                  onClick={() => toggleSort("handle")}
                  className="cursor-pointer select-none"
                >
                  Handle <SortIndicator field="handle" />
                </TableHead>
                <TableHead
                  onClick={() => toggleSort("category")}
                  className="cursor-pointer select-none"
                >
                  Category <SortIndicator field="category" />
                </TableHead>
                <TableHead
                  onClick={() => toggleSort("createdAt")}
                  className="cursor-pointer select-none"
                >
                  Date <SortIndicator field="createdAt" />
                </TableHead>
                <TableHead>Contract ID</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{rows}</TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex justify-center md:justify-end items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            className="rounded-full"
            aria-label="Previous page"
          >
            <HiChevronLeft />
          </Button>
          <span className="text-sm">
            Page <strong>{page}</strong> of {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page === meta.totalPages}
            onClick={() => setPage((p) => Math.min(p + 1, meta.totalPages))}
            className="rounded-full"
            aria-label="Next page"
          >
            <HiChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "green" | "yellow" | "red" | "indigo";
}) {
  const toneClasses: Record<typeof tone, string> = {
    green: "bg-green-50 text-green-700 ring-green-200",
    yellow: "bg-yellow-50 text-yellow-700 ring-yellow-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  } as const;

  return (
    <Card className={`shadow-none ring-1 ${toneClasses[tone]} ring-inset`}>
      <CardContent className="p-3 flex items-center gap-2">
        <span className="h-7 w-7 inline-flex items-center justify-center rounded-full bg-white/70">
          {icon}
        </span>
        <div>
          <div className="text-xs">{label}</div>
          <div className="text-lg font-semibold leading-none">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

const EmptyState = () => (
  <div className="rounded-xl border bg-white shadow-sm p-10 text-center">
    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
      <HiOutlineSearch className="h-6 w-6" />
    </div>
    <h3 className="text-lg font-semibold">No matching influencers</h3>
    <p className="text-sm text-muted-foreground mt-1">
      Try adjusting your filters or search query.
    </p>
  </div>
);

const LoadingSkeleton = ({ rows }: { rows: number }) => (
  <div className="p-6 space-y-2">
    {Array(rows)
      .fill(0)
      .map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
  </div>
);

const ErrorMessage: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <p className="p-6 text-center text-destructive">{children}</p>;
