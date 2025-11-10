"use client";

import React from "react";
import Link from "next/link";
import { post } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  HiOutlineRefresh,
  HiOutlineEye,
  HiChevronUp,
  HiChevronDown,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineClipboardList,
} from "react-icons/hi";
import { Instagram, Youtube } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";

// ---------------- Types ----------------
interface GetListResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  influencers: Influencer[];
}

interface Influencer {
  influencerId: string;
  name: string;
  email: string;
  phone?: string;
  primaryPlatform?: string | null;
  planName?: string; // flat per backend
  expiresAt?: string | null; // flat per backend (ISO)
  subscriptionExpired?: boolean; // flat per backend
}

// -------------- Constants --------------
const API_ENDPOINT = "/admin/influencer/list"; // unified backend path

const HEADERS: { key: keyof Influencer | "status" | "planName" | "expiresAt" | "primaryPlatform" | "name" | "email" | "phone"; label: string; sortable?: boolean }[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "email", label: "Email", sortable: true },
  { key: "phone", label: "Phone", sortable: true },
  { key: "primaryPlatform", label: "Platform", sortable: true },
  { key: "planName", label: "Plan", sortable: true },
  { key: "expiresAt", label: "Expires", sortable: true },
  { key: "status", label: "Status", sortable: false },
];

function formatDate(d?: string | null) {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysUntil(d?: string | null) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  const MS = 24 * 60 * 60 * 1000;
  return Math.ceil((date.getTime() - Date.now()) / MS);
}

function PlatformBadge({ platform }: { platform?: string | null }) {
  const p = (platform || "").toLowerCase();
  if (p === "instagram")
    return (
      <div className="flex items-center gap-2">
        <Instagram className="h-4 w-4" />
        <span className="capitalize">{p}</span>
      </div>
    );
  if (p === "youtube")
    return (
      <div className="flex items-center gap-2">
        <Youtube className="h-4 w-4" />
        <span className="capitalize">{p}</span>
      </div>
    );
  if (p === "tiktok")
    return <span className="capitalize">{p}</span>;
  return <span className="text-muted-foreground">—</span>;
}

function StatusBadge({ expired }: { expired?: boolean }) {
  return (
    <Badge variant={expired ? "destructive" : "default"} className={cn("rounded-full px-3", expired ? "bg-red-600 hover:bg-red-600" : "bg-emerald-600 hover:bg-emerald-600")}>
      {expired ? "Expired" : "Active"}
    </Badge>
  );
}

// -------------- Page Component --------------
const AdminInfluencersPage = () => {
  const [rows, setRows] = React.useState<Influencer[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const [page, setPage] = React.useState<number>(1);
  const [limit, setLimit] = React.useState<number>(10);
  const [totalPages, setTotalPages] = React.useState<number>(1);

  const [search, setSearch] = React.useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>("");

  const [sortBy, setSortBy] = React.useState<string>("name");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");

  // Debounce search input
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 450);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit, search: debouncedSearch, sortBy, sortOrder };
      const res = await post<GetListResponse>(API_ENDPOINT, params);
      setRows(res.influencers || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
      setError(null);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load influencers.");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sortBy, sortOrder]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleSort = (field: string, allowed: boolean) => {
    if (!allowed) return;
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const ALLOWED_SORT = new Set([
    "name",
    "email",
    "phone",
    "primaryPlatform",
    "planName",
    "expiresAt",
    "createdAt",
  ]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Influencers</h1>
          <p className="text-sm text-muted-foreground">Admin overview of all creators, plans, and statuses.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search by name, email, platform..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-[280px]"
          />
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <HiOutlineRefresh className={loading ? "animate-spin" : ""} />
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader >
              <TableRow>
                {HEADERS.map(({ key, label, sortable }) => (
                  <TableHead
                    key={String(key)}
                    onClick={() => toggleSort(String(key), !!sortable && ALLOWED_SORT.has(String(key)))}
                    className={cn("select-none", sortable && ALLOWED_SORT.has(String(key)) ? "cursor-pointer" : "")}
                  >
                    <div className="flex items-center justify-center">
                      {label}
                      {sortBy === key && sortable && (
                        sortOrder === "asc" ? (
                          <HiChevronUp className="ml-1" />
                        ) : (
                          <HiChevronDown className="ml-1" />
                        )
                      )}
                    </div>
                  </TableHead>
                ))}
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: Math.min(limit, 10) }).map((_, rowIdx) => (
                  <TableRow key={rowIdx}>
                    {Array(HEADERS.length + 1).fill(0).map((_, cellIdx) => (
                      <TableCell key={cellIdx}>
                        <div className="h-4 w-full bg-muted rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={HEADERS.length + 1} className="text-center py-10 text-muted-foreground">
                    No influencers match the criteria.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((inf) => {
                  const expired = !!inf.subscriptionExpired;
                  const dLeft = daysUntil(inf.expiresAt);
                  return (
                    <TableRow key={inf.influencerId} className={expired ? "bg-red-50/30" : undefined}>
                      <TableCell className="font-medium">{inf.name || "—"}</TableCell>
                      <TableCell>{inf.email || "—"}</TableCell>
                      <TableCell>{inf.phone || "—"}</TableCell>
                      <TableCell className="items-center justify-center">
                        <PlatformBadge platform={inf.primaryPlatform} />
                      </TableCell>
                      <TableCell>
                        {inf.planName ? (
                          <Badge className="rounded-full px-3 bg-primary text-primary-foreground">
                            {inf.planName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{formatDate(inf.expiresAt)}</span>
                          {typeof dLeft === "number" && (
                            <span className={cn("text-xs", dLeft < 0 ? "text-red-600" : dLeft <= 7 ? "text-amber-600" : "text-muted-foreground")}>
                              {dLeft < 0 ? `${Math.abs(dLeft)} days ago` : dLeft === 0 ? "today" : `in ${dLeft} days`}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge expired={expired} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 items-center justify-center">
                          <Tooltip>
                            <TooltipTrigger asChild >
                              <Link href={`/admin/influencers/view?influencerId=${inf.influencerId}`}>
                                <Button variant="ghost" size="icon">
                                  <HiOutlineEye />
                                </Button>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>View details</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Link href={`/admin/influencers/campaigns?influencerId=${inf.influencerId}`}>
                                <Button variant="ghost" size="icon" className="item-center">
                                  <HiOutlineClipboardList />
                                </Button>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent>Campaigns</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between p-4">
            <div className="text-sm text-muted-foreground">
              Page <span className="font-medium">{page}</span> of {totalPages}
            </div>
            <div className="space-x-2">
              <Button
                variant="outline"
                size="icon"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <HiChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <HiChevronRight />
              </Button>
            </div>
          </div>
        )}
      </Card>
      <Card className="p-4 flex items-center justify-between gap-4 whitespace-nowrap overflow-x-auto">
        <div className="text-sm text-muted-foreground shrink-0">
          Showing <span className="font-medium">{(page - 1) * limit + (rows.length ? 1 : 0)}</span>–
          <span className="font-medium">{Math.min(page * limit, total)}</span> of <span className="font-medium">{total}</span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <div className="flex items-center gap-1">
            {[10, 20, 50, 100].map((n) => (
              <Button
                key={n}
                size="sm"
                variant={limit === n ? "default" : "outline"}
                className={limit === n ? "bg-[#ef2f5b] text-white" : ""}
                onClick={() => {
                  setLimit(n);
                  setPage(1);
                }}
              >
                {n}
              </Button>
            ))}
          </div>
        </div>
      </Card>

    </div>
  );
};

export default AdminInfluencersPage;
