"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  HiOutlineEye,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineClipboardList,
  HiX,
} from "react-icons/hi";
import api, { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import Swal from "sweetalert2";
import MilestoneHistoryCard from "@/components/common/milestoneCard";
import { useRouter } from "next/navigation";

// ── toast helper ─────────────────────────────────────────────────────
const toast = (opts: { icon: "success" | "error" | "info"; title: string; text?: string }) =>
  Swal.fire({
    ...opts,
    showConfirmButton: false,
    timer: 1500,
    timerProgressBar: true,
    background: "white",
    customClass: {
      popup: "rounded-lg border border-gray-200",
      icon: "bg-gradient-to-r from-[#FFA135] to-[#FF7236] bg-clip-text text-transparent",
    },
  });

/* ── Types ──────────────────────────────────────────────────────────── */
interface Campaign {
  id: string;
  brandId: string;
  brandName: string;
  productOrServiceName: string;
  description: string;
  timeline: { startDate: string; endDate: string };
  isActive: number;
  budget: number;
  isApproved: number;
  isContracted: number;
  contractId: string;
  isAccepted: number;
  hasApplied: number;
  hasMilestone: number;
}

interface CampaignsResponse {
  meta: { total: number; page: number; limit: number; totalPages: number };
  campaigns: any[];
}

/* ── Page Component ─────────────────────────────────────────────────── */
export default function MyCampaignsPage() {
  /* Shared */
  const [search] = useState("");
  const router = useRouter();
  /* Active campaigns state */
  const [activeCampaigns, setActiveCampaigns] = useState<Campaign[]>([]);
  const [activeLoading, setActiveLoading] = useState(true);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [activeTotalPages, setActiveTotalPages] = useState(1);

  /* Applied campaigns state */
  const [appliedCampaigns, setAppliedCampaigns] = useState<Campaign[]>([]);
  const [appliedLoading, setAppliedLoading] = useState(true);
  const [appliedError, setAppliedError] = useState<string | null>(null);
  const [appliedPage, setAppliedPage] = useState(1);
  const [appliedTotalPages, setAppliedTotalPages] = useState(1);

  /* Contracted campaigns state */
  const [contractedCampaigns, setContractedCampaigns] = useState<Campaign[]>([]);
  const [contractedLoading, setContractedLoading] = useState(true);
  const [contractedError, setContractedError] = useState<string | null>(null);
  const [contractedPage, setContractedPage] = useState(1);
  const [contractedTotalPages, setContractedTotalPages] = useState(1);

  /* Contract modal */
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [hasAccepted, setHasAccepted] = useState(false);
  const [contractId, setContractId] = useState("");
  const [isAccepted, setIsAccepted] = useState(0);
  const [hasMilestone, setHasMilestone] = useState(0)

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<Campaign | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const itemsPerPage = 10;

  /* ── Helpers ──────────────────────────────────────────────────────── */
  const formatDate = (d: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(d));

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(n);

  const normalize = (raw: any): Campaign => ({
    id: raw.campaignsId,
    brandId: raw.brandId,
    brandName: raw.brandName,
    productOrServiceName: raw.productOrServiceName,
    description: raw.description,
    timeline: raw.timeline,
    isActive: raw.isActive,
    budget: raw.budget,
    isApproved: raw.isApproved,
    isContracted: raw.isContracted,
    contractId: raw.contractId,
    isAccepted: raw.isAccepted,
    hasApplied: raw.hasApplied,
    hasMilestone: raw.hasMilestone
  });

  /* ── Fetchers ─────────────────────────────────────────────────────── */
  const fetchActiveCampaigns = useCallback(async () => {
    setActiveLoading(true);
    setActiveError(null);
    try {
      const influencerId =
        typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
      if (!influencerId) throw new Error("No influencer ID found.");

      const payload = { influencerId, search: search.trim(), page: activePage, limit: itemsPerPage };

      const data = await post<CampaignsResponse>("/campaign/myCampaign", payload);
      setActiveCampaigns(data.campaigns.map(normalize));
      setActiveTotalPages(data.meta.totalPages);
    } catch (e: any) {
      setActiveError(e.message || "Failed to load campaigns.");
    } finally {
      setActiveLoading(false);
    }
  }, [search, activePage]);

  const fetchAppliedCampaigns = useCallback(async () => {
    setAppliedLoading(true);
    setAppliedError(null);
    try {
      const influencerId =
        typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
      if (!influencerId) throw new Error("No influencer ID found.");

      const payload = { influencerId, search: search.trim(), page: appliedPage, limit: itemsPerPage };

      const data = await post<CampaignsResponse>("/campaign/applied", payload);
      setAppliedCampaigns(data.campaigns.map(normalize));
      setAppliedTotalPages(data.meta.totalPages);
    } catch (e: any) {
      setAppliedError(e.message || "Failed to load applied campaigns.");
    } finally {
      setAppliedLoading(false);
    }
  }, [search, appliedPage]);

  const fetchContractedCampaigns = useCallback(async () => {
    setContractedLoading(true);
    setContractedError(null);
    try {
      const influencerId =
        typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
      if (!influencerId) throw new Error("No influencer ID found.");

      const payload = { influencerId, search: search.trim(), page: appliedPage, limit: itemsPerPage };

      const data = await post<CampaignsResponse>("/campaign/contracted", payload);
      setContractedCampaigns(data.campaigns.map(normalize));
      setContractedTotalPages(data.meta.totalPages);
    } catch (e: any) {
      setContractedError(e.message || "Failed to load applied campaigns.");
    } finally {
      setContractedLoading(false);
    }
  }, [search, appliedPage]);

  useEffect(() => {
    fetchContractedCampaigns();
  }, [fetchContractedCampaigns]);


  useEffect(() => {
    fetchActiveCampaigns();
  }, [fetchActiveCampaigns]);

  useEffect(() => {
    fetchAppliedCampaigns();
  }, [fetchAppliedCampaigns]);

  /* ── Contract actions ─────────────────────────────────────────────── */
  const handleViewContract = async (c: Campaign) => {
    try {
      const influencerId =
        typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
      if (!influencerId) throw new Error("No influencer ID.");

      const res = await api.post("/contract/view", { contractId: c.contractId }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      setPdfUrl(url);
      setShowPdfModal(true);
      setContractId(c.contractId);
      setIsAccepted(c.isAccepted);
    } catch (e: any) {
      toast({ icon: "error", title: "Error", text: e.message || "Failed to load contract PDF." });
    }
  };

  const handleAcceptContract = async () => {
    if (!contractId) return;
    try {
      await post("/contract/accept", { contractId });
      toast({ icon: "success", title: "Accepted!", text: "You have accepted the contract." });
      setShowPdfModal(false);
      setHasAccepted(false);
      fetchActiveCampaigns();
      fetchAppliedCampaigns();
    } catch (e: any) {
      toast({ icon: "error", title: "Error", text: e.message || "Failed to accept contract." });
    }
  };

  const openRejectModal = (c: Campaign) => {
    setRejectTarget(c);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    try {
      const influencerId =
        typeof window !== "undefined"
          ? localStorage.getItem("influencerId")
          : null;
      if (!influencerId) throw new Error("No influencer ID.");

      await post("/contract/reject", {
        contractId: rejectTarget.contractId,
        influencerId,
        reason: rejectReason.trim(),
      });

      toast({ icon: "info", title: "Rejected", text: "Contract has been rejected." });
      setShowRejectModal(false);
      // refresh all lists
      fetchActiveCampaigns();
      fetchAppliedCampaigns();
      fetchContractedCampaigns();
    } catch (e: any) {
      toast({ icon: "error", title: "Error", text: e.message || "Failed to reject contract." });
    }
  };

  // ── Contract actions ───────────────────────────────────────────────
  const handleRejectCampaign = async (c: Campaign) => {
    try {
      const influencerId =
        typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
      if (!influencerId) throw new Error("No influencer ID.");

      await post("/contract/reject", { contractId: c.contractId });
      Swal.fire("Rejected", "You have rejected the contract.", "info");
      setShowPdfModal(false);
      // refresh all lists
      fetchActiveCampaigns();
      fetchAppliedCampaigns();
      fetchContractedCampaigns();
    } catch (e: any) {
      Swal.fire("Error", e.message || "Failed to reject contract.", "error");
    }
  };


  /* ── Re‑usable Table ──────────────────────────────────────────────── */
  const CampaignTable = ({
    data,
    loading,
    error,
    emptyMessage,
    page,
    totalPages,
    onPrev,
    onNext,
    showMilestones = false
  }: {
    data: Campaign[];
    loading: boolean;
    error: string | null;
    emptyMessage: string;
    page: number;
    totalPages: number;
    onPrev: () => void;
    onNext: () => void;
    showMilestones?: boolean;
  }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const influencerId =
      typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;

    /* Skeleton rows */
    const SkeletonRows = () => (
      <tbody>
        {Array.from({ length: 5 }).map((_, row) => (
          <tr key={row} className={row % 2 === 0 ? "bg-white" : "bg-gray-50"}>
            <td className="px-6 py-4">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </td>{/* */}
            <td className="px-6 py-4 text-center">
              <Skeleton className="h-4 w-16 mx-auto" />
            </td>{/* */}
            <td className="px-6 py-4 text-center">
              <Skeleton className="h-4 w-20 mx-auto" />
            </td>{/* */}
            <td className="px-6 py-4 text-center">
              <Skeleton className="h-4 w-32 mx-auto" />
            </td>{/* */}
            <td className="px-6 py-4 text-center">
              <Skeleton className="h-4 w-24 mx-auto" />
            </td>{/* */}
            <td className="px-6 py-4 flex justify-center space-x-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </td>
          </tr>
        ))}
      </tbody>
    );

    /* Real rows */
    const DataRows = () => (
      <tbody>
        {data.map((c, idx) => {
          const isExpanded = expandedId === c.id;

          return (
            <React.Fragment key={c.id}>
              {/* main campaign row */}
              <tr className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">
                    {c.productOrServiceName}
                  </div>
                  <div className="text-gray-600 line-clamp-1">{c.description}</div>
                </td>

                <td className="px-6 py-4 text-center">{c.brandName}</td>
                <td className="px-6 py-4 text-center">
                  {formatCurrency(c.budget)}
                </td>
                <td className="px-6 py-4 text-center">
                  {formatDate(c.timeline.startDate)} –{" "}
                  {formatDate(c.timeline.endDate)}
                </td>

                {/* status badge */}
                <td className="px-6 py-4 text-center">
                  {c.hasApplied === 1 && !c.isAccepted && !c.isContracted ? (
                    <Badge className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 shadow-none">
                      Brand Reviewing
                    </Badge>
                  ) : c.isContracted === 1 && c.isAccepted !== 1 ? (
                    <Badge className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 shadow-none">
                      Brand Contracted
                    </Badge>
                  ) : (
                    <Badge className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 shadow-none">
                      Accepted
                    </Badge>
                  )}
                </td>

                {/* actions */}
                <td className="px-6 py-4 flex justify-center space-x-2 whitespace-nowrap">
                  {/* contract buttons (unchanged) */}
                  {c.hasMilestone === 1 ? (
                    <Button
                      variant="outline"
                      className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
                      onClick={() => handleViewContract(c)}
                    >
                      View Contract
                    </Button>
                  ) : c.isContracted === 1 && c.isAccepted !== 1 ? (
                    <>
                      <Button
                        variant="outline"
                        className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
                        onClick={() => handleViewContract(c)}
                      >
                        View Contract
                      </Button>
                      <Button
                        variant="outline"
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => openRejectModal(c)}
                      >
                        Reject Contract
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
                      onClick={() => router.push(`/influencer/my-campaign/view-campaign?id=${c.id}`)}
                    >
                      View Campaign
                    </Button>
                  )}

                  {/* milestone toggle */}
                  {showMilestones && (
                    <button
                      onClick={() =>
                        setExpandedId((prev) => (prev === c.id ? null : c.id))
                      }
                      className="p-2 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 rounded-md hover:brightness-90 transition"
                    >
                      <HiOutlineClipboardList
                        size={18}
                        className="inline-block mr-1"
                      />
                      {isExpanded ? "Hide" : "View"} Milestone
                    </button>
                  )}

                  {/* view campaign */}
                  <Link
                    href={`/influencer/my-campaign/view-campaign?id=${c.id}`}
                    className="p-2 bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200"
                  >
                    <HiOutlineEye size={18} />
                  </Link>
                </td>
              </tr>

              {/* expandable milestone row */}
              {isExpanded && (
                <tr>
                  <td colSpan={6} className="bg-white px-6 py-6">
                    <MilestoneHistoryCard
                      role="influencer"
                      influencerId={influencerId}
                      campaignId={c.id}
                    />
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    );

    /* Render variations */
    if (loading)
      return (
        <div className="overflow-x-auto bg-white shadow rounded-lg p-4 animate-pulse">
          <table className="w-full text-sm text-gray-600">
            <thead>
              <tr>
                {["Campaign", "Brand", "Budget", "Timeline", "Status", "Actions"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-6 py-3 font-medium whitespace-nowrap ${i === 0 ? "text-left" : "text-center"
                      }`}
                  >
                    <Skeleton className="h-4 w-24" />
                  </th>
                ))}
              </tr>
            </thead>
            <SkeletonRows />
          </table>
        </div>
      );

    if (error) return <p className="text-red-600 text-center py-6">{error}</p>;
    if (data.length === 0) return <p className="text-gray-700 text-center py-6">{emptyMessage}</p>;

    return (
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="w-full text-sm text-gray-600">
          <thead className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800">
            <tr>
              {["Campaign", "Brand", "Budget", "Timeline", "Status", "Actions"].map((h, i) => (
                <th
                  key={h}
                  className={`px-6 py-3 font-medium whitespace-nowrap ${i === 0 ? "text-left" : "text-center"
                    }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <DataRows />
        </table>

        {/* Pagination */}
        <div className="flex justify-end items-center p-4 space-x-2">
          <button
            onClick={onPrev}
            disabled={page === 1}
            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50"
          >
            <HiChevronLeft size={20} />
          </button>
          <span className="text-gray-700">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={onNext}
            disabled={page === totalPages}
            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50"
          >
            <HiChevronRight size={20} />
          </button>
        </div>
      </div>
    );
  };

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className="p-6 min-h-screen space-y-10">
      {/* Active Campaigns */}
      <section>
        <h1 className="text-3xl font-semibold mb-6">Active Campaigns</h1>
        <CampaignTable
          data={activeCampaigns}
          loading={activeLoading}
          error={activeError}
          emptyMessage="No active campaigns found."
          page={activePage}
          totalPages={activeTotalPages}
          onPrev={() => setActivePage((p) => Math.max(p - 1, 1))}
          onNext={() => setActivePage((p) => Math.min(p + 1, activeTotalPages))}
          showMilestones
        />
      </section>

      <section>
        <h1 className="text-3xl font-semibold mb-6">Contracted Campaigns</h1>
        <CampaignTable
          data={contractedCampaigns}
          loading={contractedLoading}
          error={contractedError}
          emptyMessage="No Contracted campaigns found."
          page={contractedPage}
          totalPages={contractedTotalPages}
          onPrev={() => setContractedPage((p) => Math.max(p - 1, 1))}
          onNext={() => setContractedPage((p) => Math.min(p + 1, contractedTotalPages))}
        />
      </section>

      {/* Applied Campaigns */}
      <section>
        <h1 className="text-3xl font-semibold mb-6">Applied Campaigns</h1>
        <CampaignTable
          data={appliedCampaigns}
          loading={appliedLoading}
          error={appliedError}
          emptyMessage="No applied campaigns found."
          page={appliedPage}
          totalPages={appliedTotalPages}
          onPrev={() => setAppliedPage((p) => Math.max(p - 1, 1))}
          onNext={() => setAppliedPage((p) => Math.min(p + 1, appliedTotalPages))}
        />
      </section>

      {/* PDF Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-gray-900/30 flex items-center justify-center z-50">
          <div className="relative bg-white rounded-lg w-11/12 max-w-4xl h-[80vh] overflow-hidden flex flex-col">
            <button
              onClick={() => {
                URL.revokeObjectURL(pdfUrl);
                setShowPdfModal(false);
                setHasAccepted(false);
              }}
              className="absolute top-2 right-2 p-2 text-gray-600 hover:text-gray-900"
            >
              <HiX size={24} />
            </button>

            <iframe src={pdfUrl} className="w-full flex-grow" title="Contract PDF" />

            <div className="p-4 border-t flex items-center justify-between">
              {isAccepted === 1 ? (
                <span className="text-green-600 font-semibold">
                  You have accepted this contract.
                </span>
              ) : (
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={hasAccepted}
                    onChange={(e) => setHasAccepted(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">I Accept</span>
                </label>
              )}

              <div className="flex space-x-2">
                <Button onClick={() => setShowPdfModal(false)} className="bg-red-600 hover:bg-red-700 text-white">
                  Cancel
                </Button>

                {isAccepted === 0 && (
                  <Button
                    onClick={handleAcceptContract}
                    disabled={!hasAccepted}
                    className={
                      hasAccepted
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-gray-300 text-gray-600 cursor-not-allowed"
                    }
                  >
                    Accept Contract
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {showRejectModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-gray-900/30 flex items-center justify-center z-50">
          <div className="relative bg-white rounded-lg w-96 p-6 space-y-4">
            <button
              onClick={() => setShowRejectModal(false)}
              className="absolute top-2 right-2 p-2 text-gray-600 hover:text-gray-900"
            >
              <HiX size={24} />
            </button>
            <h2 className="text-lg font-semibold">Reject Contract</h2>
            <p className="text-sm text-gray-700">
              Please let us know why you’re rejecting this contract:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full h-24 p-2 border rounded focus:outline-none focus:ring"
              placeholder="Your reason (optional)"
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowRejectModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmReject}
                className={"bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                }
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
