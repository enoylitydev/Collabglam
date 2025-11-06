"use client";

// =============================================================================
// COMPLETE REWRITE — Compliant contract flow for influencers
// - PDF view strictly via POST /contract/viewPdf (no /preview anywhere)
// - Influencer confirm/update wired to /contract/influencer/* endpoints
// - Signature upload (PNG/JPG ≤ 50 KB) via dedicated modal; sends data URL to /contract/sign
// - Uses plural endpoints /contract/* and expects plural key `contracts` from /contract/getContract
// - Resolves resend children and sets `effectiveContractId`
// - EDIT MODE: Split layout — LEFT PDF, RIGHT form
// - UI: Hide Edit tab entirely when editing isn’t allowed; force View
// - Extra: honors flags like canEditInfluencerFields/canSignInfluencer and lock state
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  HiChevronLeft,
  HiChevronRight,
  HiDocumentText,
  HiOutlineClipboardList,
  HiOutlineEye,
  HiX,
} from "react-icons/hi";
import api, { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import Swal from "sweetalert2";
import MilestoneHistoryCard from "@/components/common/milestoneCard";

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

// Data-access flags within influencer form
export type DataAccess = {
  allowAnalytics?: boolean;
  allowPaidAds?: boolean;
  allowContentReuse?: boolean;
};

// Influencer "purple" model captured in confirm/update
export type Purple = {
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

/* ─────────────────────────── Small form components ────────────────────────── */
function Input({
  id,
  label,
  value,
  onChange,
  type = "text",
  disabled = false,
}: {
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
        className={`w-full px-4 pt-6 pb-2 border-2 rounded-lg text-sm transition-all duration-200 focus:outline-none ${
          disabled ? "border-gray-200 opacity-60 cursor-not-allowed" : "border-gray-200 focus:border-[#FFBF00]"
        }`}
        placeholder=" "
      />
      <label htmlFor={id} className="absolute left-4 top-2 text-xs text-[#FFBF00] font-medium pointer-events-none">
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
  disabled = false,
}: {
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
        className={`w-full px-4 pt-6 pb-2 border-2 rounded-lg text-sm transition-all duration-200 focus:outline-none ${
          disabled ? "border-gray-200 opacity-60 cursor-not-allowed" : "border-gray-200 focus:border-[#FFBF00]"
        }`}
        placeholder=" "
      />
      <label htmlFor={id} className="absolute left-4 top-2 text-xs text-[#FFBF00] font-medium pointer-events-none">
        {label}
      </label>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200 ${
        disabled
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

  useEffect(() => {
    if (!open) {
      setSig("");
      setErr("");
    }
  }, [open]);

  const onFile = (f?: File) => {
    setErr("");
    if (!f) return;
    if (!/image\/(png|jpeg)/i.test(f.type)) return setErr("Please upload a PNG or JPG.");
    if (f.size > 50 * 1024) return setErr("Signature must be ≤ 50 KB.");
    const r = new FileReader();
    r.onload = () => setSig(String(r.result || ""));
    r.readAsDataURL(f);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 mx-auto w-[96%] max-w-xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="relative h-20">
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, #FFBF00 0%, #FFDB58 100%)` }} />
          <div className="relative z-10 h-full px-5 flex items-center justify-between text-gray-900">
            <div className="font-semibold tracking-wide">{title}</div>
            <button className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center" onClick={onClose} aria-label="Close" title="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-700">
            Upload your signature image (PNG/JPG up to <strong>50&nbsp;KB</strong>).
          </p>
          <div className="space-y-2">
            <input type="file" accept="image/png,image/jpeg" onChange={(e) => onFile(e.target.files?.[0] || undefined)} className="text-sm" />
            {err && <div className="text-xs text-red-600">{err}</div>}
          </div>
          {sig && (
            <div className="border rounded-md p-3 bg-gray-50">
              <div className="text-xs text-gray-600 mb-2">Preview</div>
              <img src={sig} alt="Signature preview" className="h-12 border bg-white rounded" />
            </div>
          )}
        </div>

        <div className="p-5 pt-0 flex justify-end gap-3">
          <Button variant="outline" className="text-gray-900" onClick={onClose}>Cancel</Button>
          <Button className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900" onClick={() => (sig ? onSubmit(sig) : setErr("Please select a signature image first."))}>
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
}: {
  open: boolean;
  onClose: () => void;
  contractId: string;
  campaign: Campaign;
  readOnly?: boolean;
  onAfterAction?: () => void;
}) {
  type ContractMeta = {
    status?: string;
    confirmations?: { brand?: { confirmed?: boolean }; influencer?: { confirmed?: boolean } };
    signatures?: { brand?: { signed?: boolean }; influencer?: { signed?: boolean } };
    lockedAt?: string;
    campaignId?: string;
    contractId?: string;
    flags?: any;
    isResendChild?: boolean;
    supersededBy?: string;
  };

  const [purple, setPurple] = useState<Purple>(emptyPurple);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isWorking, setIsWorking] = useState(false);
  const [liteLoaded, setLiteLoaded] = useState(false);

  // We may receive an outdated contractId; resolve to latest (resent child)
  const [effectiveContractId, setEffectiveContractId] = useState<string>(contractId);
  const [meta, setMeta] = useState<ContractMeta | null>(null);

  const influencerConfirmed = !!(
    meta?.confirmations?.influencer?.confirmed || meta?.flags?.isInfluencerConfirm
  );

  const isLocked = !!meta?.lockedAt || meta?.status === "locked" || !!meta?.flags?.isLocked;

  const canEdit = useMemo(() => {
    if (readOnly) return false;
    if (isLocked) return false;
    if (meta?.flags?.canEditInfluencerFields === false) return false;
    return true;
  }, [readOnly, isLocked, meta?.flags?.canEditInfluencerFields]);

  const [mode, setMode] = useState<"view" | "edit">(readOnly ? "view" : "edit");

  // Hide Edit entirely when not allowed & force to View
  useEffect(() => {
    if (!canEdit && mode === "edit") setMode("view");
  }, [canEdit, mode]);

  // Signature modal state
  const [showSignModal, setShowSignModal] = useState(false);

  /* Prefill purple from influencer lite */
  const toPurpleFromLite = (lite: any): Purple => {
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
      notes: "",
      dataAccess: {
        allowAnalytics: true,
        allowPaidAds: !!lite?.onboarding?.allowlisting,
        allowContentReuse: false,
      },
    };
  };

  const fetchInfluencerLite = useCallback(async () => {
    try {
      const influencerId = typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
      if (!influencerId) throw new Error("No influencer ID found in localStorage.");
      const res = await api.get("/influencer/lite", { params: { influencerId } });
      setPurple(toPurpleFromLite(res.data?.influencer || {}));
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
      });

      const arr = Array.isArray((list as any)?.contracts) ? (list as any).contracts : [];

      // Find by provided contractId or by campaignId fallback
      let c: any =
        arr.find((x: any) => String(x.contractId) === String(contractId)) ||
        arr.find((x: any) => String(x.campaignId) === String(campaign.id)) ||
        null;

      // If this contract was superseded, prefer the resent child
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
          campaignId: c.campaignId,
          contractId: c.contractId,
          flags: c.flags || c.statusFlags || {},
          isResendChild: !!(c.flags?.isResendChild || c.statusFlags?.isResendChild),
          supersededBy: c.supersededBy,
        });
      } else {
        setMeta(null);
        setEffectiveContractId(contractId);
      }
    } catch (e) {
      setMeta(null);
      setEffectiveContractId(contractId);
    }
  }, [campaign.brandId, campaign.id, contractId]);

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

  // start mode based on confirmation + readOnly
  useEffect(() => {
    if (!open) return;
    if (readOnly) setMode("view");
    else setMode(influencerConfirmed ? "view" : "edit");
  }, [open, readOnly, influencerConfirmed]);

  // Ensure a preview exists when switching to either view OR edit (via /contract/viewPdf)
  useEffect(() => {
    if (!open) return;
    if ((mode === "view" || mode === "edit") && !previewUrl) {
      generatePreview(true).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, open]);

  const generatePreview = async (silent = false) => {
    setIsWorking(true);
    try {
      // VIEW-ONLY: always via /contract/viewPdf
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
      toast({ icon: "error", title: "Preview Error", text: e?.message || "Failed to load PDF." });
      throw e;
    } finally {
      setIsWorking(false);
    }
  };

  const acceptOrSave = async () => {
    setIsWorking(true);
    try {
      if (!influencerConfirmed) {
        const ok = await askConfirm("Accept Contract?", "Your details will be submitted to the brand.");
        if (!ok) return;
        // ACCEPT by confirming details
        await post("/contract/influencer/confirm", {
          contractId: effectiveContractId,
          influencer: sanitizePurple(purple),
        });
        toast({ icon: "success", title: "Accepted", text: "Details saved. Contract accepted." });
      } else {
        // EDIT after acceptance
        await post("/contract/influencer/update", {
          contractId: effectiveContractId,
          influencerUpdates: sanitizePurple(purple),
        });
        toast({ icon: "success", title: "Saved", text: "Your changes were saved." });
      }
      await fetchContractMeta();
      onAfterAction && onAfterAction();
      setMode("view");
      await generatePreview(true);
    } catch (e: any) {
      toast({ icon: "error", title: "Error", text: e?.response?.data?.message || e?.message || "Failed to save." });
    } finally {
      setIsWorking(false);
    }
  };

  const openSignature = () => {
    if (isLocked) return;
    if (!influencerConfirmed) {
      toast({ icon: "error", title: "Confirm first", text: "Please accept the contract before signing." });
      return;
    }
    if (meta?.flags?.canSignInfluencer === false) {
      toast({ icon: "error", title: "Signing disabled", text: "You cannot sign this contract at the moment." });
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
        name: purple.legalName,
        email: purple.email,
        signatureImageDataUrl: signatureDataUrl,
      });
      toast({ icon: "success", title: "Signed", text: "Signature recorded." });
      setShowSignModal(false);
      await fetchContractMeta();
      onAfterAction && onAfterAction();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "";
      toast({ icon: "error", title: "Sign Error", text: msg || "Failed to sign." });
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
            <span className={`px-2 py-1 rounded-full border ${
              isLocked ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-yellow-50 border-yellow-200 text-yellow-700"
            }`}>
              Status: {meta.status.toUpperCase()}
            </span>
          )}
          {meta?.flags?.isResendChild && (
            <span className="px-2 py-1 rounded-full border bg-blue-50 border-blue-200 text-blue-700">Resent</span>
          )}
          <span className="px-2 py-1 rounded-full border bg-gray-50 border-gray-200 text-gray-700">You: {influencerConfirmed ? "Accepted" : "Pending"}</span>
          <span className="px-2 py-1 rounded-full border bg-gray-50 border-gray-200 text-gray-700">You Signed: {meta?.signatures?.influencer?.signed ? "Yes" : "No"}</span>
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
                    {canEdit && (
                      <Button className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900" onClick={() => setMode("edit")}>Edit Details</Button>
                    )}
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
                    <Input id="legalName" label="Legal Name" value={purple.legalName} onChange={(v) => setPurple((p) => ({ ...p, legalName: v }))} disabled={!canEdit} />
                    <Input id="email" label="Email" value={purple.email} onChange={(v) => setPurple((p) => ({ ...p, email: v }))} disabled={!canEdit} />
                    <Input id="phone" label="Phone" value={purple.phone} onChange={(v) => setPurple((p) => ({ ...p, phone: v }))} disabled={!canEdit} />
                    <Input id="taxId" label="Tax ID (optional)" value={purple.taxId} onChange={(v) => setPurple((p) => ({ ...p, taxId: v }))} disabled={!canEdit} />
                    <Input id="addressLine1" label="Address Line 1" value={purple.addressLine1} onChange={(v) => setPurple((p) => ({ ...p, addressLine1: v }))} disabled={!canEdit} />
                    <Input id="addressLine2" label="Address Line 2" value={purple.addressLine2} onChange={(v) => setPurple((p) => ({ ...p, addressLine2: v }))} disabled={!canEdit} />
                    <Input id="city" label="City" value={purple.city} onChange={(v) => setPurple((p) => ({ ...p, city: v }))} disabled={!canEdit} />
                    <Input id="state" label="State" value={purple.state} onChange={(v) => setPurple((p) => ({ ...p, state: v }))} disabled={!canEdit} />
                    <Input id="zip" label="ZIP / Postal Code" value={purple.zip} onChange={(v) => setPurple((p) => ({ ...p, zip: v }))} disabled={!canEdit} />
                    <Input id="country" label="Country" value={purple.country} onChange={(v) => setPurple((p) => ({ ...p, country: v }))} disabled={!canEdit} />
                  </div>

                  <div className="mt-3">
                    <Textarea id="notes" label="Notes (optional)" value={purple.notes} onChange={(v) => setPurple((p) => ({ ...p, notes: v }))} rows={3} disabled={!canEdit} />
                  </div>

                  <div className="mt-4">
                    <div className="text-sm font-medium text-gray-800 mb-2">Data Access</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Checkbox label="Allow Analytics" checked={!!purple.dataAccess.allowAnalytics} onChange={(checked) => setPurple((p) => ({ ...p, dataAccess: { ...p.dataAccess, allowAnalytics: checked } }))} disabled={!canEdit} />
                      <Checkbox label="Allow Paid Ads" checked={!!purple.dataAccess.allowPaidAds} onChange={(checked) => setPurple((p) => ({ ...p, dataAccess: { ...p.dataAccess, allowPaidAds: checked } }))} disabled={!canEdit} />
                      <Checkbox label="Allow Content Reuse" checked={!!purple.dataAccess.allowContentReuse} onChange={(checked) => setPurple((p) => ({ ...p, dataAccess: { ...p.dataAccess, allowContentReuse: checked } }))} disabled={!canEdit} />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button onClick={acceptOrSave} disabled={isWorking || !liteLoaded} className="bg-emerald-600 hover:bg-emerald-700 text-white" title={!liteLoaded ? "Loading your profile…" : ""}>
                      {influencerConfirmed ? "Save Changes" : "Accept & Save"}
                    </Button>
                    <Button onClick={() => generatePreview()} disabled={isWorking} variant="outline">
                      View PDF
                    </Button>
                    <Button
                      onClick={openSignature}
                      disabled={isWorking || isLocked || !influencerConfirmed || meta?.flags?.canSignInfluencer === false}
                      className={(!influencerConfirmed || isLocked) ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white"}
                      title={!influencerConfirmed ? "Accept the contract first" : isLocked ? "Contract is locked" : meta?.flags?.canSignInfluencer === false ? "Signing disabled" : ""}
                    >
                      Sign
                    </Button>
                    <Button variant="outline" onClick={() => setMode("view")}>Switch to View</Button>
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
              <span className="text-emerald-600">Accepted — you can edit, view, and sign.</span>
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

/* ───────────────────────────── Overlay (brand/influencer) ─────────────────── */
export function ContractEditorOverlay({
  contractId,
  role,
  onClose,
  onAfterSave,
  readOnly = false,
  accentGradientClass = "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58]",
}: {
  contractId: string;
  role: "brand" | "influencer";
  onClose: () => void;
  onAfterSave?: () => void;
  readOnly?: boolean;
  accentGradientClass?: string;
}) {
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.post("/contract/viewPdf", { contractId }, { responseType: "blob" });
        const url = URL.createObjectURL(res.data);
        setPdfUrl(url);
      } catch (e: any) {
        toast({ icon: "error", title: "Load error", text: e?.message || "Failed to load PDF" });
      }
    })();
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  const signWithSignature = async (sig: string) => {
    try {
      setBusy(true);
      await post("/contract/sign", { contractId, role, signatureImageDataUrl: sig });
      toast({ icon: "success", title: "Signed", text: "Signature recorded" });
      onAfterSave && onAfterSave();
      setSignOpen(false);
      onClose();
    } catch (e: any) {
      toast({ icon: "error", title: "Sign error", text: e?.response?.data?.message || e?.message || "Failed to sign" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full lg:w-[900px] bg-white shadow-2xl border-l flex flex-col">
        <div className={`p-4 flex items-center justify-between border-b text-gray-900 ${accentGradientClass}`}>
          <div className="font-semibold text-gray-900">Contract — {role}</div>
          <button onClick={onClose} className="p-2 rounded bg-white/20 hover:bg-white/30">
            <HiX className="w-5 h-5 text-gray-900" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {pdfUrl ? (
            <iframe className="w-full h:[78vh] lg:h-[78vh] h-[70vh] rounded border" src={pdfUrl} />
          ) : (
            <div className="p-6 text-gray-500">Loading PDF…</div>
          )}
        </div>

        {!readOnly && (
          <div className="p-4 border-t flex items-center gap-3 justify-between">
            <div className="text-xs text-gray-600">Upload your signature in the next step.</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={() => setSignOpen(true)} disabled={busy} className={`text-gray-900 px-4 py-2 rounded-md shadow-sm hover:brightness-95 ${accentGradientClass} ${busy ? "opacity-60 cursor-not-allowed" : ""}`}>
                {busy ? "Opening…" : "Sign"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <SignatureModal open={signOpen} onClose={() => setSignOpen(false)} title={`Sign as ${role === "brand" ? "Brand" : "Influencer"}`} onSubmit={signWithSignature} />
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
function CampaignTable({
  data,
  loading,
  error,
  emptyMessage,
  page,
  totalPages,
  onPrev,
  onNext,
  showMilestones = false,
  onOpenEditor,
  onRefreshAll,
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
  onOpenEditor: (c: Campaign, viewOnly: boolean) => void;
  onRefreshAll: () => void;
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
        const isExpanded = expandedId === c.id;
        const accepted = c.isAccepted === 1;

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
                {c.hasApplied === 1 && !accepted && !c.isContracted ? (
                  <Badge className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 shadow-none">Brand Reviewing</Badge>
                ) : c.isContracted === 1 && !accepted ? (
                  <Badge className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 shadow-none">Contract Sent</Badge>
                ) : (
                  <Badge className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 shadow-none">Accepted</Badge>
                )}
              </td>

              <td className="px-6 py-4 flex justify-center gap-2 whitespace-nowrap">
                {c.isContracted === 1 && !accepted ? (
                  <>
                    <Button
                      variant="outline"
                      className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900"
                      onClick={() => onOpenEditor(c, false)}
                      title="Fill details to accept"
                    >
                      Accept & Edit
                    </Button>
                    <Button variant="outline" onClick={() => onOpenEditor(c, true)} className="bg-white" title="View contract">
                      View Contract
                    </Button>
                    <RejectButton
                      contractId={c.contractId}
                      onDone={onRefreshAll}
                    />
                  </>
                ) : accepted ? (
                  <>
                    <Button
                      variant="outline"
                      className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900"
                      onClick={() => onOpenEditor(c, false)}
                      title="Edit your details"
                    >
                      Edit Contract
                    </Button>
                    <Button variant="outline" onClick={() => onOpenEditor(c, true)} className="bg-white" title="View contract">
                      View Contract
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900"
                    onClick={() => window.location.assign(`/influencer/my-campaign/view-campaign?id=${c.id}`)}
                  >
                    View Campaign
                  </Button>
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

  /* Modal state */
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorReadOnly, setEditorReadOnly] = useState(false);
  const [editorContractId, setEditorContractId] = useState<string>("");
  const [editorCampaign, setEditorCampaign] = useState<Campaign | null>(null);

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

  /* Editor open */
  const openEditor = (c: Campaign, viewOnly = false) => {
    setEditorCampaign(c);
    setEditorReadOnly(viewOnly);
    setEditorContractId(c.contractId);
    setEditorOpen(true);
  };

  // single refresh callback to reuse in children
  const refreshAll = () => {
    fetchActiveCampaigns();
    fetchAppliedCampaigns();
    fetchContractedCampaigns();
  };

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
          onOpenEditor={openEditor}
          onRefreshAll={refreshAll}
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
          onOpenEditor={openEditor}
          onRefreshAll={refreshAll}
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
          onOpenEditor={openEditor}
          onRefreshAll={refreshAll}
        />
      </section>

      {/* Editor Modal */}
      {editorOpen && editorCampaign && (
        <InfluencerContractModal
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          contractId={editorContractId}
          campaign={editorCampaign}
          readOnly={editorReadOnly}
          onAfterAction={refreshAll}
        />
      )}
    </div>
  );
}
