"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  HiCheck,
} from "react-icons/hi";
import ReactSelect from "react-select";

/* ===============================================================
   THEME
   =============================================================== */
const GRADIENT_FROM = "#FFA135";
const GRADIENT_TO = "#FF7236";

/* ===============================================================
   Types
   =============================================================== */
interface Influencer {
  influencerId: string;
  name: string;
  primaryPlatform?: "instagram" | "tiktok" | "youtube" | string | null;
  handle: string | null;
  // Accept multiple backend shapes for category
  category?: string | { name?: string } | null;
  categoryName?: string | null;
  categories?: Array<{ name?: string }>;
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

interface Meta { total: number; page: number; limit: number; totalPages: number; }
interface PartyConfirm { confirmed?: boolean; byUserId?: string; at?: string }
interface PartySign { signed?: boolean; byUserId?: string; name?: string; email?: string; at?: string }

interface AuditEvent {
  byUserId?: string;
  role?: string;
  type: string;
  details?: { reason?: string;[k: string]: any };
  at?: string;
}

interface ContractMeta {
  contractId: string;
  campaignId: string;
  status: "draft" | "sent" | "viewed" | "negotiation" | "finalize" | "signing" | "rejected" | "locked";
  lastSentAt?: string;
  lockedAt?: string | null;
  confirmations?: { brand?: PartyConfirm; influencer?: PartyConfirm };
  signatures?: { brand?: PartySign; influencer?: PartySign; collabglam?: PartySign };
  resendIteration?: number;
  audit?: AuditEvent[];
  flags?: Record<string, any>;
  statusFlags?: Record<string, any>;
  brand?: any;
}

type CurrencyOption = { value: string; label: string; meta?: any };
type TzOption = { value: string; label: string; meta?: any };

/* ===============================================================
   Utilities
   =============================================================== */
const toast = (opts: { icon: "success" | "error" | "info"; title: string; text?: string }) =>
  Swal.fire({ ...opts, showConfirmButton: false, timer: 1400, timerProgressBar: true, background: "white", customClass: { popup: "rounded-lg border border-gray-200" } });

const askConfirm = async (title: string, text?: string) => {
  const res = await Swal.fire({
    title,
    text,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, continue",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    background: "white",
  });
  return res.isConfirmed;
};

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
    case "instagram": return `https://instagram.com/${raw}`;
    case "tiktok": return `https://www.tiktok.com/@${raw}`;
    case "youtube": default: return `https://www.youtube.com/@${raw}`;
  }
};

const isRejectedMeta = (meta?: ContractMeta | null) => !!(meta && (meta.status === "rejected" || meta.flags?.isRejected || meta.statusFlags?.isRejected));

const getRejectReasonFromMeta = (meta: ContractMeta | null): string | null => {
  if (!meta) return null;
  const events: AuditEvent[] = Array.isArray(meta.audit) ? meta.audit : [];
  const lastRejected = [...events].reverse().find((ev) => (ev.type || "").toUpperCase() === "REJECTED");
  return lastRejected?.details?.reason ? String(lastRejected.details.reason).trim() : null;
};

const mapPlatformToApi = (p?: string | null) => {
  switch ((p || "").toLowerCase()) {
    case "instagram": return "Instagram";
    case "tiktok": return "TikTok";
    case "youtube": default: return "YouTube";
  }
};

const getCategoryLabel = (inf: any) => {
  const pick = (...vals: any[]) => vals.find(v => typeof v === "string" && v.trim());
  const fromObj = (o?: any) => (o && typeof o.name === "string" && o.name.trim()) ? o.name : "";

  // single-name sources
  const direct = pick(inf.category, inf.category_name, inf.categoryTitle, inf.primaryCategory, inf.niche, inf.vertical);
  if (direct) return direct;

  // object forms
  const obj = fromObj(inf.category) || fromObj(inf.primary_category) || fromObj(inf.influencerCategory);
  if (obj) return obj;

  // arrays
  const arr = inf.categories || inf.category_list || inf.influencerCategories;
  if (Array.isArray(arr) && arr.length) {
    const names = arr.map(fromObj).filter(Boolean);
    if (names.length) return names.join(", ");
  }
  return "—";
};


/* ===============================================================
   Page
   =============================================================== */
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

type PanelMode = "send" | "edit"; // sidebar only used for send/edit; viewing uses button

export default function AppliedInfluencersPage() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id");
  const campaignName = searchParams.get("name") || "";
  const router = useRouter();

  // Data & Pagination
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [applicantCount, setApplicantCount] = useState(0);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: PAGE_SIZE_OPTIONS[0], totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(PAGE_SIZE_OPTIONS[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof Influencer>("name");
  const [sortOrder, setSortOrder] = useState<1 | 0>(1);

  // Right Panel (send/edit contract)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("send");
  const [selectedInf, setSelectedInf] = useState<Influencer | null>(null);
  const [selectedMeta, setSelectedMeta] = useState<ContractMeta | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>(""); // preview of WOULD-BE doc (must be generated before send/update)

  // Cache of latest contract meta per influencer
  const [metaCache, setMetaCache] = useState<Record<string, ContractMeta | null>>({});
  const [metaCacheLoading, setMetaCacheLoading] = useState(false);

  // Form (brand)
  const [campaignTitle, setCampaignTitle] = useState(campaignName);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [goLiveStart, setGoLiveStart] = useState("");
  const [goLiveEnd, setGoLiveEnd] = useState("");
  const [totalFee, setTotalFee] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [milestoneSplit, setMilestoneSplit] = useState("50/50");
  const [revisionsIncluded, setRevisionsIncluded] = useState(1);

  // Deliverable (single-row)
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

  // Requested Effective Date
  const [requestedEffDate, setRequestedEffDate] = useState<string>("");
  const [requestedEffTz, setRequestedEffTz] = useState<string>("Europe/Amsterdam");

  // currency & timezone options
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [tzOptions, setTzOptions] = useState<TzOption[]>([]);
  const [listsLoading, setListsLoading] = useState(true);

  // Brand signer identity
  const signerName = (typeof window !== "undefined" && (localStorage.getItem("brandContactName") || localStorage.getItem("brandName") || "")) || "";
  const signerEmail = (typeof window !== "undefined" && (localStorage.getItem("brandEmail") || "")) || "";

  // Signature modal
  const [signOpen, setSignOpen] = useState(false);
  const [signTargetMeta, setSignTargetMeta] = useState<ContractMeta | null>(null);

  const toggleSort = (field: keyof Influencer) => {
    setPage(1);
    if (sortField === field) setSortOrder((o) => (o === 1 ? 0 : 1));
    else { setSortField(field); setSortOrder(1); }
  };

  const SortIndicator = ({ field }: { field: keyof Influencer }) =>
    sortField === field ? (sortOrder === 1 ? <HiOutlineChevronDown className="inline ml-1 w-4 h-4 align-middle" /> : <HiOutlineChevronUp className="inline ml-1 w-4 h-4 align-middle" />) : null;

  /* ---------------- Currency & Timezone lists ---------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      setListsLoading(true);
      try {
        const curRes: any = await api.get("/contract/currencies");
        const curArr: any[] = (curRes?.data?.currencies || curRes?.currencies || curRes || []) as any[];
        const curOpts: CurrencyOption[] = curArr.map((c) => {
          const code = (c.code || c.symbol || "").toString();
          const label = c.name ? `${code} — ${c.name}` : code;
          return { value: code, label, meta: c };
        });
        const tzRes: any = await api.get("/contract/timezones");
        const tzArr: any[] = (tzRes?.data?.timezones || tzRes?.timezones || tzRes || []) as any[];
        const tzOpts: TzOption[] = tzArr.map((t) => {
          const canonical = Array.isArray(t.utc) && t.utc.length ? t.utc[0] : t.value;
          const label = t.text || t.value;
          return { value: canonical, label, meta: t };
        });
        if (!alive) return;
        setCurrencyOptions(curOpts);
        setTzOptions(tzOpts);
      } catch (e) { }
      finally { if (alive) setListsLoading(false); }
    })();
    return () => { alive = false };
  }, []);

  /* ---------------- Applicants load ---------------- */
  const fetchApplicants = async () => {
    if (!campaignId) return;
    setLoading(true); setError(null);
    try {
      const payload = { campaignId, page, limit, search: searchTerm.trim(), sortField, sortOrder };
      const res: any = await post("/apply/list", payload);
      const influencersList = res?.influencers || res?.data?.influencers || res?.data?.data || [];
      const applicantCountVal = res?.applicantCount || res?.data?.applicantCount || influencersList?.length || 0;
      const metaVal = res?.meta || res?.data?.meta || { total: 0, page: 1, limit, totalPages: 1 };
      setInfluencers(influencersList || []);
      setApplicantCount(applicantCountVal || 0);
      setMeta(metaVal);
    } catch (e: any) {
      setError(e?.message || "Failed to load applicants.");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchApplicants(); /* eslint-disable-next-line */ }, [campaignId, page, searchTerm, sortField, sortOrder]);

  /* ---------------- Contract meta cache ---------------- */
  const getLatestContractFor = async (inf: Influencer): Promise<ContractMeta | null> => {
    const brandId = typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
    if (!brandId) return null;
    try {
      const res = await post("/contract/getContract", { brandId, influencerId: inf.influencerId });
      const list = (res?.contracts || (res as any)?.data?.contracts || []) as ContractMeta[];
      const filtered = list.filter((c) => String(c.campaignId) === String(campaignId));
      return filtered.length ? filtered[0] : list.length ? list[0] : null;
    } catch {
      return null;
    }
  };

  const loadMetaCache = async (list: Influencer[]) => {
    if (!list.length) { setMetaCache({}); return; }
    setMetaCacheLoading(true);
    try {
      const metas = await Promise.all(list.map((inf) => getLatestContractFor(inf)));
      const next: Record<string, ContractMeta | null> = {};
      list.forEach((inf, i) => (next[inf.influencerId] = metas[i] || null));
      setMetaCache(next);
    } finally { setMetaCacheLoading(false); }
  };
  useEffect(() => { loadMetaCache(influencers); /* eslint-disable-next-line */ }, [influencers]);

  /* ---------------- Helpers ---------------- */
  const toInputDate = (v?: string | Date | null) => {
    if (!v) return ""; const d = new Date(v); if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const clearPreview = () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); setPdfUrl(""); };

  const prefillFormFor = (inf: Influencer, meta?: ContractMeta | null) => {
    setCampaignTitle(campaignName || inf?.name || "");
    setPlatforms(inf?.primaryPlatform ? [mapPlatformToApi(inf.primaryPlatform) as string] : []);
    setGoLiveStart(""); setGoLiveEnd("");
    setTotalFee(String(inf.feeAmount || 5000)); setCurrency("USD");
    setMilestoneSplit("50/50"); setRevisionsIncluded(1);

    setDType("Scope"); setDQuantity(1); setDFormat("Text"); setDDurationSec(0);
    setDDraftRequired(false); setDMinLiveHours(0); setDTags([]);
    setDHandles(inf.handle ? [inf.handle] : []); setDCaptions(""); setDLinks([]);

    setRequestedEffDate(""); setRequestedEffTz("Europe/Amsterdam");

    if (meta && meta.brand) {
      const brand = meta.brand;
      if (typeof brand.campaignTitle === "string") setCampaignTitle(String(brand.campaignTitle));
      if (Array.isArray(brand.platforms) && brand.platforms.length) setPlatforms((brand.platforms as string[]).map((p) => String(p || "")));
      if (brand.goLive) { setGoLiveStart(toInputDate((brand.goLive as any).start)); setGoLiveEnd(toInputDate((brand.goLive as any).end)); }
      if (brand.totalFee !== undefined && brand.totalFee !== null) setTotalFee(String(brand.totalFee));
      if (brand.currency) setCurrency(String(brand.currency));
      if (brand.milestoneSplit) setMilestoneSplit(String(brand.milestoneSplit));
      if (brand.revisionsIncluded !== undefined && brand.revisionsIncluded !== null) setRevisionsIncluded(Number(brand.revisionsIncluded));
      if (brand.requestedEffectiveDate) setRequestedEffDate(toInputDate(brand.requestedEffectiveDate));
      if (brand.requestedEffectiveDateTimezone) setRequestedEffTz(String(brand.requestedEffectiveDateTimezone));

      const expanded = brand.deliverablesExpanded;
      if (Array.isArray(expanded) && expanded.length) {
        const first = expanded[0];
        if (first.type) setDType(String(first.type));
        if (first.quantity !== undefined && first.quantity !== null) setDQuantity(Number(first.quantity));
        if (first.format) setDFormat(String(first.format));
        if (first.durationSec !== undefined && first.durationSec !== null) setDDurationSec(Number(first.durationSec));
        if (first.draftRequired !== undefined) setDDraftRequired(Boolean(first.draftRequired));
        if (first.minLiveHours !== undefined && first.minLiveHours !== null) setDMinLiveHours(Number(first.minLiveHours));
        if (Array.isArray(first.tags)) setDTags(first.tags.map((t: any) => String(t)));
        if (Array.isArray(first.handles)) setDHandles(first.handles.map((h: any) => String(h)));
        if (first.captions) setDCaptions(String(first.captions));
        if (Array.isArray(first.links)) setDLinks(first.links.map((l: any) => String(l)));
      }
    }
  };

  const updateBtnLabel = selectedMeta && isRejectedMeta(selectedMeta) ? "Resend Contract" : "Update Contract";

  const openSidebar = async (inf: Influencer, mode: PanelMode) => {
    setSelectedInf(inf);
    setPanelMode(mode);
    const meta = metaCache[inf.influencerId] ?? (await getLatestContractFor(inf));
    setSelectedMeta(meta);
    prefillFormFor(inf, meta);
    // IMPORTANT: We require a fresh PREVIEW of the would-be document before send/update.
    clearPreview();
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    clearPreview();
    setSelectedInf(null);
    setSelectedMeta(null);
  };

  const buildBrandPayload = () => {
    const goLive = goLiveStart || goLiveEnd ? { start: goLiveStart ? new Date(goLiveStart) : undefined, end: goLiveEnd ? new Date(goLiveEnd) : undefined } : undefined;
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
      ...(requestedEffDate ? { requestedEffectiveDate: requestedEffDate } : {}),
      ...(requestedEffTz ? { requestedEffectiveDateTimezone: requestedEffTz } : {}),
    };
  };

  /* ---------------- Preview (MUST happen before Send/Update) ---------------- */
  const handleGeneratePreview = async () => {
    if (!selectedInf) return;
    if (!platforms.length || !campaignTitle.trim()) {
      toast({ icon: "error", title: "Missing fields", text: "Add title and at least one platform." });
      return;
    }
    try {
      const brand = buildBrandPayload();
      if (panelMode === "send") {
        const payload: any = {
          brandId: localStorage.getItem("brandId"),
          campaignId,
          influencerId: selectedInf.influencerId,
          brand,
          preview: true,
        };
        if (requestedEffDate) payload.requestedEffectiveDate = requestedEffDate;
        if (requestedEffTz) payload.requestedEffectiveDateTimezone = requestedEffTz;
        const res = await api.post("/contract/initiate", payload, { responseType: "blob" });
        clearPreview();
        const url = URL.createObjectURL(res.data);
        setPdfUrl(url);
      } else {
        if (!selectedMeta?.contractId) {
          toast({ icon: "error", title: "No Contract", text: "Cannot edit before a contract exists." });
          return;
        }
        const payload: any = {
          contractId: selectedMeta.contractId,
          brandUpdates: brand,
          preview: true,
        };
        if (requestedEffDate) payload.requestedEffectiveDate = requestedEffDate;
        if (requestedEffTz) payload.requestedEffectiveDateTimezone = requestedEffTz;
        const res = await api.post("/contract/resend", payload, { responseType: "blob" });
        clearPreview();
        const url = URL.createObjectURL(res.data);
        setPdfUrl(url);
      }
      toast({ icon: "success", title: "Preview ready", text: "Review the PDF on the left." });
    } catch (e: any) {
      toast({ icon: "error", title: "Preview failed", text: e?.response?.data?.message || e.message || "Could not generate preview." });
    }
  };

  const wasResent = (meta?: ContractMeta | null) => {
    if (!meta) return false;
    if ((meta as any).isResend || (meta as any).isresend) return true;
    if (meta.flags?.isResend || meta.flags?.isResendChild) return true;
    if (meta.statusFlags?.isResend || meta.statusFlags?.isResendChild) return true;
    if (typeof meta.resendIteration === "number" && meta.resendIteration > 0) return true;
    const audit = Array.isArray(meta.audit) ? meta.audit : [];
    return audit.some(ev => (ev.type || "").toUpperCase() === "RESENT");
  };


  /* ---------------- Actions ---------------- */
  // View PDF (always /contract/viewPdf of the CURRENT saved version)
  const handleViewContract = async (inf?: Influencer) => {
    const target = inf || selectedInf; if (!target) return;
    const meta = metaCache[target.influencerId] ?? (await getLatestContractFor(target));
    if (!meta?.contractId) return toast({ icon: "error", title: "No Contract", text: "Please send the contract first." });
    try {
      const res = await api.post("/contract/viewPdf", { contractId: meta.contractId }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data); window.open(url, "_blank");
    } catch (e: any) { toast({ icon: "error", title: "Open Failed", text: e?.message || "Unable to open contract." }); }
  };

  // Send contract (no contract yet) — requires preview shown
  const handleSendContract = async () => {
    if (!selectedInf) return;
    if (!pdfUrl) { toast({ icon: "info", title: "Preview required", text: "Generate preview before sending." }); return; }
    if (!platforms.length || !campaignTitle.trim()) return toast({ icon: "error", title: "Missing fields", text: "Add title and at least one platform." });
    try {
      const brand = buildBrandPayload();
      const brandId = localStorage.getItem("brandId")!;
      await post("/contract/initiate", {
        brandId,
        campaignId,
        influencerId: selectedInf.influencerId,
        brand,
        ...(requestedEffDate ? { requestedEffectiveDate: requestedEffDate } : {}),
        ...(requestedEffTz ? { requestedEffectiveDateTimezone: requestedEffTz } : {}),
      });
      toast({ icon: "success", title: "Sent!", text: "Contract sent to influencer." });
      closeSidebar();
      fetchApplicants();
      loadMetaCache(influencers);
    } catch (e: any) {
      toast({ icon: "error", title: "Error", text: e?.response?.data?.message || e.message || "Failed to send." });
    }
  };

  // Edit contract — ONLY after influencer confirmed; requires preview
  const handleEditContract = async () => {
    if (!selectedMeta?.contractId) return;
    if (!pdfUrl) { toast({ icon: "info", title: "Preview required", text: "Generate preview before updating." }); return; }
    try {
      const brandUpdates = buildBrandPayload();
      await post("/contract/resend", {
        contractId: selectedMeta.contractId,
        brandUpdates,
        ...(requestedEffDate ? { requestedEffectiveDate: requestedEffDate } : {}),
        ...(requestedEffTz ? { requestedEffectiveDateTimezone: requestedEffTz } : {}),
      });
      toast({ icon: "success", title: "Updated", text: "Contract updated (new version sent)." });
      closeSidebar();
      fetchApplicants();
      loadMetaCache(influencers);
    } catch (e: any) {
      toast({ icon: "error", title: "Update failed", text: e?.response?.data?.message || e.message || "Could not update contract." });
    }
  };

  // Brand accept (confirm) — hide when already accepted
  const handleBrandAccept = async (inf?: Influencer) => {
    const target = inf || selectedInf; if (!target) return;
    const meta = metaCache[target.influencerId] ?? (await getLatestContractFor(target));
    if (!meta?.contractId) return toast({ icon: "error", title: "No Contract", text: "Send contract first." });
    const ok = await askConfirm("Confirm as Brand?", "Once confirmed, your next step is to sign.");
    if (!ok) return;
    try {
      await post("/contract/brand/confirm", { contractId: meta.contractId });
      toast({ icon: "success", title: "Brand Accepted" });
      fetchApplicants();
      loadMetaCache(influencers);
    } catch (e: any) {
      toast({ icon: "error", title: "Confirm failed", text: e?.response?.data?.message || e.message || "Could not confirm." });
    }
  };

  // Brand sign (modal)
  const openSignModal = (meta: ContractMeta | null) => {
    if (!meta?.contractId) return toast({ icon: "error", title: "No Contract", text: "Send/accept contract first." });
    setSignTargetMeta(meta);
    setSignOpen(true);
  };

  /* ---------------- Invalidate preview when form changes ---------------- */
  useEffect(() => { clearPreview(); /* invalidate on key field changes */ }, [campaignTitle, platforms, goLiveStart, goLiveEnd, totalFee, currency, milestoneSplit, revisionsIncluded, dType, dQuantity, dFormat, dDurationSec, dDraftRequired, dMinLiveHours, dCaptions, requestedEffDate, requestedEffTz]);
  // For arrays managed via setters, wrap to invalidate
  const setTagsInvalidate = (items: string[]) => { setDTags(items); clearPreview(); };
  const setLinksInvalidate = (items: string[]) => { setDLinks(items); clearPreview(); };

  /* ---------------- Status + Actions per-row ---------------- */
  const prettyStatus = (meta: ContractMeta | null, hasContract: boolean, fallbackApplied = false) => {
    if (!hasContract) return fallbackApplied ? "Applied" : "—";
    const iConfirmed = !!meta?.confirmations?.influencer?.confirmed;
    const bConfirmed = !!meta?.confirmations?.brand?.confirmed;
    const bSigned = !!meta?.signatures?.brand?.signed;
    const locked = meta?.status === "locked";
    if (isRejectedMeta(meta)) return "Rejected";
    if (!iConfirmed) return "Waiting for influencer to confirm";
    if (iConfirmed && !bConfirmed) return "Influencer confirmed";
    if (bConfirmed && !bSigned && !locked) return "Brand accepted (awaiting signature)";
    if (bSigned && !locked) return "Brand signed";
    return meta?.status === "locked" ? "Locked" : meta?.status || "—";
  };

  const rows = useMemo(() => (
    influencers.map((inf, idx) => {
      const href = buildHandleUrl(inf.primaryPlatform, inf.handle);
      const meta = metaCache[inf.influencerId] || null;
      const hasContract = !!(meta?.contractId || inf.contractId || inf.isAssigned);
      const iConfirmed = !!meta?.confirmations?.influencer?.confirmed;
      const bConfirmed = !!meta?.confirmations?.brand?.confirmed;
      const bSigned = !!meta?.signatures?.brand?.signed;
      const locked = meta ? meta.status === "locked" : false;
      const rejected = isRejectedMeta(meta);

      const statusLabel = prettyStatus(meta, hasContract, true);

      return (
        <TableRow key={inf.influencerId} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
          <TableCell className="font-medium align-center">{inf.name}</TableCell>
          <TableCell className="whitespace-nowrap align-middle">
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-black hover:underline" title="Open profile">
                {inf.handle || "—"}
              </a>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </TableCell>
          <TableCell className="align-center">
            <Badge variant="secondary" className="capitalize bg-gray-200 text-gray-800">{getCategoryLabel(inf)}</Badge>
          </TableCell>
          <TableCell className="align-center">{formatAudience(inf.audienceSize)}</TableCell>
          <TableCell className="whitespace-nowrap align-middle">{inf.createdAt ? new Date(inf.createdAt).toLocaleDateString() : "—"}</TableCell>

          <TableCell className="text-center align-middle">
            {rejected ? (
              <div className="space-y-1">
                <Badge className="bg-black text-white shadow-none">Rejected</Badge>
                <p className="text-xs text-gray-500 break-words">{getRejectReasonFromMeta(meta) || "No reason provided"}</p>
              </div>
            ) : (
              <Badge variant="secondary" className="bg-gray-100 text-gray-800">{statusLabel}</Badge>
            )}
          </TableCell>

          {/* ACTIONS */}
          <TableCell className="text-center space-x-2 whitespace-nowrap align-middle">
            {/* Always allow viewing influencer */}
            {inf?.influencerId && (
              <Button
                size="sm"
                variant="outline"
                className="border-black text-black"
                onClick={() =>
                  router.push(`/brand/influencers?id=${encodeURIComponent(String(inf.influencerId))}`)
                }
              >
                View Influencer
              </Button>
            )}

            {/* No contract → show Send Contract */}
            {!hasContract && !rejected && (
              <Button
                size="sm"
                className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF7236] hover:to-[#FFA135] shadow-none"
                onClick={() => openSidebar(inf, "send")}
                title="Send contract"
              >
                <HiPaperAirplane className="mr-1 h-4 w-4" /> Send Contract
              </Button>
            )}

            {hasContract && rejected && !locked && !wasResent(meta) && (
              <Button
                size="sm"
                className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF7236] hover:to-[#FFA135] shadow-none"
                onClick={() => openSidebar(inf, "edit")}
                title="Resend contract"
              >
                Resend Contract
              </Button>
            )}

            {/* Has contract → View Contract always */}
            {hasContract && (
              <Button
                size="sm"
                variant="outline"
                className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF7236] hover:to-[#FFA135] shadow-none"
                onClick={() => handleViewContract(inf)}
                title="View contract"
                disabled={metaCacheLoading && !meta}
              >
                <HiEye className="mr-1 h-4 w-4" /> View Contract
              </Button>
            )}

            {/* After initiate: don't show Edit until influencer confirm; show Brand Accept (but hide if already accepted) */}
            {hasContract && !rejected && !iConfirmed && !locked && !bConfirmed && (
              <Button size="sm" variant="outline" className="border-black text-black" onClick={() => handleBrandAccept(inf)}>
                <HiCheck className="mr-1 h-4 w-4" /> Brand Accept
              </Button>
            )}

            {/* When influencer confirmed → allow Edit (resend) and Brand Accept if not yet */}
            {hasContract && iConfirmed && !bConfirmed && !locked && (
              <>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF7236] hover:to-[#FFA135] shadow-none"
                  onClick={() => openSidebar(inf, "edit")}
                  title="Edit contract"
                >
                  Edit Contract
                </Button>
                <Button size="sm" variant="outline" className="border-black text-black" onClick={() => handleBrandAccept(inf)}>
                  <HiCheck className="mr-1 h-4 w-4" /> Brand Accept
                </Button>
              </>
            )}

            {/* If brand accepted → ONLY show Sign as brand (hide when already signed) */}
            {hasContract && bConfirmed && !bSigned && !locked && (
              <Button
                size="sm"
                className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF7236] hover:to-[#FFA135] shadow-none"
                onClick={() => openSignModal(meta)}
                title="Sign as Brand"
              >
                Sign as Brand
              </Button>
            )}
          </TableCell>
        </TableRow>
      );
    })
  ), [influencers, metaCache, metaCacheLoading]);

  return (
    <div className="min-h-screen p-4 md:p-8 space-y-8">
      <header className="flex items-center justify-between p-2 md:p-4 rounded-md">
        <h1 className="text-3xl font-bold">Campaign: {campaignName || "Unknown Campaign"}</h1>
        <Button size="sm" variant="outline" className="bg-gray-200 text-black" onClick={() => router.back()}>Back</Button>
      </header>

      <div className="mb-6 max-w-md">
        <div className="relative bg-white rounded-lg">
          <HiSearch className="absolute inset-y-0 left-3 my-auto text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search influencers..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm"
          />
        </div>
      </div>

      {loading ? (<LoadingSkeleton rows={limit} />) : error ? (<ErrorMessage>{error}</ErrorMessage>) : (
        <div className="bg-white rounded-md shadow-sm overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader
              style={{ backgroundImage: `linear-gradient(to right, ${GRADIENT_FROM}, ${GRADIENT_TO})` }}
              className="text-white text-center"
            >
              <TableRow>
                <TableHead onClick={() => toggleSort("name")} className="cursor-pointer font-semibold text-center">
                  {applicantCount} Applied <SortIndicator field="name" />
                </TableHead>
                <TableHead onClick={() => toggleSort("handle")} className="cursor-pointer font-semibold text-center">
                  Social Handle <SortIndicator field="handle" />
                </TableHead>
                <TableHead onClick={() => toggleSort("category")} className="cursor-pointer font-semibold text-center">
                  Category <SortIndicator field="category" />
                </TableHead>
                <TableHead onClick={() => toggleSort("audienceSize")} className="cursor-pointer font-semibold text-center">
                  Audience <SortIndicator field="audienceSize" />
                </TableHead>
                <TableHead onClick={() => toggleSort("createdAt")} className="cursor-pointer font-semibold text-center">
                  Date <SortIndicator field="createdAt" />
                </TableHead>
                <TableHead className="font-semibold text-center">Status</TableHead>
                <TableHead className="text-center font-semibold whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{rows}</TableBody>
          </Table>
        </div>
      )}

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
          <span className="text-sm">Page <strong>{page}</strong> of {meta.totalPages}</span>
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

      <ContractSidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        title={
          panelMode === "send"
            ? "Send Contract"
            : (selectedMeta && isRejectedMeta(selectedMeta) ? "Resend Contract" : "Edit Contract")
        }
        subtitle={selectedInf ? `${campaignTitle || "Agreement"} • ${selectedInf.name}` : campaignTitle || "Agreement"}
        previewUrl={pdfUrl}
      >
        <SidebarSection title="Campaign Details" icon={<HiDocumentText className="w-4 h-4" />}>
          <div className="space-y-4">
            <FloatingLabelInput id="campaignTitle" label="Campaign Title" value={campaignTitle} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setCampaignTitle(e.target.value); clearPreview(); }} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Platforms</label>
              <PlatformSelector platforms={platforms} onChange={(v: string[]) => { setPlatforms(v); clearPreview(); }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="goLiveStart" className="block text-xs font-medium text-gray-600 mb-1.5">Go Live Start</label>
                <input id="goLiveStart" type="date" value={goLiveStart} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setGoLiveStart(e.target.value); clearPreview(); }} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-black focus:outline-none" />
              </div>
              <div>
                <label htmlFor="goLiveEnd" className="block text-xs font-medium text-gray-600 mb-1.5">Go Live End</label>
                <input id="goLiveEnd" type="date" value={goLiveEnd} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setGoLiveEnd(e.target.value); clearPreview(); }} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-black focus:outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FloatingLabelInput id="totalFee" label="Total Fee" value={totalFee} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setTotalFee(e.target.value); clearPreview(); }} type="number" />
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Currency</label>
                <ReactSelect
                  instanceId="currency-select"
                  inputId="currency-select-input"
                  name="currency"
                  isLoading={listsLoading}
                  options={currencyOptions}
                  value={currencyOptions.find((o) => o.value === currency) || null}
                  onChange={(opt: any) => { setCurrency(opt?.value || ""); clearPreview(); }}
                  placeholder="Select currency"
                  styles={{ control: (base) => ({ ...base, minHeight: "44px", borderRadius: 8 }) }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FloatingLabelInput id="milestoneSplit" label="Milestone Split" value={milestoneSplit} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setMilestoneSplit(e.target.value); clearPreview(); }} />
              <NumberInput id="revisionsIncluded" label="Revisions Included" value={revisionsIncluded} onChange={(v: number) => { setRevisionsIncluded(v); clearPreview(); }} min={0} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="requestedEffDate" className="block text-xs font-medium text-gray-600 mb-1.5">Requested Effective Date (display)</label>
                <input id="requestedEffDate" type="date" value={requestedEffDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setRequestedEffDate(e.target.value); clearPreview(); }} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-black focus:outline-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Timezone</label>
                <ReactSelect
                  instanceId="timezone-select"
                  inputId="timezone-select-input"
                  name="timezone"
                  isLoading={listsLoading}
                  options={tzOptions}
                  value={tzOptions.find((o) => o.value === requestedEffTz) || null}
                  onChange={(opt: any) => { setRequestedEffTz(opt?.value || ""); clearPreview(); }}
                  placeholder="Select timezone"
                  styles={{ control: (base) => ({ ...base, minHeight: "44px", borderRadius: 8 }) }}
                />
              </div>
            </div>
          </div>
        </SidebarSection>

        <SidebarSection title="Deliverables" icon={<HiClipboardList className="w-4 h-4" />}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FloatingLabelInput id="dType" label="Type" value={dType} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDType(e.target.value); clearPreview(); }} />
              <Select
                id="dFormat"
                label="Format"
                value={dFormat}
                onChange={(e: any) => { setDFormat(e.target.value); clearPreview(); }}
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
              <NumberInput id="quantity" label="Quantity" value={dQuantity} onChange={(v: number) => { setDQuantity(v); clearPreview(); }} min={1} />
              <NumberInput id="duration" label="Duration (sec)" value={dDurationSec} onChange={(v: number) => { setDDurationSec(v); clearPreview(); }} min={0} />
              <NumberInput id="minlive" label="Min Live (hrs)" value={dMinLiveHours} onChange={(v: number) => { setDMinLiveHours(v); clearPreview(); }} min={0} />
            </div>
            <Checkbox id="draftRequired" label="Draft Required" checked={dDraftRequired} onChange={(v: boolean) => { setDDraftRequired(v); clearPreview(); }} />
            <TextArea id="captions" label="Captions / Notes" value={dCaptions} onChange={(e: any) => { setDCaptions(e.target.value); clearPreview(); }} rows={3} placeholder="Guidelines, hashtags, instructions..." />
            <div className="grid grid-cols-2 gap-4">
              <ChipInput label="Tags" items={dTags} setItems={setTagsInvalidate} placeholder="#tag" />
              <ChipInput label="Links" items={dLinks} setItems={setLinksInvalidate} placeholder="https://" validator={(s: any) => /^https?:\/\/.+/i.test(s)} />
            </div>
            <div className="text-sm text-gray-600"><span className="font-medium">Handles: </span>{dHandles.length ? dHandles.join(", ") : "—"}</div>
          </div>
        </SidebarSection>

        <div className="sticky bottom-0 -mx-6 -mb-6 bg-white border-t border-gray-200 p-6 flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={closeSidebar} className="px-6 text-black">Close</Button>
          <Button
            onClick={handleGeneratePreview}
            className="px-6 border-2 border-black text-black bg-white hover:bg-gray-50"
            title="Generate a PDF preview on the left"
            disabled={!platforms.length || !campaignTitle.trim()}
          >
            <HiEye className="w-5 h-5 mr-2" /> Preview
          </Button>
          {panelMode === "send" ? (
            <Button
              onClick={handleSendContract}
              className="px-6 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF7236] hover:to-[#FFA135] shadow-none"
              disabled={!platforms.length || !campaignTitle.trim() || !pdfUrl}
              title={!pdfUrl ? "Preview required first" : "Send contract"}
            >
              <HiPaperAirplane className="w-5 h-5 mr-2" /> Send Contract
            </Button>
          ) : (
            <Button
              onClick={handleEditContract}
              className="px-6 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF7236] hover:to-[#FFA135] shadow-none"
              disabled={!pdfUrl}
              title={!pdfUrl ? "Preview required first" : updateBtnLabel}
            >
              {updateBtnLabel}
            </Button>
          )}
        </div>
      </ContractSidebar>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={signOpen}
        onClose={() => { setSignOpen(false); setSignTargetMeta(null); }}
        onSigned={async (sigDataUrl: string) => {
          if (!signTargetMeta?.contractId) return;
          try {
            await post("/contract/sign", {
              contractId: signTargetMeta.contractId,
              role: "brand",
              name: signerName,
              email: signerEmail,
              signatureImageDataUrl: sigDataUrl
            });
            toast({ icon: "success", title: "Signed", text: "Signature recorded." });
            setSignOpen(false);
            setSignTargetMeta(null);
            fetchApplicants();
            loadMetaCache(influencers);
          } catch (e: any) {
            toast({ icon: "error", title: "Sign failed", text: e?.response?.data?.message || e.message || "Could not sign contract." });
          }
        }}
      />
    </div>
  );
}

/* ===============================================================
   Support UI components
   =============================================================== */
const LoadingSkeleton = ({ rows }: { rows: number }) => (
  <div className="p-6 space-y-2">{Array.from({ length: rows }).map((_, i) => (<Skeleton key={i} className="h-12 w-full rounded-md" />))}</div>
);

const ErrorMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (<p className="p-6 text-center text-red-600">{children}</p>);

export function FloatingLabelInput({ id, label, value, onChange, type = "text", ...props }: any) {
  const [focused, setFocused] = useState(false);
  const hasValue = value !== "";
  return (
    <div className="relative">
      <input id={id} type={type} value={value} onChange={onChange} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} className="w-full px-4 pt-6 pb-2 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-black focus:outline-none peer" placeholder=" " {...props} />
      <label htmlFor={id} className={`absolute left-4 transition-all duration-200 pointer-events-none ${focused || hasValue ? "top-2 text-xs text-black font-medium" : "top-1/2 -translate-y-1/2 text-sm text-gray-500"}`}>{label}</label>
    </div>
  );
}

export function Select({ id, label, value, onChange, options, disabled = false }: any) {
  const flat = (Array.isArray(options[0]) ? (options as any).flat() : (options as any)) as { value: string; label: string }[];
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
      <select id={id} value={value} onChange={onChange} disabled={disabled} className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm focus:outline-none ${disabled ? "opacity-60 cursor-not-allowed" : "focus:border-black border-gray-200"}`}>
        {flat.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </div>
  );
}

export function NumberInput({ id, label, value, onChange, min = 0, ...props }: any) {
  return (
    <div className="relative">
      <input id={id} type="number" min={min} value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(Math.max(min, Number(e.target.value || min)))} className="w-full px-4 pt-6 pb-2 border-2 border-gray-200 rounded-lg text-sm transition-all duration-200 focus:border-black focus:outline-none" {...props} />
      <label htmlFor={id} className="absolute left-4 top-2 text-xs text-black font-medium pointer-events-none">{label}</label>
    </div>
  );
}

export function Checkbox({ id, label, checked, onChange, disabled = false }: any) {
  return (
    <label htmlFor={id} className={`flex items-center gap-2 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      <input id={id} type="checkbox" checked={checked} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)} disabled={disabled} className="h-4 w-4" />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

export function PlatformSelector({ platforms, onChange, disabled = false }: any) {
  const toggle = (p: string) => { if (disabled) return; const next = platforms.includes(p) ? platforms.filter((x: string) => x !== p) : [...platforms, p]; onChange(next); };
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
            className={`px-3 py-1.5 rounded-lg border text-sm ${active ? "border-black bg-gray-100" : "border-gray-300 bg-white"} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

export function ChipInput({ label, items, setItems, placeholder, validator, disabled = false }: any) {
  const [val, setVal] = useState("");
  const add = () => { if (disabled) return; const v = val.trim(); if (!v) return; if (validator && !validator(v)) return; setItems([...(items as string[]), v]); setVal(" "); setTimeout(() => setVal(""), 0); };
  const remove = (ix: number) => { if (disabled) return; setItems((items as string[]).filter((_: any, i: any) => i !== ix)); };
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium text-gray-700">{label}</div>
      <div className={`flex flex-wrap gap-2 rounded-lg border-2 p-2 ${disabled ? "opacity-60 cursor-not-allowed" : "border-gray-200"}`}>
        <div className="flex flex-wrap gap-2">
          {items.map((t: string, i: number) => (
            <span key={`${t}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-xs">
              {t}
              <button type="button" onClick={() => remove(i)} disabled={disabled} className="text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed" aria-label="Remove">×</button>
            </span>
          ))}
        </div>
        <input value={val} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVal(e.target.value)} onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => (e.key === "Enter" ? (e.preventDefault(), add()) : undefined)} placeholder={placeholder} disabled={disabled} className="flex-1 min-w-[120px] border-0 outline-none text-sm bg-transparent" />
        <button type="button" onClick={add} disabled={disabled} className="px-2 py-1 text-xs border rounded">Add</button>
      </div>
    </div>
  );
}

export function TextArea({ id, label, value, onChange, rows = 3, placeholder, disabled = false }: any) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
      <textarea id={id} value={value} onChange={onChange} rows={rows} placeholder={placeholder} disabled={disabled} className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm focus:outline-none ${disabled ? "opacity-60 cursor-not-allowed" : "focus:border-black border-gray-200"}`} />
    </div>
  );
}

function ContractSidebar({ isOpen, onClose, children, title = "Initiate Contract", subtitle = "New Agreement", previewUrl }: any) {
  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`}>
      <div className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div className={`absolute right-0 top-0 h-full w-full bg-white shadow-2xl transform transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="relative h-36 overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: `linear-gradient(135deg, ${GRADIENT_FROM} 0%, ${GRADIENT_TO} 100%)`, clipPath: "polygon(0 0, 100% 0, 100% 65%, 0 100%)" }} />
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${GRADIENT_FROM} 0%, ${GRADIENT_TO} 100%)`, clipPath: "polygon(0 0, 100% 0, 100% 78%, 0 92%)" }} />
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
            <button className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center transition-all duration-150 hover:scale-110" onClick={onClose} aria-label="Close" title="Close">✕</button>
          </div>
        </div>
        <div className="flex h-[calc(100%-9rem)]">
          {previewUrl && (<div className="w-full sm:w-1/2 p-6 overflow-auto"><iframe src={previewUrl} width="100%" height="100%" className="border-0" title="Contract PDF" /></div>)}
          <div className={`${previewUrl ? "w-full sm:w-1/2" : "w-full"} h-full px-6 space-y-5 overflow-auto`}>{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ======================
   Signature Modal
   ====================== */
function SignatureModal({ isOpen, onClose, onSigned }: { isOpen: boolean; onClose: () => void; onSigned: (signatureDataUrl: string) => Promise<void> | void; }) {
  const [sigDataUrl, setSigDataUrl] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => { if (!isOpen) { setSigDataUrl(""); setError(""); } }, [isOpen]);

  const handleFile = (file?: File | null) => {
    setError("");
    if (!file) return;
    if (!/image\/(png|jpeg)/i.test(file.type)) return setError("Please upload a PNG or JPG.");
    if (file.size > 50 * 1024) return setError("Signature must be ≤ 50 KB.");
    const reader = new FileReader(); reader.onload = () => setSigDataUrl(reader.result as string); reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-[96%] max-w-xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="relative h-20">
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${GRADIENT_FROM} 0%, ${GRADIENT_TO} 100%)` }} />
          <div className="relative z-10 h-full px-5 flex items-center justify-between text-white">
            <div className="font-semibold tracking-wide">Sign as Brand</div>
            <button className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center" onClick={onClose} aria-label="Close" title="Close">✕</button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-700">Upload your signature image (PNG/JPG up to <strong>50 KB</strong>).</p>
          <div className="space-y-2">
            <input type="file" accept="image/png,image/jpeg" onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFile(e.target.files?.[0])} className="block w-full text-sm text-gray-700" />
            {error && <div className="text-xs text-red-600">{error}</div>}
          </div>
          {sigDataUrl && (
            <div className="border rounded-md p-3 bg-gray-50">
              <div className="text-xs text-gray-600 mb-2">Preview</div>
              <img src={sigDataUrl} alt="Signature preview" className="h-12 border bg-white rounded" />
            </div>
          )}
        </div>

        <div className="p-5 pt-0 flex justify-end gap-3">
          <Button variant="outline" className="text-black" onClick={onClose}>Cancel</Button>
          <Button className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF7236] hover:to-[#FFA135] shadow-none" onClick={() => sigDataUrl ? onSigned(sigDataUrl) : setError("Please select a signature image first.")}>Sign</Button>
        </div>
      </div>
    </div>
  );
}

function SidebarSection({ title, children, icon }: any) {
  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-100 shadow-sm p-5 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        {icon && (<div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white flex items-center justify-center">{icon}</div>)}
        <div className="font-semibold text-gray-800">{title}</div>
      </div>
      {children}
    </div>
  );
}
