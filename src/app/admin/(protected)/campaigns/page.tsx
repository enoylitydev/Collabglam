"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { post } from "@/lib/api";
import {
  HiOutlineRefresh,
  HiCheckCircle,
  HiXCircle,
  HiOutlineEye,
  HiChevronLeft,
  HiChevronRight,
  HiChevronUp,
  HiChevronDown,
  HiUserGroup,
} from "react-icons/hi";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
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
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";

interface Campaign {
  campaignsId: string;
  productOrServiceName: string;
  description: string;
  timeline: { startDate: string; endDate: string };
  budget: number;
  isActive: number;
  goal?: string;
  applicantCount?: number;
}

// Updated to match API: 'campaigns' field
interface ListResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  status: number;
  campaigns: Campaign[];
}

type StatusFilter = 0 | 1 | 2; // 0: All, 1: Active, 2: Inactive

type SortKey = keyof Campaign | "startDate" | "endDate" | "status";

// helper to slice / clean name so repeated / long text doesn't blow up the UI
const MAX_NAME_LENGTH = 60;
const formatName = (name?: string) => {
  if (!name) return "—";
  const trimmed = name.trim();
  if (trimmed.length <= MAX_NAME_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_NAME_LENGTH) + "…";
};

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(0);
  const statusOptions = [
    { label: "All", value: 0 },
    { label: "Active", value: 1 },
    { label: "Inactive", value: 2 },
  ];

  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [sortKey, setSortKey] = useState<SortKey>("productOrServiceName");
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Fetch data from backend
  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const payload = {
        page,
        limit,
        search,
        sortBy: sortKey,
        sortOrder: sortAsc ? "asc" : "desc",
        type: statusFilter,
      };
      const data = await post<ListResponse>("/admin/campaign/getlist", payload);
      // Use campaigns array from response
      setCampaigns(data.campaigns);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(data.page);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  };

  // Initial & dependency-triggered load
  useEffect(() => {
    fetchCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortKey, sortAsc, search, statusFilter]);

  const handleRefresh = () => fetchCampaigns();

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
    setPage(1);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const renderSortIcon = (key: SortKey) =>
    sortKey === key ? (
      sortAsc ? (
        <HiChevronUp className="ml-1" />
      ) : (
        <HiChevronDown className="ml-1" />
      )
    ) : null;

  return (
    <div className="p-6 bg-white min-h-screen">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
        <h1 className="text-3xl font-semibold">All Campaigns (Admin)</h1>
        <div className="flex flex-wrap gap-3 items-center">
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-64"
          />
          <Select
            value={statusFilter.toString()}
            onValueChange={(val) => {
              setStatusFilter(Number(val) as StatusFilter);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {statusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value.toString()}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <HiOutlineRefresh
              className={`mr-2 h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="space-y-3">
          {Array.from({ length: limit }).map((_, i) => (
            <div
              key={i}
              className="h-6 w-full bg-gray-200 animate-pulse rounded"
            />
          ))}
        </Card>
      ) : error ? (
        <Card className="text-center py-20 text-red-600">{error}</Card>
      ) : campaigns.length === 0 ? (
        <Card className="text-center py-20 text-gray-600">
          No campaigns found.
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  { label: "Name", key: "productOrServiceName" },
                  { label: "Goal", key: "goal" },
                  { label: "Start", key: "startDate" },
                  { label: "End", key: "endDate" },
                  { label: "Budget", key: "budget" },
                  { label: "Applicants", key: "applicantCount" },
                  { label: "Status", key: "status" },
                  { label: "Actions", key: "" },
                ].map((col) => (
                  <TableHead
                    key={col.label}
                    className={col.key ? "cursor-pointer select-none" : ""}
                    onClick={() => col.key && toggleSort(col.key as SortKey)}
                  >
                    <div className="flex items-center justify-center">
                      {col.label}
                      {col.key && renderSortIcon(col.key as SortKey)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.campaignsId}>
                  <TableCell
                    className="font-medium"
                    title={c.productOrServiceName}
                  >
                    {formatName(c.productOrServiceName)}
                  </TableCell>
                  <TableCell>{c.goal || "—"}</TableCell>
                  <TableCell>{formatDate(c.timeline.startDate)}</TableCell>
                  <TableCell>{formatDate(c.timeline.endDate)}</TableCell>
                  <TableCell>${c.budget.toLocaleString()}</TableCell>
                  <TableCell>{c.applicantCount || 0}</TableCell>
                  <TableCell>
                    {c.isActive === 1 ? (
                      <span className="inline-flex items-center space-x-1 text-green-600">
                        <HiCheckCircle />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-red-600">
                        <HiXCircle />
                        <span>Inactive</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={`/admin/campaigns/view?id=${c.campaignsId}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View Campaign"
                          >
                            <HiOutlineEye />
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>View Details</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/admin/campaigns/applicants?campaignId=${c.campaignsId}`}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="View Applicants"
                          >
                            <HiUserGroup className="h-5 w-5" />
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>View Applicants</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {!loading && !error && campaigns.length > 0 && (
        <div className="flex justify-between items-center p-4">
          <div className="text-sm text-gray-700">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of{" "}
            {total}
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
