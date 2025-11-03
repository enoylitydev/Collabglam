"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  HiOutlineEye,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineClipboardList,
  HiX,
  HiDocumentText,
} from "react-icons/hi";
import api, { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import Swal from "sweetalert2";
import MilestoneHistoryCard from "@/components/common/milestoneCard";
import { useRouter } from "next/navigation";

/* ── Toast helper ───────────────────────────────────────────────────── */
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

/* ── Purple (influencer confirm) types ──────────────────────────────── */
type DataAccess = {
  allowAnalytics?: boolean;
  allowPaidAds?: boolean;
  allowContentReuse?: boolean;
};

type Purple = {
  legalName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  taxId: string;
  notes: string;
  dataAccess: DataAccess;
};

const emptyPurple: Purple = {
  legalName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
  taxId: "",
  notes: "",
  dataAccess: {},
};

const sanitizePurple = (p: Purple): Purple => ({
  legalName: (p.legalName || "").trim(),
  email: (p.email || "").trim(),
  phone: (p.phone || "").trim(),
  addressLine1: (p.addressLine1 || "").trim(),
  addressLine2: (p.addressLine2 || "").trim(),
  city: (p.city || "").trim(),
  state: (p.state || "").trim(),
  zip: (p.zip || "").trim(),
  country: (p.country || "").trim(),
  taxId: (p.taxId || "").trim(),
  notes: (p.notes || "").trim(),
  dataAccess: p.dataAccess ?? {},
});

/* ── Page Component ─────────────────────────────────────────────────── */
export default function MyCampaignsPage() {
  const [search] = useState("");
  const router = useRouter();

  /* Active campaigns */
  const [activeCampaigns, setActiveCampaigns] = useState<Campaign[]>([]);
  const [activeLoading, setActiveLoading] = useState(true);
  const [activeError, setActiveError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(1);
  const [activeTotalPages, setActiveTotalPages] = useState(1);

  /* Applied campaigns */
  const [appliedCampaigns, setAppliedCampaigns] = useState<Campaign[]>([]);
  const [appliedLoading, setAppliedLoading] = useState(true);
  const [appliedError, setAppliedError] = useState<string | null>(null);
  const [appliedPage, setAppliedPage] = useState(1);
  const [appliedTotalPages, setAppliedTotalPages] = useState(1);

  /* Contracted campaigns */
  const [contractedCampaigns, setContractedCampaigns] = useState<Campaign[]>([]);
  const [contractedLoading, setContractedLoading] = useState(true);
  const [contractedError, setContractedError] = useState<string | null>(null);
  const [contractedPage, setContractedPage] = useState(1);
  const [contractedTotalPages, setContractedTotalPages] = useState(1);

  /* Contract sidebar */
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelCampaign, setPanelCampaign] = useState<Campaign | null>(null);
  const [panelContractId, setPanelContractId] = useState("");
  const [panelIsAccepted, setPanelIsAccepted] = useState(0);
  const [purple, setPurple] = useState<Purple>(emptyPurple);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);

  /* Reject modal */
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<Campaign | null>(null);

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
    hasMilestone: raw.hasMilestone,
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

      const payload = { influencerId, search: search.trim(), page: contractedPage, limit: itemsPerPage };
      const data = await post<CampaignsResponse>("/campaign/contracted", payload);
      setContractedCampaigns(data.campaigns.map(normalize));
      setContractedTotalPages(data.meta.totalPages);
    } catch (e: any) {
      setContractedError(e.message || "Failed to load applied campaigns.");
    } finally {
      setContractedLoading(false);
    }
  }, [search, contractedPage]);

  useEffect(() => {
    fetchContractedCampaigns();
  }, [fetchContractedCampaigns]);

  useEffect(() => {
    fetchActiveCampaigns();
  }, [fetchActiveCampaigns]);

  useEffect(() => {
    fetchAppliedCampaigns();
  }, [fetchAppliedCampaigns]);

  /* ── Contract Sidebar handlers ────────────────────────────────────── */
  const openContractSidebar = (c: Campaign, viewOnlyMode = false) => {
    setPanelCampaign(c);
    setPanelContractId(c.contractId);
    setPanelIsAccepted(c.isAccepted);
    setPurple(emptyPurple);
    setHasConfirmed(false);
    setViewOnly(viewOnlyMode);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setSidebarOpen(true);
  };

  const closeContractSidebar = () => {
    setSidebarOpen(false);
    setHasConfirmed(false);
    setViewOnly(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
  };

  const generatePreview = async () => {
    if (!panelContractId) return;
    try {
      const res = await api.post(
        "/contract/influencerConfirm",
        { contractId: panelContractId, purple: sanitizePurple(purple), type: 2 },
        { responseType: "blob" }
      );
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(res.data);
      setPreviewUrl(url);
      toast({ icon: "info", title: "Preview generated" });
    } catch (e: any) {
      toast({ icon: "error", title: "Preview Error", text: e.message || "Failed to generate preview." });
    }
  };

  // Auto-generate preview when opening in view-only mode
  useEffect(() => {
    if (sidebarOpen && viewOnly && panelContractId && !previewUrl) {
      generatePreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarOpen, viewOnly, panelContractId]);

  const confirmContract = async () => {
    if (!panelContractId) return;
    try {
      await post("/contract/influencerConfirm", {
        contractId: panelContractId,
        purple: sanitizePurple(purple),
        type: 1,
      });
      setHasConfirmed(true);
      toast({ icon: "success", title: "Confirmed!", text: "Your details have been saved." });
      // refresh lists
      fetchActiveCampaigns();
      fetchAppliedCampaigns();
      fetchContractedCampaigns();
    } catch (e: any) {
      toast({ icon: "error", title: "Error", text: e.message || "Failed to confirm contract." });
    }
  };

  const signContract = async () => {
    if (!panelContractId) return;
    try {
      await post("/contract/sign", {
        contractId: panelContractId,
        role: "influencer",
        name: purple.legalName,
        email: purple.email,
      });
      toast({ icon: "success", title: "Signed", text: "Signature recorded." });
      closeContractSidebar();
      // refresh lists
      fetchActiveCampaigns();
      fetchAppliedCampaigns();
      fetchContractedCampaigns();
    } catch (e: any) {
      toast({ icon: "error", title: "Sign Error", text: e.message || "Failed to sign contract." });
    }
  };

  /* ── Reject flow ──────────────────────────────────────────────────── */
  const openRejectModal = (c: Campaign) => {
    setRejectTarget(c);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    try {
      const influencerId =
        typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
      if (!influencerId) throw new Error("No influencer ID.");

      await post("/contract/reject", {
        contractId: rejectTarget.contractId,
        influencerId,
        reason: rejectReason.trim(),
      });

      toast({ icon: "info", title: "Rejected", text: "Contract has been rejected." });
      setShowRejectModal(false);
      fetchActiveCampaigns();
      fetchAppliedCampaigns();
      fetchContractedCampaigns();
    } catch (e: any) {
      toast({ icon: "error", title: "Error", text: e.message || "Failed to reject contract." });
    }
  };

  /* ── Re-usable Table ──────────────────────────────────────────────── */
  const CampaignTable = ({
    data,
    loading,
    error,
    emptyMessage,
    page,
    totalPages,
    onPrev,
    onNext,
    showMilestones = false,
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

    const SkeletonRows = () => (
      <tbody>
        {Array.from({ length: 5 }).map((_, row) => (
          <tr key={row} className={row % 2 === 0 ? "bg-white" : "bg-gray-50"}>
            <td className="px-6 py-4">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </td>
            <td className="px-6 py-4 text-center">
              <Skeleton className="h-4 w-16 mx-auto" />
            </td>
            <td className="px-6 py-4 text-center">
              <Skeleton className="h-4 w-20 mx-auto" />
            </td>
            <td className="px-6 py-4 text-center">
              <Skeleton className="h-4 w-32 mx-auto" />
            </td>
            <td className="px-6 py-4 text-center">
              <Skeleton className="h-4 w-24 mx-auto" />
            </td>
            <td className="px-6 py-4 flex justify-center space-x-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </td>
          </tr>
        ))}
      </tbody>
    );

    const DataRows = () => (
      <tbody>
        {data.map((c, idx) => {
          const isExpanded = expandedId === c.id;
          return (
            <React.Fragment key={c.id}>
              <tr className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{c.productOrServiceName}</div>
                  <div className="text-gray-600 line-clamp-1">{c.description}</div>
                </td>
                <td className="px-6 py-4 text-center">{c.brandName}</td>
                <td className="px-6 py-4 text-center">{formatCurrency(c.budget)}</td>
                <td className="px-6 py-4 text-center">
                  {formatDate(c.timeline.startDate)} – {formatDate(c.timeline.endDate)}
                </td>

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

                <td className="px-6 py-4 flex justify-center space-x-2 whitespace-nowrap">
                  {c.isContracted === 1 && c.isAccepted !== 1 ? (
                    <>
                      <Button
                        variant="outline"
                        className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
                        onClick={() => openContractSidebar(c)}
                      >
                        Open Contract
                      </Button>
                      <Button
                        variant="outline"
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => openRejectModal(c)}
                      >
                        Reject Contract
                      </Button>
                    </>
                  ) : c.hasMilestone === 1 ? (
                    <Button
                      variant="outline"
                      className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
                      onClick={() => openContractSidebar(c, true)}
                    >
                      View Contract
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
                      onClick={() => router.push(`/influencer/my-campaign/view-campaign?id=${c.id}`)}
                    >
                      View Campaign
                    </Button>
                  )}

                  {showMilestones && (
                    <button
                      onClick={() => setExpandedId((prev) => (prev === c.id ? null : c.id))}
                      className="p-2 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 rounded-md hover:brightness-90 transition"
                    >
                      <HiOutlineClipboardList size={18} className="inline-block mr-1" />
                      {isExpanded ? "Hide" : "View"} Milestone
                    </button>
                  )}

                  <Link
                    href={`/influencer/my-campaign/view-campaign?id=${c.id}`}
                    className="p-2 bg-gray-100 text-gray-800 rounded-full hover:bg-gray-200"
                  >
                    <HiOutlineEye size={18} />
                  </Link>
                </td>
              </tr>

              {isExpanded && (
                <tr>
                  <td colSpan={6} className="bg-white px-6 py-6">
                    <MilestoneHistoryCard role="influencer" influencerId={influencerId} campaignId={c.id} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    );

    if (loading)
      return (
        <div className="overflow-x-auto bg-white shadow rounded-lg p-4 animate-pulse">
          <table className="w-full text-sm text-gray-600">
            <thead>
              <tr>
                {["Campaign", "Brand", "Budget", "Timeline", "Status", "Actions"].map((h, i) => (
                  <th
                    key={h}
                    className={`px-6 py-3 font-medium whitespace-nowrap ${
                      i === 0 ? "text-left" : "text-center"
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
                  className={`px-6 py-3 font-medium whitespace-nowrap ${
                    i === 0 ? "text-left" : "text-center"
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

      {/* Contracted Campaigns */}
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

      {/* Contract Sidebar */}
      {sidebarOpen && (
        <div className={`fixed inset-0 z-50 ${sidebarOpen ? "" : "pointer-events-none"}`}>
          {/* Overlay */}
          <div
            className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
              sidebarOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeContractSidebar}
          />

          {/* Panel */}
          <div
            className={`absolute right-0 top-0 h-full w-full sm:w-[620px] bg-white shadow-2xl border-l transform transition-transform duration-300 ease-out ${
              sidebarOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {/* Header */}
            <div className="relative h-28 overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, #FFA135 0%, #FF7236 100%)`,
                  clipPath: "polygon(0 0, 100% 0, 100% 75%, 0 90%)",
                }}
              />
              <div className="relative z-10 p-5 text-white flex items-start justify-between h-full">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mt-1">
                    <HiDocumentText className="w-6 h-6 text-white" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-medium opacity-90 uppercase tracking-wider mb-1">
                      {viewOnly ? "Preview Contract" : "Confirm / Sign Contract"}
                    </div>
                    <div className="text-lg font-bold truncate">
                      {panelCampaign?.productOrServiceName || "Campaign"}
                    </div>
                    <div className="mt-1 text-[11px] text-white/90 truncate">
                      {panelCampaign?.brandName ? `${panelCampaign.brandName}` : ""}{" "}
                      {panelCampaign?.brandName && panelCampaign?.id ? "•" : ""}{" "}
                      {panelCampaign?.id ? `#${panelCampaign.id.slice(-6)}` : ""}
                    </div>
                  </div>
                </div>

                <button
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110"
                  onClick={closeContractSidebar}
                >
                  <HiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="h-[calc(100%-7rem)] overflow-y-auto">
              <div className="p-5 space-y-5">
                {/* Influencer (Purple) Form - hidden in view-only */}
                {!viewOnly && (
                  <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-100 shadow-sm p-5">
                    <div className="font-semibold text-gray-800 mb-3">Influencer Details</div>

                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        id="legalName"
                        label="Legal Name"
                        value={purple.legalName}
                        onChange={(v) => setPurple((p) => ({ ...p, legalName: v }))}
                      />
                      <Input
                        id="email"
                        label="Email"
                        value={purple.email}
                        onChange={(v) => setPurple((p) => ({ ...p, email: v }))}
                      />
                      <Input
                        id="phone"
                        label="Phone"
                        value={purple.phone}
                        onChange={(v) => setPurple((p) => ({ ...p, phone: v }))}
                      />
                      <Input
                        id="taxId"
                        label="Tax ID (optional)"
                        value={purple.taxId}
                        onChange={(v) => setPurple((p) => ({ ...p, taxId: v }))}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <Input
                        id="addressLine1"
                        label="Address Line 1"
                        value={purple.addressLine1}
                        onChange={(v) => setPurple((p) => ({ ...p, addressLine1: v }))}
                      />
                      <Input
                        id="addressLine2"
                        label="Address Line 2"
                        value={purple.addressLine2}
                        onChange={(v) => setPurple((p) => ({ ...p, addressLine2: v }))}
                      />
                      <Input
                        id="city"
                        label="City"
                        value={purple.city}
                        onChange={(v) => setPurple((p) => ({ ...p, city: v }))}
                      />
                      <Input
                        id="state"
                        label="State"
                        value={purple.state}
                        onChange={(v) => setPurple((p) => ({ ...p, state: v }))}
                      />
                      <Input
                        id="zip"
                        label="ZIP / Postal Code"
                        value={purple.zip}
                        onChange={(v) => setPurple((p) => ({ ...p, zip: v }))}
                      />
                      <Input
                        id="country"
                        label="Country"
                        value={purple.country}
                        onChange={(v) => setPurple((p) => ({ ...p, country: v }))}
                      />
                    </div>

                    <div className="mt-3">
                      <Textarea
                        id="notes"
                        label="Notes (optional)"
                        value={purple.notes}
                        onChange={(v) => setPurple((p) => ({ ...p, notes: v }))}
                        rows={3}
                      />
                    </div>

                    {/* Data Access */}
                    <div className="mt-4">
                      <div className="text-sm font-medium text-gray-800 mb-2">Data Access</div>
                      <div className="grid grid-cols-3 gap-2">
                        <Checkbox
                          label="Allow Analytics"
                          checked={!!purple.dataAccess.allowAnalytics}
                          onChange={(checked) =>
                            setPurple((p) => ({
                              ...p,
                              dataAccess: { ...p.dataAccess, allowAnalytics: checked },
                            }))
                          }
                        />
                        <Checkbox
                          label="Allow Paid Ads"
                          checked={!!purple.dataAccess.allowPaidAds}
                          onChange={(checked) =>
                            setPurple((p) => ({
                              ...p,
                              dataAccess: { ...p.dataAccess, allowPaidAds: checked },
                            }))
                          }
                        />
                        <Checkbox
                          label="Content Reuse"
                          checked={!!purple.dataAccess.allowContentReuse}
                          onChange={(checked) =>
                            setPurple((p) => ({
                              ...p,
                              dataAccess: { ...p.dataAccess, allowContentReuse: checked },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview Pane */}
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-100 shadow-sm p-5">
                  <div className="font-semibold text-gray-800 mb-3">Preview</div>
                  {previewUrl ? (
                    <iframe className="w-full h-[55vh] rounded border" src={previewUrl} />
                  ) : (
                    <div className="rounded-lg border border-dashed p-8 text-center text-gray-500">
                      Generate a PDF preview to review the agreement layout and content.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                {viewOnly ? (
                  <span className="text-gray-600">Preview only — signing disabled.</span>
                ) : panelIsAccepted === 1 ? (
                  <span className="text-green-600 font-medium">Already signed.</span>
                ) : hasConfirmed ? (
                  <span className="text-emerald-600">Confirmed — you can sign now.</span>
                ) : (
                  <span className="text-amber-600">Fill details and confirm before signing.</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={closeContractSidebar}>
                  Cancel
                </Button>
                {viewOnly ? (
                  <Button
                    onClick={generatePreview}
                    className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white"
                  >
                    Regenerate Preview
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={generatePreview}
                      className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white"
                    >
                      Generate Preview
                    </Button>
                    <Button
                      onClick={confirmContract}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Confirm Contract
                    </Button>
                    <Button
                      onClick={signContract}
                      disabled={!hasConfirmed || panelIsAccepted === 1}
                      className={
                        hasConfirmed && panelIsAccepted !== 1
                          ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                          : "bg-gray-300 text-gray-600 cursor-not-allowed"
                      }
                      title={!hasConfirmed ? "Confirm first" : panelIsAccepted === 1 ? "Already signed" : ""}
                    >
                      Sign Contract
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
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
            <p className="text-sm text-gray-700">Please tell us why you’re rejecting this contract:</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full h-24 p-2 border rounded focus:outline-none focus:ring"
              placeholder="Your reason (optional)"
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowRejectModal(false)}>
                Cancel
              </Button>
              <Button onClick={confirmReject} className="bg-red-600 hover:bg-red-700 text-white">
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Small form components (inline to keep this file self-contained) ── */
function Input({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 pt-6 pb-2 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-[#FFA135] focus:outline-none"
        placeholder=" "
      />
      <label
        htmlFor={id}
        className="absolute left-4 top-2 text-xs text-[#FFA135] font-medium pointer-events-none"
      >
        {label}
      </label>
    </div>
  );
}

function Textarea({
  id,
  label,
  value,
  onChange,
  rows = 3,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="relative">
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 pt-6 pb-2 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-[#FFA135] focus:outline-none"
        placeholder=" "
      />
      <label
        htmlFor={id}
        className="absolute left-4 top-2 text-xs text-[#FFA135] font-medium pointer-events-none"
      >
        {label}
      </label>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 cursor-pointer transition-all duration-200 hover:border-[#FFA135] hover:bg-orange-50/50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 rounded border-2 border-gray-300 text-[#FFA135] focus:ring-2 focus:ring-[#FFA135] focus:ring-offset-2 cursor-pointer"
      />
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </label>
  );
}
