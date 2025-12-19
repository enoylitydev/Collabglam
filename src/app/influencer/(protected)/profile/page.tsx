"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

import { get, post } from "@/lib/api";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select as ShSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
// lucide icons
import {
  User,
  Users,
  Phone as PhoneIcon,
  Globe,
  Mail,
  Check,
  X,
  CreditCard,
  Calendar,
  ShieldCheck,
  Link as LinkIcon,
  Hash,
  Pencil,
  Image as ImageIcon,
  Loader2,
  Check as CheckIcon,
} from "lucide-react";

/* ===================== Types (aligned to Influencer model) ===================== */

type SubscriptionFeature = {
  key: string;
  limit: number;
  used: number;
};

type GenderStr = "" | "Male" | "Female" | "Non-binary" | "Prefer not to say";

// Onboarding (model-aligned)
interface OnboardingSubcategory {
  subcategoryId: string; // UUID v4
  subcategoryName: string;
}

interface Onboarding {
  categoryId?: number; // numeric id from taxonomy service
  categoryName?: string;
  subcategories: OnboardingSubcategory[]; // 0..n (no max limit)
}

// Reference data
interface Country {
  _id: string;
  countryName: string;
  callingCode: string;
  countryCode: string;
  flag: string;
}
interface CountryOption {
  value: string;
  label: string;
  country: Country;
}

// Category taxonomy (API should return this shape or equivalent)
interface CategoryNode {
  categoryId: number;
  categoryName: string;
  subcategories: { subcategoryId: string; subcategoryName: string }[];
}

interface CategoryOption {
  value: number; // categoryId
  label: string; // categoryName
  raw: CategoryNode;
}

interface SubcategoryOption {
  value: string; // subcategoryId (UUID v4)
  label: string; // subcategoryName
}

// Primary platform, per model enum
export type PrimaryPlatform = "youtube" | "tiktok" | "instagram" | "other" | null;

// Client view model (normalized from backend)
export type InfluencerData = {
  // Base profile
  name: string;
  email: string;
  password?: string; // only when updating
  phone: string;
  profileImage?: string; // URL / dataURL (preview only)
  profileLink?: string; // optional, for display/backcompat
  socialMedia?: string; // optional, for display/backcompat

  // Location / dialing
  country: string;
  countryId: string;
  callingId: string;
  callingCode?: string; // e.g., "+91"

  // Platform
  primaryPlatform: PrimaryPlatform;

  // Onboarding taxonomy (model aligned)
  onboarding: Onboarding;

  // Subscription (read-only display)
  subscription: {
    planName: string;
    planId?: string;
    startedAt?: string;
    expiresAt?: string;
    features: SubscriptionFeature[];
  };
  subscriptionExpired: boolean;

  // Security / auth
  otpVerified?: boolean;
  passwordResetVerified?: boolean;
  failedLoginAttempts?: number;
  lockUntil?: string | null;

  // IDs & meta
  _id?: string;
  influencerId: string;
  createdAt?: string;
  updatedAt?: string;

  // Gender string enum (model)
  gender?: GenderStr;
};

/* ===================== Utilities ===================== */
const isEmailEqual = (a = "", b = "") => a.trim().toLowerCase() === b.trim().toLowerCase();

function formatPhoneDisplay(code?: string, num?: string) {
  const c = (code || "").trim();
  const n = (num || "").trim();
  if (!c && !n) return "—";
  if (n.startsWith("+")) return n;
  return `${c ? c : ""}${c && n ? " " : ""}${n}`;
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(+dt)) return "—";
  return dt.toLocaleString();
}

function titleizeFeatureKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function validateEmail(email: string) {
  return /[^@\s]+@[^@\s]+\.[^@\s]+/.test(email);
}

function normalizeGenderStr(raw: any): GenderStr | undefined {
  if (raw === null || typeof raw === "undefined") return undefined;

  // If backend ever sends numeric enum (0..3) or numeric string, map to labels
  const num =
    typeof raw === "number" && Number.isFinite(raw)
      ? raw
      : typeof raw === "string" && /^[0-9]+$/.test(raw.trim())
        ? Number(raw.trim())
        : null;

  if (num !== null) {
    switch (num) {
      case 0:
        return "Male";
      case 1:
        return "Female";
      case 2:
        return "Non-binary";
      case 3:
        return "Prefer not to say";
      default:
        break;
    }
  }

  const s = String(raw).trim();
  const t = s.toLowerCase();
  if (t === "male" || t === "m") return "Male";
  if (t === "female" || t === "f") return "Female";
  if (t === "non-binary" || t === "nonbinary" || t === "nb") return "Non-binary";
  if (t === "prefer not to say" || t === "prefer-not-to-say") return "Prefer not to say";
  if (s === "") return "";
  if (["Male", "Female", "Non-binary", "Prefer not to say"].includes(s)) return s as GenderStr;
  return undefined;
}

/* Build options */
const buildCountryOptions = (countries: Country[]): CountryOption[] =>
  countries.map((c) => ({
    value: c._id,
    label: `${c.flag} ${c.countryName}`,
    country: c,
  }));

const buildCallingOptions = (countries: Country[]): CountryOption[] => {
  const opts = countries.map((c) => ({
    value: c._id,
    label: `${c.callingCode}`,
    country: c,
  }));
  const usIdx = opts.findIndex((o) => o.country.countryCode === "US");
  if (usIdx > -1) {
    const [us] = opts.splice(usIdx, 1);
    opts.unshift(us);
  }
  return opts;
};

const PLATFORM_OPTIONS: { value: Exclude<PrimaryPlatform, null>; label: string }[] = [
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "other", label: "Other" },
];

const humanizePlatform = (p: PrimaryPlatform) => {
  const found = PLATFORM_OPTIONS.find((o) => o.value === p);
  return found ? found.label : "—";
};

// Coerce unknown payloads into arrays safely
function asArray<T = any>(v: any): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object") {
    for (const k of [
      "data",
      "items",
      "rows",
      "result",
      "results",
      "categories",
      "list",
      "categoryList",
    ]) {
      const val = (v as any)[k];
      if (Array.isArray(val)) return val as T[];
    }
  }
  return [] as T[];
}

function normalizeCategoryNode(raw: any): CategoryNode {
  const categoryIdRaw = raw?.categoryId ?? raw?.id ?? raw?.code;
  const categoryName = String(raw?.categoryName ?? raw?.name ?? raw?.label ?? "");
  const subRaw =
    raw?.subcategories ??
    raw?.children ??
    raw?.subs ??
    raw?.subCategoryList ??
    raw?.subcategoriesList;
  const subcategories: { subcategoryId: string; subcategoryName: string }[] = asArray<any>(subRaw)
    .map((s) => ({
      subcategoryId: String(s?.subcategoryId ?? s?.id ?? s?.uuid ?? s?._id ?? s?.value ?? s?.code ?? ""),
      subcategoryName: String(s?.subcategoryName ?? s?.name ?? s?.label ?? ""),
    }))
    .filter((s) => s.subcategoryId && s.subcategoryName);

  return {
    categoryId: Number(categoryIdRaw),
    categoryName,
    subcategories,
  } as CategoryNode;
}

const buildCategoryOptions = (rows: any): CategoryOption[] => {
  const arr = asArray<any>(rows)
    .map(normalizeCategoryNode)
    .filter((n) => Number.isFinite(n.categoryId) && n.categoryName);
  if (!Array.isArray(rows)) {
    console.warn("[categories] Non-array payload received; coerced via keys.", rows);
  }
  return arr.map((c) => ({ value: c.categoryId, label: c.categoryName, raw: c }));
};

const buildSubcategoryOptions = (row?: CategoryNode | null): SubcategoryOption[] =>
  row?.subcategories?.map((s) => ({ value: s.subcategoryId, label: s.subcategoryName })) || [];

/* Normalize influencer payload from backend (model-aligned) */
function normalizeInfluencer(data: any): InfluencerData {
  const inf = data?.influencer ?? data;
  const s = inf?.subscription ?? {};

  // Social fallbacks from primary social profile (prefer primary platform; else first)
  const spArr = Array.isArray(inf?.socialProfiles) ? inf.socialProfiles : [];
  const preferred =
    spArr.find((p: any) => p?.provider === (inf?.primaryPlatform || "")) || spArr[0] || {};
  const fallbackHandle = preferred?.username ? `${preferred.username}` : "";
  const fallbackLink = preferred?.url || "";
  const fallbackImage = preferred?.picture || "";

  return {
    name: inf?.name ?? "",
    email: inf?.email ?? "",
    phone: inf?.phone ?? "",

    profileImage: inf?.profileImage || fallbackImage || "",
    profileLink: inf?.profileLink || fallbackLink || "",
    socialMedia: inf?.socialMedia || fallbackHandle || "",

    country: inf?.country ?? "",
    countryId: inf?.countryId ?? "",
    callingId: inf?.callingId ?? "",
    callingCode: inf?.callingcode ?? inf?.callingCode ?? "",

    primaryPlatform: (inf?.primaryPlatform as PrimaryPlatform) ?? null,

    onboarding: {
      categoryId: inf?.onboarding?.categoryId,
      categoryName: inf?.onboarding?.categoryName,
      subcategories: Array.isArray(inf?.onboarding?.subcategories)
        ? inf.onboarding.subcategories
        : [],
    },

    subscription: {
      planName: s?.planName ?? "",
      planId: s?.planId ?? "",
      startedAt: s?.startedAt ?? "",
      expiresAt: s?.expiresAt ?? "",
      features: Array.isArray(s?.features) ? s.features : [],
    },
    subscriptionExpired: !!inf?.subscriptionExpired,

    otpVerified: !!inf?.otpVerified,
    passwordResetVerified: !!inf?.passwordResetVerified,
    failedLoginAttempts: Number.isFinite(+inf?.failedLoginAttempts) ? +inf.failedLoginAttempts : 0,
    lockUntil: inf?.lockUntil ?? null,

    _id: inf?._id ?? "",
    influencerId: inf?.influencerId ?? inf?._id ?? "",
    createdAt: inf?.createdAt ?? "",
    updatedAt: inf?.updatedAt ?? "",

    gender: normalizeGenderStr(inf?.gender),
  };
}

/* ===================== MultiSelect (Select-only, searchable) ===================== */

type SimpleOption = { value: string; label: string };

function MultiSelect({
  values,
  onChange,
  options,
  placeholder = "Choose...",
  max = Infinity,
}: {
  values: SimpleOption[];
  onChange: (opts: SimpleOption[]) => void;
  options: SimpleOption[];
  placeholder?: string;
  max?: number; // default Infinity (no limit)
}) {
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(values.map((v) => v.value)), [values]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const toggle = (val: string) => {
    const opt = options.find((o) => o.value === val);
    if (!opt) return;
    const isSelected = selectedSet.has(val);

    if (isSelected) {
      onChange(values.filter((v) => v.value !== val));
    } else {
      if (values.length >= max) {
        Swal.fire({
          icon: "info",
          title: `Limit reached (${max})`,
          text: `You can select up to ${max} items.`,
        });
        return;
      }
      onChange([...values, opt]);
    }
  };

  const triggerLabel = values.length
    ? values.length <= 2
      ? values.map((v) => v.label).join(", ")
      : `${values.length} selected`
    : placeholder;

  return (
    <ShSelect value="" onValueChange={toggle}>
      <SelectTrigger className="w-full justify-between">
        <div className={`truncate ${values.length ? "" : "text-muted-foreground"}`}>{triggerLabel}</div>
      </SelectTrigger>
      <SelectContent className="bg-white overflow-auto">
        <div className="p-2 sticky top-0 bg-white">
          <Input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {filtered.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
        ) : (
          filtered.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <div className="flex items-center gap-2">
                <CheckIcon className={`h-4 w-4 ${selectedSet.has(opt.value) ? "opacity-100" : "opacity-0"}`} />
                {opt.label}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </ShSelect>
  );
}

/* ===================== Dual-OTP Email Editor (unchanged except theme) ===================== */

export type EmailFlowState = "idle" | "needs" | "codes_sent" | "verifying" | "verified";

function EmailEditorSingleOTP({
  influencerId,
  originalEmail,
  value,
  onChange,
  onVerified,
  onStateChange,
}: {
  influencerId: string;
  originalEmail: string;
  value: string;
  onChange: (v: string) => void;
  onVerified: (newEmail: string) => void;
  onStateChange: (s: EmailFlowState) => void;
}) {
  const [flow, setFlow] = useState<EmailFlowState>("idle");
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needs = useMemo(() => !isEmailEqual(value, originalEmail), [value, originalEmail]);
  const valueIsValid = useMemo(() => validateEmail(value), [value]);

  useEffect(() => {
    if (!needs) {
      setFlow("idle");
      setOtp("");
      setErr(null);
      setMsg(null);
      onStateChange("idle");
    } else if (flow === "codes_sent" || flow === "verifying" || flow === "verified") {
      onStateChange(flow);
    } else {
      setFlow("needs");
      onStateChange("needs");
    }
  }, [needs, flow, onStateChange]);

  const requestCode = useCallback(async () => {
    setErr(null);
    setMsg(null);
    if (!valueIsValid) return;

    setBusy(true);
    try {
      const resp = await post<{ message?: string }>("/influencer/requestEmailUpdate", {
        influencerId,
        newEmail: value.trim().toLowerCase(),
        role: "Influencer",
      });

      setFlow("codes_sent");
      const m = resp?.message || `OTP sent to ${value.trim().toLowerCase()}.`;
      setMsg(m);
      onStateChange("codes_sent");
      await Swal.fire({ icon: "info", title: "OTP sent", text: m });
    } catch (e: any) {
      const m = e?.message || "Failed to send OTP.";
      setErr(m);
      await Swal.fire({ icon: "error", title: "Error", text: m });
    } finally {
      setBusy(false);
    }
  }, [influencerId, value, valueIsValid, onStateChange]);

  const verifyAndPersist = useCallback(async () => {
    setErr(null);

    if (otp.trim().length !== 6) {
      const m = "Enter the 6-digit OTP.";
      setErr(m);
      await Swal.fire({ icon: "warning", title: "Invalid OTP", text: m });
      return;
    }

    setBusy(true);
    setFlow("verifying");
    onStateChange("verifying");

    try {
      await post<{ message?: string }>("/influencer/verifyotp", {
        influencerId,
        role: "Influencer",
        otp: otp.trim(),
        newEmail: value.trim().toLowerCase(),
      });

      onVerified(value.trim().toLowerCase());
      setMsg("Email updated successfully.");
      setFlow("verified");
      onStateChange("verified");
      setOtp("");

      await Swal.fire({
        icon: "success",
        title: "Email updated",
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (e: any) {
      const m = e?.message || "Verification failed.";
      setErr(m);
      setFlow("codes_sent");
      onStateChange("codes_sent");
      await Swal.fire({ icon: "error", title: "Verification failed", text: m });
    } finally {
      setBusy(false);
    }
  }, [influencerId, value, otp, onVerified, onStateChange]);

  const handleOtp = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(digits);
  };

  return (
    <Card className="max-w-md bg-white">
      <CardContent className="pt-6 space-y-3">
        <Label>Email Address</Label>

        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="name@example.com"
            onKeyDown={(e) => {
              if (e.key === "Enter" && needs && valueIsValid && (flow === "needs" || flow === "idle")) {
                requestCode();
              }
            }}
          />
          {needs && valueIsValid && (flow === "needs" || flow === "idle") && (
            <Button
              onClick={requestCode}
              disabled={busy}
              className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify
            </Button>
          )}
        </div>

        {needs && (flow === "codes_sent" || flow === "verifying") && (
          <div className="rounded-md border p-4 space-y-4 bg-amber-50/40">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Verification Required</p>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code sent to <span className="font-semibold">{value}</span>.
                </p>
              </div>
            </div>

            <div>
              <Label className="text-xs">New Email OTP</Label>
              <Input
                className="font-mono tracking-[0.3em] text-center text-lg"
                placeholder="000000"
                value={otp}
                onChange={handleOtp}
                inputMode="numeric"
                maxLength={6}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button variant="outline" onClick={requestCode} disabled={busy}>
                Resend Code
              </Button>
              <Button
                onClick={verifyAndPersist}
                className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
                disabled={busy || otp.length !== 6}
              >
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify & Update
              </Button>
            </div>
          </div>
        )}

        {(msg || err) && (
          <div className="text-sm">
            {msg && (
              <div className="rounded-md border p-3 bg-green-50 text-green-800 flex items-center gap-2">
                <Check className="h-4 w-4" />
                {msg}
              </div>
            )}
            {err && (
              <div className="rounded-md border p-3 bg-red-50 text-red-800 flex items-center gap-2 mt-2">
                <X className="h-4 w-4" />
                {err}
              </div>
            )}
          </div>
        )}

        {needs && flow === "needs" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(originalEmail)}
            className="text-muted-foreground underline w-fit pl-0"
          >
            Cancel change
          </Button>
        )}
      </CardContent>
    </Card>
  );
}


/* ===================== Main Page ===================== */
export default function InfluencerProfilePage() {
  const router = useRouter();

  const [influencer, setInfluencer] = useState<InfluencerData | null>(null);
  const [form, setForm] = useState<InfluencerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Email flow state controls Save button
  const [emailFlow, setEmailFlow] = useState<EmailFlowState>("idle");

  // Countries / calling codes
  const [countries, setCountries] = useState<Country[]>([]);
  const countryOptions = useMemo(() => buildCountryOptions(countries), [countries]);
  const codeOptions = useMemo(() => buildCallingOptions(countries), [countries]);
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null);
  const [selectedCalling, setSelectedCalling] = useState<CountryOption | null>(null);

  // Platform
  const [selectedPlatform, setSelectedPlatform] = useState<PrimaryPlatform>(null);

  // Categories taxonomy
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryOption | null>(null);
  const [subcategoryOptions, setSubcategoryOptions] = useState<SubcategoryOption[]>([]);
  const [selectedSubcats, setSelectedSubcats] = useState<SubcategoryOption[]>([]);

  // Track previous category to avoid wiping subs on initial hydration
  const prevCatIdRef = useRef<number | null>(null);

  // Profile image upload
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);

  // Show load error in Swal
  useEffect(() => {
    if (error) {
      Swal.fire({
        icon: "error",
        title: "Error Loading Profile",
        text: error,
      });
    }
  }, [error]);

  useEffect(() => {
    const influencerId = localStorage.getItem("influencerId");
    if (!influencerId) {
      setError("Missing influencerId in localStorage.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [infRes, countryRes, categoryRes] = await Promise.all([
          get<any>(`/influencer/getbyid?id=${influencerId}`),
          get<Country[]>("/country/getall"),
          // Expect categories API to return array of CategoryNode
          get<CategoryNode[]>("/category/categories"),
        ]);

        const countriesList = countryRes || [];
        setCountries(countriesList);

        const normalized = normalizeInfluencer(infRes);
        setInfluencer(normalized);
        setForm(structuredClone(normalized));

        // Build selections
        const countryOpts = buildCountryOptions(countriesList);
        const callingOpts = buildCallingOptions(countriesList);
        const cats = buildCategoryOptions(categoryRes || []);
        setCategories(cats);

        // Country & Calling preselects
        setSelectedCountry(() => {
          if (normalized.countryId)
            return countryOpts.find((o) => o.value === normalized.countryId) || null;
          if (normalized.country)
            return (
              countryOpts.find(
                (o) => o.country.countryName.toLowerCase() === normalized.country.toLowerCase()
              ) || null
            );
          return null;
        });
        setSelectedCalling(() => {
          if (normalized.callingId)
            return callingOpts.find((o) => o.value === normalized.callingId) || null;
          if (normalized.callingCode)
            return callingOpts.find((o) => o.country.callingCode === normalized.callingCode) || null;
          return null;
        });

        // Platform preselect
        setSelectedPlatform(normalized.primaryPlatform);

        // Category + Subcategories preselect
        const preCategory = (() => {
          if (normalized.onboarding?.categoryId)
            return cats.find((c) => c.value === normalized.onboarding.categoryId) || null;
          if (normalized.onboarding?.categoryName)
            return (
              cats.find(
                (c) => c.label.toLowerCase() === normalized.onboarding.categoryName!.toLowerCase()
              ) || null
            );
          return null;
        })();
        setSelectedCategory(preCategory);
        setSubcategoryOptions(buildSubcategoryOptions(preCategory?.raw));

        // Preselect saved subcategories (no max, no slice)
        const preSubcats = (normalized.onboarding?.subcategories || [])
          .map((s) => ({ value: s.subcategoryId, label: s.subcategoryName }))
          .filter((s) => s.value);
        setSelectedSubcats(preSubcats);

        // Initialize prevCatId to current without triggering clear
        prevCatIdRef.current = preCategory?.value ?? null;
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Failed to load influencer profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // keep form.country / callingCode in sync with selections
  useEffect(() => {
    if (!selectedCountry) return;
    setForm((prev) => {
      if (!prev) return prev;
      const nextCountryId = selectedCountry.value;
      const nextCountryName = selectedCountry.country.countryName;
      if (prev.countryId === nextCountryId && prev.country === nextCountryName) return prev;
      return { ...prev, countryId: nextCountryId, country: nextCountryName };
    });
  }, [selectedCountry]);

  useEffect(() => {
    if (!selectedCalling) return;
    setForm((prev) => {
      if (!prev) return prev;
      const nextCallingId = selectedCalling.value;
      const nextCallingCode = selectedCalling.country.callingCode;
      if (prev.callingId === nextCallingId && prev.callingCode === nextCallingCode) return prev;
      return { ...prev, callingId: nextCallingId, callingCode: nextCallingCode };
    });
  }, [selectedCalling]);

  // Sync selected platform into form
  useEffect(() => {
    setForm((prev) => {
      if (!prev) return prev;
      if (prev.primaryPlatform === selectedPlatform) return prev;
      return { ...prev, primaryPlatform: selectedPlatform };
    });
  }, [selectedPlatform]);

  // When category changes, refresh subcategory options and only clear selection if the user actually changed it
  useEffect(() => {
    setSubcategoryOptions(buildSubcategoryOptions(selectedCategory?.raw));

    const currentId = selectedCategory?.value ?? null;
    const prevId = prevCatIdRef.current;

    if (prevId !== null && currentId !== prevId) {
      // category truly changed by user -> clear subs
      setSelectedSubcats([]);
      setForm((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          onboarding: {
            ...prev.onboarding,
            categoryId: selectedCategory?.value,
            categoryName: selectedCategory?.label,
            subcategories: [],
          },
        };
      });
    } else {
      // just keep the category in sync without clearing on initial hydration
      setForm((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          onboarding: {
            ...prev.onboarding,
            categoryId: selectedCategory?.value,
            categoryName: selectedCategory?.label,
          },
        };
      });
    }

    prevCatIdRef.current = currentId;
  }, [selectedCategory]);

  // Push selected subcats into form.onboarding
  useEffect(() => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        onboarding: {
          ...prev.onboarding,
          subcategories: selectedSubcats.map((s) => ({
            subcategoryId: s.value,
            subcategoryName: s.label,
          })),
        },
      };
    });
  }, [selectedSubcats]);

  const onField = useCallback(
    <K extends keyof InfluencerData>(key: K, value: InfluencerData[K]) => {
      setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    []
  );

  const resetEdits = useCallback(() => {
    if (!influencer) return;
    const cl = structuredClone(influencer);
    setForm(cl);
    setIsEditing(false);
    setEmailFlow("idle");
    setProfileImageFile(null);

    // Hydrate selections
    setSelectedCountry((prev) => {
      const byId = countryOptions.find((o) => o.value === cl.countryId) || null;
      if (byId) return byId;
      return (
        countryOptions.find(
          (o) => o.country.countryName.toLowerCase() === (cl.country || "").toLowerCase()
        ) || null
      );
    });
    setSelectedCalling((prev) => {
      const byId = codeOptions.find((o) => o.value === cl.callingId) || null;
      if (byId) return byId;
      return codeOptions.find((o) => o.country.callingCode === cl.callingCode) || null;
    });

    setSelectedPlatform(cl.primaryPlatform ?? null);

    // Category + subcats
    const cat =
      categories.find((c) => c.value === cl.onboarding?.categoryId) ||
      categories.find(
        (c) => c.label.toLowerCase() === (cl.onboarding?.categoryName || "").toLowerCase()
      ) ||
      null;
    setSelectedCategory(cat);
    setSubcategoryOptions(buildSubcategoryOptions(cat?.raw));
    const subs = (cl.onboarding?.subcategories || [])
      .map((s) => ({ value: s.subcategoryId, label: s.subcategoryName }))
      .filter((s) => s.value);
    setSelectedSubcats(subs);
    prevCatIdRef.current = cat?.value ?? null;
  }, [influencer, countryOptions, codeOptions, categories]);

  const saveProfile = useCallback(async () => {
    if (!form || !influencer) return;

    // Must not save if email change not verified
    if (emailFlow !== "idle" && emailFlow !== "verified") {
      await Swal.fire({
        icon: "warning",
        title: "Verify your new email",
        text: "Please finish verifying the new email before saving other changes.",
      });
      return;
    }

    // Gender is required after OTP verification (product decision)
    const hasValidGender =
      typeof form.gender !== "undefined" &&
      ["Male", "Female", "Non-binary", "Prefer not to say", ""].includes(form.gender);
    if (form.otpVerified && !hasValidGender) {
      await Swal.fire({
        icon: "info",
        title: "Gender required",
        text: "Please select your gender to continue.",
      });
      return;
    }

    // Phone: optional update
    const phoneTrim = (form.phone || "").trim();

    // If provided, validate (but don't force it)
    if (form.otpVerified && phoneTrim && !/^\d{10}$/.test(phoneTrim)) {
      await Swal.fire({
        icon: "warning",
        title: "Invalid phone",
        text: "Phone number must be 10 digits.",
      });
      return;
    }

    // Category & subcategories validation (no upper limit; require at least 1)
    if (!form.onboarding?.categoryId || !form.onboarding?.categoryName) {
      await Swal.fire({
        icon: "error",
        title: "Pick a category",
        text: "Please select a primary category.",
      });
      return;
    }
    if (!form.onboarding.subcategories || form.onboarding.subcategories.length < 1) {
      await Swal.fire({
        icon: "error",
        title: "Pick subcategories",
        text: "Please select one or more subcategories.",
      });
      return;
    }

    setSaving(true);
    try {
      const influencerId = localStorage.getItem("influencerId");
      if (!influencerId) throw { message: "Missing influencerId in localStorage." };

      const fd = new FormData();
      fd.append("influencerId", influencerId);

      // Basics
      fd.append("name", form.name || "");
      if (form.password) fd.append("password", form.password);
      const originalPhone = (influencer.phone || "").trim();

      if (phoneTrim && phoneTrim !== originalPhone) {
        fd.append("phone", phoneTrim);
      }

      // Gender: send label (backend expects String enum)
      if (typeof form.gender !== "undefined") {
        const g = String(form.gender || "");
        const allowed = ["Male", "Female", "Non-binary", "Prefer not to say", ""];
        if (allowed.includes(g)) {
          fd.append("gender", g);
        }
      }

      // Optional backcompat
      fd.append("socialMedia", form.socialMedia || "");
      fd.append("profileLink", form.profileLink || "");

      // Platform
      if (form.primaryPlatform) fd.append("primaryPlatform", form.primaryPlatform);

      // Location
      if (form.countryId) fd.append("countryId", form.countryId);
      if (form.callingId) fd.append("callingId", form.callingId);

      // Onboarding taxonomy (send as one JSON blob)
      fd.append(
        "onboarding",
        JSON.stringify({
          categoryId: form.onboarding.categoryId,
          categoryName: form.onboarding.categoryName,
          subcategories: form.onboarding.subcategories,
        })
      );

      // Avatar
      if (profileImageFile) fd.append("profileImage", profileImageFile);

      await post<{ message?: string }>("/influencer/updateProfile", fd);

      await Swal.fire({
        icon: "success",
        title: "Profile updated",
        timer: 1200,
        showConfirmButton: false,
      });

      const updatedRaw = await get<any>(`/influencer/getbyid?id=${influencerId}`);
      const updated = normalizeInfluencer(updatedRaw);

      setInfluencer(updated);
      setForm(structuredClone(updated));
      setIsEditing(false);
      setEmailFlow("idle");
      setProfileImageFile(null);

      // Reset selects to reflect saved state
      setSelectedCountry(() => {
        const byId = countryOptions.find((o) => o.value === updated.countryId);
        const byName =
          !byId &&
          countryOptions.find(
            (o) => o.country.countryName.toLowerCase() === (updated.country || "").toLowerCase()
          );
        return (byId || byName || null) as CountryOption | null;
      });
      setSelectedCalling(() => {
        const byId = codeOptions.find((o) => o.value === updated.callingId);
        const byCode = !byId && codeOptions.find((o) => o.country.callingCode === updated.callingCode);
        return (byId || byCode || null) as CountryOption | null;
      });
      setSelectedPlatform(updated.primaryPlatform ?? null);

      const cat =
        categories.find((c) => c.value === updated.onboarding?.categoryId) ||
        categories.find(
          (c) =>
            c.label.toLowerCase() === (updated.onboarding?.categoryName || "").toLowerCase()
        ) ||
        null;
      setSelectedCategory(cat);
      setSubcategoryOptions(buildSubcategoryOptions(cat?.raw));
      const subs = (updated.onboarding?.subcategories || [])
        .map((s) => ({ value: s.subcategoryId, label: s.subcategoryName }))
        .filter((s) => s.value);
      setSelectedSubcats(subs);
      prevCatIdRef.current = cat?.value ?? null;
    } catch (e: any) {
      console.error(e);
      await Swal.fire({
        icon: "error",
        title: "Save failed",
        text: e?.message || "Failed to save profile.",
      });
    } finally {
      setSaving(false);
    }
  }, [influencer, emailFlow, form, profileImageFile, countryOptions, codeOptions, categories]);

  if (loading) return <Loader />;
  if (error) return <InlineError message={error} />;

  const saveDisabled = saving || (emailFlow !== "idle" && emailFlow !== "verified");

  // Helper-to-SimpleOption for MultiSelect
  const toSO = (o: { value: string; label: string }) => ({ value: o.value, label: o.label });

  return (
    <section className="min-h-screen py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <Card className="bg-white">
          <CardContent className="py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative">
                  <Avatar className="h-20 w-20 rounded-2xl">
                    <AvatarImage
                      src={form?.profileImage || influencer?.profileImage || ""}
                      alt={influencer?.name}
                    />
                    <AvatarFallback className="rounded-2xl bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800">
                      <User className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                  {isEditing && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            setProfileImageFile(f);
                            if (f) {
                              const reader = new FileReader();
                              reader.onload = () =>
                                setForm((prev) =>
                                  prev ? { ...prev, profileImage: String(reader.result) } : prev
                                );
                              reader.readAsDataURL(f);
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold truncate">
                    {influencer?.name || "—"}
                  </h1>
                  <p className="text-muted-foreground truncate">
                    {humanizePlatform(influencer?.primaryPlatform ?? null)}
                    {influencer?.profileLink && (
                      <>
                        {" • "}
                        <a
                          href={influencer.profileLink}
                          className="text-amber-600 underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Profile Link
                        </a>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {!isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="gap-2 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
                >
                  <Pencil className="h-5 w-5" />
                  Edit Profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Profile & Contact */}
        <Card className="bg-white">
          <CardContent className="py-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Name */}
              <FieldCard icon={<User className="h-5 w-5 text-gray-800" />} label="Full Name" editing={isEditing}>
                {isEditing ? (
                  <Input value={form?.name || ""} onChange={(e) => onField("name", e.target.value as any)} />
                ) : (
                  <ReadText text={influencer?.name || ""} />
                )}
              </FieldCard>

              {/* Social Handle */}
              <FieldCard icon={<Hash className="h-5 w-5 text-gray-800" />} label="Social Handle" editing={isEditing}>
                {isEditing ? (
                  <Input
                    value={form?.socialMedia || ""}
                    onChange={(e) => onField("socialMedia", e.target.value as any)}
                  />
                ) : (
                  <ReadText text={influencer?.socialMedia || ""} />
                )}
              </FieldCard>

              {/* Email (dual OTP) */}
              {!isEditing ? (
                <FieldCard icon={<Mail className="h-5 w-5 text-gray-800" />} label="Email Address" editing={false}>
                  <ReadText text={influencer?.email ?? ""} />
                </FieldCard>
              ) : (
                influencer &&
                form && (
                  <EmailEditorSingleOTP
                    influencerId={influencer.influencerId}
                    originalEmail={influencer.email}
                    value={form.email}
                    onChange={(v) => onField("email", v as any)}
                    onVerified={(newEmail) => {
                      setInfluencer((b) => (b ? { ...b, email: newEmail } : b));
                      setForm((f) => (f ? { ...f, email: newEmail } : f));
                      setEmailFlow("verified");
                    }}
                    onStateChange={setEmailFlow}
                  />
                )
              )}

              {/* Phone */}
              <FieldCard icon={<PhoneIcon className="h-5 w-5 text-gray-800" />} label="Phone Number" editing={isEditing}>
                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-[140px,1fr] gap-2">
                    <div className="sm:col-span-1">
                      <ShSelect
                        value={selectedCalling?.value || ""}
                        onValueChange={(v) =>
                          setSelectedCalling(codeOptions.find((o) => o.value === v) || null)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Code" />
                        </SelectTrigger>
                        <SelectContent className="bg-white max-h-72 overflow-auto">
                          {codeOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.country.callingCode} ({o.country.countryName})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </ShSelect>
                    </div>
                    <div className="sm:col-span-1">
                      <Input
                        type="tel"
                        inputMode="tel"
                        value={form?.phone ?? ""}
                        onChange={(e) => onField("phone", e.target.value as any)}
                        placeholder="Phone number"
                      />
                    </div>
                  </div>
                ) : (
                  <ReadText
                    text={formatPhoneDisplay(
                      form?.callingCode || influencer?.callingCode,
                      influencer?.phone
                    )}
                  />
                )}
              </FieldCard>

              {/* Country */}
              <FieldCard icon={<Globe className="h-5 w-5 text-gray-800" />} label="Country" editing={isEditing}>
                {isEditing ? (
                  <ShSelect
                    value={selectedCountry?.value || ""}
                    onValueChange={(v) =>
                      setSelectedCountry(countryOptions.find((o) => o.value === v) || null)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Country" />
                    </SelectTrigger>
                    <SelectContent className="bg-white max-h-72 overflow-auto">
                      {countryOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.country.flag} {o.country.countryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </ShSelect>
                ) : (
                  <ReadText text={influencer?.country || ""} />
                )}
              </FieldCard>

              {/* Gender */}
              <FieldCard icon={<User className="h-5 w-5 text-gray-800" />} label="Gender" editing={isEditing}>
                {isEditing ? (
                  <ShSelect
                    value={form?.gender ?? ""}
                    onValueChange={(v) => onField("gender", v as GenderStr)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Non-binary">Non-binary</SelectItem>
                      <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </ShSelect>
                ) : (
                  <ReadText text={influencer?.gender || "—"} />
                )}
              </FieldCard>
            </div>
          </CardContent>
        </Card>

        {/* Platform & Categories */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Platform & Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Platform */}
              <FieldCard icon={<Users className="h-5 w-5 text-gray-800" />} label="Primary Platform" editing={isEditing}>
                {isEditing ? (
                  <ShSelect
                    value={selectedPlatform || ""}
                    onValueChange={(v) => setSelectedPlatform((v || null) as PrimaryPlatform)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Platform" />
                    </SelectTrigger>
                    <SelectContent className="bg-white max-h-72 overflow-auto">
                      {PLATFORM_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </ShSelect>
                ) : (
                  <ReadText text={humanizePlatform(influencer?.primaryPlatform ?? null)} />
                )}
              </FieldCard>

              {/* Category */}
              <FieldCard icon={<Pencil className="h-5 w-5 text-gray-800" />} label="Category" editing={isEditing}>
                {isEditing ? (
                  <ShSelect
                    value={selectedCategory?.value?.toString() || ""}
                    onValueChange={(v) =>
                      setSelectedCategory(
                        categories.find((c) => String(c.value) === v) || null
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent className="bg-white max-h-72 overflow-auto">
                      {categories.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </ShSelect>
                ) : (
                  <ReadText text={influencer?.onboarding?.categoryName || "—"} />
                )}
              </FieldCard>

              {/* Subcategories (multi) */}
              <div className="lg:col-span-2">
                <Card className="border">
                  <CardContent className="pt-6 space-y-2 bg-white">
                    <Label>Subcategories (select one or more)</Label>
                    {isEditing ? (
                      <>
                        <MultiSelect
                          values={selectedSubcats.map(toSO)}
                          onChange={(opts) => setSelectedSubcats(opts as SubcategoryOption[])}
                          options={subcategoryOptions.map(toSO)}
                          placeholder={
                            selectedCategory ? "Choose subcategories" : "Pick a category first"
                          }
                        />
                        {!!selectedSubcats.length && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {selectedSubcats.map((c) => (
                              <Badge key={c.value} variant="secondary">
                                {c.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </>
                    ) : influencer?.onboarding?.subcategories?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {influencer.onboarding.subcategories.map((s) => (
                          <Badge
                            key={s.subcategoryId}
                            variant="secondary"
                            className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
                          >
                            {s.subcategoryName}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">—</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription (read-only display) */}
        {!isEditing && (
          <Card className="bg-white">
            <CardContent className="py-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-gray-800" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold mb-1">Subscription</h3>
                      <p className="text-2xl font-bold">
                        {influencer?.subscription?.planName
                          ? influencer.subscription.planName.replace(/^./u, (c) =>
                            c.toLocaleUpperCase()
                          )
                          : "No Plan"}
                      </p>
                      <div className="space-y-1 text-sm text-muted-foreground mt-2">
                        {influencer?.subscription?.startedAt && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Started: {formatDate(influencer.subscription.startedAt)}</span>
                          </div>
                        )}
                        {influencer?.subscription?.expiresAt && (
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>
                              Expires: {formatDate(influencer.subscription.expiresAt)}
                              {influencer?.subscriptionExpired && (
                                <Badge variant="destructive" className="ml-2">
                                  Expired
                                </Badge>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="w-full sm:w-auto">
                      <Button
                        className="w-full gap-2 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
                        onClick={() => router.push("/influencer/subscriptions")}
                      >
                        <CreditCard className="h-5 w-5 text-gray-800" />
                        Upgrade Subscription
                      </Button>
                    </div>
                  </div>

                  {!!influencer?.subscription?.features?.length && (
                    <div className="mt-5 space-y-4">
                      {influencer.subscription.features.map((f) => {
                        const isManager = f.key === "dedicated_manager_support";

                        // Normalize numbers
                        const rawLimit = Number.isFinite(f.limit) ? f.limit : 0;
                        const limit = Math.max(0, rawLimit);
                        const used = Math.max(0, Number.isFinite(f.used) ? f.used : 0);

                        // ✅ Unlimited rule (updated): ONLY 0 means Unlimited (per plans API “0 ⇒ Unlimited”)
                        const unlimited = limit === 0;

                        const label = isManager
                          ? "Dedicated Manager Support"
                          : titleizeFeatureKey(f.key);

                        if (isManager) {
                          const status = unlimited
                            ? "Unlimited"
                            : limit >= 1
                              ? "Available"
                              : "Not Included";
                          const ok = unlimited || limit >= 1;

                          return (
                            <div key={f.key} className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm">
                                {ok ? (
                                  <Check className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <X className="w-4 h-4 text-gray-400" />
                                )}
                                <span className="text-gray-800">{label}</span>
                              </div>
                              <span
                                className={`text-xs px-2 py-1 rounded-md border ${unlimited
                                  ? "bg-blue-100 text-blue-700 border-blue-200"
                                  : ok
                                    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                    : "bg-gray-100 text-gray-700 border-gray-200"
                                  }`}
                              >
                                {status}
                              </span>
                            </div>
                          );
                        }

                        const pct = unlimited
                          ? 100
                          : limit > 0
                            ? Math.min(100, Math.round((used / limit) * 100))
                            : 0;

                        const barColorClass = unlimited
                          ? "[&>div]:bg-gradient-to-r [&>div]:from-[#FFBF00] [&>div]:to-[#FFDB58]"
                          : used >= limit
                            ? "[&>div]:bg-gradient-to-r [&>div]:from-red-500 [&>div]:to-red-400"
                            : pct >= 80
                              ? "[&>div]:bg-gradient-to-r [&>div]:from-orange-500 [&>div]:to-orange-300"
                              : "[&>div]:bg-gradient-to-r [&>div]:from-[#FFBF00] [&>div]:to-[#FFDB58]";

                        return (
                          <div key={f.key} className="group">
                            <div className="flex items-center justify-between mb-1 text-sm">
                              <span className="text-gray-800">{label}</span>
                              <span className="text-gray-500 tabular-nums">
                                {used} / {unlimited ? "∞" : limit}
                              </span>
                            </div>

                            <Progress
                              value={pct}
                              className={`h-2 rounded-full bg-gray-100 ${barColorClass}`}
                              aria-label={`${label} usage: ${used} of ${unlimited ? "unlimited" : limit}`}
                            />

                            <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                              <span className="tabular-nums">
                                {unlimited ? "∞" : `${pct}%`}
                              </span>
                              {unlimited ? (
                                <span className="tabular-nums flex items-center gap-1">
                                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                    Unlimited
                                  </span>
                                </span>
                              ) : (
                                <span className="tabular-nums">{Math.max(0, limit - used)} left</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {isEditing && (
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Button variant="outline" onClick={resetEdits} disabled={saving} className="gap-2 bg-white">
              <X className="h-5 w-5" />
              Cancel
            </Button>
            <Button
              onClick={saveProfile}
              disabled={saveDisabled}
              className="gap-2 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
              title={
                emailFlow !== "idle" && emailFlow !== "verified"
                  ? "Verify the new email to enable saving"
                  : undefined
              }
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

/* -------- Small UI helpers -------- */

function Loader() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/30 via-background to-muted/30 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-10 w-10 mx-auto mb-4 animate-spin text-amber-500" />
        <p className="text-muted-foreground font-medium">Loading profile…</p>
      </div>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/30 via-background to-muted/30 flex items-center justify-center">
      <Card className="max-w-md mx-auto text-center">
        <CardContent className="py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <X className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Error Loading Profile</h2>
          <p className="text-red-600 mb-4 break-words">{message}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function FieldCard({
  icon,
  label,
  children,
  editing,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  children: React.ReactNode;
  editing: boolean;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="pt-6 bg-white">
        <div className="flex items-start gap-4">
          {/* Gradient chip wrapper for the icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 flex items-center justify-center">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <Label className="mb-2 block">{label}</Label>
            <div>{children}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReadText({ text }: { text: string }) {
  return <p className="text-lg font-medium break-words">{text || "—"}</p>;
}
