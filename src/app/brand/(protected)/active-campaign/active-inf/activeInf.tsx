/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { post } from "@/lib/api";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FloatingLabelInput } from "@/components/common/FloatingLabelInput";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  HiOutlineCalendar,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiSearch,
} from "react-icons/hi";
import MilestoneHistoryCard from "@/components/common/milestoneCard";

const toast = (opts: { icon: "success" | "error"; title: string; text?: string }) =>
  Swal.fire({ showConfirmButton: false, timer: 1200, timerProgressBar: true, background: "white", ...opts });


// Gradient constants for table header and row hover
const TABLE_GRADIENT_FROM = "#FFA135";
const TABLE_GRADIENT_TO = "#FF7236";

// ----------------------
// Types
// ----------------------
interface Influencer {
  _id: string;
  name: string;
  email: string;
  phone: string;
  socialMedia: string; // handle / username (e.g. iJustine, @mkbhd)
  platformName?: string; // e.g. YouTube, Instagram
  categoryName: string[]; // API now returns an array of strings
  audienceRange: string;
  createdAt: string;
  callingcode: string;
  influencerId: string;
  isAssigned?: number;
  isAccepted: number;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Milestone form state
interface MilestoneFormState {
  title: string;
  amount: string;
  description: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export default function ActiveInfluencersPage() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id");
  const campaignName = searchParams.get("name");
  const router = useRouter();

  // ----------------------
  // UI + API state
  // ----------------------
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

  // Client‑side table state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(
    PAGE_SIZE_OPTIONS[0]
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof Influencer>("createdAt");
  const [sortOrder, setSortOrder] = useState<1 | 0>(1); // 1 = desc, 0 = asc
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Milestone modal state
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [selectedInf, setSelectedInf] = useState<Influencer | null>(null);
  const [milestoneForm, setMilestoneForm] = useState<MilestoneFormState>({
    title: "",
    amount: "",
    description: "",
  });

  // ----------------------
  // Helpers
  // ----------------------
  const toggleExpand = (id: string) =>
    setExpandedRow((cur) => (cur === id ? null : id));

  const toggleSort = (field: keyof Influencer) => {
    setPage(1);
    if (sortField === field) {
      setSortOrder((o) => (o === 1 ? 0 : 1));
    } else {
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

  // ----------------------
  // API: fetch influencers
  // ----------------------
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
        }>("campaign/accepted-inf", {
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
      } catch (err) {
        console.error(err);
        setError("Failed to load applicants.");
      } finally {
        setLoading(false);
      }
    })();
  }, [campaignId, page, limit, searchTerm, sortField, sortOrder]);

  // ----------------------
  // Milestones
  // ----------------------
  const handleAddMilestone = (inf: Influencer) => {
    setSelectedInf(inf);
    setMilestoneForm({ title: "", amount: "", description: "" });
    setShowMilestoneModal(true);
  };

  const handleSaveMilestone = async () => {
    if (!selectedInf) return;
    try {
      await post("milestone/create", {
        influencerId: selectedInf.influencerId,
        campaignId,
        milestoneTitle: milestoneForm.title,
        amount: Number(milestoneForm.amount),
        milestoneDescription: milestoneForm.description,
        brandId: localStorage.getItem("brandId"),
      });
      Swal.fire("Added!", "Milestone has been added.", "success");
      setShowMilestoneModal(false);
      // Refresh list quietly
      setPage(1);
    } catch (err: any) {
      console.error(err);
      toast({
        icon: "error",
        title: "Error",
        text: err?.response?.data?.message || err.message || "Something went wrong",
      });
    };
  }

    const handleViewDetails = (inf: Influencer) => {
      router.push(`/brand/influencers?id=${inf.influencerId}`);
    };

    // ----------------------
    // Table rows (memoised)
    // ----------------------
    const rows = useMemo(() => {
      return influencers.flatMap((inf, idx) => {
        const hoverGradient = `linear-gradient(to right, ${TABLE_GRADIENT_FROM}11, ${TABLE_GRADIENT_TO}11)`;

        const baseRow = (
          <TableRow
            key={inf._id}
            className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} transition-colors`}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundImage = hoverGradient;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundImage = "";
            }}
          >
            {/* Name */}
            <TableCell>{inf.name}</TableCell>

            {/* Social handle & platform */}
            <TableCell>
              {inf.socialMedia}
              {inf.platformName && (
                <span className="ml-1 text-xs text-gray-500">({inf.platformName})</span>
              )}
            </TableCell>

            {/* Categories */}
            <TableCell className="space-x-1">
              {Array.isArray(inf.categoryName)
                ? inf.categoryName.map((cat, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="capitalize inline-block"
                  >
                    {cat}
                  </Badge>
                ))
                : (
                  <Badge variant="secondary" className="capitalize">
                    {inf.categoryName as unknown as string}
                  </Badge>
                )}
            </TableCell>

            {/* Audience */}
            <TableCell>{inf.audienceRange}</TableCell>

            {/* Date joined */}
            <TableCell className="whitespace-nowrap">
              <HiOutlineCalendar className="inline mr-1" />
              {new Date(inf.createdAt).toLocaleDateString()}
            </TableCell>

            {/* Status */}
            <TableCell className="text-center">
              {inf.isAccepted === 1 ? (
                <p>Working</p>
              ) : inf.isAssigned === 1 ? (
                <p>Contract Sent</p>
              ) : (
                <p>Applied</p>
              )}
            </TableCell>

            {/* Actions */}
            <TableCell className="flex space-x-2 justify-center">
              <Button
                size="sm"
                variant="outline"
                className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:bg-gradient-to-r hover:from-[#FF7236] hover:to-[#FFA135] cursor-pointer"
                onClick={() => handleViewDetails(inf)}
              >
                View
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-gradient-to-r from-[#FF8C00] via-[#FF5E7E] to-[#D12E53] text-white cursor-pointer hover:bg-gradient-to-r hover:from-[#FF5E7E] hover:to-[#D12E53]"
                onClick={() => router.push("/brand/messages")}
              >
                Message
              </Button>
              {!!inf.isAccepted && (
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-green-500 text-white hover:bg-green-600 cursor-pointer"
                  onClick={() => handleAddMilestone(inf)}
                >
                  Add Milestone
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="ml-1 cursor-pointer"
                onClick={() => toggleExpand(inf._id)}
              >
                {expandedRow === inf._id ? (
                  <HiOutlineChevronUp className="w-4 h-4" />
                ) : (
                  <HiOutlineChevronDown className="w-4 h-4" />
                )}
              </Button>
            </TableCell>
          </TableRow>
        );

        const detailsRow =
          expandedRow === inf._id ? (
            <TableRow key={`${inf._id}-details`}>
              <TableCell colSpan={7} className="p-0">
                <MilestoneHistoryCard
                  role="brand"
                  brandId={localStorage.getItem("brandId")}
                  influencerId={inf.influencerId}
                  campaignId={campaignId as string}
                />
              </TableCell>
            </TableRow>
          ) : null;

        return [baseRow, detailsRow].filter(Boolean);
      });
    }, [influencers, expandedRow]);

    // ----------------------
    // Render
    // ----------------------
    return (
      <div className="min-h-screen p-4 md:p-8 space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between p-4 rounded-md">
          <h1 className="text-3xl font-bold text-gray-800">
            Campaign: {campaignName || "Unknown Campaign"}
          </h1>

          <Button
            size="sm"
            variant="outline"
            className="bg-white text-gray-800 hover:bg-gray-100 cursor-pointer"
            onClick={() => router.back()}
          >
            Back
          </Button>
        </header>

        {/* Search */}
        <div className="mb-6 max-w-md">
          <div className="relative">
            <HiSearch
              className="absolute inset-y-0 left-3 my-auto text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Search influencers..."
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
          <LoadingSkeleton rows={limit} />
        ) : error ? (
          <ErrorMessage>{error}</ErrorMessage>
        ) : (
          <div className="bg-white rounded-md shadow-sm overflow-x-auto">
            <Table className="min-w-[960px]">
              <TableHeader
                className="text-white"
                style={{
                  backgroundImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO})`,
                }}
              >
                <TableRow>
                  <TableHead
                    onClick={() => toggleSort("name")}
                    className="cursor-pointer select-none font-semibold"
                  >
                    {applicantCount} Applied <SortIndicator field="name" />
                  </TableHead>

                  <TableHead
                    onClick={() => toggleSort("socialMedia")}
                    className="cursor-pointer select-none font-semibold"
                  >
                    Social Handle <SortIndicator field="socialMedia" />
                  </TableHead>

                  <TableHead
                    onClick={() => toggleSort("categoryName")}
                    className="cursor-pointer select-none font-semibold"
                  >
                    Categories <SortIndicator field="categoryName" />
                  </TableHead>

                  <TableHead
                    onClick={() => toggleSort("audienceRange")}
                    className="cursor-pointer select-none font-semibold"
                  >
                    Audience <SortIndicator field="audienceRange" />
                  </TableHead>

                  <TableHead
                    onClick={() => toggleSort("createdAt")}
                    className="cursor-pointer select-none font-semibold"
                  >
                    Date <SortIndicator field="createdAt" />
                  </TableHead>

                  <TableHead>Status</TableHead>

                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length > 0 ? (
                  rows
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                      No influencers match criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
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
            >
              <HiChevronRight />
            </Button>
          </div>
        )}

        {/* Milestone Modal */}
        {showMilestoneModal && selectedInf && (
          <div className="fixed inset-0 backdrop-blur-sm bg-opacity-30 flex items-center justify-center z-50">
            <div
              className="max-w-xl bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-auto border-2 border-transparent"
              style={{
                borderImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO}) 1`,
              }}
            >
              <h2 className="text-xl font-semibold mb-4">Add Milestone</h2>
              <div className="space-y-4">
                <FloatingLabelInput
                  id="milestoneTitle"
                  label="Milestone Title"
                  value={milestoneForm.title}
                  onChange={(e) =>
                    setMilestoneForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
                <FloatingLabelInput
                  id="milestoneAmount"
                  label="Amount"
                  value={milestoneForm.amount}
                  onChange={(e) =>
                    setMilestoneForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
                <FloatingLabelInput
                  id="milestoneDesc"
                  label="Milestone Description"
                  value={milestoneForm.description}
                  onChange={(e) =>
                    setMilestoneForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div className="mt-6 flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowMilestoneModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveMilestone}
                  className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF8A1F] hover:to-[#FF5A2E] focus:outline-none focus:ring-2 focus:ring-[#FFA135]/40 cursor-pointer"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----------------------
  // Reusable sub‑components
  // ----------------------
  const LoadingSkeleton = ({ rows }: { rows: number }) => (
    <div className="p-6 space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );

  const ErrorMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="p-6 text-center text-destructive">{children}</p>
  );
