/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  HiTrash,
  HiDocumentText,
  HiUsers,
  HiClipboardList,
  HiEye,
  HiPaperAirplane,
} from "react-icons/hi";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// NEW: import the exact sidebar + form components used in the reference UI
import { ContractSidebar, SidebarSection } from "./ContractSidebar";
import {
  FloatingInput,
  Select,
  NumberInput,
  Checkbox,
  PlatformSelector,
  ChipInput,
  TextArea,
} from "./FormComponents";

// ───────────────────────────────────────────────────────────────────────────────
// THEME
// ───────────────────────────────────────────────────────────────────────────────
const GRADIENT_FROM = "#FFA135";
const GRADIENT_TO = "#FF7236";

// ───────────────────────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────────────────────
interface Influencer {
  influencerId: string;
  name: string;
  primaryPlatform?: "instagram" | "tiktok" | "youtube" | string | null;
  handle: string | null;
  category: string | null;
  audienceSize: number;
  createdAt?: string;
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

// ───────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ───────────────────────────────────────────────────────────────────────────────
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
      return `https://www.youtube.com/@${raw}`;
  }
};

const mapPlatformToApi = (p?: string | null) => {
  switch ((p || "").toLowerCase()) {
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    case "youtube":
      return "YouTube";
    default:
      return "YouTube";
  }
};

// Chip input (kept for other parts of the page; sidebar uses ChipInput from reference UI)
function Chips({
  label,
  items,
  setItems,
  placeholder,
  validator,
}: {
  label: string;
  items: string[];
  setItems: (v: string[]) => void;
  placeholder?: string;
  validator?: (s: string) => boolean;
}) {
  const [value, setValue] = useState("");
  const add = () => {
    const v = value.trim();
    if (!v) return;
    if (validator && !validator(v)) {
      setValue("");
      return;
    }
    if (!items.includes(v)) setItems([...items, v]);
    setValue("");
  };
  return (
    <div className="rounded-xl border border-gray-100 shadow-sm p-4 bg-white/90 backdrop-blur">
      <Label className="mb-2 block">{label}</Label>
      <div className="flex flex-wrap gap-2 mb-2">
        {items.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-gray-100 border"
          >
            {t}
            <button
              type="button"
              className="p-0.5 rounded hover:bg-gray-200"
              onClick={() => setItems(items.filter((x) => x !== t))}
            >
              <HiTrash className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder={placeholder || "Type and press +"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          +
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// PAGE
// ───────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function AppliedInfluencersPage() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id");
  const campaignName = searchParams.get("name") || "";
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

  // Right Panel (Contract)
  const [showContractPanel, setShowContractPanel] = useState(false);
  const [selectedInf, setSelectedInf] = useState<Influencer | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");

  // Form aligned to payload
  const [campaignTitle, setCampaignTitle] = useState(campaignName);
  const [platforms, setPlatforms] = useState<string[]>([]); // string[] to match PlatformSelector
  const [goLiveStart, setGoLiveStart] = useState("");
  const [goLiveEnd, setGoLiveEnd] = useState("");
  const [totalFee, setTotalFee] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [milestoneSplit, setMilestoneSplit] = useState("50/50");
  const [revisionsIncluded, setRevisionsIncluded] = useState(1);

  const [influencerHandle, setInfluencerHandle] = useState("");

  // Deliverable fields (single item)
  const [dType, setDType] = useState("Scope");
  const [dQuantity, setDQuantity] = useState(1);
  const [dFormat, setDFormat] = useState("Text");
  const [dDurationSec, setDDurationSec] = useState(0);
  const [dDraftRequired, setDDraftRequired] = useState(false);
  const [dMinLiveHours, setDMinLiveHours] = useState(0);
  const [dTags, setDTags] = useState<string[]>([]);
  const [dHandles, setDHandles] = useState<string[]>([]);
  const [dCaptions, setDCaptions] = useState("");
  const [dLinks, setDLinks] = useState<string[]>([]);

  // Helpers
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

  // Milestones (unchanged)
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ title: "", amount: "", description: "" });

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

  // Chat
  const handleMessage = async (inf: Influencer) => {
    try {
      const brandId = localStorage.getItem("brandId");
      if (!brandId)
        return toast({ icon: "error", title: "Not Logged In", text: "Please log in as a brand to message influencers." });
      const res = await post<{ message: string; roomId: string }>("/chat/room", {
        brandId,
        influencerId: inf.influencerId,
      });
      if (!res?.roomId) throw new Error("No roomId returned by server.");
      router.push(`/brand/messages/${encodeURIComponent(res.roomId)}`);
    } catch (e: any) {
      toast({
        icon: "error",
        title: "Unable to open chat",
        text: e?.response?.data?.message || e?.message || "Please try again.",
      });
    }
  };

  // Open panel + prefill
  const openContractPanel = (inf: Influencer) => {
    setSelectedInf(inf);
    setCampaignTitle(campaignName);
    setPlatforms([mapPlatformToApi(inf.primaryPlatform) as string]);
    setGoLiveStart("");
    setGoLiveEnd("");
    setTotalFee(String(inf.feeAmount || 5000));
    setCurrency("USD");
    setMilestoneSplit("10"); // matches your payload example
    setRevisionsIncluded(1);
    setInfluencerHandle(inf.handle || "@");

    // Deliverable defaults based on your payload
    setDType("Scope");
    setDQuantity(1);
    setDFormat("Text");
    setDDurationSec(0);
    setDDraftRequired(false);
    setDMinLiveHours(0);
    setDTags([]);
    setDHandles(inf.handle ? [inf.handle] : []);
    setDCaptions("");
    setDLinks([]);

    setPdfUrl("");
    setShowContractPanel(true);
  };

  // Keep deliverable handles synced with influencerHandle if empty
  useEffect(() => {
    if (!dHandles.length && influencerHandle) setDHandles([influencerHandle]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [influencerHandle]);

  // Close on Escape
  useEffect(() => {
    if (!showContractPanel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl("");
        setShowContractPanel(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showContractPanel, pdfUrl]);

  // Build yellow payload matching EXACT structure
  const buildYellowForInitiate = () => {
    const goLive =
      goLiveStart || goLiveEnd
        ? {
            start: goLiveStart ? new Date(goLiveStart) : undefined,
            end: goLiveEnd ? new Date(goLiveEnd) : undefined,
          }
        : undefined;

    return {
      campaignTitle,
      platforms,
      ...(goLive ? { goLive } : {}),
      totalFee: Number(totalFee) || 0,
      currency,
      milestoneSplit,
      revisionsIncluded: Number(revisionsIncluded) || 0,
      deliverablesPresetKey: "ui-manual",
      deliverablesExpanded: [
        {
          type: dType,
          quantity: Number(dQuantity) || 0,
          format: dFormat,
          durationSec: Number(dDurationSec) || 0,
          postingWindow: goLive || { start: undefined, end: undefined },
          draftRequired: Boolean(dDraftRequired),
          minLiveHours: Number(dMinLiveHours) || 0,
          tags: dTags,
          handles: dHandles,
          captions: dCaptions,
          links: dLinks,
          disclosures: "",
        },
      ],
      influencerHandle,
    };
  };

  // PREVIEW: /contract/initiate type=2 → PDF blob
  const handleGeneratePreview = async () => {
    if (!selectedInf) return;
    if (!platforms.length) {
      return toast({ icon: "error", title: "Missing Platforms", text: "Select at least one platform." });
    }
    try {
      const payload = {
        brandId: localStorage.getItem("brandId"),
        campaignId,
        influencerId: selectedInf.influencerId,
        yellow: buildYellowForInitiate(),
        type: 2,
      };
      const res = await api.post("/contract/initiate", payload, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      setPdfUrl(url);
      window.open(url, "_blank");
    } catch (e: any) {
      toast({ icon: "error", title: "Preview Error", text: e?.response?.data?.message || e.message || "Failed to generate preview." });
    }
  };

  // SEND: /contract/initiate type=1 → save/assign
  const handleSendContract = async () => {
    if (!selectedInf) return;
    try {
      await post("/contract/initiate", {
        brandId: localStorage.getItem("brandId"),
        campaignId,
        influencerId: selectedInf.influencerId,
        yellow: buildYellowForInitiate(),
        type: 1,
      });
      toast({ icon: "success", title: "Sent!", text: "Contract sent to influencer." });
      setShowContractPanel(false);
      fetchApplicants();
    } catch (e: any) {
      const msg =
        e?.response?.status === 409
          ? e?.response?.data?.message || "A contract has already been assigned."
          : e?.response?.data?.message || e.message || "Failed to send contract.";
      toast({ icon: "error", title: "Error", text: msg });
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
              (e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${GRADIENT_FROM}11, ${GRADIENT_TO}11)`)
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
                  <Badge className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white shadow-none">Rejected</Badge>
                  <p className="text-xs text-gray-500">{inf.rejectedReason || "No reason provided"}</p>
                </>
              ) : inf.isAccepted === 1 ? (
                <p>Working</p>
              ) : inf.isAssigned === 1 ? (
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

              <Button
                size="sm"
                variant="outline"
                className="bg-gradient-to-r from-[#FF8C00] via-[#FF5E7E] to-[#D12E53] text-white"
                onClick={() => handleMessage(inf)}
              >
                Message
              </Button>

              {!inf.isAssigned && !inf.isRejected && (
                <Button size="sm" variant="outline" className="bg-green-500 text-white" onClick={() => openContractPanel(inf)}>
                  Send Contract
                </Button>
              )}

              {inf.isRejected === 1 && (
                <Button size="sm" variant="outline" className="bg-green-500 text-white" onClick={() => openContractPanel(inf)}>
                  Resend Contract
                </Button>
              )}

              {inf.isAccepted === 1 && (
                <Button size="sm" variant="outline" className="bg-green-500 text-white" onClick={() => handleAddMilestone(inf)}>
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

      {/* Search */}
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
          <Table className="min-w-[1000px]">
            <TableHeader
              style={{ backgroundImage: `linear-gradient(to right, ${GRADIENT_FROM}, ${GRADIENT_TO})` }}
              className="text-white"
            >
              <tr>
                <TableHead onClick={() => toggleSort("name")} className="cursor-pointer font-semibold">
                  {applicantCount} Applied <SortIndicator field="name" />
                </TableHead>
                <TableHead onClick={() => toggleSort("handle")} className="cursor-pointer font-semibold">
                  Social Handle <SortIndicator field="handle" />
                </TableHead>
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

      {/* Sliding Right Sidebar (Contract Panel) — EXACT UI as reference */}
      <ContractSidebar
        isOpen={showContractPanel}
        onClose={() => {
          if (pdfUrl) URL.revokeObjectURL(pdfUrl);
          setPdfUrl("");
          setShowContractPanel(false);
        }}
        title="Initiate Contract"
        subtitle={campaignTitle || "New Agreement"}
      >
        {!pdfUrl ? (
          <>
            <SidebarSection title="Campaign Details" icon={<HiDocumentText className="w-4 h-4" />}> 
              <div className="space-y-4">
                <FloatingInput
                  id="campaignTitle"
                  label="Campaign Title"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Select Platforms</label>
                  <PlatformSelector platforms={platforms} onChange={setPlatforms} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="goLiveStart" className="block text-xs font-medium text-gray-600 mb-1.5">
                      Go Live Start
                    </label>
                    <input
                      id="goLiveStart"
                      type="date"
                      value={goLiveStart}
                      onChange={(e) => setGoLiveStart(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-[#FFA135] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="goLiveEnd" className="block text-xs font-medium text-gray-600 mb-1.5">
                      Go Live End
                    </label>
                    <input
                      id="goLiveEnd"
                      type="date"
                      value={goLiveEnd}
                      onChange={(e) => setGoLiveEnd(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-[#FFA135] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FloatingInput
                    id="totalFee"
                    label="Total Fee"
                    value={totalFee}
                    onChange={(e) => setTotalFee(e.target.value)}
                  />
                  <Select
                    id="currency"
                    label="Currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    options={[
                      { value: "USD", label: "USD" },
                      { value: "EUR", label: "EUR" },
                      { value: "INR", label: "INR" },
                      { value: "GBP", label: "GBP" },
                    ]}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FloatingInput
                    id="milestoneSplit"
                    label="Milestone Split"
                    value={milestoneSplit}
                    onChange={(e) => setMilestoneSplit(e.target.value)}
                  />
                  <NumberInput
                    id="revisionsIncluded"
                    label="Revisions Included"
                    value={revisionsIncluded}
                    onChange={setRevisionsIncluded}
                    min={0}
                  />
                </div>
              </div>
            </SidebarSection>

            <SidebarSection title="Influencer" icon={<HiUsers className="w-4 h-4" />}> 
              <div className="space-y-4">
                <FloatingInput
                  id="influencerHandle"
                  label="Influencer Handle"
                  value={influencerHandle}
                  onChange={(e) => setInfluencerHandle(e.target.value)}
                />
                <ChipInput label="Deliverable Handles" items={dHandles} setItems={setDHandles} placeholder="@handle" />
              </div>
            </SidebarSection>

            <SidebarSection title="Deliverables" icon={<HiClipboardList className="w-4 h-4" />}> 
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FloatingInput id="dType" label="Type" value={dType} onChange={(e) => setDType(e.target.value)} />
                  <Select
                    id="dFormat"
                    label="Format"
                    value={dFormat}
                    onChange={(e) => setDFormat(e.target.value)}
                    options={[
                      { value: "Text", label: "Text" },
                      { value: "MP4", label: "MP4" },
                      { value: "Short", label: "Short" },
                      { value: "Story", label: "Story" },
                      { value: "Reel", label: "Reel" },
                      { value: "Image", label: "Image" },
                    ]}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <NumberInput id="quantity" label="Quantity" value={dQuantity} onChange={setDQuantity} min={1} />
                  <NumberInput id="duration" label="Duration (sec)" value={dDurationSec} onChange={setDDurationSec} min={0} />
                  <NumberInput id="minlive" label="Min Live (hrs)" value={dMinLiveHours} onChange={setDMinLiveHours} min={0} />
                </div>

                <Checkbox id="draftRequired" label="Draft Required" checked={dDraftRequired} onChange={setDDraftRequired} />

                <TextArea
                  id="captions"
                  label="Captions / Notes"
                  value={dCaptions}
                  onChange={(e) => setDCaptions(e.target.value)}
                  rows={3}
                  placeholder="Guidelines, hashtags, instructions..."
                />

                <div className="grid grid-cols-2 gap-4">
                  <ChipInput label="Tags" items={dTags} setItems={setDTags} placeholder="#tag" />
                  <ChipInput
                    label="Links"
                    items={dLinks}
                    setItems={setDLinks}
                    placeholder="https://"
                    validator={(s) => /^https?:\/\/.+/i.test(s)}
                  />
                </div>
              </div>
            </SidebarSection>

            <div className="sticky bottom-0 -mx-6 -mb-6 bg-white border-t border-gray-200 p-6 flex justify-end gap-3 shadow-lg">
              <Button
                variant="outline"
                onClick={() => {
                  if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                  setPdfUrl("");
                  setShowContractPanel(false);
                }}
                className="px-6 py-2.5 rounded-lg border-2 border-gray-300 text-gray-700 font-medium transition-all duration-200 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleGeneratePreview}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white font-medium shadow-md transition-all duration-200 hover:shadow-lg hover:scale-105 flex items-center gap-2"
                disabled={!platforms.length || !campaignTitle.trim()}
                title={!platforms.length ? "Select at least one platform" : ""}
              >
                <HiEye className="w-5 h-5" />
                Generate Preview
              </Button>
            </div>
          </>
        ) : (
          <>
            <SidebarSection title="PDF Preview" icon={<HiDocumentText className="w-4 h-4" />}> 
              <div className="bg-gray-100 rounded-lg p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#FFA135] to-[#FF7236] flex items-center justify-center">
                  <HiDocumentText className="w-8 h-8 text-white" />
                </div>
                <p className="text-gray-600 mb-2">PDF Preview</p>
                <p className="text-sm text-gray-500">Contract document ready to send</p>
              </div>
            </SidebarSection>

            <div className="sticky bottom-0 -mx-6 -mb-6 bg-white border-t border-gray-200 p-6 flex justify-end gap-3 shadow-lg">
              <Button
                variant="outline"
                onClick={() => {
                  URL.revokeObjectURL(pdfUrl);
                  setPdfUrl("");
                }}
                className="px-6 py-2.5 rounded-lg border-2 border-gray-300 text-gray-700 font-medium transition-all duration-200 hover:bg-gray-50"
              >
                Back
              </Button>
              <Button
                onClick={handleSendContract}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white font-medium shadow-md transition-all duration-200 hover:shadow-lg hover:scale-105 flex items-center gap-2"
              >
                <HiPaperAirplane className="w-5 h-5" />
                Send Contract
              </Button>
            </div>
          </>
        )}
      </ContractSidebar>

      {/* Milestone Modal */}
      {showMilestoneModal && selectedInf && (
        <div className="fixed inset-0 backdrop-blur-sm bg-opacity-30 flex items-center justify-center z-50">
          <div
            className="max-w-lg bg-white rounded-lg p-6 w-full max-h-[90vh] overflow-auto border-2 border-transparent"
            style={{ borderImage: `linear-gradient(to right, ${GRADIENT_FROM}, ${GRADIENT_TO}) 1` }}
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

// ───────────────────────────────────────────────────────────────────────────────
// SUPPORT UI
// ───────────────────────────────────────────────────────────────────────────────
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
