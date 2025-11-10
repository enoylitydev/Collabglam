"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import api, { post } from "@/lib/api";
import Swal from "sweetalert2";
import { HiOutlineEye, HiChevronLeft, HiChevronRight, HiX } from "react-icons/hi";

// ── Types (new API) ─────────────────────────────────────────────────────
interface RejectedCampaign {
  campaignsId: string;
  brandName: string;
  productOrServiceName: string;
  description: string;
  budget: number;
  timeline?: { startDate?: string | Date; endDate?: string | Date };

  // joined convenience fields from API
  contractId: string | null;
  feeAmount?: number;
  isRejected: 1 | 0;
  rejectedAt?: string | Date | null;
  rejectionReason?: string;
}

interface ApiResponse {
  meta: { total: number; page: number; limit: number; totalPages: number };
  campaigns: RejectedCampaign[];
}

// ── Component ───────────────────────────────────────────────────────────
export default function InfluencerRejectedCampaigns() {
  const [campaigns, setCampaigns] = useState<RejectedCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  const [searchTerm, setSearchTerm] = useState("");

  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [viewingContractId, setViewingContractId] = useState<string | null>(null);

  const influencerId =
    typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;

  // ── Formatters ─────────────────────────────────────────────────────────
  const formatDate = (d?: string | Date | null) => {
    if (!d) return "—";
    const dt = typeof d === "string" ? new Date(d) : d;
    if (isNaN(dt as unknown as number)) return "—";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(dt);
  };

  const formatCurrency = (n?: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
      Number(n ?? 0)
    );

  // ── Fetch rejected (new endpoint/shape) ────────────────────────────────
  const fetchRejected = useCallback(async () => {
    if (!influencerId) {
      setError("No influencer ID found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await post<ApiResponse>("/campaign/rejectedbyinf", {
        influencerId,
        search: searchTerm.trim() || undefined,
        page,
        limit: itemsPerPage,
      });
      setCampaigns(res.campaigns || []);
      setTotalPages(res.meta?.totalPages || 1);
    } catch (e: any) {
      setError(e?.message || "Failed to load rejected campaigns.");
    } finally {
      setLoading(false);
    }
  }, [influencerId, page, searchTerm]);

  useEffect(() => {
    fetchRejected();
  }, [fetchRejected]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRejected();
  };

  // ── View PDF ───────────────────────────────────────────────────────────
  const handleViewContract = async (contractId: string | null) => {
    if (!contractId) return;
    try {
      const res = await api.post("/contract/viewPdf", { contractId }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      setPdfUrl(url);
      setViewingContractId(contractId);
      setShowPdfModal(true);
    } catch (e: any) {
      Swal.fire("Error", e?.message || "Failed to load contract PDF.", "error");
    }
  };

  return (
    <div className="p-6 min-h-screen space-y-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-3xl font-semibold">Rejected Campaigns</h1>
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search brand, product, category..."
            className="w-full sm:w-72"
          />
          <Button type="submit" variant="outline" className="bg-gray-100 hover:bg-gray-200">
            Search
          </Button>
        </form>
      </header>

      {/* Table */}
      {loading ? (
        <div className="p-6 space-y-2">
          {Array.from({ length: itemsPerPage }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <p className="text-red-600 text-center">{error}</p>
      ) : campaigns.length === 0 ? (
        <p className="text-gray-600 text-center">No rejected campaigns found.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-md shadow-sm">
          <table className="w-full text-sm text-gray-700">
            <thead className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800">
              <tr>
                <th className="px-6 py-3 text-left">Campaign</th>
                <th className="px-6 py-3 text-left">Brand</th>
                <th className="px-6 py-3 text-right">Budget</th>
                <th className="px-6 py-3 text-center">Timeline</th>
                <th className="px-6 py-3 text-left">Reason</th>
                <th className="px-6 py-3 text-left">Rejected On</th>
                <th className="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, idx) => (
                <tr key={c.contractId || c.campaignsId} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-6 py-4">
                    <div className="font-medium">{c.productOrServiceName}</div>
                    <div className="text-gray-600 line-clamp-1">{c.description}</div>
                  </td>
                  <td className="px-6 py-4">{c.brandName}</td>
                  <td className="px-6 py-4 text-right">{formatCurrency(c.budget)}</td>
                  <td className="px-6 py-4 text-center">
                    {formatDate(c.timeline?.startDate)} – {formatDate(c.timeline?.endDate)}
                  </td>
                  <td className="px-6 py-4">{c.rejectionReason || "No Reason Provided"}</td>
                  <td className="px-6 py-4">{formatDate(c.rejectedAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!c.contractId}
                        title={!c.contractId ? "No contract PDF available" : "View contract"}
                        className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 disabled:opacity-50"
                        onClick={() => handleViewContract(c.contractId)}
                      >
                        <HiOutlineEye className="inline mr-1" />
                        View Contract
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex justify-end items-center p-4 space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50"
            >
              <HiChevronLeft size={20} />
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50"
            >
              <HiChevronRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* PDF Modal */}
      {showPdfModal && viewingContractId && (
        <div className="fixed inset-0 backdrop-blur-sm bg-gray-900/30 flex items-center justify-center z-50">
          <div className="relative bg-white rounded-lg w-11/12 max-w-4xl h-[80vh] overflow-hidden">
            <button
              onClick={() => {
                URL.revokeObjectURL(pdfUrl);
                setShowPdfModal(false);
                setViewingContractId(null);
              }}
              className="absolute top-2 right-2 p-2 text-gray-600 hover:text-gray-900"
            >
              <HiX size={24} />
            </button>
            <iframe src={pdfUrl} className="w-full h-full" title="Contract PDF" />
          </div>
        </div>
      )}
    </div>
  );
}
