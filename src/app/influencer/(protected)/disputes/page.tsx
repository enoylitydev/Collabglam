"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DisputeStatus =
  | "open"
  | "in_review"
  | "awaiting_user"
  | "resolved"
  | "rejected";

type Role = "Admin" | "Brand" | "Influencer";

type DisputeParty = {
  role: "Brand" | "Influencer";
  id: string;
  name?: string | null;
};

type Attachment = {
  url: string;
  originalName?: string | null;
  mimeType?: string | null;
  size?: number | null;
};

type Dispute = {
  disputeId: string;
  subject: string;
  description?: string;
  status: DisputeStatus;
  campaignId?: string | null;
  campaignName?: string | null;
  brandId: string;
  influencerId: string;
  assignedTo?: { adminId?: string | null; name?: string | null } | null;
  createdAt: string;
  updatedAt: string;
  attachments?: Attachment[];

  // extra direction info from backend
  createdBy?: {
    id: string;
    role: Role;
  };
  raisedByRole?: Role | null;
  raisedById?: string | null;
  raisedBy?: DisputeParty | null;
  raisedAgainst?: DisputeParty | null;
  viewerIsRaiser?: boolean;
};

type ListResp = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  disputes: Dispute[];
};

const statusOptions = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_review", label: "In Review" },
  { value: "awaiting_user", label: "Awaiting You" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
];

const directionOptions = [
  { value: "all", label: "All disputes" },
  { value: "raised_by_you", label: "Raised by you" },
  { value: "against_you", label: "Raised against you" },
];

const StatusBadge = ({ s }: { s: DisputeStatus }) => {
  const tone =
    {
      open: "bg-blue-100 text-blue-800",
      in_review: "bg-purple-100 text-purple-800",
      awaiting_user: "bg-amber-100 text-amber-800",
      resolved: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
    }[s] || "bg-gray-100 text-gray-700";

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${tone}`}>
      {s.replace("_", " ")}
    </span>
  );
};

const getDirectionLabelForViewer = (d: Dispute): string => {
  const viewerIsRaiser =
    typeof d.viewerIsRaiser === "boolean"
      ? d.viewerIsRaiser
      : d.raisedByRole === "Influencer";

  const otherFromAgainst =
    d.raisedAgainst?.name ||
    (d.raisedAgainst?.role === "Brand"
      ? "this brand"
      : d.raisedAgainst?.role === "Influencer"
      ? "this influencer"
      : "the other party");

  const otherFromBy =
    d.raisedBy?.name ||
    (d.raisedBy?.role === "Brand"
      ? "this brand"
      : d.raisedBy?.role === "Influencer"
      ? "this influencer"
      : "the other party");

  if (viewerIsRaiser) {
    return `You raised this dispute against ${otherFromAgainst}`;
  } else {
    return `${otherFromBy} raised this dispute against you`;
  }
};

const buildPageNumbers = (page: number, totalPages: number) => {
  const pages: number[] = [];
  const maxButtons = 5;
  let start = Math.max(1, page - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
};

export default function InfluencerDisputesPage() {
  const router = useRouter();
  const [influencerId, setInfluencerId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Dispute[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [status, setStatus] = useState<string>("all");
  const [direction, setDirection] = useState<string>("all");
  const [searchInput, setSearchInput] = useState<string>("");
  const [appliedSearch, setAppliedSearch] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedInfluencerId = localStorage.getItem("influencerId");
    if (!storedInfluencerId) {
      router.replace("/login");
      return;
    }

    setInfluencerId(storedInfluencerId);
  }, [router]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1);
      setAppliedSearch(searchInput.trim());
    }, 500);

    return () => clearTimeout(handler);
  }, [searchInput]);

  const load = async () => {
    if (!influencerId) return;
    setLoading(true);
    setError(null);
    try {
      const body: any = {
        influencerId,
        page,
        limit: 10,
      };

      if (status && status !== "all") {
        body.status = status;
      }

      if (direction === "raised_by_you") {
        body.appliedBy = "influencer";
      } else if (direction === "against_you") {
        body.appliedBy = "brand";
      }

      if (appliedSearch) {
        body.search = appliedSearch;
      }

      const data = await post<ListResp>("/dispute/influencer/list", body);
      setRows(data.disputes || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.message || "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, direction, appliedSearch, influencerId]);

  const pageNumbers = useMemo(
    () => buildPageNumbers(page, totalPages),
    [page, totalPages]
  );

  const from = total === 0 ? 0 : (page - 1) * 10 + 1;
  const to = Math.min(page * 10, total);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Disputes</h1>
        <Button
          className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
          onClick={() => router.push("/influencer/disputes/new")}
        >
          New Dispute
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="w-full md:w-40">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="!bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="!bg-white">
              {statusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-52">
          <Select
            value={direction}
            onValueChange={(v) => {
              setDirection(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="!bg-white">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent className="!bg-white">
              {directionOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 flex gap-2">
          <Input
            className="bg-white text-gray-800"
            placeholder="Search subject/description"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-600">No disputes found.</p>
      ) : (
        <div className="overflow-x-auto rounded-[16px] border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Subject</th>
                <th className="text-left p-3">Campaign</th>
                <th className="text-left p-3">Raised By</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Updated</th>
                <th className="text-left p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d: Dispute) => {
                const directionText = getDirectionLabelForViewer(d);

                const raisedByLabel = d.raisedBy
                  ? `${d.raisedBy.role === "Brand" ? "Brand" : "Influencer"}${
                      d.raisedBy.name ? ` (${d.raisedBy.name})` : ""
                    }`
                  : "—";

                return (
                  <tr key={d.disputeId} className="border-t">
                    <td className="p-3 max-w-xs">
                      <div className="font-medium truncate">{d.subject}</div>
                      {directionText && (
                        <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                          {directionText}
                        </div>
                      )}
                    </td>
                    <td className="p-3">{d.campaignName || "—"}</td>
                    <td className="p-3">
                      <span className="text-xs text-gray-800">
                        {raisedByLabel}
                      </span>
                    </td>
                    <td className="p-3">
                      <StatusBadge s={d.status} />
                    </td>
                    <td className="p-3 text-gray-600">
                      {new Date(d.updatedAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-right">
                      <Link
                        className="text-black-600 hover:underline"
                        href={`/influencer/disputes/${d.disputeId}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 mt-4">
          <div className="text-xs text-gray-600">
            {total > 0 ? (
              <>
                Showing{" "}
                <span className="font-medium">
                  {from}-{to}
                </span>{" "}
                of <span className="font-medium">{total}</span> disputes
              </>
            ) : (
              "No results"
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </Button>
            {pageNumbers.map((pNum: number) => (
              <Button
                key={pNum}
                size="icon"
                className="h-8 w-8"
                variant={pNum === page ? "default" : "outline"}
                onClick={() => setPage(pNum)}
              >
                {pNum}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((p) => (p >= totalPages ? totalPages : p + 1))
              }
            >
              ›
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
