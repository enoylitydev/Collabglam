"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { post } from "@/lib/api";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

interface Campaign {
  _id?: string;
  id?: string;             // from backend: id = campaignsId
  campaignId?: string;     // explicit field if you want to use it
  name: string;            // alias for campaignName
  campaignName?: string;
  brandName?: string;
  appliedDate?: string;
  status: "pending" | "approved" | "rejected";
}

interface InfluencerLite {
  influencerId: string;
  name?: string;
  email?: string;
}

interface GetCampaignsResponse {
  total: number;
  page: number;
  pages: number;
  campaigns: Campaign[];
  influencer?: InfluencerLite;
}

// 🔗 change this to match your real details route, e.g. "/brand/campaigns"
const CAMPAIGN_ROUTE_BASE = "/admin/campaigns/view?id=";

export default function InfluencerCampaignsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const influencerId = params.get("influencerId");

  // Early return if influencerId is missing
  if (!influencerId) {
    return (
      <div className="p-6">
        <p className="text-red-600">Error: Missing influencer ID in the URL.</p>
      </div>
    );
  }

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filter, setFilter] = useState<"all" | "approved">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // pagination from backend
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // influencer info from backend
  const [influencerName, setInfluencerName] = useState<string>("");
  const [influencerEmail, setInfluencerEmail] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const data = await post<GetCampaignsResponse>("/influencer/get-campaign", {
          influencerId: influencerId as string,
          page,
          limit: 10,
          search: "",
          sortBy: "createdAt",
          sortOrder: "desc",
        });

        if (!isMounted) return;

        setCampaigns(data?.campaigns ?? []);
        setPages(data?.pages ?? 1);

        if (data?.influencer) {
          setInfluencerName(data.influencer.name ?? "");
          setInfluencerEmail(data.influencer.email ?? "");
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message ?? "Failed to load campaigns");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [influencerId, page]);

  // Apply status filter (client-side)
  const filtered = campaigns.filter((c) =>
    filter === "all" ? true : c.status === "approved"
  );

  if (loading) return <p className="p-6">Loading campaigns...</p>;
  if (error)
    return (
      <div className="p-6">
        <p className="text-red-600">Error loading campaigns: {error}</p>
      </div>
    );

  const headingName =
    influencerName || influencerEmail || influencerId || "Unknown Influencer";

  return (
    <div className="p-6 space-y-4">
      {/* Top heading with influencer name */}
      <div>
        <h1 className="text-2xl font-bold">
          Campaigns for {headingName}
        </h1>
        <p className="text-sm text-gray-500">
          ID: {influencerId}
          {influencerEmail ? ` • ${influencerEmail}` : ""}
        </p>
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center space-x-2">
        <span>Show:</span>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p>No campaigns to display.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Campaign</TableCell>
              <TableCell>Brand</TableCell>
              <TableCell>Applied Date</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => {
              const id = c._id ?? c.id ?? c.campaignId ?? "";
              const campaignName = c.name || c.campaignName || "Unnamed Campaign";

              const handleRowClick = () => {
                const campaignId = c.campaignId ?? c.id ?? id;
                if (!campaignId) return;
                router.push(`${CAMPAIGN_ROUTE_BASE}${campaignId}`);
              };

              return (
                <TableRow
                  key={id}
                  onClick={handleRowClick}
                  className="cursor-pointer hover:bg-muted/60 transition-colors"
                >
                  <TableCell className="text-xs text-gray-500">
                    {id}
                  </TableCell>
                  <TableCell className="font-medium underline-offset-2 hover:underline">
                    {campaignName}
                  </TableCell>
                  <TableCell>{c.brandName ?? "-"}</TableCell>
                  <TableCell>
                    {c.appliedDate
                      ? new Date(c.appliedDate).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell
                    className={`font-medium ${
                      {
                        approved: "text-green-600",
                        pending: "text-yellow-600",
                        rejected: "text-red-600",
                      }[c.status] || "text-gray-600"
                    }`}
                  >
                    {c.status}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
          className="px-4 py-2 border rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          disabled={page >= pages}
          onClick={() => setPage((p) => Math.min(p + 1, pages))}
          className="px-4 py-2 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
