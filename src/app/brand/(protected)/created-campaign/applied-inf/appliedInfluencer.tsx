/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api, { post } from "@/lib/api";
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
  HiChevronLeft,
  HiChevronRight,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiSearch,
} from "react-icons/hi";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Gradient constants
const TABLE_GRADIENT_FROM = "#FFA135";
const TABLE_GRADIENT_TO = "#FF7236";

interface Influencer {
  influencerId: string;
  name: string;
  primaryPlatform?: "instagram" | "tiktok" | "youtube" | string | null; // kept only for link building
  handle: string | null;          // e.g. "@creator"
  category: string | null;        // e.g. "Electronics & Computers"
  audienceSize: number;           // total followers across profiles
  createdAt?: string;             // application date from response
  isAssigned: number;
  isContracted: number;
  contractId: string | null;
  feeAmount: number;
  isAccepted: number;
  isRejected: number;
  rejectedReason: string;
}

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const toast = (opts: { icon: "success" | "error"; title: string; text?: string }) =>
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

// helpers
const formatAudience = (n: number) => {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const buildHandleUrl = (platform?: string | null, handle?: string | null) => {
  if (!handle) return null;
  const raw = handle.startsWith("@") ? handle.slice(1) : handle;

  switch ((platform || "").toLowerCase()) {
    case "instagram":
      return `https://instagram.com/${raw}`;
    case "tiktok":
      return `https://www.tiktok.com/@${raw}`;
    case "youtube":
      return `https://www.youtube.com/@${raw}`;
    default:
      // fallback (keep YouTube style @ path)
      return `https://www.youtube.com/@${raw}`;
  }
};

export default function AppliedInfluencersPage() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id");
  const campaignName = searchParams.get("name");
  const router = useRouter();

  // Data & Pagination
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

  // UI state
  const [page, setPage] = useState(1);
  const [limit] = useState(PAGE_SIZE_OPTIONS[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof Influencer>("name");
  const [sortOrder, setSortOrder] = useState<1 | 0>(1);

  // Contract & Milestone
  const [showContractModal, setShowContractModal] = useState(false);
  const [selectedInf, setSelectedInf] = useState<Influencer | null>(null);
  const [contractForm, setContractForm] = useState({
    effectiveDate: new Date().toISOString().slice(0, 10),
    brandName: "",
    brandAddress: "",
    influencerName: "",
    influencerAddress: "",
    influencerHandle: "",
    feeAmount: "",
    paymentTerms: "",
  });
  const [pdfUrl, setPdfUrl] = useState<string>("");

  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({
    title: "",
    amount: "",
    description: "",
  });

  const toggleSort = (field: keyof Influencer) => {
    setPage(1);
    if (sortField === field) setSortOrder((o) => (o === 1 ? 0 : 1));
    else {
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

  // Fetch
  const fetchApplicants = async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await post<{
        meta: Meta;
        applicantCount: number;
        influencers: Influencer[];
      }>("/apply/list", {
        campaignId,
        page,
        limit,
        search: searchTerm.trim(),
        sortField,
        sortOrder,
      });

      setInfluencers(res.influencers || []);
      setApplicantCount(res.applicantCount || 0);
      setMeta(res.meta || { total: 0, page: 1, limit, totalPages: 1 });
    } catch {
      setError("Failed to load applicants.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, page, searchTerm, sortField, sortOrder]);

  // Milestones
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
      toast({ icon: "success", title: "Added!", text: "Milestone has been added." });
      setShowMilestoneModal(false);
      fetchApplicants();
    } catch {
      toast({ icon: "error", title: "Error", text: "Failed to add milestone." });
    }
  };

  // ⬇️ NEW: open or create a 1–1 room, then redirect to it
  const handleMessage = async (inf: Influencer) => {
    try {
      const brandId = localStorage.getItem("brandId");
      if (!brandId) {
        return toast({
          icon: "error",
          title: "Not Logged In",
          text: "Please log in as a brand to message influencers.",
        });
      }

      const res = await post<{ message: string; roomId: string }>("/chat/room", {
        brandId,
        influencerId: inf.influencerId,
      });

      if (!res?.roomId) {
        throw new Error("No roomId returned by server.");
      }

      // Redirect to the messages page for this room
      router.push(`/brand/messages/${encodeURIComponent(res.roomId)}`);
    } catch (e: any) {
      toast({
        icon: "error",
        title: "Unable to open chat",
        text: e?.response?.data?.message || e?.message || "Please try again.",
      });
    }
  };

  // Contracts
  const openContractModal = (inf: Influencer) => {
    setSelectedInf(inf);
    setContractForm({
      effectiveDate: new Date().toISOString().slice(0, 10),
      brandName: "",
      brandAddress: "",
      influencerName: inf.name,
      influencerAddress: "",
      influencerHandle: inf.handle || "",
      feeAmount: String(inf.feeAmount || ""),
      paymentTerms: "",
    });
    setPdfUrl("");
    setShowContractModal(true);
  };
  const handleGeneratePreview = async () => {
    if (!selectedInf) return;
    try {
      const payload = {
        brandId: localStorage.getItem("brandId"),
        campaignId,
        influencerId: selectedInf.influencerId,
        ...contractForm,
        feeAmount: Number(contractForm.feeAmount),
        type: 0,
      };
      const res = await api.post("/contract/sendContract", payload, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      setPdfUrl(url);
      window.open(url, "_blank");
    } catch (e: any) {
      toast({ icon: "error", title: "Error", text: e.message || "Failed to generate preview." });
    }
  };
  const handleSendContract = async () => {
    if (!selectedInf) return;
    try {
      await post("/contract/sendContract", {
        brandId: localStorage.getItem("brandId"),
        campaignId,
        influencerId: selectedInf.influencerId,
        ...contractForm,
        feeAmount: Number(contractForm.feeAmount),
        type: 1,
      });
      toast({ icon: "success", title: "Sent!", text: "Contract sent to influencer." });
      setShowContractModal(false);
      fetchApplicants();
    } catch (e: any) {
      toast({ icon: "error", title: "Error", text: e.message || "Failed to send contract." });
    }
  };

  // Rows
  const rows = useMemo(
    () =>
      influencers.map((inf, idx) => {
        const href = buildHandleUrl(inf.primaryPlatform, inf.handle);
        return (
          <TableRow
            key={inf.influencerId}
            className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} transition-colors`}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${TABLE_GRADIENT_FROM}11, ${TABLE_GRADIENT_TO}11)`)
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundImage = "")}
          >
            <TableCell>{inf.name}</TableCell>

            <TableCell className="whitespace-nowrap">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                  title="Open profile"
                >
                  {inf.handle || "—"}
                </a>
              ) : (
                <span className="text-gray-500">—</span>
              )}
            </TableCell>

            {/* Platform column removed */}

            <TableCell>
              <Badge variant="secondary" className="capitalize">
                {inf.category || "—"}
              </Badge>
            </TableCell>

            <TableCell>{formatAudience(inf.audienceSize)}</TableCell>

            <TableCell className="whitespace-nowrap">
              {inf.createdAt ? new Date(inf.createdAt).toLocaleDateString() : "—"}
            </TableCell>

            <TableCell className="text-center">
              {inf.isRejected === 1 ? (
                <>
                  <Badge className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white shadow-none">
                    Rejected
                  </Badge>
                  <p className="text-xs text-gray-500">{inf.rejectedReason || "No reason provided"}</p>
                </>
              ) : inf.isAccepted === 1 ? (
                <p>Working</p>
              ) : inf.isContracted === 1 ? (
                <p>Contract Sent</p>
              ) : (
                <p>Applied for Work</p>
              )}
            </TableCell>

            <TableCell className="flex space-x-2 justify-center">
              <Button
                size="sm"
                variant="outline"
                className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white"
                onClick={() => router.push(`/brand/influencers?id=${inf.influencerId}`)}
              >
                View
              </Button>

              {/* UPDATED: now opens/creates the 1–1 room and redirects */}
              <Button
                size="sm"
                variant="outline"
                className="bg-gradient-to-r from-[#FF8C00] via-[#FF5E7E] to-[#D12E53] text-white"
                onClick={() => handleMessage(inf)}
              >
                Message
              </Button>

              {!inf.isContracted && !inf.isRejected && (
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-green-500 text-white"
                  onClick={() => openContractModal(inf)}
                >
                  Send Contract
                </Button>
              )}
              {inf.isRejected === 1 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-green-500 text-white"
                  onClick={() => openContractModal(inf)}
                >
                  Resend Contract
                </Button>
              )}

              {inf.isAccepted === 1 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-green-500 text-white"
                  onClick={() => handleAddMilestone(inf)}
                >
                  Add Milestone
                </Button>
              )}
            </TableCell>
          </TableRow>
        );
      }),
    [influencers, router]
  );

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between p-4 rounded-md">
        <h1 className="text-3xl font-bold">Campaign: {campaignName || "Unknown Campaign"}</h1>
        <Button size="sm" variant="outline" className="bg-gray-200" onClick={() => router.back()}>
          Back
        </Button>
      </header>

      {/* Search box */}
      <div className="mb-6 max-w-md">
        <div className="relative bg-white rounded-lg">
          <HiSearch className="absolute inset-y-0 left-3 my-auto text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search influencers..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
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
          <Table className="min-w-[900px]">
            <TableHeader
              style={{ backgroundImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO})` }}
              className="text-white"
            >
              <tr>
                <TableHead onClick={() => toggleSort("name")} className="cursor-pointer font-semibold">
                  {applicantCount} Applied <SortIndicator field="name" />
                </TableHead>
                <TableHead onClick={() => toggleSort("handle")} className="cursor-pointer font-semibold">
                  Social Handle <SortIndicator field="handle" />
                </TableHead>
                {/* Platform column removed */}
                <TableHead onClick={() => toggleSort("category")} className="cursor-pointer font-semibold">
                  Category <SortIndicator field="category" />
                </TableHead>
                <TableHead onClick={() => toggleSort("audienceSize")} className="cursor-pointer font-semibold">
                  Audience <SortIndicator field="audienceSize" />
                </TableHead>
                <TableHead onClick={() => toggleSort("createdAt")} className="cursor-pointer font-semibold">
                  Date <SortIndicator field="createdAt" />
                </TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="text-center font-semibold">Actions</TableHead>
              </tr>
            </TableHeader>
            <TableBody>{rows}</TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex justify-center md:justify-end items-center gap-2">
          <Button variant="outline" size="icon" disabled={page === 1} onClick={() => setPage((p) => Math.max(p - 1, 1))}>
            <HiChevronLeft />
          </Button>
          <span className="text-sm">
            Page <strong>{page}</strong> of {meta.totalPages}
          </span>
          <Button variant="outline" size="icon" disabled={page === meta.totalPages} onClick={() => setPage((p) => Math.min(p + 1, meta.totalPages))}>
            <HiChevronRight />
          </Button>
        </div>
      )}

      {/* Contract Modal */}
      {showContractModal && selectedInf && (
        <div className="fixed inset-0 backdrop-blur-sm bg-opacity-30 flex items-center justify-center z-50">
          <div
            className="max-w-lg bg-white rounded-lg p-6 w-full max-h-[90vh] overflow-auto border-2 border-transparent"
            style={{ borderImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO}) 1` }}
          >
            {!pdfUrl ? (
              <>
                <h2 className="text-xl font-semibold mb-4">Contract Details</h2>
                <div className="space-y-4">
                  <FloatingLabelInput
                    id="effectiveDate"
                    label="Effective Date"
                    type="date"
                    value={contractForm.effectiveDate}
                    onChange={(e) => setContractForm((f) => ({ ...f, effectiveDate: e.target.value }))}
                  />
                  <FloatingLabelInput
                    id="brandName"
                    label="Brand Legal Name"
                    value={contractForm.brandName}
                    onChange={(e) => setContractForm((f) => ({ ...f, brandName: e.target.value }))}
                  />
                  <FloatingLabelInput
                    id="brandAddress"
                    label="Brand Address"
                    value={contractForm.brandAddress}
                    onChange={(e) => setContractForm((f) => ({ ...f, brandAddress: e.target.value }))}
                  />
                  <FloatingLabelInput
                    id="influencerName"
                    label="Influencer Legal Name"
                    value={contractForm.influencerName}
                    onChange={(e) => setContractForm((f) => ({ ...f, influencerName: e.target.value }))}
                  />
                  <FloatingLabelInput
                    id="influencerAddress"
                    label="Influencer Address"
                    value={contractForm.influencerAddress}
                    onChange={(e) => setContractForm((f) => ({ ...f, influencerAddress: e.target.value }))}
                  />
                  <FloatingLabelInput
                    id="influencerHandle"
                    label="Influencer Handle"
                    value={contractForm.influencerHandle}
                    onChange={(e) => setContractForm((f) => ({ ...f, influencerHandle: e.target.value }))}
                  />
                  <FloatingLabelInput
                    id="feeAmount"
                    label="Budget (USD)"
                    value={contractForm.feeAmount}
                    onChange={(e) => setContractForm((f) => ({ ...f, feeAmount: e.target.value }))}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="paymentTerms">Contract Deliverable Terms</Label>
                    <Textarea
                      id="paymentTerms"
                      rows={4}
                      value={contractForm.paymentTerms}
                      onChange={(e) => setContractForm((f) => ({ ...f, paymentTerms: e.target.value }))}
                      placeholder="e.g. 5 deliverables…"
                      className="focus:ring-[#FFA135]/50"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end space-x-2">
                  <Button onClick={handleGeneratePreview} className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white">
                    Generate Preview
                  </Button>
                  <Button variant="outline" onClick={() => setShowContractModal(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-4">Contract Preview</h2>
                <iframe src={pdfUrl} className="w-full h-[60vh] rounded-md border" title="PDF Preview" />
                <div className="mt-6 flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      URL.revokeObjectURL(pdfUrl);
                      setPdfUrl("");
                    }}
                  >
                    Back
                  </Button>
                  <Button onClick={handleSendContract} className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white">
                    Send Contract
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Milestone Modal */}
      {showMilestoneModal && selectedInf && (
        <div className="fixed inset-0 backdrop-blur-sm bg-opacity-30 flex items-center justify-center z-50">
          <div
            className="max-w-lg bg-white rounded-lg p-6 w-full max-h-[90vh] overflow-auto border-2 border-transparent"
            style={{ borderImage: `linear-gradient(to right, ${TABLE_GRADIENT_FROM}, ${TABLE_GRADIENT_TO}) 1` }}
          >
            <h2 className="text-xl font-semibold mb-4">Add Milestone</h2>
            <div className="space-y-4">
              <FloatingLabelInput
                id="milestoneTitle"
                label="Title"
                value={milestoneForm.title}
                onChange={(e) => setMilestoneForm((f) => ({ ...f, title: e.target.value }))}
              />
              <FloatingLabelInput
                id="milestoneAmount"
                label="Amount"
                value={milestoneForm.amount}
                onChange={(e) => setMilestoneForm((f) => ({ ...f, amount: e.target.value }))}
              />
              <FloatingLabelInput
                id="milestoneDesc"
                label="Description"
                value={milestoneForm.description}
                onChange={(e) => setMilestoneForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowMilestoneModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveMilestone} className="bg-green-600 text-white">
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
