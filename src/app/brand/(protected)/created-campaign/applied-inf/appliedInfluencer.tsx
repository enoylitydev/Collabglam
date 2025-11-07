"use client";

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
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
  HiInformationCircle,
  HiChatAlt2,
} from "react-icons/hi";
import ReactSelect from "react-select";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

/* ===============================================================
   THEME (colors preserved)
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
   Utilities (unchanged functionality)
   =============================================================== */
const toast = (opts: { icon: "success" | "error" | "info"; title: string; text?: string }) =>
  Swal.fire({ ...opts, showConfirmButton: false, timer: 1600, timerProgressBar: true, background: "white", customClass: { popup: "rounded-lg border border-gray-200" } });

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
  const direct = pick(inf.category, inf.category_name, inf.categoryTitle, inf.primaryCategory, inf.niche, inf.vertical);
  if (direct) return direct;
  const obj = fromObj(inf.category) || fromObj(inf.primary_category) || fromObj(inf.influencerCategory);
  if (obj) return obj;
  const arr = inf.categories || inf.category_list || inf.influencerCategories;
  if (Array.isArray(arr) && arr.length) {
    const names = arr.map(fromObj).filter(Boolean);
    if (names.length) return names.join(", ");
  }
  return "—";
};

/* ===============================================================
   FDD‑driven helpers (unchanged data)
   =============================================================== */
const VIDEO_TYPES = new Set([
  "Video",
  "Reel/Short/TikTok",
  "UGC Video",
  "YouTube Integration",
  "YouTube Dedicated Video",
  "Live Stream",
]);
const IMAGE_TYPES = new Set(["Static Post (Image)", "Carousel Post"]);
const TEXT_ONLY_TYPES = new Set(["Custom Deliverable (Text)", "Text (caption only)"]); // guard just in case

const VIDEO_FORMATS = [
  { value: "MP4 • 9:16 • 1080×1920", label: "MP4 • 9:16 • 1080×1920" },
  { value: "MP4 • 1:1 • 1080×1080", label: "MP4 • 1:1 • 1080×1080" },
  { value: "MP4 • 16:9 • 1920×1080", label: "MP4 • 16:9 • 1920×1080" },
];
const IMAGE_FORMATS = [
  { value: "JPG • 1:1 • 1080×1080", label: "JPG • 1:1 • 1080×1080" },
  { value: "PNG • 9:16 • 1080×1920", label: "PNG • 9:16 • 1080×1920" },
];
const TEXT_FORMATS = [
  { value: "Text (caption only)", label: "Text (caption only)" },
];

const sanitizeHandle = (h: string) => {
  const t = (h || "").trim();
  if (!t) return t;
  return t.startsWith("@") ? t : `@${t}`;
};

/* ===============================================================
   Constants for Usage Bundle & Geographies (unchanged)
   =============================================================== */
const LICENSE_TYPES = [
  { value: "Organic", label: "Organic Use" },
  { value: "Paid Digital", label: "Paid Digital Use" },
  { value: "Custom", label: "Custom (define in notes)" },
];

const GEO_OPTIONS = [
  { value: "Worldwide", label: "Worldwide" },
  { value: "United States", label: "United States" },
  { value: "Canada", label: "Canada" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "European Union", label: "European Union" },
  { value: "Australia", label: "Australia" },
  { value: "India", label: "India" },
  { value: "Southeast Asia", label: "Southeast Asia" },
  { value: "Middle East", label: "Middle East" },
  { value: "Custom Territory", label: "Custom Territory" },
];

/* ===============================================================
   Page
   =============================================================== */
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

type PanelMode = "send" | "edit"; // sidebar only used for send/edit; viewing uses button

type FormErrors = Record<string, string>;

export default function AppliedInfluencersPage() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id");
  const campaignName = searchParams.get("name") || "";
  const campaignBudgetParam = searchParams.get("budget");
  const campaignTimelineParam = searchParams.get("timeline");
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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
  const [totalFee, setTotalFee] = useState<string>(campaignBudgetParam || "");
  const [currency, setCurrency] = useState("USD");
  const [milestoneSplit, setMilestoneSplit] = useState("50/50");
  const [revisionsIncluded, setRevisionsIncluded] = useState(1);

  // Deliverable (single-row)
  const [dType, setDType] = useState("Video");
  const [dQuantity, setDQuantity] = useState(1);
  const [dFormat, setDFormat] = useState("MP4 • 9:16 • 1080×1920");
  const [dDurationSec, setDDurationSec] = useState(0);
  const [dDraftRequired, setDDraftRequired] = useState(false);
  const [dDraftDue, setDDraftDue] = useState<string>("");
  const [dMinLiveHours, setDMinLiveHours] = useState(0);
  const [retentionUnits, setRetentionUnits] = useState<"hours" | "months">("hours");
  const [retentionMonths, setRetentionMonths] = useState<number>(0);
  const [dTags, setDTags] = useState<string[]>([]);
  const [dHandles, setDHandles] = useState<string[]>([]);
  const [dCaptions, setDCaptions] = useState("");
  const [dLinks, setDLinks] = useState<string[]>([]);
  const [dDisclosures, setDDisclosures] = useState("");
  const [allowWhitelisting, setAllowWhitelisting] = useState(false);
  const [allowSparkAds, setAllowSparkAds] = useState(false);
  const [allowReadOnlyInsights, setAllowReadOnlyInsights] = useState(false);

  // Usage Bundle (Schedule K)
  const [usageType, setUsageType] = useState<string>("Organic");
  const [usageDurationMonths, setUsageDurationMonths] = useState<number>(12);
  const [usageGeographies, setUsageGeographies] = useState<string[]>(["Worldwide"]);
  const [usageDerivativeEdits, setUsageDerivativeEdits] = useState<boolean>(false);

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

  // Form errors (FDD‑aware)
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const clearErrors = () => setFormErrors({});
  const setErr = (key: string, msg: string) => setFormErrors((e) => ({ ...e, [key]: msg }));

  const toggleSort = (field: keyof Influencer) => {
    setPage(1);
    if (sortField === field) setSortOrder((o) => (o === 1 ? 0 : 1));
    else { setSortField(field); setSortOrder(1); }
  };

  const SortIndicator = ({ field }: { field: keyof Influencer }) =>
    sortField === field ? (sortOrder === 1 ? <HiOutlineChevronDown className="inline ml-1 w-4 h-4" /> : <HiOutlineChevronUp className="inline ml-1 w-4 h-4" />) : null;

  /* ---------------- Helpers: dates ---------------- */
  const toInputDate = (v?: string | Date | null) => {
    if (!v) return ""; const d = new Date(v); if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, "0"); const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  const parseDateOnly = (s?: string) => (s ? new Date(s + "T00:00:00") : null);
  const todayStr = toInputDate(new Date());
  const startMin = todayStr;
  const endMin = goLiveStart || todayStr;
  const startMax = goLiveEnd || "";
  const effMin = todayStr;
  const effMax = goLiveEnd || "";
  const draftMin = todayStr;
  const draftMax = goLiveStart || "";

  /* ---------------- Seed from search params (budget + timeline) ---------------- */
  useEffect(() => {
    // budget
    if (campaignBudgetParam && !totalFee) setTotalFee(campaignBudgetParam);

    // timeline format example: "Nov 12, 2025 – Nov 19, 2025"
    if (campaignTimelineParam && !goLiveStart && !goLiveEnd) {
      const raw = campaignTimelineParam.trim();
      const parts = raw.split(/\u2013|–|-/); // en dash or hyphen
      if (parts.length >= 2) {
        const start = toInputDate(new Date(parts[0].trim()));
        const end = toInputDate(new Date(parts[1].trim()));
        if (start) setGoLiveStart(start);
        if (end) setGoLiveEnd(end);
        if (!requestedEffDate && start) setRequestedEffDate(start);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignBudgetParam, campaignTimelineParam]);

  /* ---------------- Debounce search for smoother UX ---------------- */
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  /* ---------------- Keyboard shortcuts ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && sidebarOpen) closeSidebar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

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
          const label = c.name ? `${code} — c.name` : code; // keep shape, text refined below
          return { value: code, label: c.name ? `${code} — ${c.name}` : code, meta: c };
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
      } catch (e: any) {
        toast({ icon: "error", title: "Lists failed", text: e?.message || "Could not load currency/timezones." });
      }
      finally { if (alive) setListsLoading(false); }
    })();
    return () => { alive = false };
  }, []);

  const handleViewMessage = async (inf?: Influencer) => {
    const target = inf || selectedInf;
    if (!target) return;

    const brandId = typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
    if (!brandId) {
      return toast({ icon: "error", title: "Not ready", text: "Missing brandId. Please sign in as a brand." });
    }

    try {
      // Create (or return existing) 1:1 room
      const res: any = await post("/chat/room", {
        brandId,
        influencerId: target.influencerId,
      });

      const roomId = res?.roomId || res?.data?.roomId;
      if (!roomId) throw new Error("Room could not be created");

      // Redirect to messages with roomId
      router.push(`/brand/messages/${encodeURIComponent(roomId)}`);
    } catch (e: any) {
      toast({
        icon: "error",
        title: "Open chat failed",
        text: e?.response?.data?.message || e?.message || "Could not open messages.",
      });
    }
  };

  /* ---------------- Applicants load ---------------- */
  const fetchApplicants = useCallback(async (search?: string) => {
    if (!campaignId) return;
    setLoading(true); setError(null);
    try {
      const payload = { campaignId, page, limit, search: (search ?? searchTerm).trim(), sortField, sortOrder };
      const res: any = await post("/apply/list", payload);
      const influencersList = res?.influencers || res?.data?.influencers || res?.data?.data || [];
      const applicantCountVal = res?.applicantCount || res?.data?.applicantCount || influencersList?.length || 0;
      const metaVal = res?.meta || res?.data?.meta || { total: 0, page: 1, limit, totalPages: 1 };
      setInfluencers(influencersList || []);
      setApplicantCount(applicantCountVal || 0);
      setMeta(metaVal);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to load applicants.");
    } finally { setLoading(false); }
  }, [campaignId, page, limit, sortField, sortOrder, searchTerm]);

  useEffect(() => { fetchApplicants(debouncedSearch); /* eslint-disable-next-line */ }, [campaignId, page, debouncedSearch, sortField, sortOrder]);

  /* ---------------- Contract meta cache ---------------- */
  const getLatestContractFor = async (inf: Influencer): Promise<ContractMeta | null> => {
    const brandId = typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
    if (!brandId) return null;
    try {
      const res = await post("/contract/getContract", { brandId, influencerId: inf.influencerId, campaignId });
      const list = (res?.contracts || (res as any)?.data?.contracts || []) as ContractMeta[];
      const filtered = list.filter((c) => String(c.campaignId) === String(campaignId));
      return filtered.length ? filtered[0] : list.length ? list[0] : null;
    } catch (e: any) {
      toast({ icon: "error", title: "Meta fetch failed", text: e?.response?.data?.message || e?.message || "Could not get contract meta." });
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
    } catch (e: any) {
      toast({ icon: "error", title: "Meta cache failed", text: e?.message || "Unable to build contract cache." });
    }
    finally { setMetaCacheLoading(false); }
  };
  useEffect(() => { loadMetaCache(influencers); /* eslint-disable-next-line */ }, [influencers]);

  /* ---------------- Helpers ---------------- */
  const clearPreview = () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); setPdfUrl(""); };

  const prefillFormFor = (inf: Influencer, meta?: ContractMeta | null) => {
    clearErrors();
    setCampaignTitle(campaignName || inf?.name || "");
    setPlatforms(inf?.primaryPlatform ? [mapPlatformToApi(inf.primaryPlatform) as string] : []);

    // Prefer timeline from params when present
    if (campaignTimelineParam) {
      const parts = campaignTimelineParam.split(/\u2013|–|-/);
      const start = parts[0] ? toInputDate(new Date(parts[0].trim())) : "";
      const end = parts[1] ? toInputDate(new Date(parts[1].trim())) : "";
      setGoLiveStart(start);
      setGoLiveEnd(end);
    } else {
      setGoLiveStart(""); setGoLiveEnd("");
    }

    // budget from params > influencer fee > fallback
    const initialFee = campaignBudgetParam || String(inf.feeAmount || 5000);
    setTotalFee(initialFee);
    setCurrency("USD");

    setMilestoneSplit("50/50"); setRevisionsIncluded(1);

    setDType("Video"); setDQuantity(1); setDFormat("MP4 • 9:16 • 1080×1920"); setDDurationSec(0);
    setDDraftRequired(false); setDDraftDue(""); setDMinLiveHours(0); setRetentionUnits("hours"); setRetentionMonths(0); setDTags([]);
    setDHandles(inf.handle ? [sanitizeHandle(inf.handle)] : []); setDCaptions(""); setDLinks([]); setDDisclosures("");

    setAllowWhitelisting(false); setAllowSparkAds(false); setAllowReadOnlyInsights(false);

    setUsageType("Organic"); setUsageDurationMonths(12); setUsageGeographies(["Worldwide"]); setUsageDerivativeEdits(false);

    const startDefault = goLiveStart || toInputDate(new Date());
    setRequestedEffDate(startDefault);
    setRequestedEffTz("Europe/Amsterdam");

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

      if (brand.usageBundle) {
        const ub = brand.usageBundle;
        if (ub.type) setUsageType(String(ub.type));
        if (ub.durationMonths !== undefined && ub.durationMonths !== null) setUsageDurationMonths(Number(ub.durationMonths));
        if (Array.isArray(ub.geographies)) setUsageGeographies(ub.geographies.map((g: any) => String(g)));
        if (typeof ub.derivativeEditsAllowed === "boolean") setUsageDerivativeEdits(Boolean(ub.derivativeEditsAllowed));
      }

      const expanded = brand.deliverablesExpanded;
      if (Array.isArray(expanded) && expanded.length) {
        const first = expanded[0];
        if (first.type) setDType(String(first.type));
        if (first.quantity !== undefined && first.quantity !== null) setDQuantity(Number(first.quantity));
        if (first.format) setDFormat(String(first.format));
        if (first.durationSec !== undefined && first.durationSec !== null) setDDurationSec(Number(first.durationSec));
        if (first.draftRequired !== undefined) setDDraftRequired(Boolean(first.draftRequired));
        if (first.draftDueDate) setDDraftDue(toInputDate(first.draftDueDate));
        if (first.minLiveHours !== undefined && first.minLiveHours !== null) {
          setDMinLiveHours(Number(first.minLiveHours));
          setRetentionUnits("hours");
          setRetentionMonths(0);
        }
        if (Array.isArray(first.tags)) setDTags(first.tags.map((t: any) => String(t)));
        if (Array.isArray(first.handles)) setDHandles(first.handles.map((h: any) => sanitizeHandle(String(h))));
        if (first.captions) setDCaptions(String(first.captions));
        if (Array.isArray(first.links)) setDLinks(first.links.map((l: any) => String(l)));
        if (typeof first.disclosures === "string") setDDisclosures(first.disclosures);
        if (typeof first.whitelistingEnabled === "boolean") setAllowWhitelisting(first.whitelistingEnabled);
        if (typeof first.sparkAdsEnabled === "boolean") setAllowSparkAds(first.sparkAdsEnabled);
        if (typeof first.insightsReadOnly === "boolean") setAllowReadOnlyInsights(first.insightsReadOnly);
      }
    }
  };

  // Derive conditional UI from FDD
  const isVideo = VIDEO_TYPES.has(dType);
  const isImage = IMAGE_TYPES.has(dType);
  const isTextOnly = TEXT_ONLY_TYPES.has(dType) || dFormat.startsWith("Text ");
  const showDuration = isVideo && !isTextOnly; // FDD: no duration for text or image deliverables

  const formatOptions = isTextOnly ? TEXT_FORMATS : isImage ? IMAGE_FORMATS : VIDEO_FORMATS;

  // keep format valid for the chosen type
  useEffect(() => {
    if (!formatOptions.find((o) => o.value === dFormat)) {
      setDFormat(formatOptions[0].value);
    }
    // hide duration when not applicable
    if (!showDuration) setDDurationSec(0);
  }, [dType]); // eslint-disable-line

  // toggle‑specific support by platform
  const supportsSparkAds = platforms.includes("TikTok");
  const supportsWhitelisting = platforms.includes("Instagram") || platforms.includes("TikTok");

  useEffect(() => {
    if (!supportsSparkAds) setAllowSparkAds(false);
    if (!supportsWhitelisting) setAllowWhitelisting(false);
  }, [supportsSparkAds, supportsWhitelisting]);

  // Draft due enabled only if required
  useEffect(() => { if (!dDraftRequired) setDDraftDue(""); }, [dDraftRequired]);

  const updateBtnLabel = selectedMeta && isRejectedMeta(selectedMeta) ? "Resend Contract" : "Update Contract";

  const openSidebar = async (inf: Influencer, mode: PanelMode) => {
    setSelectedInf(inf);
    setPanelMode(mode);
    const meta = metaCache[inf.influencerId] ?? (await getLatestContractFor(inf));
    setSelectedMeta(meta);
    prefillFormFor(inf, meta);
    clearPreview();
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    clearPreview();
    setSelectedInf(null);
    setSelectedMeta(null);
  };

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [sidebarOpen]);

  const buildBrandPayload = () => {
    // sanitize arrays
    const handles = dHandles.map(sanitizeHandle).filter(Boolean);
    const links = dLinks.filter((l) => /^https?:\/\/.+/i.test(l));
    const tags = dTags.map((t) => (t.startsWith("#") ? t : `#${t}`));

    const goLive = goLiveStart || goLiveEnd ? { start: goLiveStart ? new Date(goLiveStart) : undefined, end: goLiveEnd ? new Date(goLiveEnd) : undefined } : undefined;

    const minLiveHours = retentionUnits === "months" ? (Number(retentionMonths) || 0) * 720 : (Number(dMinLiveHours) || 0);

    return {
      campaignTitle,
      platforms,
      ...(goLive ? { goLive } : {}), // Posting Window = Go-Live Window
      totalFee: Number(totalFee) || 0,
      currency,
      milestoneSplit,
      revisionsIncluded: Number(revisionsIncluded) || 0,
      usageBundle: {
        type: usageType,
        durationMonths: Number(usageDurationMonths) || 0,
        geographies: usageGeographies,
        derivativeEditsAllowed: Boolean(usageDerivativeEdits),
      },
      deliverablesPresetKey: "ui-manual",
      deliverablesExpanded: [
        {
          type: dType,
          quantity: Number(dQuantity) || 0,
          format: dFormat,
          durationSec: Number(dDurationSec) || 0,
          postingWindow: goLive || { start: undefined, end: undefined },
          draftRequired: Boolean(dDraftRequired),
          draftDueDate: dDraftDue || undefined,
          minLiveHours,
          tags,
          handles,
          captions: dCaptions,
          links,
          disclosures: dDisclosures,
          whitelistingEnabled: allowWhitelisting,
          sparkAdsEnabled: allowSparkAds,
          insightsReadOnly: allowReadOnlyInsights,
        },
      ],
      ...(requestedEffDate ? { requestedEffectiveDate: requestedEffDate } : {}),
      ...(requestedEffTz ? { requestedEffectiveDateTimezone: requestedEffTz } : {}),
    };
  };

  /* ---------------- Validation helpers ---------------- */
  const parseMilestoneSplit = (s: string): number[] => {
    if (!s) return [];
    return s.split("/")
      .map((x) => x.replace(/%/g, "").trim())
      .filter(Boolean)
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n));
  };

  const scrollFirstErrorIntoView = () => {
    const first = document.querySelector("[data-field-error=true]") as HTMLElement | null;
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const validateForPreview = (): boolean => {
    clearErrors();
    let ok = true;
    const add = (k: string, msg: string) => { ok = false; setErr(k, msg); };

    const today = parseDateOnly(todayStr)!;
    const start = parseDateOnly(goLiveStart || undefined);
    const end = parseDateOnly(goLiveEnd || undefined);

    if (!campaignTitle.trim()) add("campaignTitle", "Campaign title is required.");
    if (!platforms.length) add("platforms", "Select at least one platform.");

    // Posting window constraints
    if (start && start < today) add("goLiveStart", "Start date must be today or later.");
    if (end && end < today) add("goLiveEnd", "End date must be today or later.");
    if (start && end && start > end) add("goLiveEnd", "End must be on/after Start.");

    // Requested effective date within [today, end]
    if (requestedEffDate) {
      const eff = parseDateOnly(requestedEffDate)!;
      if (eff < today) add("requestedEffDate", "Requested date cannot be before today.");
      if (end && eff > end) add("requestedEffDate", "Requested date must be on/before Posting Window End.");
    }

    // Draft due must be >= today and <= start (if required or provided)
    if (dDraftRequired && !dDraftDue) add("dDraftDue", "Draft due date is required when a draft is required.");
    if (dDraftDue) {
      const draft = parseDateOnly(dDraftDue)!;
      if (draft < today) add("dDraftDue", "Draft due cannot be before today.");
      if (start && draft > start) add("dDraftDue", "Draft due must be on/before Posting Window Start.");
    }

    // money
    const feeNum = Number(totalFee);
    if (Number.isNaN(feeNum) || feeNum < 0) add("totalFee", "Enter a valid non‑negative fee.");
    if (!currency) add("currency", "Choose a currency.");

    // milestone split (sum ≤ 100)
    const parts = parseMilestoneSplit(milestoneSplit);
    if (!parts.length) add("milestoneSplit", "Use a percentage split like 50/50 or 100.");
    if (parts.some((p) => p < 0 || p > 100)) add("milestoneSplit", "Each percentage must be between 0 and 100.");
    const sum = parts.reduce((a, b) => a + b, 0);
    if (sum > 100) add("milestoneSplit", "Split total must be ≤ 100%.");

    // deliverable
    if (!dType) add("dType", "Deliverable type is required.");
    if (dQuantity < 1) add("dQuantity", "Quantity must be at least 1.");

    const isVideoNow = VIDEO_TYPES.has(dType) && !isTextOnly;
    if (isVideoNow) {
      if (!dDurationSec || dDurationSec <= 0) add("dDurationSec", "Duration (sec) must be > 0 for video.");
    }

    // basic link/handle checks (already sanitized in payload too)
    const badLink = dLinks.find((l) => !/^https?:\/\/.+/i.test(l));
    if (badLink) add("dLinks", "All links must be valid URLs (https://).");

    const badHandle = dHandles.find((h) => !/^@?\w[\w._-]*$/.test(h));
    if (badHandle) add("dHandles", "Handles should be like @username (letters, numbers, . _ -).");

    // usage bundle
    if (!usageType) add("usageType", "Choose a license type.");
    if (Number(usageDurationMonths) < 0) add("usageDurationMonths", "Duration must be ≥ 0.");

    if (!ok) { toast({ icon: "error", title: "Please fix the highlighted fields" }); setTimeout(scrollFirstErrorIntoView, 50); }
    return ok;
  };

  /* ---------------- Preview (MUST happen before Send/Update) ---------------- */
  const handleGeneratePreview = async () => {
    if (!selectedInf) return;
    if (!validateForPreview()) return;
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
      const msg = e?.response?.data?.message || e?.message || "Could not generate preview.";
      toast({ icon: "error", title: "Preview failed", text: msg });
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
  const handleViewContract = async (inf?: Influencer) => {
    const target = inf || selectedInf; if (!target) return;
    const meta = metaCache[target.influencerId] ?? (await getLatestContractFor(target));
    if (!meta?.contractId) return toast({ icon: "error", title: "No Contract", text: "Please send the contract first." });
    try {
      const res = await api.post("/contract/viewPdf", { contractId: meta.contractId }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data); window.open(url, "_blank");
    } catch (e: any) { toast({ icon: "error", title: "Open Failed", text: e?.message || "Unable to open contract." }); }
  };

  const handleSendContract = async () => {
    if (!selectedInf) return;
    if (!pdfUrl) { toast({ icon: "info", title: "Preview required", text: "Generate preview before sending." }); return; }
    if (!validateForPreview()) return;
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
      toast({ icon: "error", title: "Send failed", text: e?.response?.data?.message || e?.message || "Failed to send." });
    }
  };

  const handleEditContract = async () => {
    if (!selectedMeta?.contractId) return;
    if (!pdfUrl) { toast({ icon: "info", title: "Preview required", text: "Generate preview before updating." }); return; }
    if (!validateForPreview()) return;
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
      toast({ icon: "error", title: "Update failed", text: e?.response?.data?.message || e?.message || "Could not update contract." });
    }
  };

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
      toast({ icon: "error", title: "Confirm failed", text: e?.response?.data?.message || e?.message || "Could not confirm." });
    }
  };

  const openSignModal = (meta: ContractMeta | null) => {
    if (!meta?.contractId) return toast({ icon: "error", title: "No Contract", text: "Send/accept contract first." });
    setSignTargetMeta(meta);
    setSignOpen(true);
  };

  /* ---------------- Invalidate preview when form changes ---------------- */
  useEffect(() => { clearPreview(); /* invalidate on key field changes */ }, [
    campaignTitle, platforms, goLiveStart, goLiveEnd, totalFee, currency, milestoneSplit, revisionsIncluded,
    dType, dQuantity, dFormat, dDurationSec, dDraftRequired, dDraftDue, dMinLiveHours, dCaptions, dDisclosures,
    requestedEffDate, requestedEffTz, allowWhitelisting, allowSparkAds, allowReadOnlyInsights, dTags.length, dLinks.length, dHandles.length,
    usageType, usageDurationMonths, usageDerivativeEdits, usageGeographies.length, retentionUnits, retentionMonths
  ]);
  const setTagsInvalidate = (items: string[]) => { setDTags(items); clearPreview(); };
  const setLinksInvalidate = (items: string[]) => { setDLinks(items); clearPreview(); };
  const setHandlesInvalidate = (items: string[]) => { setDHandles(items.map(sanitizeHandle)); clearPreview(); };

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

  const StatusBadge = ({ meta, hasContract }: { meta: ContractMeta | null, hasContract: boolean }) => {
    const label = prettyStatus(meta, hasContract, true);
    const rejected = isRejectedMeta(meta);
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${rejected ? "bg-black text-white" : "bg-gray-100 text-gray-800"}`}>
        {label}
      </span>
    );
  };

  const RowActions = ({ inf, meta, hasContract, rejected, iConfirmed, bConfirmed, bSigned, locked, nowrap = false, }: any) => (
    <div
      className={[
        "items-center gap-2 md:gap-2 lg:gap-2",
        "whitespace-nowrap",
        nowrap ? "inline-flex flex-nowrap" : "flex flex-wrap justify-center",
      ].join(" ")}
    >
      <ActionButton
        icon={HiChatAlt2}
        title="View Messages"
        variant="outline"
        onClick={() => handleViewMessage(inf)}
      >
        View Messages
      </ActionButton>

      <ActionButton
        title="View Influencer"
        variant="outline"
        onClick={() => router.push(`/brand/influencers?id=${inf.influencerId}`)}
      >
        View Influencer
      </ActionButton>

      {!hasContract && !rejected && (
        <ActionButton
          icon={HiPaperAirplane}
          title="Send contract"
          variant="grad"
          onClick={() => openSidebar(inf, "send")}
        >
          Send Contract
        </ActionButton>
      )}

      {hasContract && rejected && !locked && !wasResent(meta) && (
        <ActionButton
          title="Resend contract"
          variant="grad"
          onClick={() => openSidebar(inf, "edit")}
        >
          Resend Contract
        </ActionButton>
      )}

      {hasContract && (
        <ActionButton
          icon={HiEye}
          title="View contract"
          variant="grad"
          disabled={metaCacheLoading && !meta}
          onClick={() => handleViewContract(inf)}
        >
          View Contract
        </ActionButton>
      )}

      {hasContract && !rejected && !iConfirmed && !locked && !bConfirmed && (
        <ActionButton
          icon={HiCheck}
          title="Brand Accept"
          variant="outline"
          onClick={() => handleBrandAccept(inf)}
        >
          Brand Accept
        </ActionButton>
      )}

      {hasContract && iConfirmed && !bConfirmed && !locked && (
        <>
          <ActionButton
            title="Edit contract"
            variant="grad"
            onClick={() => openSidebar(inf, "edit")}
          >
            Edit Contract
          </ActionButton>
          <ActionButton
            icon={HiCheck}
            title="Brand Accept"
            variant="outline"
            onClick={() => handleBrandAccept(inf)}
          >
            Brand Accept
          </ActionButton>
        </>
      )}

      {hasContract && bConfirmed && !bSigned && !locked && (
        <ActionButton
          title="Sign as Brand"
          variant="grad"
          onClick={() => openSignModal(meta)}
        >
          Sign as Brand
        </ActionButton>
      )}
    </div>
  );


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

      return (
        <TableRow key={inf.influencerId} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100/60 focus-within:bg-gray-100/80 transition-colors`}>
          <TableCell className="font-medium">
            <div className="flex items-center gap-2">
              <span className="truncate max-w-[220px]" title={inf.name}>{inf.name}</span>
            </div>
          </TableCell>
          <TableCell className="whitespace-nowrap">
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-black hover:underline" title="Open profile">
                {inf.handle || "—"}
              </a>
            ) : (
              <span className="text-gray-500">—</span>
            )}
          </TableCell>
          <TableCell>
            <Badge variant="secondary" className="capitalize bg-gray-200 text-gray-800">{getCategoryLabel(inf)}</Badge>
          </TableCell>
          <TableCell>{formatAudience(inf.audienceSize)}</TableCell>
          <TableCell className="whitespace-nowrap">{inf.createdAt ? new Date(inf.createdAt).toLocaleDateString() : "—"}</TableCell>

          <TableCell className="text-center">
            {rejected ? (
              <div className="space-y-1">
                <Badge className="bg-black text-white shadow-none">Rejected</Badge>
                <p className="text-xs text-gray-500 break-words">{getRejectReasonFromMeta(meta) || "No reason provided"}</p>
              </div>
            ) : (
              <StatusBadge meta={meta} hasContract={hasContract} />
            )}
          </TableCell>

          {/* ACTIONS */}
          <TableCell className="text-center">
              <RowActions
                inf={inf}
                meta={meta}
                hasContract={hasContract}
                rejected={rejected}
                iConfirmed={iConfirmed}
                bConfirmed={bConfirmed}
                bSigned={bSigned}
                locked={locked}
                nowrap
              />
          </TableCell>
        </TableRow>
      );
    })
  ), [influencers, metaCache, metaCacheLoading]);

  const EmptyState = () => (
    <div className="p-12 text-center space-y-3">
      <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundImage: `linear-gradient(to right, ${GRADIENT_FROM}, ${GRADIENT_TO})` }}>
        <HiSearch className="text-white w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold">No applicants found</h3>
      <p className="text-sm text-gray-600">Try adjusting your search or sorting options.</p>
    </div>
  );

  const MobileCardList = () => (
    <div className="grid gap-3 md:hidden">
      {influencers.map((inf) => {
        const meta = metaCache[inf.influencerId] || null;
        const hasContract = !!(meta?.contractId || inf.contractId || inf.isAssigned);
        const iConfirmed = !!meta?.confirmations?.influencer?.confirmed;
        const bConfirmed = !!meta?.confirmations?.brand?.confirmed;
        const bSigned = !!meta?.signatures?.brand?.signed;
        const locked = meta ? meta.status === "locked" : false;
        const rejected = isRejectedMeta(meta);
        const href = buildHandleUrl(inf.primaryPlatform, inf.handle);

        return (
          <div key={inf.influencerId} className="rounded-xl border border-gray-200 p-4 bg-white">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate" title={inf.name}>{inf.name}</div>
                <div className="text-sm text-gray-600 truncate">
                  {href ? <a className="hover:underline text-black" href={href} target="_blank" rel="noreferrer">{inf.handle}</a> : <span className="text-gray-500">—</span>}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                  <Badge variant="secondary" className="bg-gray-200 text-gray-800">{getCategoryLabel(inf)}</Badge>
                  <span>•</span>
                  <span>{formatAudience(inf.audienceSize)} audience</span>
                </div>
              </div>
              <StatusBadge meta={meta} hasContract={hasContract} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <RowActions inf={inf} meta={meta} hasContract={hasContract} rejected={rejected} iConfirmed={iConfirmed} bConfirmed={bConfirmed} bSigned={bSigned} locked={locked} />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto">
        <header className="flex items-center justify-between p-2 md:p-4 rounded-md sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 border-b border-gray-100">
          <h1 className="text-xl md:text-3xl font-bold truncate">Campaign: {campaignName || "Unknown Campaign"}</h1>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="bg-gray-200 text-black" onClick={() => router.back()}>Back</Button>
          </div>
        </header>

        <div className="mb-2 md:mb-4 max-w-xl sticky top-[62px] z-10">
          <div className="relative bg-white rounded-lg">
            <HiSearch className="absolute inset-y-0 left-3 my-auto text-gray-400" size={20} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search influencers… (press / to focus)"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-sm"
              aria-label="Search influencers"
            />
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-md shadow-sm">
            <LoadingSkeleton rows={limit} />
          </div>
        ) : error ? (
          <ErrorMessage>{error}</ErrorMessage>
        ) : influencers.length === 0 ? (
          <div className="bg-white rounded-md shadow-sm">
            <EmptyState />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="bg-white rounded-md shadow-sm overflow-hidden hidden md:block" aria-busy={loading}>
              <div className="overflow-x-auto">
                <Table className="min-w-[1100px]">
                  <TableHeader
                    style={{ backgroundImage: `linear-gradient(to right, ${GRADIENT_FROM}, ${GRADIENT_TO})` }}
                    className="text-white sticky top-0 z-10"
                  >
                    <TableRow>
                      <TableHead onClick={() => toggleSort("name")} className="cursor-pointer font-semibold select-none" aria-sort={sortField === 'name' ? (sortOrder === 1 ? 'ascending' : 'descending') : 'none'}>
                        {applicantCount} Applied <SortIndicator field="name" />
                      </TableHead>
                      <TableHead onClick={() => toggleSort("handle")} className="cursor-pointer font-semibold select-none" aria-sort={sortField === 'handle' ? (sortOrder === 1 ? 'ascending' : 'descending') : 'none'}>
                        Social Handle <SortIndicator field="handle" />
                      </TableHead>
                      <TableHead onClick={() => toggleSort("category")} className="cursor-pointer font-semibold select-none" aria-sort={sortField === 'category' ? (sortOrder === 1 ? 'ascending' : 'descending') : 'none'}>
                        Category <SortIndicator field="category" />
                      </TableHead>
                      <TableHead onClick={() => toggleSort("audienceSize")} className="cursor-pointer font-semibold select-none" aria-sort={sortField === 'audienceSize' ? (sortOrder === 1 ? 'ascending' : 'descending') : 'none'}>
                        Audience <SortIndicator field="audienceSize" />
                      </TableHead>
                      <TableHead onClick={() => toggleSort("createdAt")} className="cursor-pointer font-semibold select-none" aria-sort={sortField === 'createdAt' ? (sortOrder === 1 ? 'ascending' : 'descending') : 'none'}>
                        Date <SortIndicator field="createdAt" />
                      </TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-center font-semibold w-[560px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{rows}</TableBody>
                </Table>
              </div>
            </div>

            {/* Mobile cards */}
            <MobileCardList />
          </>
        )}

        {meta.totalPages > 1 && (
          <div className="flex justify-center md:justify-end items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="text-black"
              aria-label="Previous page"
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
              aria-label="Next page"
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
          {/* Campaign Details */}
          <SidebarSection title="Campaign Details" icon={<HiDocumentText className="w-4 h-4" />}>
            <div className="space-y-4">
              <FloatingLabelInput
                id="campaignTitle"
                label="Campaign Title"
                info="The display name for this agreement (Schedule A, item 1)."
                value={campaignTitle}
                onChange={(e: any) => { setCampaignTitle(e.target.value); clearPreview(); }}
                error={formErrors.campaignTitle}
                data-field-error={!!formErrors.campaignTitle}
              />

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <LabelWithInfo text="Platforms" info="Select the channels for this SOW (Schedule A, item 3)." />
                  {formErrors.platforms && <span className="text-xs text-red-600" data-field-error>{formErrors.platforms}</span>}
                </div>
                <PlatformSelector platforms={platforms} onChange={(v: string[]) => { setPlatforms(v); clearPreview(); }} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Total Fee — top label + 44px height */}
                <NumberInputTop
                  id="totalFee"
                  label="Total Fee"
                  info="The full compensation for the campaign (Schedule A, 7a)."
                  value={totalFee}
                  onChange={(v: number) => { setTotalFee(String(v)); clearPreview(); }}
                  min={0}
                  error={formErrors.totalFee}
                  data-field-error={!!formErrors.totalFee}
                />

                {/* Currency — top label + 44px height to match */}
                <div className="space-y-1.5" data-field-error={!!formErrors.currency}>
                  <LabelWithInfo text="Currency" info="Payment currency (Schedule A, 7a)." />
                  <ReactSelect
                    instanceId="currency-select"
                    inputId="currency-select-input"
                    name="currency"
                    isLoading={listsLoading}
                    options={currencyOptions}
                    value={currencyOptions.find((o) => o.value === currency) || null}
                    onChange={(opt: any) => { setCurrency(opt?.value || ""); clearPreview(); }}
                    placeholder="Select currency"
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        minHeight: 44,
                        height: 44,
                        borderRadius: 8,
                        borderColor: formErrors.currency ? "#ef4444" : base.borderColor,
                        boxShadow: "none",
                        "&:hover": { borderColor: formErrors.currency ? "#ef4444" : base.borderColor },
                      }),
                      valueContainer: (base) => ({ ...base, height: 44, padding: "0 12px" }),
                      indicatorsContainer: (base) => ({ ...base, height: 44 }),
                      input: (base) => ({ ...base, margin: 0, padding: 0 }),
                    }}
                  />
                  {formErrors.currency && (
                    <div className="text-xs text-red-600" data-field-error>
                      {formErrors.currency}
                    </div>
                  )}
                </div>
              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FloatingLabelInput
                  id="milestoneSplit"
                  label="Milestone Split (%)"
                  info="Percentages like 50/50 or 40/30/30. Total must be ≤ 100%."
                  value={milestoneSplit}
                  onChange={(e: any) => { setMilestoneSplit(e.target.value); clearPreview(); }}
                  error={formErrors.milestoneSplit}
                  inputMode="numeric"
                  placeholder="50/50"
                  data-field-error={!!formErrors.milestoneSplit}
                />
                <NumberInput
                  id="revisionsIncluded"
                  label="Revisions Included"
                  info="Included rounds of edits (Schedule A, 5b)."
                  value={revisionsIncluded}
                  onChange={(v: number) => { setRevisionsIncluded(v); clearPreview(); }}
                  min={0}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <LabelWithInfo text="Requested Effective Date (display)" info="Shown in the PDF header; does not change locking rules." />
                  <input
                    id="requestedEffDate"
                    type="date"
                    value={requestedEffDate}
                    min={effMin}
                    max={effMax || undefined}
                    onChange={(e) => { setRequestedEffDate(e.target.value); clearPreview(); }}
                    className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm transition-all duration-200 focus:border-black focus:outline-none ${formErrors.requestedEffDate ? "border-red-500" : "border-gray-200"}`}
                    data-field-error={!!formErrors.requestedEffDate}
                  />
                  {formErrors.requestedEffDate && <div className="text-xs text-red-600 mt-1">{formErrors.requestedEffDate}</div>}
                </div>
                <div>
                  <LabelWithInfo text="Timezone" info="Used for date formatting and review windows (Section 2c)." />
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

          {/* Posting Window */}
          <SidebarSection title="Posting Window" icon={<HiInformationCircle className="w-4 h-4" />}>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <LabelWithInfo text="Start" info="Earliest date content may go live." />
                  <input
                    id="goLiveStart"
                    type="date"
                    value={goLiveStart}
                    min={startMin}
                    max={startMax || undefined}
                    onChange={(e) => { setGoLiveStart(e.target.value); clearPreview(); }}
                    className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm transition-all duration-200 focus:border-black focus:outline-none ${formErrors.goLiveStart ? "border-red-500" : "border-gray-200"}`}
                    data-field-error={!!formErrors.goLiveStart}
                  />
                  {formErrors.goLiveStart && <div className="text-xs text-red-600 mt-1">{formErrors.goLiveStart}</div>}
                </div>
                <div>
                  <LabelWithInfo text="End" info="Latest date content must be posted." />
                  <input
                    id="goLiveEnd"
                    type="date"
                    value={goLiveEnd}
                    min={endMin}
                    onChange={(e) => { setGoLiveEnd(e.target.value); clearPreview(); }}
                    className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm transition-all duration-200 focus:border-black focus:outline-none ${formErrors.goLiveEnd ? "border-red-500" : "border-gray-200"}`}
                    data-field-error={!!formErrors.goLiveEnd}
                  />
                  {formErrors.goLiveEnd && <div className="text-xs text-red-600 mt-1">{formErrors.goLiveEnd}</div>}
                </div>
              </div>
            </div>
          </SidebarSection>

          {/* Deliverables */}
          <SidebarSection title="Deliverables" icon={<HiClipboardList className="w-4 h-4" />}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SelectWithInfo
                  id="dType"
                  label="Type (what it is)"
                  info="Content category, e.g., Video, Story, Carousel (Schedule E)."
                  value={dType}
                  onChange={(e: any) => { setDType(e.target.value); clearPreview(); }}
                  options={[
                    { value: "Video", label: "Video" },
                    { value: "Reel/Short/TikTok", label: "Reel / Short / TikTok" },
                    { value: "Static Post (Image)", label: "Static Post (Image)" },
                    { value: "Carousel Post", label: "Carousel Post" },
                    { value: "Story (Single)", label: "Story (Single)" },
                    { value: "Story Set", label: "Story Set (Multiple)" },
                    { value: "UGC Video", label: "UGC Video" },
                    { value: "YouTube Integration", label: "YouTube Integration" },
                    { value: "YouTube Dedicated Video", label: "YouTube Dedicated Video" },
                    { value: "Live Stream", label: "Live Stream" },
                    { value: "Text (caption only)", label: "Text (caption only)" },
                    { value: "Custom Deliverable", label: "Custom Deliverable" },
                  ]}
                  error={formErrors.dType}
                  data-field-error={!!formErrors.dType}
                />
                <SelectWithInfo
                  id="dFormat"
                  label="Format (file • aspect • res)"
                  info="Technical spec for delivery (Schedule E)."
                  value={dFormat}
                  onChange={(e: any) => { setDFormat(e.target.value); clearPreview(); }}
                  options={formatOptions}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Quantity - top label */}
                <NumberInputTop
                  id="quantity"
                  label="Quantity"
                  info="Number of pieces required."
                  value={dQuantity}
                  onChange={(v: number) => { setDQuantity(v); clearPreview(); }}
                  min={1}
                  error={formErrors.dQuantity}
                  data-field-error={!!formErrors.dQuantity}
                />

                {/* Duration - top label (only when shown) */}
                {showDuration && (
                  <NumberInputTop
                    id="duration"
                    label="Duration (sec)"
                    info="For video deliverables only."
                    value={dDurationSec}
                    onChange={(v: number) => { setDDurationSec(v); clearPreview(); }}
                    min={1}
                    error={formErrors.dDurationSec}
                    data-field-error={!!formErrors.dDurationSec}
                  />
                )}

                {/* Minimum Live + Units — both top labels, 44px controls */}
                <div className="grid grid-cols-2 gap-2">
                  {retentionUnits === "hours" ? (
                    <NumberInputTop
                      id="minlive-hrs"
                      label="Minimum Live"
                      value={dMinLiveHours}
                      onChange={(v: number) => { setDMinLiveHours(v); clearPreview(); }}
                      min={0}
                    />
                  ) : (
                    <NumberInputTop
                      id="minlive-months"
                      label="Minimum Live"
                      value={retentionMonths}
                      onChange={(v: number) => { setRetentionMonths(v); clearPreview(); }}
                      min={0}
                    />
                  )}

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Units</label>
                    <select
                      value={retentionUnits}
                      onChange={(e) => { setRetentionUnits(e.target.value as any); clearPreview(); }}
                      className="w-full h-[44px] px-3 border-2 rounded-lg text-sm focus:outline-none focus:border-black border-gray-200"
                    >
                      <option value="hours">Hours</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Checkbox id="draftRequired" label={<>Draft Required <InfoTip text="If enabled, a draft must be submitted before posting (Section 4b)." /></>} checked={dDraftRequired} onChange={(v: boolean) => { setDDraftRequired(v); clearPreview(); }} />
                <div>
                  <LabelWithInfo text="Draft Due (if required)" info="Date the draft must be submitted for review." />
                  <input
                    id="draftDue"
                    type="date"
                    value={dDraftDue}
                    min={draftMin}
                    max={draftMax || undefined}
                    onChange={(e) => { setDDraftDue(e.target.value); clearPreview(); }}
                    disabled={!dDraftRequired}
                    className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm transition-all duration-200 focus:border-black focus:outline-none ${dDraftRequired ? "border-gray-200" : "opacity-60 cursor-not-allowed border-gray-200"} ${formErrors.dDraftDue ? "!border-red-500" : ""}`}
                    data-field-error={!!formErrors.dDraftDue}
                  />
                  {formErrors.dDraftDue && <div className="text-xs text-red-600 mt-1">{formErrors.dDraftDue}</div>}
                </div>
              </div>
              <TextArea id="captions" label={<LabelWithInfo text="Captions / Notes" info="Guidelines, messaging, and creative notes." />} value={dCaptions} onChange={(e: any) => { setDCaptions(e.target.value); clearPreview(); }} rows={3} placeholder="Hashtags, call‑outs, shot list…" />
              <TextArea id="disclosures" label={<LabelWithInfo text="Disclosures (e.g., #ad)" info="Required compliance labels (Schedule B)." />} value={dDisclosures} onChange={(e: any) => { setDDisclosures(e.target.value); clearPreview(); }} rows={2} placeholder="Clear & conspicuous material-connection labels" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ChipInput label={<LabelWithInfo text="Tags" info="Required hashtags to include." />} items={dTags} setItems={setTagsInvalidate} placeholder="#tag" />
                <ChipInput label={<LabelWithInfo text="Links" info="Campaign or tracking links (https://)." />} items={dLinks} setItems={setLinksInvalidate} placeholder="https://" validator={(s: any) => /^https?:\/\/.+/i.test(s)} error={formErrors.dLinks} />
                <ChipInput label={<LabelWithInfo text="Handles" info="Brand or partner handles to tag." />} items={dHandles} setItems={setHandlesInvalidate} placeholder="@brand" error={formErrors.dHandles} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {supportsWhitelisting && (
                  <Checkbox id="whitelist" label={<>Enable Whitelisting Access <InfoTip text="Allow brand to run ads from influencer handle (Schedule A, 12)." /></>} checked={allowWhitelisting} onChange={setAllowWhitelisting} />
                )}
                {supportsSparkAds && (
                  <Checkbox id="sparkads" label={<>Enable Spark Ads / Boosting <InfoTip text="Allow boosting on TikTok (Schedule A, 12)." /></>} checked={allowSparkAds} onChange={setAllowSparkAds} />
                )}
                <Checkbox id="insightsread" label={<>Grant Read‑only Insights <InfoTip text="Permit analytics access for verification (Schedule L)." /></>} checked={allowReadOnlyInsights} onChange={setAllowReadOnlyInsights} />
              </div>
            </div>
          </SidebarSection>

          {/* Usage Bundle & Rights */}
          <SidebarSection title="Usage Bundle & Rights (Schedule)" icon={<HiInformationCircle className="w-4 h-4" />}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SelectWithInfo id="usageType" label="License Type" info="Organic Use or Paid Digital Use." value={usageType} onChange={(e: any) => { setUsageType(e.target.value); clearPreview(); }} options={LICENSE_TYPES} />
                <NumberInputTop
                  id="usageDuration"
                  label="Duration (months)"
                  info="Length of license from first go-live."
                  value={usageDurationMonths}
                  onChange={(v: number) => { setUsageDurationMonths(v); clearPreview(); }}
                  min={0}
                  error={formErrors.usageDurationMonths}
                  data-field-error={!!formErrors.usageDurationMonths}
                />
              </div>

              <div>
                <LabelWithInfo text="Geographies" info="Territories where the license applies." />
                <ReactSelect
                  instanceId="geo-select"
                  inputId="geo-select-input"
                  isMulti
                  options={GEO_OPTIONS}
                  value={GEO_OPTIONS.filter(o => usageGeographies.includes(o.value))}
                  onChange={(vals: any) => { setUsageGeographies((vals || []).map((v: any) => v.value)); clearPreview(); }}
                  placeholder="Select territories"
                  styles={{ control: (base) => ({ ...base, minHeight: "44px", borderRadius: 8 }) }}
                />
              </div>

              <Checkbox id="deriv-edits" label={<>Allow Derivative Edits <InfoTip text="Permit cut‑downs, captions, translations, thumbnails, metadata edits." /></>} checked={usageDerivativeEdits} onChange={setUsageDerivativeEdits} />
            </div>
          </SidebarSection>

          <div className="sticky bottom-0 -mx-6 -mb-6 bg-white/95 backdrop-blur border-t border-gray-200 p-6 flex flex-wrap justify-end gap-3">
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
              toast({ icon: "error", title: "Sign failed", text: e?.response?.data?.message || e?.message || "Could not sign contract." });
            }
          }}
        />
      </div>
    </TooltipProvider>
  );
}

/* ===============================================================
   Support UI components (visual tweaks only — same inputs)
   =============================================================== */
const LoadingSkeleton = ({ rows }: { rows: number }) => (
  <div className="p-6 space-y-2">{Array.from({ length: rows }).map((_, i) => (<Skeleton key={i} className="h-12 w-full rounded-md" />))}</div>
);

const ErrorMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (<p className="p-6 text-center text-red-600">{children}</p>);

export function FloatingLabelInput({ id, label, value, onChange, type = "text", error, info, ...props }: any) {
  const [focused, setFocused] = useState(false);
  const hasValue = value !== "" && value !== undefined && value !== null;
  return (
    <div className="relative" data-field-error={!!error}>
      <input id={id} type={type} value={value} onChange={onChange} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} className={`w-full px-4 pt-6 pb-2 border-2 rounded-lg text-sm transition-all duration-200 focus:outline-none peer ${error ? "border-red-500 focus:border-red-500" : "border-gray-200 focus:border-black"}`} placeholder=" " {...props} />
      <label htmlFor={id} className={`absolute left-4 transition-all duration-200 pointer-events-none inline-flex items-center gap-1 ${focused || hasValue ? "top-2 text-[11px] text-black font-medium" : "top-1/2 -translate-y-1/2 text-sm text-gray-500"}`}>
        <span>{label}</span>
        {info ? <span className="pointer-events-auto"><InfoTip text={String(info)} /></span> : null}
      </label>
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
}

export function Select({ id, label, value, onChange, options, disabled = false, error, info }: any) {
  const flat = (Array.isArray(options[0]) ? (options as any).flat() : (options as any)) as { value: string; label: string }[];
  return (
    <div className="space-y-1.5" data-field-error={!!error}>
      <label htmlFor={id} className="text-sm font-medium text-gray-700 inline-flex items-center gap-1">
        <span>{label}</span>
        {info ? <InfoTip text={String(info)} /> : null}
      </label>
      <select id={id} value={value} onChange={onChange} disabled={disabled} className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm focus:outline-none ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${error ? "border-red-500" : "focus:border-black border-gray-200"}`}>
        {flat.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}

export function SelectWithInfo({ id, label, info, value, onChange, options, disabled = false, error }: any) {
  return (
    <div className="space-y-1.5">
      <Select id={id} label={label} value={value} onChange={onChange} options={options} disabled={disabled} error={error} info={info} />
    </div>
  );
}

export function NumberInput({ id, label, value, onChange, min = 0, error, info, ...props }: any) {
  return (
    <div className="relative" data-field-error={!!error}>
      <input id={id} type="number" min={min} value={value} onChange={(e) => onChange(Math.max(min, Number(e.target.value || min)))} className={`w-full px-4 pt-6 pb-2 border-2 rounded-lg text-sm transition-all duration-200 focus:outline-none ${error ? "border-red-500 focus:border-red-500" : "border-gray-200 focus:border-black"}`} {...props} />
      <label htmlFor={id} className="absolute left-4 top-2 text-[11px] text-black font-medium pointer-events-none inline-flex items-center gap-1">
        <span>{label}</span>
        {info ? <span className="pointer-events-auto"><InfoTip text={String(info)} /></span> : null}
      </label>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
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
            aria-pressed={active}
            className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${active ? "border-black bg-gray-100" : "border-gray-300 bg-white hover:bg-gray-50"} ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}

export function ChipInput({ label, items, setItems, placeholder, validator, disabled = false, error }: any) {
  const [val, setVal] = useState("");
  const add = () => {
    if (disabled) return;
    const v = val.trim();
    if (!v) return;
    // Allow comma or newline separated pastes without changing fields
    const parts = v.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const validParts = validator ? parts.filter((p) => validator(p)) : parts;
    if (!validParts.length) return;
    setItems([...(items as string[]), ...validParts]);
    setVal(" ");
    setTimeout(() => setVal(""), 0);
  };
  const remove = (ix: number) => { if (disabled) return; setItems((items as string[]).filter((_: any, i: any) => i !== ix)); };
  return (
    <div className="space-y-1.5" data-field-error={!!error}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>
      <div className={`flex flex-wrap gap-2 rounded-lg border-2 p-2 ${disabled ? "opacity-60 cursor-not-allowed" : error ? "border-red-500" : "border-gray-200"}`}>
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

export function TextArea({ id, label, value, onChange, rows = 3, placeholder, disabled = false, error }: any) {
  return (
    <div className="space-y-1.5" data-field-error={!!error}>
      <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
      <textarea id={id} value={value} onChange={onChange} rows={rows} placeholder={placeholder} disabled={disabled} className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm focus:outline-none ${disabled ? "opacity-60 cursor-not-allowed" : error ? "border-red-500" : "focus:border-black border-gray-200"}`} />
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}

function ContractSidebar({ isOpen, onClose, children, title = "Initiate Contract", subtitle = "New Agreement", previewUrl }: any) {
  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"}`} role="dialog" aria-modal="true" aria-labelledby="contract-title">
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
                <div className="text-[11px] tracking-wide font-semibold uppercase/relaxed opacity-95 mb-1" id="contract-title">{title}</div>
                <div className="text-2xl font-extrabold leading-tight">{subtitle}</div>
              </div>
            </div>
            <button className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center transition-all duration-150 hover:scale-110" onClick={onClose} aria-label="Close" title="Close">✕</button>
          </div>
        </div>
        <div className="flex h-[calc(100%-9rem)]">
          {previewUrl ? (
            <div className="w-full sm:w-1/2 p-6 overflow-auto border-r border-gray-100">
              <iframe src={previewUrl} width="100%" height="100%" className="border-0" title="Contract PDF" />
            </div>
          ) : (
            <div className="hidden sm:flex w-1/2 p-6 items-center justify-center text-gray-400 select-none">
              <div className="text-center">
                <HiEye className="mx-auto w-8 h-8 mb-2" />
                <div className="text-sm">Generate a preview to see the PDF here</div>
              </div>
            </div>
          )}
          <div className={`${previewUrl ? "w-full sm:w-1/2" : "w-full"} h-full px-6 space-y-5 overflow-auto`}>{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ======================
   Signature Modal (drag‑and‑drop polish without new fields)
   ====================== */
function SignatureModal({ isOpen, onClose, onSigned }: { isOpen: boolean; onClose: () => void; onSigned: (signatureDataUrl: string) => Promise<void> | void; }) {
  const [sigDataUrl, setSigDataUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const dropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { if (!isOpen) { setSigDataUrl(""); setError(""); } }, [isOpen]);

  const handleFile = (file?: File | null) => {
    setError("");
    if (!file) return;
    if (!/image\/(png|jpeg)/i.test(file.type)) return setError("Please upload a PNG or JPG.");
    if (file.size > 50 * 1024) return setError("Signature must be ≤ 50 KB.");
    const reader = new FileReader(); reader.onload = () => setSigDataUrl(reader.result as string); reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!isOpen) return;
    const el = dropRef.current;
    if (!el) return;
    const onDrag = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const f = e.dataTransfer?.files?.[0];
      handleFile(f || null);
    };
    el.addEventListener("dragover", onDrag);
    el.addEventListener("drop", onDrop);
    return () => {
      el.removeEventListener("dragover", onDrag);
      el.removeEventListener("drop", onDrop);
    };
  }, [isOpen]);

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
          <div ref={dropRef} className="rounded-lg border-2 border-dashed border-gray-300 p-4 text-center text-sm text-gray-600">
            Drag & drop here, or use the picker below.
          </div>
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

/* ======================
   Tiny helpers: labels + tooltips
   ====================== */
function LabelWithInfo({ text, info }: { text: React.ReactNode; info?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
      {text}
      {info ? <InfoTip text={String(info)} /> : null}
    </span>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex items-center" aria-label="Info">
          <HiInformationCircle className="w-4 h-4 text-gray-500" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="center" className="max-w-xs text-sm leading-relaxed">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function NumberInputTop({ id, label, value, onChange, min = 0, error, info, ...props }: any) {
  return (
    <div className="space-y-1.5" data-field-error={!!error}>
      <label htmlFor={id} className="text-sm font-medium text-gray-700 inline-flex items-center gap-1">
        <span>{label}</span>
        {info ? <InfoTip text={String(info)} /> : null}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value || min)))}
        className={`w-full h-[44px] px-3 border-2 rounded-lg text-sm focus:outline-none focus:border-black ${error ? "border-red-500" : "border-gray-200"}`}
        {...props}
      />
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}

const BTN_GRAD =
  "bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF7236] hover:to-[#FFA135] shadow-none";
const BTN_OUTLINE = "border-gray-300 text-black";
const BTN_BASE = "h-9 px-3 rounded-lg"; // same height for all action buttons


function ActionButton({
  onClick,
  title,
  disabled,
  variant = "outline",
  icon: Icon,
  children,
  className = "",
}: {
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  variant?: "outline" | "grad" | "default";
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  children: React.ReactNode;
  className?: string;
}) {
  const base = `${BTN_BASE} ${className}`;
  const variantClass =
    variant === "grad"
      ? BTN_GRAD
      : variant === "outline"
        ? `border ${BTN_OUTLINE} bg-white`
        : "bg-white text-black";

  const BtnInner = (
    <Button
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variantClass}`}
      variant="outline"
    >
      {Icon ? <Icon className="mr-1 h-4 w-4" /> : null}
      {/* Text hidden on very small screens so rows stay tidy, visible on md+ */}
      <span className="hidden sm:inline">{children}</span>
    </Button>
  );

  return title ? (
    <Tooltip>
      <TooltipTrigger asChild>{BtnInner}</TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {title}
      </TooltipContent>
    </Tooltip>
  ) : (
    BtnInner
  );
}

