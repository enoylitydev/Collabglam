"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  HiChevronLeft,
  HiChevronRight,
  HiDocumentText,
  HiOutlineClipboardList,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiX,
} from "react-icons/hi";
import api, { post } from "@/lib/api"; // expects axios instance + helper post()
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import Swal from "sweetalert2";
import MilestoneHistoryCard from "@/components/common/milestoneCard";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ─────────────────────────── Toast & Confirm helpers ───────────────────────── */
const toast = (opts: { icon: "success" | "error" | "info"; title: string; text?: string }) =>
  Swal.fire({
    ...opts,
    showConfirmButton: false,
    timer: 1500,
    timerProgressBar: true,
    background: "white",
    customClass: {
      popup: "rounded-lg border border-gray-200",
      icon: "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] bg-clip-text text-transparent",
    },
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

/* ─────────────────────────────────── Types ─────────────────────────────────── */
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
  isContracted: number; // brand sent a contract
  contractId: string;
  isAccepted: number; // influencer accepted (confirmed)
  hasApplied: number;
  hasMilestone: number;
}

interface CampaignsResponse {
  meta: { total: number; page: number; limit: number; totalPages: number };
  campaigns: any[];
}

// Server-shaped influencer fields
export type ServerInfluencer = {
  legalName?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
  shippingAddress?: string;
  taxFormType?: "W-9" | "W-8BEN" | "W-8BEN-E";
  dataAccess?: { insightsReadOnly?: boolean; whitelisting?: boolean; sparkAds?: boolean };
};

export type LocalInfluencer = {
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
  taxFormType?: ServerInfluencer["taxFormType"];
  notes: string;
  dataAccess: NonNullable<ServerInfluencer["dataAccess"]>;
};

const emptyLocal: LocalInfluencer = {
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
  taxFormType: "W-9",
  notes: "",
  dataAccess: { insightsReadOnly: true, whitelisting: false, sparkAds: false },
};

const trim = (s?: string) => (s || "").trim();
const sanitizeLocal = (p: LocalInfluencer): LocalInfluencer => ({
  ...p,
  legalName: trim(p.legalName),
  email: trim(p.email),
  phone: trim(p.phone),
  addressLine1: trim(p.addressLine1),
  addressLine2: trim(p.addressLine2),
  city: trim(p.city),
  state: trim(p.state),
  zip: trim(p.zip),
  country: trim(p.country),
  taxId: trim(p.taxId),
  notes: trim(p.notes),
});

const composeShippingAddress = (p: LocalInfluencer) =>
  [p.addressLine1, p.addressLine2, [p.city, p.state].filter(Boolean).join(", "), p.zip, p.country]
    .filter(Boolean)
    .join(", ");

const toServerInfluencer = (sp: LocalInfluencer): ServerInfluencer => ({
  legalName: sp.legalName,
  email: sp.email,
  phone: sp.phone,
  taxId: sp.taxId || undefined,
  addressLine1: sp.addressLine1,
  addressLine2: sp.addressLine2,
  city: sp.city,
  state: sp.state,
  postalCode: sp.zip,
  country: sp.country,
  notes: sp.notes,
  shippingAddress: composeShippingAddress(sp),
  taxFormType: sp.taxFormType,
  dataAccess: {
    insightsReadOnly: !!sp.dataAccess.insightsReadOnly,
    whitelisting: !!sp.dataAccess.whitelisting,
    sparkAds: !!sp.dataAccess.sparkAds,
  },
});

export type PartyConfirm = { confirmed?: boolean; byUserId?: string; at?: string };
export type PartySign = { signed?: boolean; byUserId?: string; name?: string; email?: string; at?: string };

export type ContractMeta = {
  status?: ContractStatus | string;

  confirmations?: { brand?: PartyConfirm; influencer?: PartyConfirm };
  acceptances?: any; // optional, if you ever want to use it
  signatures?: { brand?: PartySign; influencer?: PartySign; collabglam?: PartySign };

  lockedAt?: string | null;
  editsLockedAt?: string | null;

  awaitingRole?: "brand" | "influencer" | null | string;
  version?: number;

  campaignId?: string;
  contractId?: string;

  supersededBy?: string | null;
  resendOf?: string | null;
  resendIteration?: number;
};

// ───────────────────────── Contract Status (frontend mirror) ─────────────────────────
// Keep these EXACTLY matching backend constants/strings.
const CONTRACT_STATUS = {
  BRAND_SENT_DRAFT: "BRAND_SENT_DRAFT",
  INFLUENCER_ACCEPTED: "INFLUENCER_ACCEPTED",
  BRAND_ACCEPTED: "BRAND_ACCEPTED",
  READY_TO_SIGN: "READY_TO_SIGN",
  CONTRACT_SIGNED: "CONTRACT_SIGNED",
  MILESTONES_CREATED: "MILESTONES_CREATED",
  BRAND_EDITED: "BRAND_EDITED",
  INFLUENCER_EDITED: "INFLUENCER_EDITED",
  REJECTED: "REJECTED",
  SUPERSEDED: "SUPERSEDED",
} as const;

export type ContractStatus = (typeof CONTRACT_STATUS)[keyof typeof CONTRACT_STATUS];

const normStatus = (s?: string) => String(s || "").trim().toUpperCase();

const signingStatusLabel = (meta?: ContractMeta | null) => {
  if (!meta) return null;

  const st = normStatus(meta.status);
  const isSigningPhase = st === CONTRACT_STATUS.READY_TO_SIGN || !!meta.editsLockedAt;
  if (!isSigningPhase) return null;

  const b = !!meta.signatures?.brand?.signed;
  const i = !!meta.signatures?.influencer?.signed;
  const c = !!meta.signatures?.collabglam?.signed;

  // if UI ever sees "all signed" before backend flips status to CONTRACT_SIGNED
  if (b && i && c) return "Signed";

  // Prefer backend "awaitingRole" when present (single source of truth)
  const awaiting = String(meta.awaitingRole || "").toLowerCase();
  if (awaiting === "brand") return "Awaiting brand signature";
  if (awaiting === "influencer") return "Awaiting influencer signature";
  if (awaiting === "collabglam") return "Awaiting CollabGlam signature";

  // Fallback inference (for older records that don't have awaitingRole)
  if (!b && !i) return "Ready to sign";
  if (b && !i) return "Awaiting influencer signature";
  if (!b && i) return "Awaiting brand signature";
  if (b && i && !c) return "Awaiting CollabGlam signature";

  return null;
};

/* ─────────────────────────── Small form components ────────────────────────── */
function Input({ id, label, value, onChange, type = "text", disabled = false }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-4 pt-6 pb-2 border-2 rounded-lg text-sm transition-all duration-200 focus:outline-none ${disabled ? "border-gray-200 opacity-60 cursor-not-allowed" : "border-gray-200 focus:border-[#FFBF00]"
          }`}
        placeholder=" "
      />
      <label htmlFor={id} className="absolute left-4 top-2 text-xs text-[#FFBF00] font-medium pointer-events-none">
        {label}
      </label>
    </div>
  );
}

function Textarea({ id, label, value, onChange, rows = 3, disabled = false }: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-4 pt-6 pb-2 border-2 rounded-lg text-sm transition-all duration-200 focus:outline-none ${disabled ? "border-gray-200 opacity-60 cursor-not-allowed" : "border-gray-200 focus:border-[#FFBF00]"
          }`}
        placeholder=" "
      />
      <label htmlFor={id} className="absolute left-4 top-2 text-xs text-[#FFBF00] font-medium pointer-events-none">
        {label}
      </label>
    </div>
  );
}

function Checkbox({ label, checked, onChange, disabled = false }: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 ${disabled
        ? "border-gray-200 opacity-60 cursor-not-allowed"
        : "border-gray-200 hover:border-[#FFBF00] hover:bg-yellow-50/50 cursor-pointer"
        }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-5 h-5 rounded border-2 border-gray-300 text-[#FFBF00] focus:ring-2 focus:ring-[#FFBF00] focus:ring-offset-2"
      />
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </label>
  );
}

/* ─────────────────────────── API error helper ─────────────────────────── */
function apiMessage(e: any, fallback = "Something went wrong") {
  const status = e?.response?.status;
  const msg = e?.response?.data?.message || e?.message;

  const known = [
    "Contract is locked and cannot be edited",
    "Contract is locked for signing; edits are disabled",
    "Influencer must accept the current version first",
    "Brand must accept the current version first",
    "Both parties must accept the current version before signing",
    "Contract is not ready to sign yet",
    "Contract not found",
    "Signature image must be ≤ 50 KB.",
  ];

  if (msg && known.some((k) => String(msg).includes(k))) return msg;

  if (status === 400) return msg || "Bad request.";
  if (status === 401) return "Please sign in again.";
  if (status === 403) return "You don’t have permission to do that.";
  if (status === 404) return "Not found.";
  if (status === 409) return msg || "Conflict. Please refresh.";
  if (status === 422) return msg || "Validation error.";
  if (status >= 500) return "Server error. Please try again.";

  return msg || fallback;
}

/* ───────────────────────────── Signature Modal ────────────────────────────── */
function SignatureModal({
  open,
  onClose,
  onSubmit,
  title = "Add Signature",
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (signatureDataUrl: string) => Promise<void> | void;
  title?: string;
}) {
  const [sig, setSig] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dropRef = useRef<HTMLDivElement | null>(null);

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setSig("");
      setErr("");
      setFileName("");
      setFileSize(null);
      setIsDragging(false);
    }
  }, [open]);

  // Close with ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const formatSize = (size: number | null) => {
    if (!size) return "";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const onFile = (f?: File) => {
    setErr("");
    setIsDragging(false);
    if (!f) return;

    setFileName(f.name);
    setFileSize(f.size);

    if (!/image\/(png|jpeg)/i.test(f.type)) {
      setSig("");
      return setErr("Please upload a PNG or JPG image.");
    }
    if (f.size > 50 * 1024) {
      setSig("");
      return setErr("Signature must be ≤ 50 KB.");
    }

    const r = new FileReader();
    r.onload = () => setSig(String(r.result || ""));
    r.readAsDataURL(f);
  };

  // Drag & drop behavior
  useEffect(() => {
    if (!open) return;
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
      if (e.target === el) setIsDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const f = e.dataTransfer?.files?.[0];
      onFile(f || undefined);
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
  }, [open]);

  if (!open) return null;

  const handleSign = () => {
    if (!sig) {
      setErr("Please select a signature image first.");
      return;
    }
    onSubmit(sig);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-[61] w-[96%] max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="relative h-24">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, #FFBF00 0%, #FFDB58 100%)",
            }}
          />
          <div className="relative z-10 h-full px-5 flex items-center justify-between text-gray-900">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/50 flex items-center justify-center text-lg">
                ✍️
              </div>
              <div className="flex flex-col">
                <div className="font-semibold tracking-wide text-sm sm:text-base">
                  {title}
                </div>
                <div className="text-xs text-gray-800/80">
                  Upload your official brand signature (PNG/JPG, ≤ 50 KB)
                </div>
              </div>
            </div>
            <button
              className="w-9 h-9 rounded-full bg-white/40 hover:bg-white flex items-center justify-center text-gray-800 transition"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-gray-700">
              This signature will be embedded into your agreement as the
              authorized brand sign-off.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Best with transparent PNG
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5">
                💡 Tip: Use a dark pen on white paper, then crop neatly.
              </span>
            </div>
          </div>

          {/* Drag & Drop Area */}
          <div
            ref={dropRef}
            className={`rounded-xl border-2 border-dashed p-5 text-center text-sm transition-all cursor-pointer select-none
              ${isDragging
                ? "border-amber-400 bg-amber-50 shadow-sm"
                : "border-gray-300 bg-gray-50 hover:bg-gray-100/80"
              }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                <span className="text-lg">📁</span>
              </div>
              <div className="font-medium text-gray-800">
                {isDragging
                  ? "Drop your signature image here"
                  : "Drag & drop signature image here"}
              </div>
              <div className="text-xs text-gray-500">
                or use the file picker below
              </div>
            </div>
          </div>

          {/* File input + meta + errors */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">
              Signature file
            </label>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-xs sm:text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-black"
            />
            <div className="flex justify-between items-center text-[11px] text-gray-500">
              <span>Allowed: PNG, JPG · Max size: 50 KB</span>
              {fileSize !== null && (
                <span>
                  Selected:{" "}
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
            {err && (
              <div className="text-xs text-red-600 flex items-center gap-1 mt-1">
                <span>⚠️</span>
                <span>{err}</span>
              </div>
            )}
          </div>

          {/* Preview */}
          {sig && (
            <div className="border rounded-xl p-3 bg-gray-50 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-gray-700">
                    Signature preview
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSig("");
                      setFileName("");
                      setFileSize(null);
                      setErr("");
                    }}
                    className="text-[11px] text-gray-500 hover:text-gray-700 underline"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex items-center justify-center rounded-lg border bg-white px-3 py-2">
                  <img
                    src={sig}
                    alt="Signature preview"
                    className="max-h-14 object-contain"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-1 flex justify-end gap-3">
          <Button
            variant="outline"
            className="text-gray-900 border-gray-300 hover:bg-gray-100"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900 hover:from-[#FFDB58] hover:to-[#FFBF00] disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={handleSign}
            disabled={!sig}
          >
            Sign
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Contract Modal: Accept / Edit / Sign ───────────────── */
function InfluencerContractModal({
  open,
  onClose,
  contractId,
  campaign,
  readOnly = false,
  onAfterAction,
  initialMode = "edit",
}: {
  open: boolean;
  onClose: () => void;
  contractId: string;
  campaign: Campaign;
  readOnly?: boolean;
  onAfterAction?: () => void;
  initialMode?: "view" | "edit";
}) {
  const [local, setLocal] = useState<LocalInfluencer>(emptyLocal);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isWorking, setIsWorking] = useState(false);
  const [liteLoaded, setLiteLoaded] = useState(false);

  // Resolve to resent child if present
  const [effectiveContractId, setEffectiveContractId] = useState<string>(contractId);
  const [meta, setMeta] = useState<ContractMeta | null>(null);
  const [showTax, setShowTax] = useState(false);

  const st = normStatus(meta?.status);

  const influencerConfirmed = !!meta?.confirmations?.influencer?.confirmed;
  const brandConfirmed = !!meta?.confirmations?.brand?.confirmed;

  const brandSigned = !!meta?.signatures?.brand?.signed;
  const influencerSigned = !!meta?.signatures?.influencer?.signed;
  const anyoneSigned = brandSigned || influencerSigned || !!meta?.signatures?.collabglam?.signed;

  const isReadyToSign = st === CONTRACT_STATUS.READY_TO_SIGN || !!meta?.editsLockedAt;
  const isLocked =
    !!meta?.lockedAt ||
    st === CONTRACT_STATUS.CONTRACT_SIGNED ||
    st === CONTRACT_STATUS.MILESTONES_CREATED;

  const isRejected = st === CONTRACT_STATUS.REJECTED;
  const isSuperseded = st === CONTRACT_STATUS.SUPERSEDED;

  const canSign =
    !isLocked &&
    isReadyToSign &&
    influencerConfirmed &&
    brandConfirmed &&
    !influencerSigned;

  const canEdit = useMemo(() => {
    if (readOnly) return false;
    if (isLocked || isReadyToSign) return false;
    if (isRejected || isSuperseded) return false;
    if (anyoneSigned) return false;
    return true;
  }, [readOnly, isLocked, isReadyToSign, isRejected, isSuperseded, anyoneSigned]);

  const [mode, setMode] = useState<"view" | "edit">(initialMode);

  // Hide Edit entirely when not allowed & force to View
  useEffect(() => {
    if (!canEdit && mode === "edit") setMode("view");
  }, [canEdit, mode]);

  // Signature modal state (inside modal remains available)
  const [showSignModal, setShowSignModal] = useState(false);

  /* Prefill UI model from influencer lite */
  const toLocalFromLite = (lite: any): LocalInfluencer => {
    const primary = (lite?.primaryPlatform || "").toLowerCase();
    const profiles: any[] = Array.isArray(lite?.socialProfiles) ? lite.socialProfiles : [];
    const match = profiles.find((p) => (p?.provider || "").toLowerCase() === primary) || profiles[0] || {};
    const bestName = lite?.legalName || lite?.name || match?.fullname || match?.username || "";
    return {
      legalName: bestName,
      email: lite?.email || "",
      phone: lite?.phone || "",
      addressLine1: "",
      addressLine2: "",
      city: lite?.city || "",
      state: lite?.state || "",
      zip: "",
      country: lite?.country || "",
      taxId: "",
      taxFormType: "W-9",
      notes: "",
      dataAccess: {
        insightsReadOnly: true,
        whitelisting: !!lite?.onboarding?.allowlisting,
        sparkAds: false,
      },
    };
  };

  const contractInfluencerToLocal = (ci: any, prev: LocalInfluencer): LocalInfluencer =>
    sanitizeLocal({
      ...prev,
      legalName: ci.legalName ?? prev.legalName,
      email: ci.email ?? prev.email,
      phone: ci.phone ?? prev.phone,
      addressLine1: ci.addressLine1 ?? prev.addressLine1,
      addressLine2: ci.addressLine2 ?? prev.addressLine2,
      city: ci.city ?? prev.city,
      state: ci.state ?? prev.state,
      zip: ci.postalCode ?? ci.zip ?? prev.zip,
      country: ci.country ?? prev.country,
      taxId: ci.taxId ?? prev.taxId,
      taxFormType: (ci.taxFormType as any) ?? prev.taxFormType,
      notes: ci.notes ?? prev.notes,
      dataAccess: {
        insightsReadOnly: ci?.dataAccess?.insightsReadOnly ?? prev.dataAccess.insightsReadOnly,
        whitelisting: ci?.dataAccess?.whitelisting ?? prev.dataAccess.whitelisting,
        sparkAds: ci?.dataAccess?.sparkAds ?? prev.dataAccess.sparkAds,
      },
    });

  const fetchInfluencerLite = useCallback(async () => {
    try {
      const influencerId = typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
      if (!influencerId) throw new Error("No influencer ID found in localStorage.");
      const res = await api.get("/influencer/lite", { params: { influencerId } });
      setLocal(toLocalFromLite(res.data?.influencer || {}));
    } catch (e: any) {
      console.warn("lite fetch failed", e?.message);
    } finally {
      setLiteLoaded(true);
    }
  }, []);

  const fetchContractMeta = useCallback(async () => {
    try {
      const influencerId = typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
      if (!influencerId) throw new Error("No influencer ID found in localStorage.");

      const list = await post<{ success?: boolean; contracts: any[] }>("/contract/getContract", {
        brandId: campaign.brandId,
        influencerId,
        campaignId: campaign.id,
      });

      const arr = Array.isArray((list as any)?.contracts) ? (list as any).contracts : [];

      let c: any =
        arr.find((x: any) => String(x.contractId) === String(contractId)) ||
        arr.find((x: any) => String(x.campaignId) === String(campaign.id)) ||
        null;

      if (c?.supersededBy) {
        const child = arr.find((x: any) => String(x.contractId) === String(c.supersededBy));
        if (child) c = child;
      }

      if (c) {
        setEffectiveContractId(c.contractId);
        setMeta({
          status: c.status,
          confirmations: c.confirmations || {},
          signatures: c.signatures || {},
          lockedAt: c.lockedAt,
          editsLockedAt: c.editsLockedAt,
          awaitingRole: c.awaitingRole,
          version: c.version,
          campaignId: c.campaignId,
          contractId: c.contractId,
          supersededBy: c.supersededBy,
          resendOf: c.resendOf || null,
          resendIteration: c.resendIteration,
        });

        // Prefill on edit open ONLY
        if (!readOnly && c.influencer && Object.keys(c.influencer).length) {
          setLocal((prev) => contractInfluencerToLocal(c.influencer, prev));
        }
      } else {
        setMeta(null);
        setEffectiveContractId(contractId);
      }
    } catch (e) {
      setMeta(null);
      setEffectiveContractId(contractId);
    }
  }, [campaign.brandId, campaign.id, contractId, readOnly]);

  // initial open: load lite + meta
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setPreviewUrl("");
      await fetchInfluencerLite();
      if (cancelled) return;
      await fetchContractMeta();
    })();
    return () => {
      cancelled = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contractId, fetchInfluencerLite, fetchContractMeta]);

  // Reset mode when modal opens or initialMode changes
  useEffect(() => {
    if (!open) return;
    if (initialMode === "edit" && !readOnly) {
      setMode("edit");
    } else {
      setMode("view");
    }
  }, [open, initialMode, readOnly]);

  // If editing becomes disallowed while in edit mode, force back to view
  useEffect(() => {
    if (!canEdit && mode === "edit") setMode("view");
  }, [canEdit, mode]);

  // Ensure a preview exists when switching to either view OR edit (via /contract/viewPdf)
  useEffect(() => {
    if (!open) return;
    if ((mode === "view" || mode === "edit") && !previewUrl) {
      generatePreview(true).catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, open]);

  const generatePreview = async (silent = false) => {
    setIsWorking(true);
    try {
      const res = await api.post(
        "/contract/viewPdf",
        { contractId: effectiveContractId },
        { responseType: "blob" }
      );
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(res.data);
      setPreviewUrl(url);
      if (!silent) toast({ icon: "info", title: "PDF loaded" });
    } catch (e: any) {
      toast({ icon: "error", title: "Preview Error", text: apiMessage(e, "Failed to load PDF.") });
      throw e;
    } finally {
      setIsWorking(false);
    }
  };

  const acceptOrSave = async () => {
    setIsWorking(true);
    try {
      const sp = sanitizeLocal(local);
      const payload: ServerInfluencer = toServerInfluencer(sp);

      // Simple Tax ID format validation
      const isValidTaxId = (value: string, taxFormType?: ServerInfluencer["taxFormType"]) => {
        const v = (value || "").trim();
        if (!v) return true;
        if (taxFormType === "W-9") return /^(?:\d{3}-\d{2}-\d{4}|\d{2}-\d{7}|\d{9})$/.test(v);
        return /^[A-Za-z0-9 \-\/]{4,30}$/.test(v);
      };
      if (!isValidTaxId(sp.taxId, sp.taxFormType)) {
        setIsWorking(false);
        toast({ icon: "error", title: "Invalid Tax ID", text: sp.taxFormType === "W-9" ? "Enter a valid SSN (XXX-XX-XXXX), EIN (XX-XXXXXXX), or 9 digits." : "Enter a valid Tax ID (4–30 characters; letters, numbers, spaces, '-' or '/')." });
        return;
      }

      if (!influencerConfirmed) {
        const ok = await askConfirm("Accept Contract?", "Your details will be submitted to the brand.");
        if (!ok) return;
        await post("/contract/influencer/confirm", { contractId: effectiveContractId, influencer: payload });
        toast({ icon: "success", title: "Accepted", text: "Details saved. Contract accepted." });
      } else {
        await post("/contract/influencer/update", { contractId: effectiveContractId, influencerUpdates: payload });
        toast({ icon: "success", title: "Saved", text: "Your changes were saved." });
      }

      await fetchContractMeta();
      onAfterAction && onAfterAction();
      setMode("view");
      await generatePreview(true);
    } catch (e: any) {
      toast({ icon: "error", title: "Error", text: apiMessage(e, "Failed to save.") });
    } finally {
      setIsWorking(false);
    }
  };

  const openSignature = () => {
    if (isLocked) return;

    if (!isReadyToSign) {
      toast({ icon: "error", title: "Not ready to sign", text: "Waiting for both parties to accept the current version." });
      return;
    }
    if (!influencerConfirmed) {
      toast({ icon: "error", title: "Accept first", text: "Please accept the contract before signing." });
      return;
    }
    if (!brandConfirmed) {
      toast({ icon: "error", title: "Brand acceptance pending", text: "Brand must accept before signing can start." });
      return;
    }
    setShowSignModal(true);
  };

  const signWithSignature = async (signatureDataUrl: string) => {
    setIsWorking(true);
    try {
      await post("/contract/sign", {
        contractId: effectiveContractId,
        role: "influencer",
        name: local.legalName,
        email: local.email,
        signatureImageDataUrl: signatureDataUrl,
      });
      toast({ icon: "success", title: "Signed", text: "Signature recorded." });
      setShowSignModal(false);
      await fetchContractMeta();
      onAfterAction && onAfterAction();
      onClose();
    } catch (e: any) {
      toast({ icon: "error", title: "Sign Error", text: apiMessage(e, "Failed to sign.") });
    } finally {

      setIsWorking(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full bg-white shadow-2xl border-l flex flex-col">
        {/* Header */}
        <div className="relative h-24 overflow-hidden">
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, #FFBF00 0%, #FFDB58 100%)` }} />
          <div className="relative z-10 p-5 text-gray-900 flex items-center justify-between h-full">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center">
                  <HiDocumentText className="w-6 h-6 text-gray-900" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-medium opacity-90 uppercase tracking-wider">
                    {mode === "view" ? "View Contract" : influencerConfirmed ? "Edit Contract Details" : "Accept Contract"}
                  </div>
                  <div className="text-lg font-bold truncate">{campaign?.productOrServiceName || "Campaign"}</div>
                  <div className="mt-0.5 text-[11px] text-gray-800 truncate">
                    {campaign?.brandName ? `${campaign.brandName}` : ""} {campaign?.brandName && campaign?.id ? "•" : ""} {campaign?.id ? `#${campaign.id.slice(-6)}` : ""}
                  </div>
                </div>
              </div>
            </div>

            {/* Mode Switcher (Edit hidden when cannot edit) */}
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-full border border-gray-300 overflow-hidden">
                <button className={`px-3 py-1.5 text-sm ${mode === "view" ? "bg-white" : "bg-gray-100"} transition`} onClick={() => setMode("view")}>
                  View
                </button>
                {canEdit && (
                  <button className={`px-3 py-1.5 text-sm ${mode === "edit" ? "bg-white" : "bg-gray-100"} transition`} onClick={() => setMode("edit")}>
                    Edit
                  </button>
                )}
              </div>
              <button className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110" onClick={onClose}>
                <HiX className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Minimal meta line */}
        <div className="px-5 pt-3 flex flex-wrap gap-2 text-[11px]">
          {meta?.status && (
            <span className={`px-2 py-1 rounded-full border ${isLocked ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-yellow-50 border-yellow-200 text-yellow-700"
              }`}>
              Status: {String(meta.status).toUpperCase()}
            </span>
          )}
          {(!!meta?.resendOf || (meta?.resendIteration ?? 0) > 0) && (
            <span className="px-2 py-1 rounded-full border bg-blue-50 border-blue-200 text-blue-700">
              Resent
            </span>
          )}
          <span className="px-2 py-1 rounded-full border bg-gray-50 border-gray-200 text-gray-700">You: {influencerConfirmed ? "Accepted" : "Pending"}</span>
          <span className="px-2 py-1 rounded-full border bg-gray-50 border-gray-200 text-gray-700">You Signed: {meta?.signatures?.influencer?.signed ? "Yes" : "No"}</span>
          <span className="px-2 py-1 rounded-full border bg-gray-50 border-gray-200 text-gray-700">Brand Signed: {meta?.signatures?.brand?.signed ? "Yes" : "No"}</span>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-6.5rem)] overflow-y-auto">
          {/* VIEW → PDF */}
          {mode === "view" && (
            <div className="p-5">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-gray-800">Contract PDF</div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => (previewUrl ? window.open(previewUrl, "_blank") : generatePreview())}>
                      <HiOutlineEye className="mr-2 h-5 w-5" />
                      {previewUrl ? "Open in New Tab" : "Load PDF"}
                    </Button>
                  </div>
                </div>
                {previewUrl ? (
                  <iframe className="w-full h-[70vh] rounded border" src={previewUrl} />
                ) : (
                  <div className="rounded-lg border border-dashed p-10 text-center text-gray-500">Load the PDF to view your contract.</div>
                )}
              </div>
            </div>
          )}

          {/* EDIT → split layout: LEFT preview, RIGHT form */}
          {mode === "edit" && (
            <div className="p-5">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
                {/* LEFT: Preview */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 xl:sticky xl:top-4 self-start">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-gray-800">Contract PDF</div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => (previewUrl ? window.open(previewUrl, "_blank") : generatePreview())}>
                        <HiOutlineEye className="mr-2 h-5 w-5" />
                        {previewUrl ? "Open in New Tab" : "Load PDF"}
                      </Button>
                      <Button variant="outline" onClick={() => generatePreview()} disabled={isWorking}>
                        Refresh
                      </Button>
                    </div>
                  </div>
                  {previewUrl ? (
                    <iframe className="w-full h-[70vh] rounded border" src={previewUrl} />
                  ) : (
                    <div className="rounded-lg border border-dashed p-10 text-center text-gray-500">Load the PDF to view your contract.</div>
                  )}
                </div>

                {/* RIGHT: Form + actions (signature via modal) */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="font-semibold text-gray-800 mb-3">{influencerConfirmed ? "Edit Your Details" : "Fill Your Details to Accept"}</div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <Input id="legalName" label="Legal Name" value={local.legalName} onChange={(v) => setLocal((p) => ({ ...p, legalName: v }))} disabled={!canEdit} />
                    <Input id="email" label="Email" value={local.email} onChange={(v) => setLocal((p) => ({ ...p, email: v }))} disabled={!canEdit} />
                    <Input id="phone" label="Phone" value={local.phone} onChange={(v) => setLocal((p) => ({ ...p, phone: v }))} disabled={!canEdit} />

                    {/* Tax Form Type selector */}
                    <div className="relative">
                      <label htmlFor="taxFormType" className="absolute left-4 top-2 text-xs text-[#FFBF00] font-medium pointer-events-none">
                        Tax Form Type
                      </label>
                      <select
                        id="taxFormType"
                        disabled={!canEdit}
                        value={local.taxFormType}
                        onChange={(e) => setLocal((p) => ({ ...p, taxFormType: e.target.value as any }))}
                        className={`w-full px-4 pt-6 pb-2 border-2 rounded-lg text-sm transition-all duration-200 focus:outline-none ${!canEdit ? "border-gray-200 opacity-60 cursor-not-allowed" : "border-gray-200 focus:border-[#FFBF00]"
                          }`}
                      >
                        <option value="W-9">W-9</option>
                        <option value="W-8BEN">W-8BEN</option>
                        <option value="W-8BEN-E">W-8BEN-E</option>
                      </select>
                    </div>

                    {/* Tax ID (secure) */}
                    <div className="relative">
                      <label htmlFor="taxId" className="absolute left-4 top-2 text-xs text-[#FFBF00] font-medium pointer-events-none">Tax ID {local.taxFormType === "W-9" ? "(SSN/EIN)" : ""}</label>
                      <input
                        id="taxId"
                        type={showTax ? "text" : "password"}
                        value={local.taxId}
                        onChange={(e) => setLocal((p) => ({ ...p, taxId: e.target.value }))}
                        disabled={!canEdit}
                        className={`w-full px-4 pt-6 pb-2 pr-12 border-2 rounded-lg text-sm transition-all duration-200 focus:outline-none ${!canEdit ? "border-gray-200 opacity-60 cursor-not-allowed" : "border-gray-200 focus:border-[#FFBF00]"
                          }`}
                        placeholder=" "
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTax((s) => !s)}
                        disabled={!canEdit}
                        aria-label={showTax ? "Hide Tax ID" : "Show Tax ID"}
                        aria-controls="taxId"
                        aria-pressed={showTax}
                        className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-md border bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#FFBF00] disabled:opacity-50"
                        title={showTax ? "Hide Tax ID" : "Show Tax ID"}
                      >
                        {showTax ? (
                          <HiOutlineEyeOff className="w-5 h-5 text-gray-600" />
                        ) : (
                          <HiOutlineEye className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                    </div>

                    {/* Address composition */}
                    <Input id="addressLine1" label="Address Line 1" value={local.addressLine1} onChange={(v) => setLocal((p) => ({ ...p, addressLine1: v }))} disabled={!canEdit} />
                    <Input id="addressLine2" label="Address Line 2" value={local.addressLine2} onChange={(v) => setLocal((p) => ({ ...p, addressLine2: v }))} disabled={!canEdit} />
                    <Input id="city" label="City" value={local.city} onChange={(v) => setLocal((p) => ({ ...p, city: v }))} disabled={!canEdit} />
                    <Input id="state" label="State" value={local.state} onChange={(v) => setLocal((p) => ({ ...p, state: v }))} disabled={!canEdit} />
                    <Input id="zip" label="ZIP / Postal Code" value={local.zip} onChange={(v) => setLocal((p) => ({ ...p, zip: v }))} disabled={!canEdit} />
                    <Input id="country" label="Country" value={local.country} onChange={(v) => setLocal((p) => ({ ...p, country: v }))} disabled={!canEdit} />
                  </div>

                  <div className="mt-3">
                    <Textarea id="notes" label="Notes (optional)" value={local.notes} onChange={(v) => setLocal((p) => ({ ...p, notes: v }))} rows={3} disabled={!canEdit} />
                  </div>

                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-800 mb-2">
                      Data / Access Consents
                    </div>

                    <TooltipProvider delayDuration={150}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {/* Read-Only Insights Access */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Checkbox
                                label="Read-Only Insights Access"
                                checked={!!local.dataAccess.insightsReadOnly}
                                onChange={(checked) =>
                                  setLocal((p) => ({
                                    ...p,
                                    dataAccess: { ...p.dataAccess, insightsReadOnly: checked },
                                  }))
                                }
                                disabled={!canEdit}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-black text-white border-black text-xs max-w-xs">
                            <p>
                              Allows the brand to view your analytics / insights only. No posting,
                              editing, or account control.
                            </p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Whitelisting Access */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Checkbox
                                label="Whitelisting Access"
                                checked={!!local.dataAccess.whitelisting}
                                onChange={(checked) =>
                                  setLocal((p) => ({
                                    ...p,
                                    dataAccess: { ...p.dataAccess, whitelisting: checked },
                                  }))
                                }
                                disabled={!canEdit}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-black text-white border-black text-xs max-w-xs">
                            <p>
                              Lets the brand run paid ads using your handle/content (whitelisted
                              usage) according to this agreement.
                            </p>
                          </TooltipContent>
                        </Tooltip>

                        {/* Spark Ads Access */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Checkbox
                                label="Spark Ads Access"
                                checked={!!local.dataAccess.sparkAds}
                                onChange={(checked) =>
                                  setLocal((p) => ({
                                    ...p,
                                    dataAccess: { ...p.dataAccess, sparkAds: checked },
                                  }))
                                }
                                disabled={!canEdit}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-black text-white border-black text-xs max-w-xs">
                            <p>
                              Authorizes the brand to run Spark Ads on your posts where supported
                              (e.g. TikTok Spark Ads).
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>

                    <div className="text-xs text-gray-500 mt-1">
                      Consents appear in Parties block / Section 12(e) and Schedule K references
                      inside the contract.
                    </div>
                  </div>


                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button onClick={acceptOrSave} disabled={isWorking || !liteLoaded} className="bg-emerald-600 hover:bg-emerald-700 text-white" title={!liteLoaded ? "Loading your profile…" : ""}>
                      {influencerConfirmed ? "Save Changes" : "Accept & Save"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex items-center justify-between">
          <div className="text-xs text-gray-600">
            {isLocked ? (
              <span className="text-emerald-600">Locked — all signatures/confirmations captured.</span>
            ) : influencerConfirmed ? (
              <span className="text-emerald-600">Accepted — you can view{canEdit ? ", edit," : ""} and sign.</span>
            ) : (
              <span className="text-amber-600">Fill details to accept the contract.</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal open={showSignModal} onClose={() => setShowSignModal(false)} title="Sign as Influencer" onSubmit={signWithSignature} />
    </div>
  );
}

/* ─────────────────────────── Reject button (compact) ───────────────────────── */
function RejectButton({ contractId, onDone }: { contractId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const submit = async () => {
    try {
      const influencerId = typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
      if (!influencerId) throw new Error("No influencer ID.");
      await post("/contract/reject", { contractId, influencerId, reason: reason.trim() });
      toast({ icon: "info", title: "Rejected", text: "Contract has been rejected." });
      setOpen(false);
      onDone();
    } catch (e: any) {
      toast({ icon: "error", title: "Error", text: e.message || "Failed to reject contract." });
    }
  };

  return (
    <>
      <Button variant="outline" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => setOpen(true)} title="Reject contract">
        Reject
      </Button>
      {open && (
        <div className="fixed inset-0 backdrop-blur-sm bg-gray-900/30 flex items-center justify-center z-50">
          <div className="relative bg-white rounded-lg w-96 p-6 space-y-4">
            <button onClick={() => setOpen(false)} className="absolute top-2 right-2 p-2 text-gray-600 hover:text-gray-900">
              <HiX size={24} />
            </button>
            <h2 className="text-lg font-semibold">Reject Contract</h2>
            <p className="text-sm text-gray-700">Let the brand know why you’re rejecting this contract:</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full h-24 p-2 border rounded focus:outline-none focus:ring" placeholder="Your reason (optional)" />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} className="bg-red-600 hover:bg-red-700 text-white">Submit</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────── Reusable Campaign Table ───────────────────────── */
function CampaignTable({ data, loading, error, emptyMessage, page, totalPages, onPrev, onNext, showMilestones = false, onOpenEditor, onRefreshAll, metaCache, onSignDirect, }: {
  data: Campaign[];
  loading: boolean;
  error: string | null;
  emptyMessage: string;
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  showMilestones?: boolean;
  onOpenEditor: (c: Campaign, viewOnly: boolean, startMode?: "view" | "edit") => void;
  onRefreshAll: () => void;
  metaCache: Record<string, ContractMeta | null>;
  onSignDirect: (opts: {
    contractId: string;
    influencerConfirmed: boolean;
    brandConfirmed: boolean;
    isLocked: boolean;
    isReadyToSign: boolean;
  }) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const influencerId = typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;

  const formatDate = (d: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(d));
  const formatCurrency = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

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
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </td>
        </tr>
      ))}
    </tbody>
  );

  const DataRows = () => (
    <tbody>
      {data.map((c, idx) => {
        const meta = metaCache[c.id] || null;
        const st = normStatus(meta?.status);

        const signLabel = signingStatusLabel(meta);

        const effectiveContractId = meta?.contractId || c.contractId;
        const hasContract = !!effectiveContractId;

        const influencerConfirmed = !!meta?.confirmations?.influencer?.confirmed;
        const brandConfirmed = !!meta?.confirmations?.brand?.confirmed;

        const brandSigned = !!meta?.signatures?.brand?.signed;
        const influencerSigned = !!meta?.signatures?.influencer?.signed;

        const isReadyToSign = st === CONTRACT_STATUS.READY_TO_SIGN || !!meta?.editsLockedAt;
        const isLocked =
          !!meta?.lockedAt ||
          st === CONTRACT_STATUS.CONTRACT_SIGNED ||
          st === CONTRACT_STATUS.MILESTONES_CREATED;

        const isRejected = st === CONTRACT_STATUS.REJECTED;
        const isSuperseded = st === CONTRACT_STATUS.SUPERSEDED;

        const canEditRow = hasContract && !isLocked && !isReadyToSign && !isRejected && !isSuperseded;
        const needsAccept = hasContract && !influencerConfirmed && canEditRow; // action needed
        const canSign =
          hasContract && !isLocked && isReadyToSign && influencerConfirmed && brandConfirmed && !influencerSigned;

        const canReject = hasContract && !isLocked && !isRejected && !isSuperseded; // (until fully signed/locked)

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
                {!hasContract ? (
                  <Badge className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 shadow-none">
                    {c.hasApplied === 1 ? "Brand Reviewing" : "Active"}
                  </Badge>
                ) : (
                  <Badge className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 shadow-none">
                    {signLabel ??
                      (st === CONTRACT_STATUS.BRAND_SENT_DRAFT ? "Awaiting Your Acceptance" :
                        st === CONTRACT_STATUS.BRAND_EDITED ? "Updated by Brand (Review)" :
                          st === CONTRACT_STATUS.INFLUENCER_ACCEPTED ? "Awaiting Brand Acceptance" :
                            st === CONTRACT_STATUS.INFLUENCER_EDITED ? "Sent to Brand (Pending)" :
                              st === CONTRACT_STATUS.READY_TO_SIGN ? "Ready to Sign" :
                                st === CONTRACT_STATUS.CONTRACT_SIGNED ? "Contract Signed" :
                                  st === CONTRACT_STATUS.MILESTONES_CREATED ? "Milestones Created" :
                                    st === CONTRACT_STATUS.REJECTED ? "Rejected" :
                                      st === CONTRACT_STATUS.SUPERSEDED ? "Superseded" :
                                        (meta?.status ? String(meta.status) : "Contract"))}
                  </Badge>
                )}
              </td>
              <td className="px-6 py-4 flex justify-center gap-2 whitespace-nowrap">
                {!hasContract ? (
                  <Button
                    variant="outline"
                    className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900"
                    onClick={() => (window.location.href = `/influencer/my-campaign/view-campaign?id=${c.id}`)}
                  >
                    View Campaign
                  </Button>
                ) : (
                  <>
                    {needsAccept && (
                      <Button
                        variant="outline"
                        className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900"
                        onClick={() => onOpenEditor({ ...c, contractId: effectiveContractId }, false, "edit")}
                        title="Review details and accept"
                      >
                        Review & Accept
                      </Button>
                    )}

                    {!needsAccept && canEditRow && (
                      <Button
                        variant="outline"
                        className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900"
                        onClick={() => onOpenEditor({ ...c, contractId: effectiveContractId }, false, "edit")}
                        title="Edit your details"
                      >
                        Edit Details
                      </Button>
                    )}

                    {canSign && (
                      <Button
                        className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900"
                        onClick={() =>
                          onSignDirect({
                            contractId: effectiveContractId,
                            influencerConfirmed,
                            brandConfirmed,
                            isLocked,
                            isReadyToSign,
                          })
                        }
                      >
                        Sign as Influencer
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => onOpenEditor({ ...c, contractId: effectiveContractId }, true, "view")}
                      className="bg-white"
                      title="View contract"
                    >
                      View Contract
                    </Button>

                    {canReject && <RejectButton contractId={effectiveContractId} onDone={onRefreshAll} />}
                  </>
                )}

                {showMilestones && (
                  <button
                    onClick={() => setExpandedId((prev) => (prev === c.id ? null : c.id))}
                    className="p-2 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900 rounded-md hover:brightness-95 transition"
                  >
                    <HiOutlineClipboardList size={18} className="inline-block mr-1" />
                    {isExpanded ? "Hide" : "View"} Milestone
                  </button>
                )}
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
                <th key={h} className={`px-6 py-3 font-medium whitespace-nowrap ${i === 0 ? "text-left" : "text-center"}`}>
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
        <thead className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900">
          <tr>
            {["Campaign", "Brand", "Budget", "Timeline", "Status", "Actions"].map((h, i) => (
              <th key={h} className={`px-6 py-3 font-medium whitespace-nowrap ${i === 0 ? "text-left" : "text-center"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <DataRows />
      </table>
      {/* Pagination */}
      <div className="flex justify-end items-center p-4 space-x-2">
        <button onClick={onPrev} disabled={page === 1} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50">
          <HiChevronLeft size={20} />
        </button>
        <span className="text-gray-700">Page {page} of {totalPages}</span>
        <button onClick={onNext} disabled={page === totalPages} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50">
          <HiChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Page Component ───────────────────────────── */
type ViewKey = "active" | "contracted" | "applied" | "all";

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

  /* Contract meta cache (per campaign) */
  const [metaCache, setMetaCache] = useState<Record<string, ContractMeta | null>>({});
  const [metaLoading, setMetaLoading] = useState(false);

  /* Influencer identity for signing from table */
  const [influencerIdentity, setInfluencerIdentity] = useState<{ legalName?: string; name?: string; email?: string }>({});

  /* Page-level signature modal */
  const [topSignOpen, setTopSignOpen] = useState(false);
  const [topSignContractId, setTopSignContractId] = useState<string>("");

  /* NEW: selection view */
  const [view, setView] = useState<ViewKey>("all");

  const itemsPerPage = 10;

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

  /* Fetchers */
  const fetchActiveCampaigns = useCallback(async () => {
    setActiveLoading(true);
    setActiveError(null);
    try {
      const influencerId = typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
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
      const influencerId = typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
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
      const influencerId = typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
      if (!influencerId) throw new Error("No influencer ID found.");
      const payload = { influencerId, search: search.trim(), page: contractedPage, limit: itemsPerPage };
      const data = await post<CampaignsResponse>("/campaign/contracted", payload);
      setContractedCampaigns(data.campaigns.map(normalize));
      setContractedTotalPages(data.meta.totalPages);
    } catch (e: any) {
      setContractedError(e.message || "Failed to load contracted campaigns.");
    } finally {
      setContractedLoading(false);
    }
  }, [search, contractedPage]);

  useEffect(() => { fetchContractedCampaigns(); }, [fetchContractedCampaigns]);
  useEffect(() => { fetchActiveCampaigns(); }, [fetchActiveCampaigns]);
  useEffect(() => { fetchAppliedCampaigns(); }, [fetchAppliedCampaigns]);

  /* Build/refresh meta cache for visible campaigns */
  const loadMetaCache = useCallback(async (list: Campaign[]) => {
    const influencerId = typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
    if (!influencerId) return;
    setMetaLoading(true);
    try {
      const uniqById: Record<string, Campaign> = {};
      list.forEach((c) => { uniqById[c.id] = c; });
      const campaigns = Object.values(uniqById);
      const metas = await Promise.all(campaigns.map(async (c) => {
        try {
          const res: any = await post("/contract/getContract", { brandId: c.brandId, influencerId, campaignId: c.id });
          const arr: any[] = Array.isArray(res?.contracts) ? res.contracts : [];
          let m: any = arr.find((x) => String(x.contractId) === String(c.contractId)) || arr.find((x) => String(x.campaignId) === String(c.id)) || null;
          if (m?.supersededBy) {
            const child = arr.find((x) => String(x.contractId) === String(m.supersededBy));
            if (child) m = child;
          }
          return {
            id: c.id,
            meta: m ? ({
              status: m.status,
              confirmations: m.confirmations || {},
              signatures: m.signatures || {},
              lockedAt: m.lockedAt,
              editsLockedAt: m.editsLockedAt,
              awaitingRole: m.awaitingRole,
              version: m.version,
              campaignId: m.campaignId,
              contractId: m.contractId,
              supersededBy: m.supersededBy,
              resendOf: m.resendOf || null,
              resendIteration: m.resendIteration,
            } as ContractMeta) : null,
          };
        } catch {
          return { id: c.id, meta: null };
        }
      }));
      const next: Record<string, ContractMeta | null> = {};
      metas.forEach((x) => { next[x.id] = x.meta; });
      setMetaCache(next);
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    const all = [...activeCampaigns, ...appliedCampaigns, ...contractedCampaigns].filter((c) => c.contractId);
    loadMetaCache(all);
  }, [activeCampaigns, appliedCampaigns, contractedCampaigns, loadMetaCache]);

  /* Fetch influencer identity once (for table-level signing) */
  useEffect(() => {
    (async () => {
      try {
        const influencerId = typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
        if (!influencerId) return;
        const res = await api.get("/influencer/lite", { params: { influencerId } });
        const i = res?.data?.influencer || {};
        setInfluencerIdentity({ legalName: i?.legalName || i?.name, name: i?.name, email: i?.email });
      } catch (e) {
        // not fatal
      }
    })();
  }, []);

  /* Editor open */
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorReadOnly, setEditorReadOnly] = useState(false);
  const [editorContractId, setEditorContractId] = useState<string>("");
  const [editorCampaign, setEditorCampaign] = useState<Campaign | null>(null);
  const [editorInitialMode, setEditorInitialMode] = useState<"view" | "edit">("edit");

  const openEditor = (c: Campaign, viewOnly = false, startMode: "view" | "edit" = "edit") => {
    setEditorCampaign(c);
    setEditorReadOnly(viewOnly);
    setEditorContractId(c.contractId);
    setEditorInitialMode(startMode);
    setEditorOpen(true);
  };


  const refreshAll = () => {
    fetchActiveCampaigns();
    fetchAppliedCampaigns();
    fetchContractedCampaigns();
  };

  const openSignDirect = ({
    contractId,
    influencerConfirmed,
    brandConfirmed,
    isLocked,
    isReadyToSign,
  }: {
    contractId: string;
    influencerConfirmed: boolean;
    brandConfirmed: boolean;
    isLocked: boolean;
    isReadyToSign: boolean;
  }) => {
    if (isLocked) return;

    if (!isReadyToSign) {
      toast({ icon: "error", title: "Not ready to sign", text: "Waiting for both parties to accept the current version." });
      return;
    }
    if (!influencerConfirmed) {
      toast({ icon: "error", title: "Accept first", text: "Please accept the contract before signing." });
      return;
    }
    if (!brandConfirmed) {
      toast({ icon: "error", title: "Brand acceptance pending", text: "Brand must accept before signing can start." });
      return;
    }

    setTopSignContractId(contractId);
    setTopSignOpen(true);
  };

  const signDirect = async (sigDataUrl: string) => {
    try {
      await post("/contract/sign", {
        contractId: topSignContractId,
        role: "influencer",
        name: influencerIdentity.legalName || influencerIdentity.name || "",
        email: influencerIdentity.email || "",
        signatureImageDataUrl: sigDataUrl,
      });
      toast({ icon: "success", title: "Signed", text: "Signature recorded." });
      setTopSignOpen(false);
      setTopSignContractId("");
      refreshAll();
    } catch (e: any) {
      toast({ icon: "error", title: "Sign failed", text: e?.response?.data?.message || e?.message || "Could not sign." });
    }
  };

  /* ──────────────── NEW: Top selection tabs with counts ──────────────── */
  const tabs: { key: ViewKey; label: string; count: number }[] = [
    { key: "active", label: "Active", count: activeCampaigns.length },
    { key: "contracted", label: "Contracted", count: contractedCampaigns.length },
    { key: "applied", label: "Applied", count: appliedCampaigns.length },
    { key: "all", label: "All", count: activeCampaigns.length + contractedCampaigns.length + appliedCampaigns.length },
  ];

  const TabButton = ({ k, label, count }: { k: ViewKey; label: string; count: number }) => {
    const isActive = view === k;
    return (
      <button
        onClick={() => setView(k)}
        className={[
          "px-3.5 py-2 rounded-full text-sm font-medium transition",
          isActive
            ? "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900 shadow"
            : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200",
        ].join(" ")}
      >
        <span>{label}</span>
        <span className={`ml-2 inline-flex items-center justify-center text-xs px-2 py-0.5 rounded-full ${isActive ? "bg-white/70 text-gray-900" : "bg-gray-100 text-gray-700"}`}>
          {count}
        </span>
      </button>
    );
  };

  return (
    <div className="p-6 min-h-screen space-y-8">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-semibold">My Campaigns</h1>

        <div className="flex flex-wrap gap-2 bg-white rounded-full p-1 border border-gray-200">
          {tabs.map(t => (
            <TabButton key={t.key} k={t.key} label={t.label} count={t.count} />
          ))}
        </div>
      </div>

      {/* Content by selection */}
      {view === "all" ? (
        <>
          {/* Active Campaigns */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Active Campaigns</h2>
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
              onOpenEditor={openEditor}
              onRefreshAll={refreshAll}
              metaCache={metaCache}
              onSignDirect={openSignDirect}
            />
          </section>

          {/* Contracted Campaigns */}
          <section>
            <h2 className="text-xl font-semibold mb-4 mt-10">Contracted Campaigns</h2>
            <CampaignTable
              data={contractedCampaigns}
              loading={contractedLoading}
              error={contractedError}
              emptyMessage="No contracted campaigns found."
              page={contractedPage}
              totalPages={contractedTotalPages}
              onPrev={() => setContractedPage((p) => Math.max(p - 1, 1))}
              onNext={() => setContractedPage((p) => Math.min(p + 1, contractedTotalPages))}
              onOpenEditor={openEditor}
              onRefreshAll={refreshAll}
              metaCache={metaCache}
              onSignDirect={openSignDirect}
            />
          </section>

          {/* Applied Campaigns */}
          <section>
            <h2 className="text-xl font-semibold mb-4 mt-10">Applied Campaigns</h2>
            <CampaignTable
              data={appliedCampaigns}
              loading={appliedLoading}
              error={appliedError}
              emptyMessage="No applied campaigns found."
              page={appliedPage}
              totalPages={appliedTotalPages}
              onPrev={() => setAppliedPage((p) => Math.max(p - 1, 1))}
              onNext={() => setAppliedPage((p) => Math.min(p + 1, appliedTotalPages))}
              onOpenEditor={openEditor}
              onRefreshAll={refreshAll}
              metaCache={metaCache}
              onSignDirect={openSignDirect}
            />
          </section>
        </>
      ) : null}

      {view === "active" ? (
        <section>
          <h2 className="text-xl font-semibold mb-4">Active Campaigns</h2>
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
            onOpenEditor={openEditor}
            onRefreshAll={refreshAll}
            metaCache={metaCache}
            onSignDirect={openSignDirect}
          />
        </section>
      ) : null}

      {view === "contracted" ? (
        <section>
          <h2 className="text-xl font-semibold mb-4">Contracted Campaigns</h2>
          <CampaignTable
            data={contractedCampaigns}
            loading={contractedLoading}
            error={contractedError}
            emptyMessage="No contracted campaigns found."
            page={contractedPage}
            totalPages={contractedTotalPages}
            onPrev={() => setContractedPage((p) => Math.max(p - 1, 1))}
            onNext={() => setContractedPage((p) => Math.min(p + 1, contractedTotalPages))}
            onOpenEditor={openEditor}
            onRefreshAll={refreshAll}
            metaCache={metaCache}
            onSignDirect={openSignDirect}
          />
        </section>
      ) : null}

      {view === "applied" ? (
        <section>
          <h2 className="text-xl font-semibold mb-4">Applied Campaigns</h2>
          <CampaignTable
            data={appliedCampaigns}
            loading={appliedLoading}
            error={appliedError}
            emptyMessage="No applied campaigns found."
            page={appliedPage}
            totalPages={appliedTotalPages}
            onPrev={() => setAppliedPage((p) => Math.max(p - 1, 1))}
            onNext={() => setAppliedPage((p) => Math.min(p + 1, appliedTotalPages))}
            onOpenEditor={openEditor}
            onRefreshAll={refreshAll}
            metaCache={metaCache}
            onSignDirect={openSignDirect}
          />
        </section>
      ) : null}

      {editorOpen && editorCampaign && (
        <InfluencerContractModal
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          contractId={editorContractId}
          campaign={editorCampaign}
          readOnly={editorReadOnly}
          initialMode={editorInitialMode}
          onAfterAction={refreshAll}
        />
      )}

      {/* Page-level Signature Modal (table action) */}
      <SignatureModal
        open={topSignOpen}
        onClose={() => setTopSignOpen(false)}
        title="Sign as Influencer"
        onSubmit={signDirect}
      />
    </div>
  );
}
