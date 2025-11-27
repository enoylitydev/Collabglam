"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { get, post } from "@/lib/api";
import {
  HiChevronLeft,
  HiOutlineMail,
  HiPhone,
  HiLocationMarker,
  HiCheckCircle,
  HiXCircle,
  HiUserGroup,
  HiIdentification,
  HiClipboardList,
  HiChevronUp,
  HiChevronDown,
  HiSearch,
} from "react-icons/hi";
import {
  HiWallet,
  HiChevronRight,
  HiChevronDoubleRight,
  HiChevronLeft as HiChevronLeftIcon,
} from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

/* ---------- Types ---------- */
interface Feature {
  key: string;
  limit: number;
  used: number;
}

interface Subscription {
  planId: string;
  planName: string;
  role: string;
  monthlyCost: number;
  autoRenew: boolean;
  status: string;
  durationMins: number;
  startedAt: string;
  expiresAt: string;
  features: Feature[];
}

interface BrandDetail {
  brandId: string;
  name: string;
  phone: string;
  country: string;
  callingcode: string;
  email: string;
  categoryName: string;
  businessType: string;
  companySize: string;
  referralCode: string;
  isVerifiedRepresentative: boolean;
  subscriptionExpired: boolean;
  createdAt: string;
  updatedAt: string;
  subscription: Subscription;
  walletBalance: number;
}

interface Campaign {
  campaignsId: string;
  productOrServiceName: string;
  goal?: string;
  timeline: { startDate: string; endDate: string };
  applicantCount?: number;
  isActive: number;
}

interface CampaignListResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  status: number;
  campaigns: Campaign[];
}

type StatusFilter = 0 | 1 | 2;
type SortKey = keyof Campaign | "startDate" | "endDate" | "status";

/* ---------- Helpers ---------- */
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const statusPill = (isActive: number) =>
  isActive === 1 ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
      <HiCheckCircle className="h-4 w-4" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
      <HiXCircle className="h-4 w-4" /> Inactive
    </span>
  );

// truncate / slice long campaign names so repeated text doesn't dominate UI
const MAX_CAMPAIGN_NAME_LENGTH = 60;
const formatCampaignName = (name?: string) => {
  if (!name) return "—";
  const trimmed = name.trim();
  if (trimmed.length <= MAX_CAMPAIGN_NAME_LENGTH) return trimmed;
  return trimmed.slice(0, MAX_CAMPAIGN_NAME_LENGTH) + "…";
};

/* ---------- Component ---------- */
export default function ViewBrandPage() {
  const router = useRouter();
  const params = useSearchParams();
  const brandId = params.get("brandId") || undefined;

  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [loadingBrand, setLoadingBrand] = useState(true);
  const [errorBrand, setErrorBrand] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [errorCampaigns, setErrorCampaigns] = useState<string | null>(null);
  const [campaignsPage, setCampaignsPage] = useState(1);
  const [campaignsTotalPages, setCampaignsTotalPages] = useState(1);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(0);
  const [sortBy, setSortBy] = useState<SortKey>("productOrServiceName");
  const [sortAsc, setSortAsc] = useState(true);
  const campaignsLimit = 10;

  const apiSortBy = useMemo(
    () => (sortBy === "status" ? "isActive" : sortBy),
    [sortBy]
  );

  const fetchBrand = async (id: string) => {
    setLoadingBrand(true);
    try {
      const data = await get<BrandDetail>("/admin/brand/getById", { id });
      setBrand(data);
      setErrorBrand(null);
    } catch (err: any) {
      setErrorBrand(err.message || "Failed to load brand.");
    } finally {
      setLoadingBrand(false);
    }
  };

  const fetchCampaigns = async () => {
    if (!brandId) return;
    setLoadingCampaigns(true);
    try {
      const payload = {
        brandId,
        page: campaignsPage,
        limit: campaignsLimit,
        search: searchTerm,
        status: statusFilter,
        sortBy: apiSortBy,
        sortOrder: sortAsc ? "asc" : "desc",
      };
      const resp = await post<CampaignListResponse>(
        "/admin/campaign/getByBrandId",
        payload
      );
      setCampaigns(resp.campaigns);
      setCampaignsTotalPages(resp.totalPages);
    } catch (err: any) {
      setErrorCampaigns(err.message || "Failed to load campaigns.");
    } finally {
      setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    if (brandId) fetchBrand(brandId);
  }, [brandId]);

  useEffect(() => {
    fetchCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, campaignsPage, searchTerm, statusFilter, apiSortBy, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else {
      setSortBy(key);
      setSortAsc(true);
    }
    setCampaignsPage(1);
  };

  if (loadingBrand)
    return (
      <div className="max-w-5xl mx-auto p-8 space-y-6">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );

  if (errorBrand)
    return (
      <div className="max-w-5xl mx-auto p-8 text-red-600 font-semibold">
        Error: {errorBrand}
      </div>
    );

  if (!brand)
    return (
      <div className="max-w-5xl mx-auto p-8 text-gray-700">
        No brand found.
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Button
          onClick={() => router.back()}
          className="bg-[#ef2f5b] text-white hover:bg-[#ef2f5b]/85 flex items-center gap-2 transition-all hover:shadow"
        >
          <HiChevronLeft className="h-5 w-5" /> Back
        </Button>
      </div>

      {/* Brand Header */}
      <Card className="overflow-hidden border border-gray-100 shadow-md">
        <div className="bg-gradient-to-r from-[#ef2f5b]/10 via-white to-white">
          <div className="p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-3xl font-semibold text-gray-900 flex items-center gap-3">
              {brand.name}
              {brand.isVerifiedRepresentative ? (
                <HiCheckCircle className="text-green-600" title="Verified" />
              ) : (
                <HiXCircle className="text-red-500" title="Not Verified" />
              )}
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#ef2f5b]/10 text-[#ef2f5b] px-3 py-1 text-sm font-medium">
                {brand.subscriptionExpired ? "Subscription: Expired" : "Subscription: Active"}
              </span>
              <span className="rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-sm font-medium">
                Wallet: ${brand.walletBalance.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white text-gray-800">
          <div className="space-y-3">
            <p className="flex items-center gap-2">
              <HiOutlineMail className="text-gray-500" /> {brand.email}
            </p>
            <p className="flex items-center gap-2">
              <HiPhone className="text-gray-500" /> {brand.callingcode} {brand.phone}
            </p>
            <p className="flex items-center gap-2">
              <HiLocationMarker className="text-gray-500" /> {brand.country}
            </p>
            <p className="flex items-center gap-2">
              <HiIdentification className="text-gray-500" /> Business Type:{" "}
              <span className="font-medium">{brand.businessType}</span>
            </p>
            <p className="flex items-center gap-2">
              <HiUserGroup className="text-gray-500" /> Company Size:{" "}
              <span className="font-medium">{brand.companySize}</span>
            </p>
          </div>

          <div className="space-y-3">
            <p>
              <strong>Category:</strong> {brand.categoryName}
            </p>
            <p>
              <strong>Referral Code:</strong> {brand.referralCode}
            </p>
            <p className="text-sm text-gray-500">
              Created: {formatDate(brand.createdAt)} &nbsp;|&nbsp; Updated: {formatDate(brand.updatedAt)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card className="p-6 bg_white shadow-md border border-gray-100 hover:shadow-lg transition-all">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <HiClipboardList /> Subscription
          </h3>
          <span className="rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-sm font-medium">
            Plan: {brand.subscription.planName}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-gray-700 mb-6">
          <p><strong>Role:</strong> {brand.subscription.role}</p>
          <p><strong>Status:</strong> {brand.subscription.status}</p>
          <p><strong>Monthly Cost:</strong> {brand.subscription.monthlyCost > 0 ? `$${brand.subscription.monthlyCost}` : "Free"}</p>
          <p><strong>Auto Renew:</strong> {brand.subscription.autoRenew ? "Yes" : "No"}</p>
          <p><strong>Started:</strong> {formatDate(brand.subscription.startedAt)}</p>
          <p><strong>Expires:</strong> {formatDate(brand.subscription.expiresAt)}</p>
        </div>

        {/* Subscription Features Table */}
        <div className="overflow-hidden rounded-md border border-gray-200">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="px-4 py-3 text-left text-gray-600 font-semibold uppercase tracking-wide">
                  Feature
                </TableHead>
                <TableHead className="px-4 py-3 text-gray-600 font-semibold uppercase tracking-wide">
                  Limit
                </TableHead>
                <TableHead className="px-4 py-3 text-gray-600 font-semibold uppercase tracking-wide">
                  Used
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-200">
              {brand.subscription.features.map((f) => {
                const pct =
                  f.limit > 0
                    ? Math.min(100, Math.round((f.used / f.limit) * 100))
                    : 0;

                return (
                  <TableRow key={f.key}>
                    <TableCell className="px-4 py-3 text-gray-800 capitalize text-left">
                      {f.key.replace(/_/g, " ")}
                    </TableCell>

                    <TableCell className="px-4 py-3">{f.limit}</TableCell>

                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify_between">
                        <span className="font-medium">{f.used}</span>
                        <span className="text-xs text-gray-500">{pct}%</span>
                      </div>

                      <div className="mt-1 h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full bg-[#ef2f5b] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Campaigns */}
      <Card className="p-6 bg-white shadow-md border border-gray-100 hover:shadow-lg transition-all">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
          <h3 className="text-2xl font-semibold text-gray-900">Campaigns</h3>

          <div className="flex gap-2">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <HiSearch className="absolute inset-y-0 left-3 my-auto text-gray-400" size={18} />
              <Input
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCampaignsPage(1);
                }}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select
              value={statusFilter.toString()}
              onValueChange={(val) => {
                setStatusFilter(Number(val) as StatusFilter);
                setCampaignsPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="0">All</SelectItem>
                <SelectItem value="1">Active</SelectItem>
                <SelectItem value="2">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loadingCampaigns ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, idx) => (
              <Skeleton key={idx} className="h-6 w-full" />
            ))}
          </div>
        ) : errorCampaigns ? (
          <p className="text-red-600">Error: {errorCampaigns}</p>
        ) : campaigns.length === 0 ? (
          <div className="text-gray-600 flex items-center gap-2">
            <span>😕</span> No campaigns found.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    {[
                      { label: "Name", key: "productOrServiceName" as SortKey },
                      { label: "Goal", key: "goal" as SortKey },
                      { label: "Start", key: "startDate" as SortKey },
                      { label: "End", key: "endDate" as SortKey },
                      { label: "Applicants", key: "applicantCount" as SortKey },
                      { label: "Status", key: "status" as SortKey },
                      { label: "Open", key: undefined },
                    ].map((col) => (
                      <TableHead
                        key={col.label}
                        className={`whitespace-nowrap ${
                          col.key ? "cursor-pointer select-none" : ""
                        }`}
                        onClick={() => col.key && toggleSort(col.key)}
                      >
                        <div className="flex items-center justify-center">
                          {col.label}
                          {col.key && sortBy === col.key && (
                            sortAsc ? (
                              <HiChevronUp className="ml-1" />
                            ) : (
                              <HiChevronDown className="ml-1" />
                            )
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {campaigns.map((c, i) => (
                    <TableRow
                      key={c.campaignsId}
                      className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      {/* SLICED / TRUNCATED NAME */}
                      <TableCell
                        className="font-medium max-w-[30ch] truncate"
                        title={c.productOrServiceName}
                      >
                        {formatCampaignName(c.productOrServiceName)}
                      </TableCell>

                      <TableCell
                        className="max-w-[22ch] truncate"
                        title={c.goal || ""}
                      >
                        {c.goal || "—"}
                      </TableCell>
                      <TableCell>{formatDate(c.timeline.startDate)}</TableCell>
                      <TableCell>{formatDate(c.timeline.endDate)}</TableCell>
                      <TableCell>{c.applicantCount ?? 0}</TableCell>
                      <TableCell>{statusPill(c.isActive)}</TableCell>
                      <TableCell>
                        <Button
                          onClick={() =>
                            router.push(
                              `/admin/campaigns/view?id=${c.campaignsId}`
                            )
                          }
                          className="bg-[#ef2f5b] text-white hover:bg-[#ef2f5b]/85 hover:shadow-sm transition-all"
                          size="sm"
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {campaignsTotalPages > 1 && (
              <div className="flex justify-end items-center space-x-2 mt-4">
                <Button
                  onClick={() =>
                    setCampaignsPage((p) => Math.max(p - 1, 1))
                  }
                  disabled={campaignsPage === 1}
                  className="bg-[#ef2f5b] text-white hover:bg-[#ef2f5b]/85"
                  size="sm"
                >
                  <HiChevronLeftIcon />
                </Button>
                <span className="text-sm text-gray-700">
                  Page{" "}
                  <span className="font-medium">{campaignsPage}</span> of{" "}
                  <span className="font-medium">
                    {campaignsTotalPages}
                  </span>
                </span>
                <Button
                  onClick={() =>
                    setCampaignsPage((p) =>
                      Math.min(p + 1, campaignsTotalPages)
                    )
                  }
                  disabled={campaignsPage === campaignsTotalPages}
                  className="bg-[#ef2f5b] text-white hover:bg-[#ef2f5b]/85"
                  size="sm"
                >
                  <HiChevronRight />
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
