"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
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
} from "react-icons/hi";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import dynamic from "next/dynamic";

/* ===============================================================
   THEME
   =============================================================== */
const GRADIENT_FROM = "#FFA135";
const GRADIENT_TO = "#FF7236";

const MILESTONE_SPLIT_PRESETS = [
  { value: "100", label: "100% on completion" },
  { value: "50/50", label: "50% upfront / 50% on completion" },
  { value: "30/70", label: "30% on signing / 70% on completion" },
  { value: "40/30/30", label: "40% / 30% / 30%" },
  { value: "custom", label: "Custom split…" },
] as const;

const ReactSelect = dynamic(() => import("react-select"), { ssr: false });

// ✅ Canonical contract statuses (match backend constants/contract.js)
const CONTRACT_STATUS = {
  DRAFT: "DRAFT",
  BRAND_SENT_DRAFT: "BRAND_SENT_DRAFT",
  BRAND_EDITED: "BRAND_EDITED",
  INFLUENCER_EDITED: "INFLUENCER_EDITED",
  BRAND_ACCEPTED: "BRAND_ACCEPTED",
  INFLUENCER_ACCEPTED: "INFLUENCER_ACCEPTED",
  READY_TO_SIGN: "READY_TO_SIGN",
  CONTRACT_SIGNED: "CONTRACT_SIGNED",
  MILESTONES_CREATED: "MILESTONES_CREATED",
  REJECTED: "REJECTED",
  SUPERSEDED: "SUPERSEDED",
} as const;

export type ContractStatus =
  (typeof CONTRACT_STATUS)[keyof typeof CONTRACT_STATUS];

const buildReactSelectStyles = (opts?: { hasError?: boolean }) => {
  const hasError = opts?.hasError;
  return {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: 44,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: hasError
        ? "#ef4444"
        : state.isFocused
          ? "#FF8A35"
          : "#e5e7eb",
      boxShadow: state.isFocused
        ? "0 0 0 1px #FF8A35, 0 0 0 3px rgba(255,138,53,0.35)"
        : "none",
      "&:hover": {
        borderColor: hasError
          ? "#ef4444"
          : state.isFocused
            ? "#FF8A35"
            : "#e5e7eb",
      },
    }),
    valueContainer: (base: any) => ({
      ...base,
      padding: "0 12px",
    }),
    indicatorsContainer: (base: any) => ({
      ...base,
      minHeight: 44,
    }),
    input: (base: any) => ({
      ...base,
      margin: 0,
      padding: 0,
    }),
    multiValue: (base: any) => ({
      ...base,
      borderRadius: 9999,
      paddingLeft: 4,
      paddingRight: 4,
    }),
  };
};

/* ===============================================================
   Types
   =============================================================== */
interface Influencer {
  influencerId: string;
  name: string;
  primaryPlatform?: "instagram" | "tiktok" | "youtube" | string | null;
  handle: string | null;
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

  status: ContractStatus | string;

  lastSentAt?: string;
  lockedAt?: string | null;

  confirmations?: { brand?: PartyConfirm; influencer?: PartyConfirm };
  signatures?: {
    brand?: PartySign;
    influencer?: PartySign;
  };

  resendIteration?: number;
  audit?: AuditEvent[];
  flags?: Record<string, any>;
  statusFlags?: Record<string, any>;
  brand?: any;
}

type CurrencyOption = { value: string; label: string; meta?: any };
type TzOption = { value: string; label: string; meta?: any };

type PanelMode = "send" | "edit";
type FormErrors = Record<string, string>;

// Per-row deliverable data
interface DeliverableRow {
  id: string;
  type: string;
  quantity: string;
  format: string;
  durationSec: string;
  minLiveValue: string;
  minLiveUnit: "hours" | "months";

  // per-deliverable settings
  draftRequired: boolean;
  draftDue: string; // yyyy-mm-dd
  captions: string;
  disclosures: string;
  tags: string[];
  links: string[];
  handles: string[];

  // NEW: per-deliverable usage toggles
  whitelistingEnabled: boolean;
  sparkAdsEnabled: boolean;
  insightsReadOnly: boolean;
}

/* ===============================================================
   Utilities
   =============================================================== */
const toast = (opts: {
  icon: "success" | "error" | "info";
  title: string;
  text?: string;
}) =>
  Swal.fire({
    ...opts,
    showConfirmButton: false,
    timer: 1600,
    timerProgressBar: true,
    background: "white",
    customClass: { popup: "rounded-lg border border-gray-200" },
  });

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
    case "instagram":
      return `https://instagram.com/${raw}`;
    case "tiktok":
      return `https://www.tiktok.com/@${raw}`;
    case "youtube":
    default:
      return `https://www.youtube.com/@${raw}`;
  }
};

const isRejectedMeta = (meta?: any) => {
  if (!meta) return false;
  const s = String(meta.status || "").toUpperCase();
  return (
    s === CONTRACT_STATUS.REJECTED ||
    meta.isRejected === 1 ||
    meta.flags?.isRejected ||
    meta.statusFlags?.isRejected
  );
};

const signingStatusLabel = (meta?: ContractMeta | null) => {
  if (!meta) return null;
  const s = String(meta.status || "");
  if (s !== CONTRACT_STATUS.READY_TO_SIGN) return null;

  const b = !!meta.signatures?.brand?.signed;
  const i = !!meta.signatures?.influencer?.signed;

  if (b && !i) return "Awaiting influencer signature";
  if (!b && i) return "Awaiting brand signature";
  if (!b && !i) return "Ready to sign";
  if (b && i) return "Signed"; // ✅ fully signed now (no CollabGlam)
  return null;
};

const getRejectReasonFromMeta = (meta: ContractMeta | null): string | null => {
  if (!meta) return null;
  const events: AuditEvent[] = Array.isArray(meta.audit) ? meta.audit : [];
  const lastRejected = [...events]
    .reverse()
    .find((ev) => (ev.type || "").toUpperCase() === "REJECTED");
  return lastRejected?.details?.reason
    ? String(lastRejected.details.reason).trim()
    : null;
};

const mapPlatformToApi = (p?: string | null) => {
  switch ((p || "").toLowerCase()) {
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    case "youtube":
    default:
      return "YouTube";
  }
};

const getCategoryLabel = (inf: any) => {
  const pick = (...vals: any[]) =>
    vals.find((v) => typeof v === "string" && v.trim());
  const fromObj = (o?: any) =>
    o && typeof o.name === "string" && o.name.trim() ? o.name : "";
  const direct = pick(
    inf.category,
    inf.category_name,
    inf.categoryTitle,
    inf.primaryCategory,
    inf.niche,
    inf.vertical
  );
  if (direct) return direct;
  const obj =
    fromObj(inf.category) ||
    fromObj(inf.primary_category) ||
    fromObj(inf.influencerCategory);
  if (obj) return obj;
  const arr =
    inf.categories || inf.category_list || inf.influencerCategories || [];
  if (Array.isArray(arr) && arr.length) {
    const names = arr.map(fromObj).filter(Boolean);
    if (names.length) return names.join(", ");
  }
  return "—";
};

const sanitizeHandle = (h: string) => {
  const t = (h || "").trim();
  if (!t) return t;
  return t.startsWith("@") ? t : `@${t}`;
};

const createRowId = () => Math.random().toString(36).slice(2);

const isLockedStatus = (status?: string | null) =>
  status === CONTRACT_STATUS.CONTRACT_SIGNED ||
  status === CONTRACT_STATUS.MILESTONES_CREATED;

const isEditableStatus = (status?: string | null) =>
  status === CONTRACT_STATUS.BRAND_SENT_DRAFT ||
  status === CONTRACT_STATUS.BRAND_EDITED ||
  status === CONTRACT_STATUS.INFLUENCER_EDITED;

const needsBrandAcceptance = (status?: string | null) =>
  status === CONTRACT_STATUS.INFLUENCER_ACCEPTED;

const canSignNow = (status?: string | null) =>
  status === CONTRACT_STATUS.READY_TO_SIGN;

const statusLabel = (status?: string | null) => {
  switch (status) {
    case CONTRACT_STATUS.BRAND_SENT_DRAFT:
      return "Draft sent to influencer";
    case CONTRACT_STATUS.BRAND_EDITED:
      return "Brand edited (awaiting influencer)";
    case CONTRACT_STATUS.INFLUENCER_EDITED:
      return "Influencer requested changes";
    case CONTRACT_STATUS.INFLUENCER_ACCEPTED:
      return "Influencer accepted";
    case CONTRACT_STATUS.BRAND_ACCEPTED:
      return "Brand accepted";
    case CONTRACT_STATUS.READY_TO_SIGN:
      return "Ready to sign";
    case CONTRACT_STATUS.CONTRACT_SIGNED:
      return "Signed";
    case CONTRACT_STATUS.MILESTONES_CREATED:
      return "Milestones created";
    default:
      return status ? String(status) : "—";
  }
};

/* ===============================================================
   FDD-driven helpers
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
const TEXT_ONLY_TYPES = new Set([
  "Custom Deliverable (Text)",
  "Text (caption only)",
]);

/* ===============================================================
   Constants for Usage Bundle & Geographies
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

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

const DELIVERABLE_TYPE_OPTIONS = [
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
];

/* ===============================================================
   Main Page Component
   =============================================================== */
export default function AppliedInfluencersPage() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id");
  const influencerId = searchParams.get("infId");
  const createdPage = searchParams.get("createdPage") === "true";


  const [serverBudget, setServerBudget] = useState<number | null>(null);
  const [serverTimeline, setServerTimeline] = useState<{
    startDate?: string | Date;
    endDate?: string | Date;
  } | null>(null);

  const router = useRouter();
  const [highlightInfId, setHighlightInfId] = useState<string | null>(null);

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
  const [pdfUrl, setPdfUrl] = useState<string>("");

  // Cache of latest contract meta per influencer
  const [metaCache, setMetaCache] = useState<Record<string, ContractMeta | null>>(
    {}
  );
  const [metaCacheLoading, setMetaCacheLoading] = useState(false);

  // Form (brand)
  const [campaignTitle, setCampaignTitle] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [goLiveStart, setGoLiveStart] = useState("");
  const [goLiveEnd, setGoLiveEnd] = useState("");
  const [totalFee, setTotalFee] = useState<string>("");
  const [currency, setCurrency] = useState("USD");
  const [milestoneSplit, setMilestoneSplit] = useState("50/50");
  const [revisionsIncluded, setRevisionsIncluded] = useState<string>("1");

  const milestonePreset = useMemo(() => {
    const match = MILESTONE_SPLIT_PRESETS.find(
      (p) => p.value === milestoneSplit
    );
    return match ? match.value : "custom";
  }, [milestoneSplit]);

  // Deliverables list (per row)
  const [deliverables, setDeliverables] = useState<DeliverableRow[]>([
    {
      id: createRowId(),
      type: "Video",
      quantity: "1",
      format: "",
      durationSec: "",
      minLiveValue: "",
      minLiveUnit: "hours",
      draftRequired: false,
      draftDue: "",
      captions: "",
      disclosures: "",
      tags: [],
      links: [],
      handles: [],
      whitelistingEnabled: false,
      sparkAdsEnabled: false,
      insightsReadOnly: false,
    },
  ]);

  // Usage Bundle
  const [usageType, setUsageType] = useState<string>("Organic");
  const [usageDurationMonths, setUsageDurationMonths] = useState<string>("12");
  const [usageGeographies, setUsageGeographies] = useState<string[]>([
    "Worldwide",
  ]);
  const [usageDerivativeEdits, setUsageDerivativeEdits] =
    useState<boolean>(false);

  // Requested Effective Date
  const [requestedEffDate, setRequestedEffDate] = useState<string>("");
  const [requestedEffTz, setRequestedEffTz] =
    useState<string>("America/Los_Angeles");

  // currency & timezone options
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>([]);
  const [tzOptions, setTzOptions] = useState<TzOption[]>([]);
  const [listsLoading, setListsLoading] = useState(true);

  // Brand signer identity
  const signerName =
    (typeof window !== "undefined" &&
      (localStorage.getItem("brandContactName") ||
        localStorage.getItem("brandName") ||
        "")) ||
    "";
  const signerEmail =
    (typeof window !== "undefined" &&
      (localStorage.getItem("brandEmail") || "")) ||
    "";

  // Signature modal
  const [signOpen, setSignOpen] = useState(false);
  const [signTargetMeta, setSignTargetMeta] = useState<ContractMeta | null>(
    null
  );

  // Form errors
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const clearErrors = () => setFormErrors({});
  const setErr = (key: string, msg: string) =>
    setFormErrors((e) => ({ ...e, [key]: msg }));

  // Loading states for actions
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSendLoading, setIsSendLoading] = useState(false);
  const [isUpdateLoading, setIsUpdateLoading] = useState(false);

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

  /* ---------------- Helpers: dates ---------------- */
  const toInputDate = (v?: string | Date | null) => {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const parseDateOnly = (s?: string) => (s ? new Date(s + "T00:00:00") : null);

  const formatDateLong = (s?: string) => {
    if (!s) return "";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const todayStr = toInputDate(new Date());
  const startMin = todayStr;
  const endMin = goLiveStart || todayStr;
  const startMax = goLiveEnd || "";
  const effMin = todayStr;
  const effMax = goLiveEnd || "";
  const draftMin = todayStr;
  const draftMax = goLiveStart || "";

  /* ---------------- Seed campaign summary ---------------- */
  useEffect(() => {
    if (!campaignId) return;

    (async () => {
      try {
        const res: any = await api.get("/campaign/campaignSummary", {
          params: { id: campaignId },
        });
        const d = res?.data || res || {};
        const name = d.campaignName || "";
        const budgetNum =
          typeof d.budget === "number" ? d.budget : Number(d.budget ?? NaN);

        setCampaignTitle(name);

        if (!Number.isNaN(budgetNum)) {
          setServerBudget(budgetNum);
          setTotalFee(String(budgetNum));
        }

        if (d.timeline) {
          const start = d.timeline.startDate
            ? toInputDate(new Date(d.timeline.startDate))
            : "";
          const end = d.timeline.endDate
            ? toInputDate(new Date(d.timeline.endDate))
            : "";
          setServerTimeline(d.timeline);
          if (start) setGoLiveStart(start);
          if (end) setGoLiveEnd(end);
          if (!requestedEffDate && start) setRequestedEffDate(start);
        }
      } catch (e: any) {
        toast({
          icon: "error",
          title: "Failed to load campaign",
          text:
            e?.response?.data?.message ||
            e?.message ||
            "Could not fetch campaign summary.",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  /* ---------------- Debounce search ---------------- */
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  /* ---------------- Keyboard shortcuts ---------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        target?.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT";

      // Don't hijack / when user is typing in a field
      if (isEditable) return;

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
        const curArr: any[] =
          (curRes?.data?.currencies ||
            curRes?.currencies ||
            curRes ||
            []) as any[];
        const curOpts: CurrencyOption[] = curArr.map((c) => {
          const code = (c.code || c.symbol || "").toString();
          return {
            value: code,
            label: c.name ? `${code} — ${c.name}` : code,
            meta: c,
          };
        });

        const tzRes: any = await api.get("/contract/timezones");
        const tzArr: any[] =
          (tzRes?.data?.timezones || tzRes?.timezones || tzRes || []) as any[];
        const tzOpts: TzOption[] = tzArr.map((t) => {
          const canonical =
            Array.isArray(t.utc) && t.utc.length ? t.utc[0] : t.value;
          const label = t.text || t.value;
          return { value: canonical, label, meta: t };
        });

        if (!alive) return;
        setCurrencyOptions(curOpts);
        setTzOptions(tzOpts);
      } catch (e: any) {
        toast({
          icon: "error",
          title: "Lists failed",
          text: e?.message || "Could not load currency/timezones.",
        });
      } finally {
        if (alive) setListsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ---------------- Chat ---------------- */
  const handleViewMessage = async (inf?: Influencer) => {
    const target = inf || selectedInf;
    if (!target) return;

    const brandId =
      typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
    if (!brandId) {
      return toast({
        icon: "error",
        title: "Not ready",
        text: "Missing brandId. Please sign in as a brand.",
      });
    }

    try {
      const res: any = await post("/chat/create-room", {
        brandId,
        influencerId: target.influencerId,
      });

      const roomId = res?.roomId || res?.data?.roomId;
      if (!roomId) throw new Error("Room could not be created");

      router.push(`/brand/messages/${encodeURIComponent(roomId)}`);
    } catch (e: any) {
      toast({
        icon: "error",
        title: "Open chat failed",
        text:
          e?.response?.data?.message ||
          e?.message ||
          "Could not open messages.",
      });
    }
  };

  /* ---------------- Applicants load ---------------- */
  const fetchApplicants = useCallback(
    async (search?: string) => {
      if (!campaignId) return;
      setLoading(true);
      setError(null);
      try {
        const payload = {
          campaignId,
          page,
          limit,
          search: (search ?? searchTerm).trim(),
          sortField,
          sortOrder,
          createdPage,
        };
        const res: any = await post("/apply/list", payload);
        const influencersList =
          res?.influencers || res?.data?.influencers || res?.data?.data || [];
        const applicantCountVal =
          res?.applicantCount ||
          res?.data?.applicantCount ||
          influencersList?.length ||
          0;
        const metaVal =
          res?.meta ||
          res?.data?.meta || {
            total: 0,
            page: 1,
            limit,
            totalPages: 1,
          };
        setInfluencers(influencersList || []);
        setApplicantCount(applicantCountVal || 0);
        setMeta(metaVal);
      } catch (e: any) {
        setError(
          e?.response?.data?.message ||
          e?.message ||
          "Failed to load applicants."
        );
      } finally {
        setLoading(false);
      }
    },
    [campaignId, page, limit, sortField, sortOrder, searchTerm]
  );

  useEffect(() => {
    fetchApplicants(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, page, debouncedSearch, sortField, sortOrder]);

  /* ---------------- Highlight influencer from URL ---------------- */
  useEffect(() => {
    if (!influencerId) return;
    if (!influencers.length) return;

    const exists = influencers.some(
      (inf) => String(inf.influencerId) === String(influencerId)
    );
    if (!exists) return;

    setHighlightInfId(influencerId);

    const el =
      document.getElementById(`inf-row-${influencerId}`) ||
      document.getElementById(`inf-card-${influencerId}`);

    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const timeout = setTimeout(() => setHighlightInfId(null), 4000);
    return () => clearTimeout(timeout);
  }, [influencerId, influencers]);

  /* ---------------- Contract meta cache ---------------- */
  const getLatestContractFor = async (
    inf: Influencer
  ): Promise<ContractMeta | null> => {
    const brandId =
      typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
    if (!brandId) return null;
    try {
      const res = await post("/contract/getContract", {
        brandId,
        influencerId: inf.influencerId,
        campaignId,
      });
      const list =
        (res as any)?.contracts || (res as any)?.data?.contracts || [];
      const filtered = (list as ContractMeta[]).filter(
        (c) => String(c.campaignId) === String(campaignId)
      );
      return filtered.length
        ? filtered[0]
        : (list as ContractMeta[]).length
          ? (list as ContractMeta[])[0]
          : null;
    } catch (e: any) {
      toast({
        icon: "error",
        title: "Meta fetch failed",
        text:
          e?.response?.data?.message ||
          e?.message ||
          "Could not get contract meta.",
      });
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
      list.forEach((inf, i) => {
        next[inf.influencerId] = metas[i] || null;
      });
      setMetaCache(next);
    } catch (e: any) {
      toast({
        icon: "error",
        title: "Meta cache failed",
        text: e?.message || "Unable to build contract cache.",
      });
    } finally {
      setMetaCacheLoading(false);
    }
  };

  useEffect(() => {
    loadMetaCache(influencers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [influencers]);

  /* ---------------- Helpers ---------------- */
  const clearPreview = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl("");
  };

  const prefillFormFor = (inf: Influencer, meta?: ContractMeta | null) => {
    clearErrors();

    setCampaignTitle((prev) => prev || "");
    setPlatforms(
      inf?.primaryPlatform ? [mapPlatformToApi(inf.primaryPlatform) as string] : []
    );

    if (serverTimeline?.startDate || serverTimeline?.endDate) {
      const start = serverTimeline?.startDate
        ? toInputDate(serverTimeline.startDate)
        : "";
      const end = serverTimeline?.endDate
        ? toInputDate(serverTimeline.endDate)
        : "";
      setGoLiveStart(start);
      setGoLiveEnd(end);
    } else {
      setGoLiveStart("");
      setGoLiveEnd("");
    }

    const initialFee = String(serverBudget ?? inf.feeAmount ?? 5000);
    setTotalFee(initialFee);
    setCurrency("USD");

    setMilestoneSplit("50/50");
    setRevisionsIncluded("1");

    // default single deliverable row
    setDeliverables([
      {
        id: createRowId(),
        type: "Video",
        quantity: "1",
        format: "",
        durationSec: "",
        minLiveValue: "",
        minLiveUnit: "hours",
        draftRequired: false,
        draftDue: "",
        captions: "",
        disclosures: "",
        tags: [],
        links: [],
        handles: inf.handle ? [sanitizeHandle(inf.handle)] : [],
        whitelistingEnabled: false,
        sparkAdsEnabled: false,
        insightsReadOnly: false,
      },
    ]);

    setUsageType("Organic");
    setUsageDurationMonths("12");
    setUsageGeographies(["Worldwide"]);
    setUsageDerivativeEdits(false);

    const start = serverTimeline?.startDate ? toInputDate(serverTimeline.startDate) : "";
    const startDefault = start || toInputDate(new Date());
    setRequestedEffDate(startDefault);
    setRequestedEffTz("Europe/Amsterdam");

    if (meta && meta.brand) {
      const brand = meta.brand;

      if (typeof brand.campaignTitle === "string")
        setCampaignTitle(String(brand.campaignTitle));

      if (Array.isArray(brand.platforms) && brand.platforms.length)
        setPlatforms((brand.platforms as string[]).map((p) => String(p || "")));

      if (brand.goLive) {
        setGoLiveStart(toInputDate((brand.goLive as any).start));
        setGoLiveEnd(toInputDate((brand.goLive as any).end));
      }

      if (brand.totalFee !== undefined && brand.totalFee !== null)
        setTotalFee(String(brand.totalFee));

      if (brand.currency) setCurrency(String(brand.currency));
      if (brand.milestoneSplit) setMilestoneSplit(String(brand.milestoneSplit));

      if (
        brand.revisionsIncluded !== undefined &&
        brand.revisionsIncluded !== null
      )
        setRevisionsIncluded(String(brand.revisionsIncluded));

      if (brand.requestedEffectiveDate)
        setRequestedEffDate(toInputDate(brand.requestedEffectiveDate));
      if (brand.requestedEffectiveDateTimezone)
        setRequestedEffTz(String(brand.requestedEffectiveDateTimezone));

      if (brand.usageBundle) {
        const ub = brand.usageBundle;
        if (ub.type) setUsageType(String(ub.type));
        if (ub.durationMonths !== undefined && ub.durationMonths !== null)
          setUsageDurationMonths(String(ub.durationMonths));
        if (Array.isArray(ub.geographies))
          setUsageGeographies(ub.geographies.map((g: any) => String(g)));
        if (typeof ub.derivativeEditsAllowed === "boolean")
          setUsageDerivativeEdits(Boolean(ub.derivativeEditsAllowed));
      }

      const expanded = brand.deliverablesExpanded;
      if (Array.isArray(expanded) && expanded.length) {
        const mapped: DeliverableRow[] = expanded.map((d: any, index: number) => {
          const minLiveHours: number =
            typeof d.minLiveHours === "number" ? d.minLiveHours : 0;
          let minLiveValue = "";
          let minLiveUnit: "hours" | "months" = "hours";

          if (minLiveHours > 0) {
            if (minLiveHours % 720 === 0) {
              minLiveUnit = "months";
              minLiveValue = String(minLiveHours / 720);
            } else {
              minLiveUnit = "hours";
              minLiveValue = String(minLiveHours);
            }
          }

          return {
            id: `${String(d.type || "row")}-${index}-${d.quantity ?? 1}`,
            type: String(d.type || "Video"),
            quantity:
              d.quantity !== undefined && d.quantity !== null
                ? String(d.quantity)
                : "1",
            format: d.format ? String(d.format) : "",
            durationSec:
              d.durationSec !== undefined && d.durationSec !== null
                ? String(d.durationSec)
                : "",
            minLiveValue,
            minLiveUnit,
            draftRequired: Boolean(d.draftRequired),
            draftDue: d.draftDueDate ? toInputDate(d.draftDueDate) : "",
            captions: d.captions ? String(d.captions) : "",
            disclosures:
              typeof d.disclosures === "string" ? d.disclosures : "",
            tags: Array.isArray(d.tags)
              ? d.tags.map((t: any) => String(t))
              : [],
            links: Array.isArray(d.links)
              ? d.links.map((l: any) => String(l))
              : [],
            handles: Array.isArray(d.handles)
              ? d.handles.map((h: any) => sanitizeHandle(String(h)))
              : inf.handle
                ? [sanitizeHandle(inf.handle)]
                : [],
            whitelistingEnabled:
              typeof d.whitelistingEnabled === "boolean"
                ? d.whitelistingEnabled
                : false,
            sparkAdsEnabled:
              typeof d.sparkAdsEnabled === "boolean"
                ? d.sparkAdsEnabled
                : false,
            insightsReadOnly:
              typeof d.insightsReadOnly === "boolean"
                ? d.insightsReadOnly
                : false,
          };
        });

        setDeliverables(mapped);
      }
    }
  };

  // toggle-specific support by platform (row-level uses this as proxy)
  const supportsSparkAds = platforms.includes("TikTok");
  const supportsWhitelisting =
    platforms.includes("Instagram") || platforms.includes("TikTok");

  // If a platform no longer supports a toggle, force it off on all rows
  useEffect(() => {
    if (!supportsSparkAds || !supportsWhitelisting) {
      setDeliverables((prev) =>
        prev.map((row) => ({
          ...row,
          sparkAdsEnabled: supportsSparkAds ? row.sparkAdsEnabled : false,
          whitelistingEnabled: supportsWhitelisting
            ? row.whitelistingEnabled
            : false,
        }))
      );
    }
  }, [supportsSparkAds, supportsWhitelisting]);

  const updateBtnLabel =
    selectedMeta && isRejectedMeta(selectedMeta)
      ? "Resend Contract"
      : "Update Contract";

  const openSidebar = async (inf: Influencer, mode: PanelMode) => {
    setSelectedInf(inf);
    setPanelMode(mode);
    const meta = metaCache[inf.influencerId] ?? (await getLatestContractFor(inf));
    setSelectedMeta(meta || null);
    prefillFormFor(inf, meta || null);
    clearPreview();
    setSidebarOpen(true);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
    clearPreview();
    setSelectedInf(null);
    setSelectedMeta(null);
    setIsPreviewLoading(false);
    setIsSendLoading(false);
    setIsUpdateLoading(false);
  };

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [sidebarOpen]);

  /* ---------------- Build payload ---------------- */
  const buildBrandPayload = () => {
    const toLocalMidnight = (d: string) => new Date(d + "T00:00:00");

    const goLive =
      goLiveStart || goLiveEnd
        ? {
          start: goLiveStart ? toLocalMidnight(goLiveStart) : undefined,
          end: goLiveEnd ? toLocalMidnight(goLiveEnd) : undefined,
        }
        : undefined;

    const feeNum = Number(totalFee || "0");
    const revisionsNum = Number(revisionsIncluded || "0");
    const usageDurationNum = Number(usageDurationMonths || "0");

    const isVideoRowType = (type: string, format: string) => {
      const isTextOnly =
        TEXT_ONLY_TYPES.has(type) ||
        (format || "").toLowerCase().startsWith("text ");
      return VIDEO_TYPES.has(type) && !isTextOnly;
    };

    const deliverablesExpanded =
      deliverables.length > 0
        ? deliverables.map((row) => {
          const qtyNum = Number(row.quantity || "0");
          const durNum = Number(row.durationSec || "0");
          const isVideoRow = isVideoRowType(row.type, row.format);

          const minLiveHoursNum =
            row.minLiveUnit === "months"
              ? (Number(row.minLiveValue || "0") || 0) * 720
              : Number(row.minLiveValue || "0") || 0;

          const rowTags = (row.tags || []).map((t) =>
            t.startsWith("#") ? t : `#${t}`
          );
          const rowLinks = (row.links || []).filter((l) =>
            /^https?:\/\/.+/i.test(l)
          );
          const rowHandles = (row.handles || [])
            .map(sanitizeHandle)
            .filter(Boolean);

          return {
            type: row.type || "Video",
            quantity: Number.isFinite(qtyNum) ? qtyNum : 0,
            format: row.format,
            durationSec:
              isVideoRow && Number.isFinite(durNum) ? durNum : 0,
            postingWindow: goLive || { start: undefined, end: undefined },
            draftRequired: Boolean(row.draftRequired),
            draftDueDate: row.draftDue || undefined,
            minLiveHours: minLiveHoursNum,
            tags: rowTags,
            handles: rowHandles,
            captions: row.captions,
            links: rowLinks,
            disclosures: row.disclosures,
            whitelistingEnabled: row.whitelistingEnabled,
            sparkAdsEnabled: row.sparkAdsEnabled,
            insightsReadOnly: row.insightsReadOnly,
          };
        })
        : [];

    return {
      campaignTitle,
      platforms,
      ...(goLive ? { goLive } : {}),
      totalFee: Number.isFinite(feeNum) ? feeNum : 0,
      currency,
      milestoneSplit,
      revisionsIncluded: Number.isFinite(revisionsNum) ? revisionsNum : 0,
      usageBundle: {
        type: usageType,
        durationMonths: Number.isFinite(usageDurationNum)
          ? usageDurationNum
          : 0,
        geographies: usageGeographies,
        derivativeEditsAllowed: Boolean(usageDerivativeEdits),
      },
      deliverablesPresetKey: "ui-manual",
      deliverablesExpanded,
      ...(requestedEffDate ? { requestedEffectiveDate: requestedEffDate } : {}),
      ...(requestedEffTz
        ? { requestedEffectiveDateTimezone: requestedEffTz }
        : {}),
    };
  };

  /* ---------------- Validation helpers ---------------- */
  const parseMilestoneSplit = (s: string): number[] => {
    if (!s) return [];
    return s
      .split("/")
      .map((x) => x.replace(/%/g, "").trim())
      .filter(Boolean)
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n));
  };

  const scrollFirstErrorIntoView = () => {
    const first = document.querySelector(
      "[data-field-error=true]"
    ) as HTMLElement | null;
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const validateForPreview = (): boolean => {
    clearErrors();
    let ok = true;
    const add = (k: string, msg: string) => {
      ok = false;
      setErr(k, msg);
    };

    const today = parseDateOnly(todayStr)!;
    const start = parseDateOnly(goLiveStart || undefined);
    const end = parseDateOnly(goLiveEnd || undefined);

    if (!campaignTitle.trim())
      add("campaignTitle", "Campaign title is required.");
    if (!platforms.length) add("platforms", "Select at least one platform.");

    if (start && start < today)
      add("goLiveStart", "Start date must be today or later.");
    if (end && end < today)
      add("goLiveEnd", "End date must be today or later.");
    if (start && end && start > end)
      add("goLiveEnd", "End must be on/after Start.");

    if (requestedEffDate) {
      const eff = parseDateOnly(requestedEffDate)!;
      if (eff < today)
        add("requestedEffDate", "Requested date cannot be before today.");
      if (end && eff > end)
        add(
          "requestedEffDate",
          "Requested date must be on/before Posting Window End."
        );
    }

    const feeNum = Number(totalFee || "");
    if (!totalFee.trim() || Number.isNaN(feeNum) || feeNum < 0)
      add("totalFee", "Enter a valid non-negative fee.");
    if (!currency) add("currency", "Choose a currency.");

    const parts = parseMilestoneSplit(milestoneSplit);
    if (!parts.length)
      add("milestoneSplit", "Use a percentage split like 50/50 or 100.");
    if (parts.some((p) => p < 0 || p > 100))
      add("milestoneSplit", "Each percentage must be between 0 and 100.");
    const sum = parts.reduce((a, b) => a + b, 0);
    if (sum > 100) add("milestoneSplit", "Split total must be ≤ 100%.");

    // Deliverables validation
    if (!deliverables.length) {
      add("deliverables", "Add at least one deliverable.");
    } else {
      const messages: string[] = [];
      const isVideoRowType = (type: string, format: string) => {
        const isTextOnly =
          TEXT_ONLY_TYPES.has(type) ||
          (format || "").toLowerCase().startsWith("text ");
        return VIDEO_TYPES.has(type) && !isTextOnly;
      };

      deliverables.forEach((row, idx) => {
        const idxLabel = `Deliverable #${idx + 1}`;

        // Type
        if (!row.type) {
          messages.push(`${idxLabel}: Type is required.`);
        }

        // Quantity
        const qtyNum = Number(row.quantity || "");
        if (!row.quantity.trim() || Number.isNaN(qtyNum) || qtyNum < 1) {
          messages.push(`${idxLabel}: Quantity must be at least 1.`);
        }

        // Duration (for video)
        const isVideoRow = isVideoRowType(row.type, row.format);
        if (isVideoRow) {
          const durNum = Number(row.durationSec || "");
          if (!row.durationSec.trim() || Number.isNaN(durNum) || durNum <= 0) {
            messages.push(
              `${idxLabel}: Duration (sec) must be > 0 for video type.`
            );
          }
        }

        // Minimum Live
        if (row.minLiveValue) {
          const liveNum = Number(row.minLiveValue);
          if (Number.isNaN(liveNum) || liveNum < 0) {
            messages.push(
              `${idxLabel}: Minimum Live must be a non-negative number.`
            );
          }
        }

        // Draft per deliverable
        if (row.draftRequired && !row.draftDue) {
          messages.push(
            `${idxLabel}: Draft due date is required when a draft is required.`
          );
        }
        if (row.draftDue) {
          const draft = parseDateOnly(row.draftDue)!;
          if (draft < today) {
            messages.push(
              `${idxLabel}: Draft due cannot be before today.`
            );
          }
          if (start && draft > start) {
            messages.push(
              `${idxLabel}: Draft due must be on/before Posting Window Start.`
            );
          }
        }

        // Links per deliverable
        const badLink = (row.links || []).find(
          (l) => !/^https?:\/\/.+/i.test(l)
        );
        if (badLink) {
          messages.push(
            `${idxLabel}: All links must be valid URLs (https://).`
          );
        }

        // Handles per deliverable
        const badHandle = (row.handles || []).find(
          (h) => !/^@?\w[\w._-]*$/.test(h)
        );
        if (badHandle) {
          messages.push(
            `${idxLabel}: Handles should be like @username (letters, numbers, . _ -).`
          );
        }
      });

      if (messages.length) {
        add("deliverables", messages.join(" "));
      }
    }

    if (!usageType) add("usageType", "Choose a license type.");
    const usageDurNum = Number(usageDurationMonths || "");
    if (
      !usageDurationMonths.trim() ||
      Number.isNaN(usageDurNum) ||
      usageDurNum < 0
    )
      add("usageDurationMonths", "Duration must be ≥ 0.");

    const revNum = Number(revisionsIncluded || "");
    if (Number.isNaN(revNum) || revNum < 0)
      add("revisionsIncluded", "Revisions must be ≥ 0.");

    if (!ok) {
      toast({ icon: "error", title: "Please fix the highlighted fields" });
      setTimeout(scrollFirstErrorIntoView, 50);
    }
    return ok;
  };

  /* ---------------- Preview ---------------- */
  const handleGeneratePreview = async () => {
    if (!selectedInf) return;
    if (!validateForPreview()) return;

    setIsPreviewLoading(true);
    try {
      if (panelMode === "send") {
        const brand = buildBrandPayload();
        const payload: any = {
          brandId: localStorage.getItem("brandId"),
          campaignId,
          influencerId: selectedInf.influencerId,
          brand,
          preview: true,
          ...(requestedEffDate && { requestedEffectiveDate: requestedEffDate }),
          ...(requestedEffTz && {
            requestedEffectiveDateTimezone: requestedEffTz,
          }),
        };

        const res = await api.post("/contract/initiate", payload, {
          responseType: "blob",
        });

        clearPreview();
        setPdfUrl(URL.createObjectURL(res.data));
      } else {
        if (!selectedMeta?.contractId) {
          toast({
            icon: "error",
            title: "No Contract",
            text: "Cannot edit before a contract exists.",
          });
          setIsPreviewLoading(false);
          return;
        }

        if (panelMode === "edit" && isRejectedMeta(selectedMeta)) {
          const brandUpdates = buildBrandPayload();

          const res = await api.post(
            "/contract/resend",
            {
              contractId: selectedMeta.contractId,
              brandUpdates,
              requestedEffectiveDate: requestedEffDate,
              requestedEffectiveDateTimezone: requestedEffTz,
              preview: true,
            },
            { responseType: "blob" }
          );

          clearPreview();
          setPdfUrl(URL.createObjectURL(res.data));
          return;
        }

        const brandUpdates = buildBrandPayload();

        await post("/contract/brand/update", {
          contractId: selectedMeta.contractId,
          brandId: localStorage.getItem("brandId"),
          type: 1,
          brandUpdates,
          ...(requestedEffDate && {
            requestedEffectiveDate: requestedEffDate,
          }),
          ...(requestedEffTz && {
            requestedEffectiveDateTimezone: requestedEffTz,
          }),
        });

        const res = await api.get("/contract/preview", {
          params: { contractId: selectedMeta.contractId },
          responseType: "blob",
        });

        clearPreview();
        setPdfUrl(URL.createObjectURL(res.data));
      }

      toast({
        icon: "success",
        title: "Preview ready",
        text: "Review the PDF on the left.",
      });
    } catch (e: any) {
      toast({
        icon: "error",
        title: "Preview failed",
        text:
          e?.response?.data?.message ||
          e?.message ||
          "Could not generate preview.",
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const wasResent = (meta?: ContractMeta | null) => {
    if (!meta) return false;
    if ((meta as any).isResend || (meta as any).isresend) return true;
    if (meta.flags?.isResend || meta.flags?.isResendChild) return true;
    if (meta.statusFlags?.isResend || meta.statusFlags?.isResendChild)
      return true;
    if (typeof meta.resendIteration === "number" && meta.resendIteration > 0)
      return true;
    const audit = Array.isArray(meta.audit) ? meta.audit : [];
    return audit.some((ev) => (ev.type || "").toUpperCase() === "RESENT");
  };

  /* ---------------- Row actions ---------------- */
  const handleViewContract = async (inf?: Influencer) => {
    const target = inf || selectedInf;
    if (!target) return;
    const meta =
      metaCache[target.influencerId] ?? (await getLatestContractFor(target));
    if (!meta?.contractId)
      return toast({
        icon: "error",
        title: "No Contract",
        text: "Please send the contract first.",
      });
    try {
      const res = await api.post(
        "/contract/viewPdf",
        { contractId: meta.contractId },
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank");
    } catch (e: any) {
      toast({
        icon: "error",
        title: "Open Failed",
        text: e?.message || "Unable to open contract.",
      });
    }
  };

  const handleSendContract = async () => {
    if (!selectedInf) return;
    if (!pdfUrl) {
      toast({
        icon: "info",
        title: "Preview required",
        text: "Generate preview before sending.",
      });
      return;
    }
    if (!validateForPreview()) return;

    setIsSendLoading(true);
    try {
      const brand = buildBrandPayload();
      const brandId = localStorage.getItem("brandId")!;
      await post("/contract/initiate", {
        brandId,
        campaignId,
        influencerId: selectedInf.influencerId,
        brand,
        ...(requestedEffDate
          ? { requestedEffectiveDate: requestedEffDate }
          : {}),
        ...(requestedEffTz
          ? { requestedEffectiveDateTimezone: requestedEffTz }
          : {}),
      });
      toast({
        icon: "success",
        title: "Sent!",
        text: "Contract sent to influencer.",
      });
      closeSidebar();
      fetchApplicants();
      loadMetaCache(influencers);
    } catch (e: any) {
      toast({
        icon: "error",
        title: "Send failed",
        text:
          e?.response?.data?.message ||
          e?.message ||
          "Failed to send.",
      });
    } finally {
      setIsSendLoading(false);
    }
  };

  const handleEditContract = async () => {
    if (!selectedMeta?.contractId) return;
    if (!pdfUrl) return toast({ icon: "info", title: "Preview required" });
    if (!validateForPreview()) return;

    setIsUpdateLoading(true);
    try {
      const brandUpdates = buildBrandPayload();

      if (isRejectedMeta(selectedMeta)) {
        await post("/contract/resend", {
          contractId: selectedMeta.contractId,
          brandUpdates,
          requestedEffectiveDate: requestedEffDate,
          requestedEffectiveDateTimezone: requestedEffTz,
        });

        toast({ icon: "success", title: "Resent!", text: "New contract sent to influencer." });
      } else {
        await post("/contract/brand/update", {
          contractId: selectedMeta.contractId,
          brandId: localStorage.getItem("brandId"),
          type: 0,
          brandUpdates,
          requestedEffectiveDate: requestedEffDate,
          requestedEffectiveDateTimezone: requestedEffTz,
        });

        toast({ icon: "success", title: "Updated", text: "Contract updated (new version sent)." });
      }

      closeSidebar();
      fetchApplicants();
      loadMetaCache(influencers);
    } catch (e: any) {
      toast({ icon: "error", title: "Action failed", text: e?.response?.data?.message || e?.message || "Failed." });
    } finally {
      setIsUpdateLoading(false);
    }
  };

  const handleBrandAccept = async (inf?: Influencer) => {
    const target = inf || selectedInf;
    if (!target) return;
    const meta =
      metaCache[target.influencerId] ?? (await getLatestContractFor(target));
    if (!meta?.contractId)
      return toast({
        icon: "error",
        title: "No Contract",
        text: "Send contract first.",
      });

    const statusStr = meta?.status ? String(meta.status) : "";
    const influencerAccepted =
      statusStr === CONTRACT_STATUS.INFLUENCER_ACCEPTED ||
      !!meta.confirmations?.influencer?.confirmed; // fallback if some old docs still use confirmations

    if (!influencerAccepted) {
      return toast({
        icon: "info",
        title: "Awaiting influencer",
        text: "Influencer must accept before you can accept.",
      });
    }

    const ok = await askConfirm(
      "Confirm as Brand?",
      "Once confirmed, your next step is to sign."
    );
    if (!ok) return;

    try {
      await post("/contract/brand/confirm", { contractId: meta.contractId });
      toast({ icon: "success", title: "Brand Accepted" });
      fetchApplicants();
      loadMetaCache(influencers);
    } catch (e: any) {
      toast({
        icon: "error",
        title: "Confirm failed",
        text:
          e?.response?.data?.message ||
          e?.message ||
          "Could not confirm.",
      });
    }
  };


  const openSignModal = (meta: ContractMeta | null) => {
    if (!meta?.contractId)
      return toast({
        icon: "error",
        title: "No Contract",
        text: "Send/accept contract first.",
      });
    setSignTargetMeta(meta);
    setSignOpen(true);
  };

  /* ---------------- Invalidate preview when form changes ---------------- */
  useEffect(() => {
    clearPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    campaignTitle,
    platforms,
    goLiveStart,
    goLiveEnd,
    totalFee,
    currency,
    milestoneSplit,
    revisionsIncluded,
    requestedEffDate,
    requestedEffTz,
    usageType,
    usageDurationMonths,
    usageDerivativeEdits,
    usageGeographies.length,
    JSON.stringify(deliverables),
  ]);

  const prettyStatus = (
    meta: ContractMeta | null,
    hasContract: boolean,
    fallbackApplied = false
  ) => {
    if (!hasContract) return fallbackApplied ? "Applied" : "—";
    if (isRejectedMeta(meta)) return "Rejected";

    const signingLabel = signingStatusLabel(meta);
    if (signingLabel) return signingLabel;

    const s = meta?.status ? String(meta.status) : "";
    return statusLabel(s);
  };

  const StatusBadge = ({
    meta,
    hasContract,
  }: {
    meta: ContractMeta | null;
    hasContract: boolean;
  }) => {
    const label = prettyStatus(meta, hasContract, true);
    const rejected = isRejectedMeta(meta);
    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${rejected
          ? "bg-black text-white"
          : "bg-gray-100 text-gray-800"
          }`}
      >
        {label}
      </span>
    );
  };

  const RowActions = ({ inf, meta, hasContract, rejected, nowrap = false }: any) => {
    const statusStr = meta?.status ? String(meta.status) : "";
    const locked = isLockedStatus(statusStr);
    const editable = isEditableStatus(statusStr);
    const brandNeedsAccept = needsBrandAcceptance(statusStr);
    const signAllowed = canSignNow(statusStr);
    const brandSigned = !!meta?.signatures?.brand?.signed;
    const influencerSigned = !!meta?.signatures?.influencer?.signed;

    const milestonesAllowed =
      hasContract &&
      !rejected &&
      statusStr !== CONTRACT_STATUS.MILESTONES_CREATED &&
      (
        statusStr === CONTRACT_STATUS.CONTRACT_SIGNED ||
        (statusStr === CONTRACT_STATUS.READY_TO_SIGN && brandSigned && influencerSigned)
      );

    return (
      <div
        className={[
          "items-center gap-2 md:gap-2 lg:gap-2",
          "whitespace-nowrap",
          nowrap ? "inline-flex flex-nowrap" : "flex flex-wrap justify-center",
        ].join(" ")}
      >

        {/* Fully signed (Brand + Influencer) → allow Add Milestone */}
        {milestonesAllowed && (
          <ActionButton
            title="Add milestones for this influencer"
            variant="outline"
            onClick={() =>
              router.push(
                `/brand/active-campaign/active-inf?id=${encodeURIComponent(
                  campaignId || ""
                )}&infId=${encodeURIComponent(inf.influencerId)}${meta?.contractId ? `&contractId=${encodeURIComponent(meta.contractId)}` : ""
                }`
              )
            }
          >
            Add Milestone
          </ActionButton>
        )}

        {/* Influencer accepted → brand accepts */}
        {hasContract && !rejected && !locked && brandNeedsAccept && (
          <ActionButton
            icon={HiCheck}
            title="Brand Accept"
            variant="outline"
            onClick={() => handleBrandAccept(inf)}
          >
            Brand Accept
          </ActionButton>
        )}

        {/* Both accepted → sign */}
        {hasContract && !rejected && !locked && signAllowed && !brandSigned && (
          <ActionButton
            title="Sign as Brand"
            variant="grad"
            onClick={() => openSignModal(meta)}
          >
            Sign as Brand
          </ActionButton>
        )}
        
        <ActionButton
          title="View Influencer"
          variant="outline"
          onClick={() => router.push(`/brand/influencers?id=${inf.influencerId}`)}
        >
          View Influencer
        </ActionButton>

        {/* No contract yet */}
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

        {/* Rejected → allow resend (still controlled by your resend logic) */}
        {hasContract && rejected && !locked && (
          <ActionButton
            title="Resend contract"
            variant="grad"
            onClick={() => openSidebar(inf, "edit")}
          >
            Resend Contract
          </ActionButton>
        )}

        {/* Always allow viewing if exists */}
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

        {/* Editable window (pre-accept / change-request) */}
        {hasContract && !rejected && !locked && editable && (
          <ActionButton
            title="Edit contract"
            variant="grad"
            onClick={() => openSidebar(inf, "edit")}
          >
            Edit Contract
          </ActionButton>
        )}
      </div>
    );
  };


  /* ---------------- Rows rendering ---------------- */
  const rows = useMemo(
    () =>
      influencers.map((inf, idx) => {
        const href = buildHandleUrl(inf.primaryPlatform, inf.handle);
        const meta = metaCache[inf.influencerId] || null;
        const hasContract = !!(
          meta?.contractId ||
          inf.contractId ||
          inf.isAssigned
        );
        const iConfirmed = !!meta?.confirmations?.influencer?.confirmed;
        const bConfirmed = !!meta?.confirmations?.brand?.confirmed;
        const bSigned = !!meta?.signatures?.brand?.signed;
        const locked = isLockedStatus(meta?.status ? String(meta.status) : null);
        const rejected = isRejectedMeta(meta);
        const statusStr = meta?.status ? String(meta.status) : "";
        const editable = isEditableStatus(statusStr);
        const brandNeedsAccept = needsBrandAcceptance(statusStr);
        const signAllowed = canSignNow(statusStr);

        const isHighlighted = highlightInfId === inf.influencerId;

        return (
          <TableRow
            key={inf.influencerId}
            id={`inf-row-${inf.influencerId}`}
            className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"
              } hover:bg-gray-100/60 focus-within:bg-gray-100/80 transition-colors ${isHighlighted
                ? "bg-[#FFF0D6] !bg-[#FFF0D6] shadow-[0_0_0_2px_rgba(234,88,12,0.9)] outline outline-2 outline-[#EA580C] animate-pulse"
                : ""
              }`}
          >
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                <span
                  className="truncate max-w-[220px]"
                  title={inf.name}
                >
                  {inf.name}
                </span>
              </div>
            </TableCell>
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
              <Badge
                variant="secondary"
                className="capitalize bg-gray-200 text-gray-800"
              >
                {getCategoryLabel(inf)}
              </Badge>
            </TableCell>
            <TableCell>{formatAudience(inf.audienceSize)}</TableCell>
            <TableCell className="whitespace-nowrap">
              {inf.createdAt
                ? new Date(inf.createdAt).toLocaleDateString()
                : "—"}
            </TableCell>

            <TableCell className="text-center">
              {rejected ? (
                <div className="space-y-1">
                  <Badge className="bg-black text-white shadow-none">
                    Rejected
                  </Badge>
                  <p className="text-xs text-gray-500 break-words">
                    {getRejectReasonFromMeta(meta) || "No reason provided"}
                  </p>
                </div>
              ) : (
                <StatusBadge meta={meta} hasContract={hasContract} />
              )}
            </TableCell>

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
      }),
    [influencers, metaCache, metaCacheLoading, highlightInfId]
  );

  const EmptyState = () => (
    <div className="p-12 text-center space-y-3">
      <div
        className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{
          backgroundImage: `linear-gradient(to right, ${GRADIENT_FROM}, ${GRADIENT_TO})`,
        }}
      >
        <HiSearch className="text-white w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold">No applicants found</h3>
      <p className="text-sm text-gray-600">
        Try adjusting your search or sorting options.
      </p>
    </div>
  );

  const MobileCardList = () => (
    <div className="grid gap-3 md:hidden">
      {influencers.map((inf) => {
        const meta = metaCache[inf.influencerId] || null;
        const hasContract = !!(
          meta?.contractId ||
          inf.contractId ||
          inf.isAssigned
        );
        const iConfirmed = !!meta?.confirmations?.influencer?.confirmed;
        const bConfirmed = !!meta?.confirmations?.brand?.confirmed;
        const bSigned = !!meta?.signatures?.brand?.signed;
        const locked = isLockedStatus(meta?.status ? String(meta.status) : null);
        const rejected = isRejectedMeta(meta);
        const href = buildHandleUrl(inf.primaryPlatform, inf.handle);

        const statusStr = meta?.status ? String(meta.status) : "";
        const editable = isEditableStatus(statusStr);
        const brandNeedsAccept = needsBrandAcceptance(statusStr);
        const signAllowed = canSignNow(statusStr);


        return (
          <div
            key={inf.influencerId}
            id={`inf-card-${inf.influencerId}`}
            className={`relative rounded-xl border p-4 bg-white transition-all duration-300 ${highlightInfId === inf.influencerId
              ? "border-[#EA580C] bg-[#FFE4C4] shadow-[0_0_0_2px_rgba(234,88,12,0.9),0_18px_45px_rgba(0,0,0,0.35)] animate-pulse scale-[1.02]"
              : "border-gray-200 hover:shadow-md hover:-translate-y-[1px]"
              }`}
          >
            {highlightInfId === inf.influencerId && (
              <span className="absolute -top-2 right-3 rounded-full bg-gradient-to-r from-[#FFA135] to-[#FF7236] px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                From notification
              </span>
            )}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div
                  className="font-semibold truncate"
                  title={inf.name}
                >
                  {inf.name}
                </div>
                <div className="text-sm text-gray-600 truncate">
                  {href ? (
                    <a
                      className="hover:underline text-black"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {inf.handle}
                    </a>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                  <Badge className="bg-gray-200 text-gray-800">
                    {getCategoryLabel(inf)}
                  </Badge>
                  <span>•</span>
                  <span>{formatAudience(inf.audienceSize)} audience</span>
                </div>
              </div>
              <StatusBadge meta={meta} hasContract={hasContract} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <RowActions
                inf={inf}
                meta={meta}
                hasContract={hasContract}
                rejected={rejected}
                iConfirmed={iConfirmed}
                bConfirmed={bConfirmed}
                bSigned={bSigned}
                locked={locked}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ===============================================================
     Render
     =============================================================== */
  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto">
        <header className="flex items-center justify-between p-2 md:p-4 rounded-md sticky top-0 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white/90 border-b border-gray-100">
          <h1 className="text-xl md:text-3xl font-bold truncate">
            Campaign: {campaignTitle || "Unknown Campaign"}
          </h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="bg-gray-200 text-black"
              onClick={() => router.back()}
            >
              Back
            </Button>
          </div>
        </header>

        <div className="mb-2 md:mb-4 max-w-xl sticky top-[62px] z-10">
          <div className="relative bg-white rounded-lg">
            <HiSearch
              className="absolute inset-y-0 left-3 my-auto text-gray-400"
              size={20}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search influencers… (press / to focus)"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full h-[44px] pl-10 pr-4 border-2 rounded-lg text-sm border-gray-200 focus:outline-none focus-visible:outline-none focus:border-[#FF8A35] focus-visible:ring-2 focus-visible:ring-[#FF8A35] focus-visible:ring-offset-1 focus-visible:ring-offset-white"
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
            <div
              className="bg-white rounded-md shadow-sm overflow-hidden hidden md:block"
              aria-busy={loading}
            >
              <div className="overflow-x-auto">
                <Table className="min-w-[1100px]">
                  <TableHeader
                    style={{
                      backgroundImage: `linear-gradient(to right, ${GRADIENT_FROM}, ${GRADIENT_TO})`,
                    }}
                    className="text-white sticky top-0 z-10"
                  >
                    <TableRow>
                      <TableHead
                        onClick={() => toggleSort("name")}
                        className="cursor-pointer font-semibold select-none"
                        aria-sort={
                          sortField === "name"
                            ? sortOrder === 1
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        {influencers.length} Applied{" "}
                        <SortIndicator field="name" />
                      </TableHead>
                      <TableHead
                        onClick={() => toggleSort("handle")}
                        className="cursor-pointer font-semibold select-none"
                        aria-sort={
                          sortField === "handle"
                            ? sortOrder === 1
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        Social Handle <SortIndicator field="handle" />
                      </TableHead>
                      <TableHead
                        onClick={() => toggleSort("category")}
                        className="cursor-pointer font-semibold select-none"
                        aria-sort={
                          sortField === "category"
                            ? sortOrder === 1
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        Category <SortIndicator field="category" />
                      </TableHead>
                      <TableHead
                        onClick={() => toggleSort("audienceSize")}
                        className="cursor-pointer font-semibold select-none"
                        aria-sort={
                          sortField === "audienceSize"
                            ? sortOrder === 1
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        Audience <SortIndicator field="audienceSize" />
                      </TableHead>
                      <TableHead
                        onClick={() => toggleSort("createdAt")}
                        className="cursor-pointer font-semibold select-none"
                        aria-sort={
                          sortField === "createdAt"
                            ? sortOrder === 1
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        Date <SortIndicator field="createdAt" />
                      </TableHead>
                      <TableHead className="font-semibold">
                        Status
                      </TableHead>
                      <TableHead className="text-center font-semibold w-[560px]">
                        Actions
                      </TableHead>
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
            <span className="text-sm">
              Page <strong>{page}</strong> of {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={page === meta.totalPages}
              onClick={() =>
                setPage((p) => Math.min(p + 1, meta.totalPages))
              }
              className="text-black"
              aria-label="Next page"
            >
              <HiChevronRight />
            </Button>
          </div>
        )}

        {/* ================= Sidebar ================= */}
        <ContractSidebar
          isOpen={sidebarOpen}
          onClose={closeSidebar}
          title={
            panelMode === "send"
              ? "Send Contract"
              : selectedMeta && isRejectedMeta(selectedMeta)
                ? "Resend Contract"
                : "Edit Contract"
          }
          subtitle={
            selectedInf
              ? `${campaignTitle || "Agreement"} • ${selectedInf.name}`
              : campaignTitle || "Agreement"
          }
          previewUrl={pdfUrl}
          onClosePreview={clearPreview}
        >
          {/* Campaign Details */}
          <SidebarSection
            title="Campaign Details"
            icon={<HiDocumentText className="w-4 h-4" />}
          >
            <div className="space-y-4">
              <FloatingLabelInput
                id="campaignTitle"
                label="Campaign Title"
                info="The display name for this agreement (Schedule A, item 1)."
                value={campaignTitle}
                onChange={(e: any) => {
                  setCampaignTitle(e.target.value);
                  clearPreview();
                }}
                error={formErrors.campaignTitle}
                data-field-error={!!formErrors.campaignTitle}
              />

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <LabelWithInfo
                    text="Platforms"
                    info="Select the channels for this SOW (Schedule A, item 3)."
                  />
                  {formErrors.platforms && (
                    <span
                      className="text-xs text-red-600"
                      data-field-error
                    >
                      {formErrors.platforms}
                    </span>
                  )}
                </div>
                <PlatformSelector
                  platforms={platforms}
                  onChange={(v: string[]) => {
                    setPlatforms(v);
                    clearPreview();
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Total Fee */}
                <NumberInputTop
                  id="totalFee"
                  label="Total Fee"
                  info="The full compensation for the campaign (Schedule A, 7a)."
                  value={totalFee}
                  onChange={(v: string) => {
                    setTotalFee(v);
                    clearPreview();
                  }}
                  error={formErrors.totalFee}
                  data-field-error={!!formErrors.totalFee}
                />

                {/* Currency */}
                <div
                  className="space-y-1.5"
                  data-field-error={!!formErrors.currency}
                >
                  <LabelWithInfo
                    text="Currency"
                    info="Payment currency (Schedule A, 7a)."
                  />
                  <ReactSelect
                    instanceId="currency-select"
                    inputId="currency-select-input"
                    name="currency"
                    isLoading={listsLoading}
                    options={currencyOptions}
                    value={
                      currencyOptions.find((o) => o.value === currency) ||
                      null
                    }
                    onChange={(opt: any) => {
                      setCurrency(opt?.value || "");
                      clearPreview();
                    }}
                    placeholder="Select currency"
                    styles={buildReactSelectStyles({
                      hasError: !!formErrors.currency,
                    })}
                  />
                  {formErrors.currency && (
                    <div
                      className="text-xs text-red-600"
                      data-field-error
                    >
                      {formErrors.currency}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Milestone Split with dropdown */}
                <div
                  className="space-y-1.5"
                  data-field-error={!!formErrors.milestoneSplit}
                >
                  <LabelWithInfo
                    text="Milestone Split (%)"
                    info="Percentages like 50/50 or 40/30/30. Total must be ≤ 100%."
                  />
                  <div className="flex flex-col gap-2">
                    <select
                      value={milestonePreset}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "custom") {
                          setMilestoneSplit("");
                          clearPreview();
                          return;
                        }
                        setMilestoneSplit(val);
                        clearPreview();
                      }}
                      className="w-full h-[44px] px-3 border-2 rounded-lg text-sm border-gray-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A35] focus-visible:ring-offset-1 focus-visible:ring-offset-white"
                    >
                      {MILESTONE_SPLIT_PRESETS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {milestonePreset === "custom" && (
                      <input
                        id="milestoneSplitCustom"
                        type="text"
                        value={milestoneSplit}
                        onChange={(e) => {
                          setMilestoneSplit(e.target.value);
                          clearPreview();
                        }}
                        placeholder="e.g. 50/50 or 40/30/30"
                        className="w-full h-[44px] px-3 border-2 rounded-lg text-sm border-gray-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A35] focus-visible:ring-offset-1 focus-visible:ring-offset-white"
                      />
                    )}
                  </div>
                  {formErrors.milestoneSplit && (
                    <div className="text-xs text-red-600 mt-1">
                      {formErrors.milestoneSplit}
                    </div>
                  )}
                </div>

                {/* Revisions Included */}
                <NumberInput
                  id="revisionsIncluded"
                  label="Revisions Included"
                  info="Included rounds of edits (Schedule A, 5b)."
                  value={revisionsIncluded}
                  onChange={(v: string) => {
                    setRevisionsIncluded(v);
                    clearPreview();
                  }}
                  error={formErrors.revisionsIncluded}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <LabelWithInfo
                    text="Requested Effective Date (display)"
                    info="Shown in the PDF header; does not change locking rules."
                  />
                  <input
                    id="requestedEffDate"
                    type="date"
                    value={requestedEffDate}
                    min={effMin}
                    max={effMax || undefined}
                    onChange={(e) => {
                      setRequestedEffDate(e.target.value);
                      clearPreview();
                    }}
                    className={`w-full h-[44px] px-3 border-2 rounded-lg text-sm transition-all duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A35] focus-visible:ring-offset-1 focus-visible:ring-offset-white ${formErrors.requestedEffDate
                      ? "border-red-500"
                      : "border-gray-200 focus:border-[#FF8A35]"
                      }`}
                    data-field-error={!!formErrors.requestedEffDate}
                  />
                  {formErrors.requestedEffDate && (
                    <div className="text-xs text-red-600 mt-1">
                      {formErrors.requestedEffDate}
                    </div>
                  )}
                </div>
                <div>
                  <LabelWithInfo
                    text="Timezone"
                    info="Used for date formatting and review windows (Section 2c)."
                  />
                  <ReactSelect
                    instanceId="timezone-select"
                    inputId="timezone-select-input"
                    name="timezone"
                    isLoading={listsLoading}
                    options={tzOptions}
                    value={
                      tzOptions.find((o) => o.value === requestedEffTz) ||
                      null
                    }
                    onChange={(opt: any) => {
                      setRequestedEffTz(opt?.value || "");
                      clearPreview();
                    }}
                    placeholder="Select timezone"
                    styles={buildReactSelectStyles()}
                  />
                </div>
              </div>
            </div>
          </SidebarSection>

          {/* Posting Window */}
          <SidebarSection
            title="Posting Window"
            icon={<HiInformationCircle className="w-4 h-4" />}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <LabelWithInfo
                    text="Start"
                    info="Earliest date content may go live."
                  />
                  <input
                    id="goLiveStart"
                    type="date"
                    value={goLiveStart}
                    min={startMin}
                    max={startMax || undefined}
                    onChange={(e) => {
                      setGoLiveStart(e.target.value);
                      clearPreview();
                    }}
                    className={`w-full h-[44px] px-3 border-2 rounded-lg text-sm transition-all duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A35] focus-visible:ring-offset-1 focus-visible:ring-offset-white ${formErrors.goLiveStart
                      ? "border-red-500"
                      : "border-gray-200 focus:border-[#FF8A35]"
                      }`}
                    data-field-error={!!formErrors.goLiveStart}
                  />
                  {formErrors.goLiveStart && (
                    <div className="text-xs text-red-600 mt-1">
                      {formErrors.goLiveStart}
                    </div>
                  )}
                </div>
                <div>
                  <LabelWithInfo
                    text="End"
                    info="Latest date content must be posted."
                  />
                  <input
                    id="goLiveEnd"
                    type="date"
                    value={goLiveEnd}
                    min={endMin}
                    onChange={(e) => {
                      setGoLiveEnd(e.target.value);
                      clearPreview();
                    }}
                    className={`w-full h-[44px] px-3 border-2 rounded-lg text-sm transition-all duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A35] focus-visible:ring-offset-1 focus-visible:ring-offset-white ${formErrors.goLiveEnd
                      ? "border-red-500"
                      : "border-gray-200 focus:border-[#FF8A35]"
                      }`}
                    data-field-error={!!formErrors.goLiveEnd}
                  />
                  {formErrors.goLiveEnd && (
                    <div className="text-xs text-red-600 mt-1">
                      {formErrors.goLiveEnd}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SidebarSection>

          {/* Deliverables (multi-row, everything per row) */}
          <SidebarSection
            title="Deliverables"
            icon={<HiClipboardList className="w-4 h-4" />}
          >
            <div className="space-y-4">
              {formErrors.deliverables && (
                <div
                  className="text-xs text-red-600 mb-1"
                  data-field-error={true}
                >
                  {formErrors.deliverables}
                </div>
              )}

              <div className="space-y-3">
                {deliverables.map((row, index) => {
                  const isVideoRow =
                    VIDEO_TYPES.has(row.type) &&
                    !TEXT_ONLY_TYPES.has(row.type);

                  return (
                    <div
                      key={row.id}
                      className="border border-gray-200 rounded-xl p-3 bg-white flex flex-col gap-3"
                    >
                      {/* Row header */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-gray-800">
                          Deliverable #{index + 1}
                        </div>
                        {deliverables.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setDeliverables((prev) =>
                                prev.filter((d) => d.id !== row.id)
                              )
                            }
                            className="text-xs text-gray-500 hover:text-red-600"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      {/* Type + Quantity + Duration (for video) */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <LabelWithInfo
                            text="Type"
                            info="Content category for this line item."
                          />
                          <ReactSelect
                            instanceId={`dtype-${row.id}`}
                            inputId={`dtype-${row.id}-input`}
                            options={DELIVERABLE_TYPE_OPTIONS}
                            value={
                              DELIVERABLE_TYPE_OPTIONS.find(
                                (o) => o.value === row.type
                              ) || null
                            }
                            onChange={(opt: any) => {
                              const nextType = opt?.value || "Video";
                              setDeliverables((prev) =>
                                prev.map((d) =>
                                  d.id === row.id
                                    ? { ...d, type: nextType }
                                    : d
                                )
                              );
                              clearPreview();
                            }}
                            styles={buildReactSelectStyles()}
                            placeholder="Select type"
                          />
                        </div>

                        <NumberInputTop
                          id={`quantity-${row.id}`}
                          label="Quantity"
                          info="Number of pieces of this type."
                          value={row.quantity}
                          onChange={(v: string) => {
                            setDeliverables((prev) =>
                              prev.map((d) =>
                                d.id === row.id
                                  ? { ...d, quantity: v }
                                  : d
                              )
                            );
                            clearPreview();
                          }}
                        />

                        {isVideoRow && (
                          <NumberInputTop
                            id={`duration-${row.id}`}
                            label="Duration (sec)"
                            info="Required for video deliverables."
                            value={row.durationSec}
                            onChange={(v: string) => {
                              setDeliverables((prev) =>
                                prev.map((d) =>
                                  d.id === row.id
                                    ? { ...d, durationSec: v }
                                    : d
                                )
                              );
                              clearPreview();
                            }}
                          />
                        )}
                      </div>

                      {/* Format per deliverable */}
                      <FloatingLabelInput
                        id={`format-${row.id}`}
                        label="Format (file • aspect • res)"
                        info="Example: MP4 • 9:16 • 1080×1920"
                        value={row.format}
                        onChange={(e: any) => {
                          const v = e.target.value;
                          setDeliverables((prev) =>
                            prev.map((d) =>
                              d.id === row.id ? { ...d, format: v } : d
                            )
                          );
                          clearPreview();
                        }}
                      />

                      {/* Minimum Live + Units per deliverable */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <NumberInputTop
                          id={`minlive-${row.id}`}
                          label="Minimum Live"
                          info="How long this piece must stay live."
                          value={row.minLiveValue}
                          onChange={(v: string) => {
                            setDeliverables((prev) =>
                              prev.map((d) =>
                                d.id === row.id
                                  ? { ...d, minLiveValue: v }
                                  : d
                              )
                            );
                            clearPreview();
                          }}
                        />
                        <div className="space-y-1.5 md:col-span-2 md:max-w-xs">
                          <label className="text-sm font-medium text-gray-700">
                            Units
                          </label>
                          <select
                            value={row.minLiveUnit}
                            onChange={(e) => {
                              const val = e.target.value as
                                | "hours"
                                | "months";
                              setDeliverables((prev) =>
                                prev.map((d) =>
                                  d.id === row.id
                                    ? { ...d, minLiveUnit: val }
                                    : d
                                )
                              );
                              clearPreview();
                            }}
                            className="w-full h-[44px] px-3 border-2 rounded-lg text-sm border-gray-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A35] focus-visible:ring-offset-1 focus-visible:ring-offset-white focus:border-[#FF8A35]"
                          >
                            <option value="hours">Hours</option>
                            <option value="months">Months</option>
                          </select>
                        </div>
                      </div>

                      {/* Draft Required + Draft Due per deliverable */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Checkbox
                          id={`draftRequired-${row.id}`}
                          label={
                            <>
                              Draft Required{" "}
                              <InfoTip text="If enabled, a draft must be submitted before posting (Section 4b)." />
                            </>
                          }
                          checked={row.draftRequired}
                          onChange={(v: boolean) => {
                            setDeliverables((prev) =>
                              prev.map((d) =>
                                d.id === row.id
                                  ? {
                                    ...d,
                                    draftRequired: v,
                                    draftDue: v ? d.draftDue : "",
                                  }
                                  : d
                              )
                            );
                            clearPreview();
                          }}
                        />
                        <div>
                          <LabelWithInfo
                            text="Draft Due (if required)"
                            info="Date the draft must be submitted for review."
                          />
                          <input
                            id={`draftDue-${row.id}`}
                            type="date"
                            value={row.draftDue}
                            min={draftMin}
                            max={draftMax || undefined}
                            onChange={(e) => {
                              const v = e.target.value;
                              setDeliverables((prev) =>
                                prev.map((d) =>
                                  d.id === row.id
                                    ? { ...d, draftDue: v }
                                    : d
                                )
                              );
                              clearPreview();
                            }}
                            disabled={!row.draftRequired}
                            className={`w-full h-[44px] px-3 border-2 rounded-lg text-sm transition-all duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A35] focus-visible:ring-offset-1 focus-visible:ring-offset-white ${row.draftRequired
                              ? "border-gray-200 focus:border-[#FF8A35]"
                              : "opacity-60 cursor-not-allowed border-gray-200"
                              }`}
                          />
                        </div>
                      </div>

                      {/* Usage & Access per deliverable */}
                      <div className="space-y-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700">
                            Usage &amp; Access for this deliverable
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {supportsWhitelisting && (
                            <Checkbox
                              id={`whitelist-${row.id}`}
                              label={
                                <>
                                  Enable Whitelisting Access{" "}
                                  <InfoTip text="Allow the brand to run ads from the creator handle for this deliverable." />
                                </>
                              }
                              checked={row.whitelistingEnabled}
                              onChange={(v: boolean) => {
                                setDeliverables((prev) =>
                                  prev.map((d) =>
                                    d.id === row.id
                                      ? { ...d, whitelistingEnabled: v }
                                      : d
                                  )
                                );
                                clearPreview();
                              }}
                            />
                          )}
                          {supportsSparkAds && (
                            <Checkbox
                              id={`sparkads-${row.id}`}
                              label={
                                <>
                                  Enable Spark Ads / Boosting{" "}
                                  <InfoTip text="Allow boosting or Spark Ads for this TikTok asset." />
                                </>
                              }
                              checked={row.sparkAdsEnabled}
                              onChange={(v: boolean) => {
                                setDeliverables((prev) =>
                                  prev.map((d) =>
                                    d.id === row.id
                                      ? { ...d, sparkAdsEnabled: v }
                                      : d
                                  )
                                );
                                clearPreview();
                              }}
                            />
                          )}
                          <Checkbox
                            id={`insights-${row.id}`}
                            label={
                              <>
                                Grant Read-only Insights{" "}
                                <InfoTip text="Permit read-only analytics access for this specific deliverable." />
                              </>
                            }
                            checked={row.insightsReadOnly}
                            onChange={(v: boolean) => {
                              setDeliverables((prev) =>
                                prev.map((d) =>
                                  d.id === row.id
                                    ? { ...d, insightsReadOnly: v }
                                    : d
                                )
                              );
                              clearPreview();
                            }}
                          />
                        </div>
                      </div>

                      {/* Captions / Disclosures per deliverable */}
                      <TextArea
                        id={`captions-${row.id}`}
                        label={
                          <LabelWithInfo
                            text="Captions / Notes"
                            info="Guidelines, messaging, and creative notes."
                          />
                        }
                        value={row.captions}
                        onChange={(e: any) => {
                          const v = e.target.value;
                          setDeliverables((prev) =>
                            prev.map((d) =>
                              d.id === row.id ? { ...d, captions: v } : d
                            )
                          );
                          clearPreview();
                        }}
                        rows={3}
                        placeholder="Hashtags, call-outs, shot list…"
                      />

                      <TextArea
                        id={`disclosures-${row.id}`}
                        label={
                          <LabelWithInfo
                            text="Disclosures (e.g., #ad)"
                            info="Required compliance labels (Schedule B)."
                          />
                        }
                        value={row.disclosures}
                        onChange={(e: any) => {
                          const v = e.target.value;
                          setDeliverables((prev) =>
                            prev.map((d) =>
                              d.id === row.id
                                ? { ...d, disclosures: v }
                                : d
                            )
                          );
                          clearPreview();
                        }}
                        rows={2}
                        placeholder="Clear & conspicuous material-connection labels"
                      />

                      {/* Tags / Links / Handles per deliverable */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <ChipInput
                          label={
                            <LabelWithInfo
                              text="Tags"
                              info="Required hashtags to include."
                            />
                          }
                          items={row.tags}
                          setItems={(items: string[]) => {
                            setDeliverables((prev) =>
                              prev.map((d) =>
                                d.id === row.id ? { ...d, tags: items } : d
                              )
                            );
                            clearPreview();
                          }}
                          placeholder="#tag"
                        />
                        <ChipInput
                          label={
                            <LabelWithInfo
                              text="Links"
                              info="Campaign or tracking links (https://)."
                            />
                          }
                          items={row.links}
                          setItems={(items: string[]) => {
                            setDeliverables((prev) =>
                              prev.map((d) =>
                                d.id === row.id ? { ...d, links: items } : d
                              )
                            );
                            clearPreview();
                          }}
                          placeholder="https://"
                          validator={(s: string) => /^https?:\/\/.+/i.test(s)}
                        />
                        <ChipInput
                          label={
                            <LabelWithInfo
                              text="Handles"
                              info="Brand or partner handles to tag."
                            />
                          }
                          items={row.handles}
                          setItems={(items: string[]) => {
                            setDeliverables((prev) =>
                              prev.map((d) =>
                                d.id === row.id ? { ...d, handles: items } : d
                              )
                            );
                            clearPreview();
                          }}
                          placeholder="@brand"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add new row */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-dashed border-gray-300 text-gray-700"
                onClick={() => {
                  setDeliverables((prev) => [
                    ...prev,
                    {
                      id: createRowId(),
                      type: "Video",
                      quantity: "1",
                      format: "",
                      durationSec: "",
                      minLiveValue: "",
                      minLiveUnit: "hours",
                      draftRequired: false,
                      draftDue: "",
                      captions: "",
                      disclosures: "",
                      tags: [],
                      links: [],
                      handles: [],
                      whitelistingEnabled: false,
                      sparkAdsEnabled: false,
                      insightsReadOnly: false,
                    },
                  ]);
                  clearPreview();
                }}
              >
                + Add another deliverable
              </Button>
            </div>
          </SidebarSection>

          {/* Usage Bundle & Rights */}
          <SidebarSection
            title="Usage Bundle & Rights (Schedule)"
            icon={<HiInformationCircle className="w-4 h-4" />}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SelectWithInfo
                  id="usageType"
                  label="License Type"
                  info="Organic Use or Paid Digital Use."
                  value={usageType}
                  onChange={(e: any) => {
                    setUsageType(e.target.value);
                    clearPreview();
                  }}
                  options={LICENSE_TYPES}
                  error={formErrors.usageType}
                />
                <NumberInputTop
                  id="usageDuration"
                  label="Duration (months)"
                  info="Length of license from first go-live."
                  value={usageDurationMonths}
                  onChange={(v: string) => {
                    setUsageDurationMonths(v);
                    clearPreview();
                  }}
                  error={formErrors.usageDurationMonths}
                  data-field-error={!!formErrors.usageDurationMonths}
                />
              </div>

              <div>
                <LabelWithInfo
                  text="Geographies"
                  info="Territories where the license applies."
                />
                <ReactSelect
                  instanceId="geo-select"
                  inputId="geo-select-input"
                  isMulti
                  options={GEO_OPTIONS}
                  value={GEO_OPTIONS.filter((o) =>
                    usageGeographies.includes(o.value)
                  )}
                  onChange={(vals: any) => {
                    setUsageGeographies(
                      (vals || []).map((v: any) => v.value)
                    );
                    clearPreview();
                  }}
                  placeholder="Select territories"
                  styles={buildReactSelectStyles()}
                />
              </div>

              <Checkbox
                id="deriv-edits"
                label={
                  <>
                    Allow Derivative Edits{" "}
                    <InfoTip text="Permit cut-downs, captions, translations, thumbnails, metadata edits." />
                  </>
                }
                checked={usageDerivativeEdits}
                onChange={setUsageDerivativeEdits}
              />
            </div>
          </SidebarSection>

          {/* Footer Buttons */}
          <div className="sticky bottom-0 -mx-6 -mb-6 bg-white/95 backdrop-blur border-t border-gray-200 p-6 flex flex-wrap justify-end gap-3">
            <Button
              onClick={handleGeneratePreview}
              className="px-6 border-2 border-black text-black bg-white hover:bg-gray-50 disabled:opacity-60"
              title="Generate a PDF preview on the left"
              disabled={
                !platforms.length ||
                !campaignTitle.trim() ||
                isPreviewLoading ||
                isSendLoading ||
                isUpdateLoading
              }
            >
              {isPreviewLoading ? (
                <>
                  <span className="mr-2 animate-spin">⏳</span> Generating…
                </>
              ) : (
                <>
                  <HiEye className="w-5 h-5 mr-2" /> Preview
                </>
              )}
            </Button>
            {panelMode === "send" ? (
              <Button
                onClick={handleSendContract}
                className="px-6 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF7236] hover:to-[#FFA135] shadow-none disabled:opacity-60"
                disabled={
                  !platforms.length ||
                  !campaignTitle.trim() ||
                  !pdfUrl ||
                  isSendLoading ||
                  isPreviewLoading ||
                  isUpdateLoading
                }
                title={
                  !pdfUrl ? "Preview required first" : "Send contract"
                }
              >
                {isSendLoading ? (
                  <>
                    <span className="mr-2 animate-spin">⏳</span> Sending…
                  </>
                ) : (
                  <>
                    <HiPaperAirplane className="w-5 h-5 mr-2" /> Send
                    Contract
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleEditContract}
                className="px-6 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF7236] hover:to-[#FFA135] shadow-none disabled:opacity-60"
                disabled={
                  !pdfUrl ||
                  isUpdateLoading ||
                  isPreviewLoading ||
                  isSendLoading
                }
                title={
                  !pdfUrl ? "Preview required first" : updateBtnLabel
                }
              >
                {isUpdateLoading ? (
                  <>
                    <span className="mr-2 animate-spin">⏳</span>{" "}
                    Updating…
                  </>
                ) : (
                  updateBtnLabel
                )}
              </Button>
            )}
          </div>
        </ContractSidebar>

        {/* Signature Modal */}
        <SignatureModal
          isOpen={signOpen}
          onClose={() => {
            setSignOpen(false);
            setSignTargetMeta(null);
          }}
          onSigned={async (sigDataUrl: string) => {
            if (!signTargetMeta?.contractId) return;
            try {
              await post("/contract/sign", {
                contractId: signTargetMeta.contractId,
                role: "brand",
                name: signerName,
                email: signerEmail,
                signatureImageDataUrl: sigDataUrl,
              });
              toast({
                icon: "success",
                title: "Signed",
                text: "Signature recorded.",
              });
              setSignOpen(false);
              setSignTargetMeta(null);
              fetchApplicants();
              loadMetaCache(influencers);
            } catch (e: any) {
              toast({
                icon: "error",
                title: "Sign failed",
                text:
                  e?.response?.data?.message ||
                  e?.message ||
                  "Could not sign contract.",
              });
            }
          }}
        />
      </div>
    </TooltipProvider>
  );
}

/* ===============================================================
   Support UI components
   =============================================================== */
const LoadingSkeleton = ({ rows }: { rows: number }) => (
  <div className="p-6 space-y-2">
    {Array.from({ length: rows }).map((_, i) => (
      <Skeleton key={i} className="h-12 w-full rounded-md" />
    ))}
  </div>
);

const ErrorMessage: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <p className="p-6 text-center text-red-600">{children}</p>;

export function FloatingLabelInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  error,
  info,
  ...props
}: any) {
  const [focused, setFocused] = useState(false);
  const hasValue = value !== "" && value !== undefined && value !== null;
  return (
    <div className="relative" data-field-error={!!error}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`w-full h-[60px] px-4 pt-5 pb-1.5 border-2 rounded-lg text-sm transition-all duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A35] focus-visible:ring-offset-1 focus-visible:ring-offset-white ${error ? "border-red-500" : "border-gray-200 focus:border-[#FF8A35]"
          } peer`}
        placeholder=" "
        {...props}
      />
      <label
        htmlFor={id}
        className={`absolute left-4 transition-all duration-200 pointer-events-none inline-flex items-center gap-1 ${focused || hasValue
          ? "top-1.5 text-[11px] text-black font-medium"
          : "top-1/2 -translate-y-1/2 text-sm text-gray-500"
          }`}
      >
        <span>{label}</span>
        {info ? (
          <span className="pointer-events-auto">
            <InfoTip text={String(info)} />
          </span>
        ) : null}
      </label>
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
}

export function Select({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
  error,
  info,
}: any) {
  const flat = (
    Array.isArray(options[0]) ? (options as any).flat() : (options as any)
  ) as { value: string; label: string }[];
  return (
    <div className="space-y-1.5" data-field-error={!!error}>
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-700 inline-flex items-center gap-1"
      >
        <span>{label}</span>
        {info ? <InfoTip text={String(info)} /> : null}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full h-[44px] px-3 border-2 rounded-lg text-sm focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A35] focus-visible:ring-offset-1 focus-visible:ring-offset-white ${disabled
          ? "opacity-60 cursor-not-allowed border-gray-200"
          : error
            ? "border-red-500"
            : "border-gray-200 focus:border-[#FF8A35]"
          }`}
      >
        {flat.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}

export function SelectWithInfo({
  id,
  label,
  info,
  value,
  onChange,
  options,
  disabled = false,
  error,
}: any) {
  return (
    <div className="space-y-1.5" data-field-error={!!error}>
      <Select
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
        error={error}
        info={info}
      />
    </div>
  );
}

export function NumberInput({
  id,
  label,
  value,
  onChange,
  error,
  info,
  ...props
}: any) {
  return (
    <div className="relative" data-field-error={!!error}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full h-[60px] px-4 pt-5 pb-1.5 border-2 rounded-lg text-sm transition-all duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A35] focus-visible:ring-offset-1 focus-visible:ring-offset-white ${error ? "border-red-500" : "border-gray-200 focus:border-[#FF8A35]"
          }`}
        {...props}
      />
      <label
        htmlFor={id}
        className="absolute left-4 top-1.5 text-[11px] text-black font-medium pointer-events-none inline-flex items-center gap-1"
      >
        <span>{label}</span>
        {info ? (
          <span className="pointer-events-auto">
            <InfoTip text={String(info)} />
          </span>
        ) : null}
      </label>
      {error && (
        <div className="text-xs text-red-600 mt-1">{error}</div>
      )}
    </div>
  );
}

export function NumberInputTop({
  id,
  label,
  value,
  onChange,
  error,
  info,
  ...props
}: any) {
  return (
    <div className="space-y-1.5" data-field-error={!!error}>
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-700 inline-flex items-center gap-1 mb-1.5"
      >
        <span>{label}</span>
        {info ? <InfoTip text={String(info)} /> : null}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full h-[44px] px-3 border-2 rounded-lg text-sm transition-all duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A35] focus-visible:ring-offset-1 focus-visible:ring-offset-white ${error ? "border-red-500" : "border-gray-200 focus:border-[#FF8A35]"
          }`}
        {...props}
      />
      {error && (
        <div className="text-xs text-red-600">{error}</div>
      )}
    </div>
  );
}

export function Checkbox({
  id,
  label,
  checked,
  onChange,
  disabled = false,
}: any) {
  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2 text-sm ${disabled ? "opacity-60 cursor-not-allowed" : ""
        }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onChange(e.target.checked)
        }
        disabled={disabled}
        className="h-4 w-4 rounded border-gray-300"
      />
      <span className="text-gray-700">{label}</span>
    </label>
  );
}

export function PlatformSelector({
  platforms,
  onChange,
  disabled = false,
}: any) {
  const toggle = (p: string) => {
    if (disabled) return;
    const next = platforms.includes(p)
      ? platforms.filter((x: string) => x !== p)
      : [...platforms, p];
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
            aria-pressed={active}
            className={[
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all border flex items-center gap-1",
              disabled ? "opacity-60 cursor-not-allowed" : "",
              active
                ? "border-transparent text-white shadow-sm"
                : "border-gray-300 text-gray-800 bg-white hover:bg-gray-50",
            ].join(" ")}
            style={
              active
                ? {
                  backgroundImage: `linear-gradient(to right, ${GRADIENT_FROM}, ${GRADIENT_TO})`,
                }
                : undefined
            }
          >
            {active && (
              <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
            )}
            {p}
          </button>
        );
      })}
    </div>
  );
}

export function ChipInput({
  label,
  items,
  setItems,
  placeholder,
  validator,
  disabled = false,
  error,
}: any) {
  const [val, setVal] = useState("");

  const add = () => {
    if (disabled) return;
    const v = val.trim();
    if (!v) return;

    const parts = v
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const validParts = validator ? parts.filter((p) => validator(p)) : parts;
    if (!validParts.length) return;

    // items is the controlled prop from parent
    setItems([...(items as string[]), ...validParts]);
    setVal("");
  };

  const remove = (ix: number) => {
    if (disabled) return;
    setItems((items as string[]).filter((_: any, i: any) => i !== ix));
  };

  return (
    <div className="space-y-1.5" data-field-error={!!error}>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>

      <div
        className={`
          flex items-start gap-2 rounded-lg border-2 p-2
          ${disabled ? "opacity-60 cursor-not-allowed" : ""}
          ${error ? "border-red-500" : "border-gray-200"}
        `}
      >
        {/* Chips + input share this flex area */}
        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
          {items.map((t: string, i: number) => (
            <span
              key={`${t}-${i}`}
              className="group inline-flex max-w-full items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs"
              title={t}
            >
              {/* text wraps / truncates nicely even for huge links */}
              <span className="block max-w-[180px] sm:max-w-[260px] break-all">
                {t}
              </span>
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

          {/* Input grows but doesn't disappear */}
          <input
            value={val}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setVal(e.target.value)
            }
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-[1_1_120px] min-w-[80px] border-0 outline-none text-sm bg-transparent"
          />
        </div>

        {/* Add button pinned on the right */}
        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="px-2 py-1 text-xs border rounded whitespace-nowrap disabled:opacity-60"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function TextArea({
  id,
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  disabled = false,
  error,
}: any) {
  return (
    <div className="space-y-1.5" data-field-error={!!error}>
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A35] focus-visible:ring-offset-1 focus-visible:ring-offset-white ${disabled
          ? "opacity-60 cursor-not-allowed border-gray-200"
          : error
            ? "border-red-500"
            : "border-gray-200 focus:border-[#FF8A35]"
          }`}
      />
      {error && (
        <div className="text-xs text-red-600">{error}</div>
      )}
    </div>
  );
}

function ContractSidebar({
  isOpen,
  onClose,
  children,
  title = "Initiate Contract",
  subtitle = "New Agreement",
  previewUrl,
  onClosePreview,
}: any) {
  return (
    <div
      className={`fixed inset-0 z-50 ${isOpen ? "" : "pointer-events-none"
        }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="contract-title"
    >
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"
          }`}
        onClick={onClose}
      />
      <div
        className={`absolute right-0 top-0 h-full w-full bg-white shadow-2xl transform transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
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
                <div
                  className="text-[11px] tracking-wide font-semibold uppercase/relaxed opacity-95 mb-1"
                  id="contract-title"
                >
                  {title}
                </div>
                <div className="text-2xl font-extrabold leading-tight">
                  {subtitle}
                </div>
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
        <div className="flex h-[calc(100%-9rem)]">
          {previewUrl ? (
            <div className="w-full sm:w-1/2 p-6 border-r border-gray-100 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <HiEye className="w-4 h-4" />
                  <span>Preview</span>
                </div>
                {onClosePreview && (
                  <button
                    type="button"
                    onClick={onClosePreview}
                    className="text-xs px-3 py-1 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-100"
                  >
                    Close preview
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-gray-50">
                <iframe
                  src={previewUrl}
                  width="100%"
                  height="100%"
                  className="border-0"
                  title="Contract PDF"
                />
              </div>
            </div>
          ) : (
            <div className="hidden sm:flex w-1/2 p-6 items-center justify-center text-gray-400 select-none">
              <div className="text-center">
                <HiEye className="mx-auto w-8 h-8 mb-2" />
                <div className="text-sm">
                  Generate a preview to see the PDF here
                </div>
              </div>
            </div>
          )}

          <div
            className={`${previewUrl ? "w-full sm:w-1/2" : "w-full"
              } h-full px-6 space-y-5 overflow-auto`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================
   Signature Modal
   ====================== */
function SignatureModal({
  isOpen,
  onClose,
  onSigned,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSigned: (signatureDataUrl: string) => Promise<void> | void;
}) {
  const [sigDataUrl, setSigDataUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSigDataUrl("");
      setError("");
      setFileName("");
      setFileSize(null);
      setIsDragging(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const formatSize = (size: number | null) => {
    if (!size) return "";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleFile = (file?: File | null) => {
    setError("");
    setIsDragging(false);
    if (!file) return;

    setFileName(file.name);
    setFileSize(file.size);

    if (!/image\/(png|jpeg)/i.test(file.type)) {
      setSigDataUrl("");
      return setError("Please upload a PNG or JPG image.");
    }

    if (file.size > 50 * 1024) {
      setSigDataUrl("");
      return setError("Signature must be 50 KB or less.");
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSigDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!isOpen) return;
    const el = dropRef.current;
    if (!el) return;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.target === el) {
        setIsDragging(false);
      }
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const f = e.dataTransfer?.files?.[0];
      handleFile(f || null);
    };

    el.addEventListener("dragover", onDragOver);
    el.addEventListener("dragenter", onDragEnter);
    el.addEventListener("dragleave", onDragLeave);
    el.addEventListener("drop", onDrop);

    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("dragenter", onDragEnter);
      el.removeEventListener("dragleave", onDragLeave);
      el.removeEventListener("drop", onDrop);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSignClick = () => {
    if (!sigDataUrl) {
      setError("Please select a signature image first.");
      return;
    }
    onSigned(sigDataUrl);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative z-[61] w-[96%] max-w-xl rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        <div className="relative h-24">
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${GRADIENT_FROM} 0%, ${GRADIENT_TO} 100%)`,
            }}
          />
          <div className="relative z-10 h-full px-5 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-sm font-semibold">
                ✍️
              </div>
              <div className="flex flex-col">
                <span className="font-semibold tracking-wide text-sm sm:text-base">
                  Sign as Brand
                </span>
                <span className="text-xs text-white/80">
                  Upload your official signature to finalize the document.
                </span>
              </div>
            </div>
            <button
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center text-lg"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-700">
              Upload your signature image{" "}
              <span className="font-semibold">(PNG/JPG, ≤ 50 KB)</span>. This
              will be embedded as your brand signature.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Best results with transparent PNG
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5">
                💡 Tip: Use a dark pen on white paper, then scan or crop
                neatly.
              </span>
            </div>
          </div>

          <div
            ref={dropRef}
            className={`rounded-xl border-2 border-dashed p-5 text-center text-sm transition-all cursor-pointer select-none ${isDragging
              ? "border-orange-400 bg-orange-50/80 shadow-sm"
              : "border-gray-300 bg-gray-50 hover:bg-gray-100/80"
              }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                <span className="text-lg">📁</span>
              </div>
              <div className="font-medium text-gray-800">
                {isDragging
                  ? "Drop your signature here"
                  : "Drag & drop your signature here"}
              </div>
              <div className="text-xs text-gray-500">
                or use the file picker below
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">
              Signature file
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleFile(e.target.files?.[0])
              }
              className="block w-full text-xs sm:text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-black"
            />
            <div className="flex justify-between items-center text-[11px] text-gray-500">
              <span>Allowed: PNG, JPG · Max size: 50 KB</span>
              {fileSize !== null && (
                <span>
                  Selected size:{" "}
                  <span
                    className={
                      fileSize > 50 * 1024
                        ? "text-red-600 font-medium"
                        : ""
                    }
                  >
                    {formatSize(fileSize)}
                  </span>
                </span>
              )}
            </div>
            {fileName && (
              <div className="text-[11px] text-gray-600 truncate">
                File: <span className="font-medium">{fileName}</span>
              </div>
            )}
            {error && (
              <div className="text-xs text-red-600 flex items-center gap-1 mt-1">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}
          </div>

          {sigDataUrl && (
            <div className="border rounded-xl p-3 bg-gray-50 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-gray-700">
                    Signature preview
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSigDataUrl("");
                      setFileName("");
                      setFileSize(null);
                      setError("");
                    }}
                    className="text-[11px] text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex items-center justify-center rounded-lg border bg-white px-3 py-2">
                  <img
                    src={sigDataUrl}
                    alt="Signature preview"
                    className="max-h-14 object-contain"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-1 flex flex-col sm:flex-row justify-end gap-3">
          <Button
            variant="outline"
            className="text-gray-800 border-gray-300 hover:bg-gray-100"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF7236] hover:to-[#FFA135] shadow-none disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={handleSignClick}
            disabled={!sigDataUrl}
          >
            Sign & continue
          </Button>
        </div>
      </div>
    </div>
  );
}

function SidebarSection({ title, children, icon }: any) {
  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-100 shadow-sm p-5 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white flex items-center justify-center">
            {icon}
          </div>
        )}
        <div className="font-semibold text-gray-800">{title}</div>
      </div>
      {children}
    </div>
  );
}

/* ======================
   Tiny helpers: labels + tooltips
   ====================== */
function LabelWithInfo({
  text,
  info,
}: {
  text: React.ReactNode;
  info?: React.ReactNode;
}) {
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
        <button
          type="button"
          className="inline-flex items-center"
          aria-label="Info"
        >
          <HiInformationCircle className="w-4 h-4 text-gray-500" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        className="max-w-xs text-sm leading-relaxed bg-gray-800 text-white"
      >
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  );
}

const BTN_GRAD =
  "bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF7236] hover:to-[#FFA135] shadow-none";
const BTN_OUTLINE = "border-gray-300 text-black";
const BTN_BASE = "h-9 px-3 rounded-lg";

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
      <span className="hidden sm:inline">{children}</span>
    </Button>
  );

  return title ? (
    <Tooltip>
      <TooltipTrigger asChild>{BtnInner}</TooltipTrigger>
      <TooltipContent
        side="top"
        className="text-xs bg-gray-800 text-white max-w-xs"
      >
        {title}
      </TooltipContent>
    </Tooltip>
  ) : (
    BtnInner
  );
}
