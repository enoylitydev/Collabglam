/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useState, ChangeEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api, { post } from "@/lib/api";
import Swal from "sweetalert2";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  HiDocumentText,
  HiClipboardList,
  HiEye,
  HiPaperAirplane,
} from "react-icons/hi";

// ───────────────────────────────────────────────────────────────────────────────
// THEME (black & white)
// ───────────────────────────────────────────────────────────────────────────────
const GRADIENT_FROM = "#000000";
const GRADIENT_TO = "#4B5563"; // gray-600

// ───────────────────────────────────────────────────────────────────────────────
/** TYPES */
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

interface PartyConfirm {
  confirmed?: boolean;
  byUserId?: string;
  at?: string;
}
interface PartySign {
  signed?: boolean;
  byUserId?: string;
  name?: string;
  email?: string;
  at?: string;
}
interface ContractMeta {
  contractId: string;
  campaignId: string;
  status:
    | "draft"
    | "sent"
    | "viewed"
    | "negotiation"
    | "finalize"
    | "signing"
    | "locked";
  lastSentAt?: string;
  lockedAt?: string | null;
  confirmations?: { brand?: PartyConfirm; influencer?: PartyConfirm };
  signatures?: { brand?: PartySign; influencer?: PartySign; collabglam?: PartySign };
  isEdit?: boolean;
  isEditBy?: "brand" | "influencer" | "admin" | string;
  editedFields?: string[];
  lastEdit?: { isEdit: boolean; by: string; at: string; fields: string[] } | null;
}

// ───────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ───────────────────────────────────────────────────────────────────────────────
const toast = (opts: { icon: "success" | "error"; title: string; text?: string }) =>
  Swal.fire({
    ...opts,
    showConfirmButton: false,
    timer: 1400,
    timerProgressBar: true,
    background: "white",
    customClass: { popup: "rounded-lg border border-gray-200" },
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

// ───────────────────────────────────────────────────────────────────────────────
// PAGE
// ───────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
type PanelMode = "initiate" | "view" | "edit";

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
  const [panelMode, setPanelMode] = useState<PanelMode>("initiate");
  const [selectedInf, setSelectedInf] = useState<Influencer | null>(null);
  const [selectedContractMeta, setSelectedContractMeta] = useState<ContractMeta | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");

  // Cache of latest contract meta for influencers on current page
  const [metaCache, setMetaCache] = useState<Record<string, ContractMeta | null>>({});
  const [metaCacheLoading, setMetaCacheLoading] = useState(false);

  // Form aligned to backend BRAND payload
  const [campaignTitle, setCampaignTitle] = useState(campaignName);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [goLiveStart, setGoLiveStart] = useState("");
  const [goLiveEnd, setGoLiveEnd] = useState("");
  const [totalFee, setTotalFee] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [milestoneSplit, setMilestoneSplit] = useState("50/50");
  const [revisionsIncluded, setRevisionsIncluded] = useState(1);

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

  // Requested Effective Date (Brand intent — display token)
  const [requestedEffDate, setRequestedEffDate] = useState<string>("");
  const [requestedEffTz, setRequestedEffTz] = useState<string>("Europe/Amsterdam");

  // Signature upload state (PNG/JPG ≤ 50 KB)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>("");

  // (optional) cached signer info
  const signerName =
    (typeof window !== "undefined" &&
      (localStorage.getItem("brandContactName") ||
        localStorage.getItem("brandName") ||
        "")) || "";
  const signerEmail =
    (typeof window !== "undefined" && (localStorage.getItem("brandEmail") || "")) || "";

  // ───────────────────────────────────────────────────────────────────────────
  // Helpers
  // ───────────────────────────────────────────────────────────────────────────
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

  const tzOptions = useMemo(
    () => [
      { value: "Europe/Amsterdam", label: "Europe/Amsterdam" },
      { value: "UTC", label: "UTC" },
      { value: "America/Los_Angeles", label: "America/Los_Angeles" },
      { value: "America/New_York", label: "America/New_York" },
      { value: "Asia/Kolkata", label: "Asia/Kolkata" },
    ],
    []
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Data loading
  // ───────────────────────────────────────────────────────────────────────────
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

  const getLatestContractFor = async (inf: Influencer): Promise<ContractMeta | null> => {
    const brandId = typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
    if (!brandId) return null;
    try {
      const res = await post<{ contracts: ContractMeta[] }>("/contract/getContract", {
        brandId,
        influencerId: inf.influencerId,
      });
      const list = (res.contracts || []).filter(
        (c: any) => String(c.campaignId) === String(campaignId)
      );
      return list.length ? list[0] : null;
    } catch {
      return null;
    }
  };

  const loadMetaCache = async (list: Influencer[]) => {
    if (!list.length) {
      setMetaCache({});
      return;
    }
    setMetaCacheLoading(true);
    try {
      const metas = await Promise.all(list.map((inf) => getLatestContractFor(inf)));
      const next: Record<string, ContractMeta | null> = {};
      list.forEach((inf, i) => (next[inf.influencerId] = metas[i] || null));
      setMetaCache(next);
    } finally {
      setMetaCacheLoading(false);
    }
  };

  useEffect(() => {
    loadMetaCache(influencers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [influencers]);

  // ───────────────────────────────────────────────────────────────────────────
  // Contract panel openers (modes)
  // ───────────────────────────────────────────────────────────────────────────
  const prefillFormFor = (inf: Influencer) => {
    setCampaignTitle(campaignName);
    setPlatforms([mapPlatformToApi(inf.primaryPlatform) as string]);
    setGoLiveStart("");
    setGoLiveEnd("");
    setTotalFee(String(inf.feeAmount || 5000));
    setCurrency("USD");
    setMilestoneSplit("50/50");
    setRevisionsIncluded(1);

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

    setRequestedEffDate("");
    setRequestedEffTz("Europe/Amsterdam");
    setSignatureDataUrl("");
  };

  const openContractPanel = async (inf: Influencer, override?: PanelMode) => {
    setSelectedInf(inf);
    prefillFormFor(inf);
    setPdfUrl("");

    const meta = metaCache[inf.influencerId] ?? (await getLatestContractFor(inf));
    setSelectedContractMeta(meta);

    let mode: PanelMode = "initiate";
    if (meta?.contractId) {
      const influencerConfirmed = !!meta?.confirmations?.influencer?.confirmed;
      const locked = meta?.status === "locked";
      mode = locked ? "view" : influencerConfirmed ? "edit" : "view";
    }
    setPanelMode(override || mode);
    setShowContractPanel(true);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Build Brand payload (initiate / edit)
  // ───────────────────────────────────────────────────────────────────────────
  const buildBrand = () => {
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
    };
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Signature upload
  // ───────────────────────────────────────────────────────────────────────────
  const handleSignatureFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/image\/(png|jpeg)/i.test(file.type)) {
      toast({ icon: "error", title: "Invalid file", text: "Please upload a PNG or JPG." });
      return;
    }
    if (file.size > 50 * 1024) {
      toast({ icon: "error", title: "Too large", text: "Signature must be ≤ 50 KB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSignatureDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Actions: View / Send / Edit / Preview / Sign
  // ───────────────────────────────────────────────────────────────────────────
  const handleViewExistingContract = async (inf?: Influencer) => {
    const target = inf || selectedInf;
    if (!target) return;
    const meta = metaCache[target.influencerId] ?? (await getLatestContractFor(target));
    if (!meta?.contractId) {
      return toast({ icon: "error", title: "No Contract", text: "Please send the contract first." });
    }
    try {
      const res = await api.get("/contract/preview", {
        params: { contractId: meta.contractId },
        responseType: "blob",
      } as any);
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank");
    } catch (e: any) {
      toast({
        icon: "error",
        title: "View Failed",
        text: e?.response?.data?.message || e?.message || "Unable to open contract.",
      });
    }
  };

  // PREVIEW (server renders a PDF preview of current inputs)
  const handleGeneratePreview = async () => {
    if (!selectedInf) return;
    if (!platforms.length) {
      return toast({ icon: "error", title: "Missing Platforms", text: "Select at least one platform." });
    }
    try {
      const payload: any = {
        brandId: localStorage.getItem("brandId"),
        campaignId,
        influencerId: selectedInf.influencerId,
        brand: buildBrand(),
        preview: true,
      };
      if (requestedEffDate) payload.requestedEffectiveDate = requestedEffDate;
      if (requestedEffTz) payload.requestedEffectiveDateTimezone = requestedEffTz;

      const res = await api.post("/contract/initiate", payload, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      setPdfUrl(url);
      window.open(url, "_blank");
    } catch (e: any) {
      toast({
        icon: "error",
        title: "Preview Error",
        text: e?.response?.data?.message || e.message || "Failed to generate preview.",
      });
    }
  };

  // SEND (first time) or UPDATE (after influencer confirm)
  const handleSendOrUpdate = async () => {
    if (!selectedInf) return;
    try {
      const brand = buildBrand();
      const brandId = localStorage.getItem("brandId")!;
      const meta = selectedContractMeta;

      // First-time send
      if (!meta?.contractId) {
        const payload: any = {
          brandId,
          campaignId,
          influencerId: selectedInf.influencerId,
          brand,
        };
        if (requestedEffDate) payload.requestedEffectiveDate = requestedEffDate;
        if (requestedEffTz) payload.requestedEffectiveDateTimezone = requestedEffTz;

        await post("/contract/initiate", payload);
        toast({ icon: "success", title: "Sent!", text: "Contract sent to influencer." });
        setShowContractPanel(false);
        fetchApplicants();
        loadMetaCache(influencers);
        return;
      }

      // Existing → only allow edit/update after influencer confirms
      const influencerConfirmed = !!meta?.confirmations?.influencer?.confirmed;
      const locked = meta?.status === "locked";
      if (!influencerConfirmed || locked) {
        return toast({
          icon: "error",
          title: "Editing Disabled",
          text: locked
            ? "Contract is locked and no longer editable."
            : "Edits are allowed only after the influencer confirms.",
        });
      }

      // /contract/brand/update expects requestedEffectiveDate(*) inside brandUpdates
      const brandUpdates: any = { ...brand };
      if (requestedEffDate) brandUpdates.requestedEffectiveDate = requestedEffDate;
      if (requestedEffTz) brandUpdates.requestedEffectiveDateTimezone = requestedEffTz;

      await post("/contract/brand/update", {
        contractId: meta.contractId,
        brandId,
        brandUpdates,
      });

      toast({ icon: "success", title: "Updated", text: "Contract updated." });
      setShowContractPanel(false);
      fetchApplicants();
      loadMetaCache(influencers);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e.message || "Failed to send/update contract.";
      toast({ icon: "error", title: "Error", text: msg });
    }
  };

  // SIGN (Brand)
  const handleSignAsBrand = async () => {
    const meta = selectedContractMeta;
    if (!meta?.contractId) {
      toast({ icon: "error", title: "No Contract", text: "Send the contract first." });
      return;
    }
    if (!signatureDataUrl) {
      toast({ icon: "error", title: "No signature", text: "Upload a signature image first." });
      return;
    }
    try {
      await post("/contract/sign", {
        contractId: meta.contractId,
        role: "brand",
        name: signerName,
        email: signerEmail,
        signatureImageDataUrl: signatureDataUrl,
      });
      toast({ icon: "success", title: "Signed", text: "Signature recorded." });
      setShowContractPanel(false);
      fetchApplicants();
      loadMetaCache(influencers);
    } catch (e: any) {
      toast({
        icon: "error",
        title: "Sign failed",
        text: e?.response?.data?.message || e.message || "Could not sign contract.",
      });
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Rows
  // ───────────────────────────────────────────────────────────────────────────
  const rows = useMemo(
    () =>
      influencers.map((inf, idx) => {
        const href = buildHandleUrl(inf.primaryPlatform, inf.handle);
        const meta = metaCache[inf.influencerId] || null;
        const hasContract = !!(meta?.contractId || inf.contractId || inf.isAssigned);
        const influencerConfirmed = !!meta?.confirmations?.influencer?.confirmed;
        const locked = meta ? meta.status === "locked" : false;

        return (
          <TableRow
            key={inf.influencerId}
            className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} transition-colors`}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundImage = `linear-gradient(to right, ${GRADIENT_FROM}11, ${GRADIENT_TO}11)`)
            }
            onMouseLeave={(e) => (e.currentTarget.style.backgroundImage = "")}
          >
            <TableCell className="font-medium">{inf.name}</TableCell>

            <TableCell className="whitespace-nowrap">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-black hover:underline"
                  title="Open profile"
                >
                  {inf.handle || "—"}
                </a>
              ) : (
                <span className="text-gray-500">—</span>
              )}
            </TableCell>

            <TableCell>
              <Badge variant="secondary" className="capitalize bg-gray-200 text-gray-800">
                {inf.category || "—"}
              </Badge>
            </TableCell>

            <TableCell>{formatAudience(inf.audienceSize)}</TableCell>

            <TableCell className="whitespace-nowrap">
              {inf.createdAt ? new Date(inf.createdAt).toLocaleDateString() : "—"}
            </TableCell>

            <TableCell className="text-center">
              {inf.isRejected === 1 ? (
                <div className="space-y-1">
                  <Badge className="bg-black text-white shadow-none">Rejected</Badge>
                  <p className="text-xs text-gray-500">{inf.rejectedReason || "No reason provided"}</p>
                </div>
              ) : hasContract ? (
                <Badge variant="secondary" className="bg-gray-100 text-gray-800">
                  Contract {locked ? "Locked" : influencerConfirmed ? "Ready to Edit" : "Sent"}
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-gray-200 text-gray-800">
                  Applied
                </Badge>
              )}
            </TableCell>

            <TableCell className="flex flex-wrap gap-2 justify-center">
              <Button
                size="sm"
                variant="outline"
                className="bg-white border text-black"
                onClick={() => router.push(`/brand/influencers?id=${inf.influencerId}`)}
                title="View profile"
              >
                View
              </Button>

              {!hasContract && inf.isRejected !== 1 && (
                <Button
                  size="sm"
                  className="bg-black text-white"
                  onClick={() => openContractPanel(inf, "initiate")}
                  title="Send contract"
                >
                  <HiPaperAirplane className="mr-1 h-4 w-4" />
                  Send Contract
                </Button>
              )}

              {hasContract && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="bg-white"
                    onClick={() => handleViewExistingContract(inf)}
                    title="View contract"
                    disabled={metaCacheLoading && !meta}
                  >
                    <HiEye className="mr-1 h-4 w-4" />
                    View Contract
                  </Button>

                  {influencerConfirmed && !locked && (
                    <Button
                      size="sm"
                      className="bg-gray-900 text-white"
                      onClick={() => openContractPanel(inf, "edit")}
                      title="Edit contract"
                    >
                      Edit Contract
                    </Button>
                  )}
                </>
              )}
            </TableCell>
          </TableRow>
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [influencers, metaCache, metaCacheLoading]
  );

  // ───────────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between p-2 md:p-4 rounded-md">
        <h1 className="text-3xl font-bold">Campaign: {campaignName || "Unknown Campaign"}</h1>
        <Button size="sm" variant="outline" className="bg-gray-200 text-black" onClick={() => router.back()}>
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
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm"
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
          <Table className="min-w-[1024px]">
            <TableHeader
              style={{ backgroundImage: `linear-gradient(to right, ${GRADIENT_FROM}, ${GRADIENT_TO})` }}
              className="text-white"
            >
              <TableRow>
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
              </TableRow>
            </TableHeader>
            <TableBody>{rows}</TableBody>
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
            className="text-black"
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
            className="text-black"
          >
            <HiChevronRight />
          </Button>
        </div>
      )}

      {/* Sliding Right Sidebar (Contract Panel) */}
      <ContractSidebar
        isOpen={showContractPanel}
        onClose={() => {
          if (pdfUrl) URL.revokeObjectURL(pdfUrl);
          setPdfUrl("");
          setShowContractPanel(false);
          setSelectedContractMeta(null);
        }}
        title={panelMode === "initiate" ? "Send Contract" : panelMode === "edit" ? "Edit Contract" : "View Contract"}
        subtitle={selectedInf ? `${campaignTitle || "Agreement"} • ${selectedInf.name}` : campaignTitle || "Agreement"}
      >
        {/* VIEW MODE */}
        {panelMode === "view" && (
          <SidebarSection title="Contract" icon={<HiDocumentText className="w-4 h-4" />}>
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                {selectedContractMeta?.confirmations?.influencer?.confirmed
                  ? "Influencer confirmed. You may edit from the list using the Edit button."
                  : "Awaiting influencer confirmation. You can only view the contract for now."}
              </p>
              <Button className="bg-white border-2 text-black" variant="outline" onClick={() => handleViewExistingContract()}>
                <HiEye className="mr-2 h-5 w-5" />
                Open PDF
              </Button>
            </div>
          </SidebarSection>
        )}

        {/* INITIATE / EDIT MODE */}
        {(panelMode === "initiate" || panelMode === "edit") && (
          <>
            <SidebarSection title="Campaign Details" icon={<HiDocumentText className="w-4 h-4" />}>
              <div className="space-y-4">
                <FloatingLabelInput
                  id="campaignTitle"
                  label="Campaign Title"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Platforms</label>
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
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-black focus:outline-none"
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
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-black focus:outline-none"
                    />
                  </div>
                </div>

                {/* Fees: keep 2-col grid + Currency (backend requires it) */}
                <div className="grid grid-cols-2 gap-3">
                  <FloatingLabelInput
                    id="totalFee"
                    label="Total Fee"
                    value={totalFee}
                    onChange={(e) => setTotalFee(e.target.value)}
                    type="number"
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
                  <FloatingLabelInput
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

                {/* Requested Effective Date (display token) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="requestedEffDate" className="block text-xs font-medium text-gray-600 mb-1.5">
                      Requested Effective Date (display)
                    </label>
                    <input
                      id="requestedEffDate"
                      type="date"
                      value={requestedEffDate}
                      onChange={(e) => setRequestedEffDate(e.target.value)}
                      className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-black focus:outline-none"
                    />
                  </div>
                  <Select
                    id="requestedEffTz"
                    label="Timezone"
                    value={requestedEffTz}
                    onChange={(e) => setRequestedEffTz(e.target.value)}
                    options={tzOptions}
                  />
                </div>

                {/* Signature upload (compact, black & white) */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Upload Signature (PNG/JPG ≤ 50 KB)
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleSignatureFileChange}
                    className="block w-full text-sm text-gray-700"
                  />
                  {signatureDataUrl && (
                    <img
                      src={signatureDataUrl}
                      alt="Signature preview"
                      className="h-12 mt-2 border border-gray-200 rounded bg-white"
                    />
                  )}
                </div>
              </div>
            </SidebarSection>

            <SidebarSection title="Deliverables" icon={<HiClipboardList className="w-4 h-4" />}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FloatingLabelInput id="dType" label="Type" value={dType} onChange={(e) => setDType(e.target.value)} />
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

                <div className="text-sm text-gray-600">
                  <span className="font-medium">Handles: </span>
                  {dHandles.length ? dHandles.join(", ") : "—"}
                </div>
              </div>
            </SidebarSection>

            {/* Footer Actions */}
            <div className="sticky bottom-0 -mx-6 -mb-6 bg-white border-t border-gray-200 p-6 flex flex-wrap justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                  setPdfUrl("");
                  setShowContractPanel(false);
                }}
                className="px-6 text-black"
              >
                Close
              </Button>

              <Button
                onClick={handleGeneratePreview}
                className="px-6 bg-black text-white"
                disabled={!platforms.length || !campaignTitle.trim()}
                title={!platforms.length ? "Select at least one platform" : ""}
              >
                <HiEye className="w-5 h-5 mr-2" />
                Preview
              </Button>

              <Button
                onClick={handleSendOrUpdate}
                className="px-6 bg-gray-900 text-white"
                title={panelMode === "initiate" ? "Send contract" : "Update contract"}
              >
                <HiPaperAirplane className="w-5 h-5 mr-2" />
                {panelMode === "initiate" ? "Send Contract" : "Update Contract"}
              </Button>

              {selectedContractMeta?.confirmations?.influencer?.confirmed &&
                selectedContractMeta?.status !== "locked" && (
                  <Button
                    onClick={handleSignAsBrand}
                    className="px-6 bg-gray-800 text-white"
                    title="Sign as Brand"
                  >
                    Sign as Brand
                  </Button>
                )}
            </div>
          </>
        )}
      </ContractSidebar>
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
  <p className="p-6 text-center text-red-600">{children}</p>
);

// ───────────────────────────────────────────────────────────────────────────────
// INLINE: FormComponents.tsx (kept here for a single-file drop-in)
// ───────────────────────────────────────────────────────────────────────────────
export function FloatingLabelInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  ...props
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  [key: string]: any;
}) {
  const [focused, setFocused] = useState(false);
  const hasValue = value !== "";

  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full px-4 pt-6 pb-2 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-black focus:outline-none peer"
        placeholder=" "
        {...props}
      />
      <label
        htmlFor={id}
        className={`absolute left-4 transition-all duration-200 pointer-events-none ${
          focused || hasValue
            ? "top-2 text-xs text-black font-medium"
            : "top-1/2 -translate-y-1/2 text-sm text-gray-500"
        }`}
      >
        {label}
      </label>
    </div>
  );
}

type SelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[] | { value: string; label: string }[][];
  disabled?: boolean;
};

export function Select({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
}: SelectProps) {
  const flat = (Array.isArray(options[0]) ? (options as any).flat() : (options as any)) as {
    value: string;
    label: string;
  }[];
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm focus:outline-none ${
          disabled ? "opacity-60 cursor-not-allowed" : "focus:border-black border-gray-200"
        }`}
      >
        {flat.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function NumberInput({
  id,
  label,
  value,
  onChange,
  min = 0,
  ...props
}: {
  id: string;
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  [key: string]: any;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value || min)))}
        className="w-full px-4 pt-6 pb-2 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-black focus:outline-none"
        {...props}
      />
      <label htmlFor={id} className="absolute left-4 top-2 text-xs text-black font-medium pointer-events-none">
        {label}
      </label>
    </div>
  );
}

type CheckboxProps = {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export function Checkbox({ id, label, checked, onChange, disabled = false }: CheckboxProps) {
  return (
    <label htmlFor={id} className={`flex items-center gap-2 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} className="h-4 w-4" />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

type PlatformSelectorProps = {
  platforms: string[];
  onChange: (platforms: string[]) => void;
  disabled?: boolean;
};

export function PlatformSelector({ platforms, onChange, disabled = false }: PlatformSelectorProps) {
  const toggle = (p: string) => {
    if (disabled) return;
    const next = platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p];
    onChange(next);
  };

  const opts = ["YouTube", "Instagram", "TikTok"];

  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((p) => {
        const active = platforms.includes(p);
        return (
          <button
            key={p}
            type="button"
            onClick={() => toggle(p)}
            disabled={disabled}
            aria-disabled={disabled}
            className={`px-3 py-1.5 rounded-lg border text-sm ${
              active ? "border-black bg-gray-100" : "border-gray-300 bg-white"
            } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

type ChipInputProps = {
  label: string;
  items: string[];
  setItems: (items: string[]) => void;
  placeholder?: string;
  validator?: (s: string) => boolean;
  disabled?: boolean;
};

export function ChipInput({ label, items, setItems, placeholder, validator, disabled = false }: ChipInputProps) {
  const [val, setVal] = useState("");

  const add = () => {
    if (disabled) return;
    const v = val.trim();
    if (!v) return;
    if (validator && !validator(v)) return;
    setItems([...items, v]);
    setVal("");
  };

  const remove = (ix: number) => {
    if (disabled) return;
    setItems(items.filter((_, i) => i !== ix));
  };

  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium text-gray-700">{label}</div>
      <div className={`flex flex-wrap gap-2 rounded-lg border-2 p-2 ${disabled ? "opacity-60 cursor-not-allowed" : "border-gray-200"}`}>
        {items.map((t, i) => (
          <span key={`${t}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-xs">
            {t}
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={disabled}
              className="text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed"
              aria-label="Remove"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => (e.key === "Enter" ? (e.preventDefault(), add()) : undefined)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 min-w-[120px] border-0 outline-none text-sm bg-transparent"
        />
        <button type="button" onClick={add} disabled={disabled} className="px-2 py-1 text-xs border rounded">
          Add
        </button>
      </div>
    </div>
  );
}

type TextAreaProps = {
  id: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
};

export function TextArea({ id, label, value, onChange, rows = 3, placeholder, disabled = false }: TextAreaProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm focus:outline-none ${
          disabled ? "opacity-60 cursor-not-allowed" : "focus:border-black border-gray-200"
        }`}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// INLINE: ContractSidebar.tsx (single-file drop-in)
// ───────────────────────────────────────────────────────────────────────────────
function ContractSidebar({
  isOpen,
  onClose,
  children,
  title = "Initiate Contract",
  subtitle = "New Agreement",
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-[720px] md:w-[860px] lg:w-[960px] bg-white shadow-2xl transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="relative h-36 overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `linear-gradient(135deg, ${GRADIENT_FROM} 0%, ${GRADIENT_TO} 100%)`,
              clipPath: "polygon(0 0, 100% 0, 100% 65%, 0 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${GRADIENT_FROM} 0%, ${GRADIENT_TO} 100%)`,
              clipPath: "polygon(0 0, 100% 0, 100% 78%, 0 92%)",
            }}
          />

          <div className="relative z-10 p-6 text-white flex items-start justify-between h-full">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mt-1 shadow-sm">
                <HiDocumentText className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-[11px] tracking-wide font-semibold uppercase/relaxed opacity-95 mb-1">{title}</div>
                <div className="text-2xl font-extrabold leading-tight">{subtitle}</div>
              </div>
            </div>

            <button
              className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center transition-all duration-150 hover:scale-110"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="h-[calc(100%-9rem)] overflow-y-auto">
          <div className="p-6 space-y-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SidebarSection({ title, children, icon }: { title: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-100 shadow-sm p-5 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center">
            {icon}
          </div>
        )}
        <div className="font-semibold text-gray-800">{title}</div>
      </div>
      {children}
    </div>
  );
}
