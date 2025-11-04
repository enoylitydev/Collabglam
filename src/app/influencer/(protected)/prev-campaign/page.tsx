"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import api, { post } from "@/lib/api";
import Swal from "sweetalert2";
import {
  HiOutlineEye,
  HiChevronLeft,
  HiChevronRight,
  HiX,
} from "react-icons/hi";

// ── Types ───────────────────────────────────────────────────────────────
interface RejectedContract {
  contractId: string;
  rejectedReason: string;
  campaign: {
    campaignsId: string;
    brandName: string;
    productOrServiceName: string;
    description: string;
    budget: number;
    timeline: { startDate: string; endDate: string };
  };
}

interface ContractsResponse {
  meta: { total: number; page: number; limit: number; totalPages: number };
  contracts: RejectedContract[];
}

// ── Component ───────────────────────────────────────────────────────────
export default function InfluencerDashboard() {
  const [contracts, setContracts] = useState<RejectedContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [viewingContractId, setViewingContractId] = useState<string | null>(null);

  const influencerId =
    typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;

  // ── Formatters ─────────────────────────────────────────────────────────
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

  // ── Fetch rejected contracts ───────────────────────────────────────────
  const fetchRejected = useCallback(async () => {
    if (!influencerId) {
      setError("No influencer ID found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await post<ContractsResponse>("/contract/rejectedByInfluencer", {
        influencerId,
        page,
        limit: itemsPerPage,
      });
      setContracts(res.contracts);
      setTotalPages(res.meta.totalPages);
    } catch (e: any) {
      setError(e.message || "Failed to load rejected campaigns.");
    } finally {
      setLoading(false);
    }
  }, [influencerId, page]);

  useEffect(() => {
    fetchRejected();
  }, [fetchRejected]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRejected();
  };

  // ── View PDF ───────────────────────────────────────────────────────────
  const handleViewContract = async (contractId: string) => {
    try {
      const res = await api.post(
        "/contract/view",
        { contractId },
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data);
      setPdfUrl(url);
      setViewingContractId(contractId);
      setShowPdfModal(true);
    } catch (e: any) {
      Swal.fire("Error", e.message || "Failed to load contract PDF.", "error");
    }
  };

  return (
    <div className="p-6 min-h-screen space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Previous Campaigns</h1>
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
      ) : contracts.length === 0 ? (
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
                <th className="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c, idx) => {
                const camp = c.campaign;
                return (
                  <tr
                    key={c.contractId}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium">{camp.productOrServiceName}</div>
                      <div className="text-gray-600 line-clamp-1">
                        {camp.description}
                      </div>
                    </td>
                    <td className="px-6 py-4">{camp.brandName}</td>
                    <td className="px-6 py-4 text-right">
                      {formatCurrency(camp.budget)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {formatDate(camp.timeline.startDate)} –{" "}
                      {formatDate(camp.timeline.endDate)}
                    </td>
<td className="px-6 py-4">
  {c.rejectedReason || "No Reason Provided"}
</td>

                    <td className="px-6 py-4 flex justify-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
                        onClick={() => handleViewContract(c.contractId)}
                      >
                        <HiOutlineEye className="inline mr-1" />
                        View Contract
                      </Button>
                    </td>
                  </tr>
                );
              })}
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
            <iframe
              src={pdfUrl}
              className="w-full h-full"
              title="Contract PDF"
            />
          </div>
        </div>
      )}
    </div>
  );
}
