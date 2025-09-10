"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

import { get, post } from "@/lib/api";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

/* ===================== Types ===================== */

type SubscriptionFeature = {
  key: string;
  limit: number;
  used: number;
};

type AudienceBifurcation = {
  malePercentage?: number;
  femalePercentage?: number;
};

type InfluencerData = {
  // Base profile
  name: string;
  email: string;
  password?: string; // only for update
  phone: string;
  profileImage?: string; // URL
  profileLink?: string;
  socialMedia?: string;

  // Location / dialing
  country: string;
  countryId: string;
  callingId: string;
  callingCode?: string; // "+91"
  county?: string; // backend legacy name for country

  // Platform / audience
  platformId?: string; // incoming normalized to platformId
  platformName?: string;
  manualPlatformName?: string;
  audienceRange?: string;
  audienceAgeRange?: string;
  audienceAgeRangeId?: string;
  audienceId?: string; // will hold AudienceRange _id when saving
  audienceBifurcation?: AudienceBifurcation;

  // Categories
  categories?: string[]; // interest _ids
  categoryName?: string[]; // resolved names

  // Subscription (read-only display)
  subscription: {
    planName: string;
    planId?: string;
    startedAt?: string;
    expiresAt: string;
    features: SubscriptionFeature[];
  };
  subscriptionExpired: boolean;

  // Wallet
  walletBalance: number;

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

  // Misc
  bio?: string;

  // Gender (0: Male, 1: Female, 2: Other)
  gender?: 0 | 1 | 2;
};

/* Reference data */
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

interface Platform {
  _id: string;
  platformId?: string;
  name: string;
}
interface PlatformOption {
  value: string;
  label: string;
  raw: Platform;
}

interface Interest {
  _id: string;
  name: string;
}
interface InterestOption {
  value: string;
  label: string;
  raw: Interest;
}

interface AudienceAgeRange {
  _id: string;
  audienceId: string;
  range: string;
}
interface AudienceAgeOption {
  value: string;
  label: string;
  raw: AudienceAgeRange;
}

interface AudienceRange {
  _id: string;
  range: string;
}
interface AudienceRangeOption {
  value: string;
  label: string;
  raw: AudienceRange;
}

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

function genderFromCode(code?: number) {
  if (code === 0) return "Male";
  if (code === 1) return "Female";
  if (code === 2) return "Other";
  return "—";
}

function pct(val?: number) {
  const v = Number.isFinite(val as any) ? (val as number) : 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function normalizeGender(raw: any): 0 | 1 | 2 | undefined {
  if (raw === null || typeof raw === "undefined" || raw === "") return undefined;

  if (typeof raw === "number") {
    return raw === 0 || raw === 1 || raw === 2 ? (raw as 0 | 1 | 2) : undefined;
  }

  const s = String(raw).trim().toLowerCase();
  if (s === "0" || s === "male" || s === "m") return 0;
  if (s === "1" || s === "female" || s === "f") return 1;
  if (s === "2" || s === "other" || s === "non-binary" || s === "nonbinary" || s === "nb")
    return 2;

  const n = Number(s);
  return n === 0 || n === 1 || n === 2 ? (n as 0 | 1 | 2) : undefined;
}

function validateEmail(email: string) {
  return /[^@\s]+@[^@\s]+\.[^@\s]+/.test(email);
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

const buildPlatformOptions = (rows: Platform[]): PlatformOption[] =>
  rows.map((p) => ({ value: p.platformId || p._id, label: p.name, raw: p }));

const buildInterestOptions = (rows: Interest[]): InterestOption[] =>
  rows.map((r) => ({ value: r._id, label: r.name, raw: r }));

const buildAgeOptions = (rows: AudienceAgeRange[]): AudienceAgeOption[] =>
  rows.map((r) => ({ value: r.audienceId, label: r.range, raw: r }));

const buildCountOptions = (rows: AudienceRange[]): AudienceRangeOption[] =>
  rows.map((r) => ({ value: r._id, label: r.range, raw: r }));

/* Normalize influencer payloads with variants */
function normalizeInfluencer(data: any): InfluencerData {
  const inf = data?.influencer ?? data;
  const s = inf?.subscription ?? {};
  return {
    name: inf?.name ?? "",
    email: inf?.email ?? "",
    phone: inf?.phone ?? "",
    profileImage: inf?.profileImage ?? "",
    profileLink: inf?.profileLink ?? "",
    socialMedia: inf?.socialMedia ?? "",

    country: inf?.country ?? inf?.county ?? "",
    countryId: inf?.countryId ?? "",
    callingId: inf?.callingId ?? "",
    callingCode: inf?.callingCode ?? inf?.callingcode ?? "",
    county: inf?.county ?? "",

    platformId: inf?.platformId || inf?.platformRef || "",
    platformName: inf?.platformName ?? "",
    audienceRange: inf?.audienceRange ?? "",
    audienceAgeRange: inf?.audienceAgeRange ?? "",
    audienceAgeRangeId: inf?.audienceAgeRangeId ?? "",
    audienceId: inf?.audienceId ?? "",
    audienceBifurcation: inf?.audienceBifurcation ?? {},

    categories: Array.isArray(inf?.categories) ? inf.categories : [],
    categoryName: Array.isArray(inf?.categoryName) ? inf.categoryName : [],

    subscription: {
      planName: s?.planName ?? "",
      planId: s?.planId ?? "",
      startedAt: s?.startedAt ?? "",
      expiresAt: s?.expiresAt ?? "",
      features: Array.isArray(s?.features) ? s.features : [],
    },
    subscriptionExpired: !!inf?.subscriptionExpired,

    walletBalance: Number.isFinite(+inf?.walletBalance) ? +inf.walletBalance : 0,

    otpVerified: !!inf?.otpVerified,
    passwordResetVerified: !!inf?.passwordResetVerified,
    failedLoginAttempts: Number.isFinite(+inf?.failedLoginAttempts) ? +inf.failedLoginAttempts : 0,
    lockUntil: inf?.lockUntil ?? null,

    _id: inf?._id ?? "",
    influencerId: inf?.influencerId ?? inf?._id ?? "",
    createdAt: inf?.createdAt ?? "",
    updatedAt: inf?.updatedAt ?? "",

    bio: inf?.bio ?? "",

    gender: normalizeGender(inf?.gender),
  };
}

/* ===================== MultiSelect for Categories (Select-only, searchable) ===================== */

type SimpleOption = { value: string; label: string };

function MultiSelect({ values, onChange, options, placeholder = "Choose...", max = 3 }: {
  values: SimpleOption[];
  onChange: (opts: SimpleOption[]) => void;
  options: SimpleOption[];
  placeholder?: string;
  max?: number;
}) {
  // remove controlled open unless you really need it
  // const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(values.map(v => v.value)), [values]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const toggle = (val: string) => {
    const opt = options.find(o => o.value === val);
    if (!opt) return;
    const isSelected = selectedSet.has(val);

    if (isSelected) {
      onChange(values.filter(v => v.value !== val));
    } else {
      if (values.length >= max) {
        Swal.fire({ icon: "info", title: `Limit reached (${max})`, text: `You can select up to ${max} categories.` });
        return;
      }
      onChange([...values, opt]);
    }
    // ❌ remove: setOpen(true);
  };

  const triggerLabel = values.length
    ? values.length <= 2 ? values.map(v => v.label).join(", ") : `${values.length} selected`
    : placeholder;

  return (
    <ShSelect /* open={open} onOpenChange={setOpen} */ value="" onValueChange={toggle}>
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
          filtered.map(opt => (
            <SelectItem
              key={opt.value}
              value={opt.value}
            // ❌ remove this: onPointerDown={(e) => e.preventDefault()}
            >
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


/* ===================== Dual-OTP Email Editor ===================== */

export type EmailFlowState = "idle" | "needs" | "codes_sent" | "verifying" | "verified";

function EmailEditorDualOTP({
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
  const [oldOtp, setOldOtp] = useState("");
  const [newOtp, setNewOtp] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needs = useMemo(() => !isEmailEqual(value, originalEmail), [value, originalEmail]);
  const valueIsValid = useMemo(() => validateEmail(value), [value]);

  useEffect(() => {
    if (!needs) {
      setFlow("idle");
      setOldOtp("");
      setNewOtp("");
      setErr(null);
      setMsg(null);
      onStateChange("idle");
    } else if (flow === "codes_sent" || flow === "verifying" || flow === "verified") {
      onStateChange(flow);
    } else {
      setFlow("needs");
      onStateChange("needs");
    }
  }, [needs, flow, value, originalEmail, onStateChange]);

  const requestCodes = useCallback(async () => {
    setErr(null);
    setMsg(null);
    if (!valueIsValid) return;
    setBusy(true);
    try {
      const resp = await post<{ message?: string }>("/requestEmailUpdate", {
        influencerId,
        newEmail: value.trim().toLowerCase(),
        role: "Influencer",
      });
      setFlow("codes_sent");
      const m = resp?.message || `OTPs sent to ${originalEmail} (current) and ${value} (new).`;
      setMsg(m);
      onStateChange("codes_sent");
      await Swal.fire({ icon: "info", title: "OTPs sent", text: m });
    } catch (e: any) {
      const m = e?.message || "Failed to send codes.";
      setErr(m);
      await Swal.fire({ icon: "error", title: "Error", text: m });
    } finally {
      setBusy(false);
    }
  }, [influencerId, originalEmail, value, valueIsValid, onStateChange]);

  const verifyAndPersist = useCallback(async () => {
    setErr(null);
    if (oldOtp.trim().length !== 6 || newOtp.trim().length !== 6) {
      const m = "Enter both 6-digit OTPs.";
      setErr(m);
      await Swal.fire({ icon: "warning", title: "Invalid OTP", text: m });
      return;
    }
    setBusy(true);
    setFlow("verifying");
    onStateChange("verifying");
    try {
      await post<{ message?: string }>("/verifyEmailUpdateOtp", {
        influencerId,
        role: "Influencer",
        oldEmailOtp: oldOtp.trim(),
        newEmailOtp: newOtp.trim(),
        newEmail: value.trim().toLowerCase(),
      });
      onVerified(value.trim().toLowerCase());
      setMsg("Email updated successfully.");
      setFlow("verified");
      onStateChange("verified");
      setOldOtp("");
      setNewOtp("");
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
  }, [influencerId, value, oldOtp, newOtp, onVerified, onStateChange]);

  const handleOtp =
    (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
      setter(digits);
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
              if (e.key === "Enter" && needs && valueIsValid && flow === "needs") {
                requestCodes();
              }
            }}
          />
          {needs && valueIsValid && (flow === "needs" || flow === "idle") && (
            <Button
              onClick={requestCodes}
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
                  Enter the 6-digit codes sent to{" "}
                  <span className="font-semibold">{originalEmail}</span> (current) and{" "}
                  <span className="font-semibold">{value}</span> (new).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Current Email OTP</Label>
                <Input
                  className="font-mono tracking-[0.3em] text-center text-lg"
                  placeholder="000000"
                  value={oldOtp}
                  onChange={handleOtp(setOldOtp)}
                  inputMode="numeric"
                  maxLength={6}
                />
              </div>
              <div>
                <Label className="text-xs">New Email OTP</Label>
                <Input
                  className="font-mono tracking-[0.3em] text-center text-lg"
                  placeholder="000000"
                  value={newOtp}
                  onChange={handleOtp(setNewOtp)}
                  inputMode="numeric"
                  maxLength={6}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button variant="outline" onClick={requestCodes} disabled={busy}>
                Resend Codes
              </Button>
              <Button
                onClick={verifyAndPersist}
                className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
                disabled={busy || oldOtp.length !== 6 || newOtp.length !== 6}
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

  // Platform, Categories, Audience Age, Audience Range
  const [platforms, setPlatforms] = useState<PlatformOption[]>([]);
  const [interests, setInterests] = useState<InterestOption[]>([]);
  const [ages, setAges] = useState<AudienceAgeOption[]>([]);
  const [ranges, setRanges] = useState<AudienceRangeOption[]>([]);

  const [selectedPlatform, setSelectedPlatform] = useState<PlatformOption | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<InterestOption[]>([]);
  const [selectedAge, setSelectedAge] = useState<AudienceAgeOption | null>(null);
  const [selectedRange, setSelectedRange] = useState<AudienceRangeOption | null>(null);

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
        const [infRes, countryRes, platRes, interestRes, ageRes, rangeRes] =
          await Promise.all([
            get<any>(`/influencer/getbyid?id=${influencerId}`),
            get<Country[]>("/country/getall"),
            get<Platform[]>("/platform/getall"),
            get<Interest[]>("/interest/getList"),
            get<AudienceAgeRange[]>("/audienceRange/getAll"),
            get<AudienceRange[]>("/audience/getlist"),
          ]);

        const countriesList = countryRes || [];
        setCountries(countriesList);

        const normalized = normalizeInfluencer(infRes);
        setInfluencer(normalized);
        setForm(structuredClone(normalized));

        // Build selections
        const countryOpts = buildCountryOptions(countriesList);
        const callingOpts = buildCallingOptions(countriesList);
        const platformOpts = buildPlatformOptions(platRes || []);
        const interestOpts = buildInterestOptions(interestRes || []);
        const ageOpts = buildAgeOptions(ageRes || []);
        const rangeOpts = buildCountOptions(rangeRes || []);

        setPlatforms(platformOpts);
        setInterests(interestOpts);
        setAges(ageOpts);
        setRanges(rangeOpts);

        // Preselect based on stored ids / values
        setSelectedCountry(() => {
          if (normalized.countryId)
            return countryOpts.find((o) => o.value === normalized.countryId) || null;
          if (normalized.country)
            return (
              countryOpts.find(
                (o) =>
                  o.country.countryName.toLowerCase() === normalized.country.toLowerCase()
              ) || null
            );
          return null;
        });
        setSelectedCalling(() => {
          if (normalized.callingId)
            return callingOpts.find((o) => o.value === normalized.callingId) || null;
          if (normalized.callingCode)
            return (
              callingOpts.find((o) => o.country.callingCode === normalized.callingCode) ||
              null
            );
          return null;
        });

        setSelectedPlatform(() => {
          if (!normalized.platformName && !normalized.platformId) return null;
          return (
            platformOpts.find((o) => o.value === normalized.platformId) ||
            platformOpts.find(
              (o) =>
                o.label.toLowerCase() === (normalized.platformName || "").toLowerCase()
            ) ||
            null
          );
        });

        setSelectedCategories(() => {
          const haveIds =
            Array.isArray(normalized.categories) && normalized.categories.length > 0;
          let picked: InterestOption[] = [];

          if (haveIds) {
            const idSet = new Set(normalized.categories);
            picked = interestOpts.filter((o) => idSet.has(o.value));
          }

          if (!picked.length && Array.isArray(normalized.categoryName) && normalized.categoryName.length) {
            const nameSet = new Set(
              normalized.categoryName.map((n: string) => n.trim().toLowerCase())
            );
            picked = interestOpts.filter((o) =>
              nameSet.has(o.label.trim().toLowerCase())
            );
          }

          return picked.slice(0, 3);
        });

        setSelectedAge(() => {
          const byId = ageOpts.find((o) => o.value === normalized.audienceAgeRangeId) || null;
          const byLabel =
            !byId && normalized.audienceAgeRange
              ? ageOpts.find(
                (o) =>
                  o.label.toLowerCase() ===
                  (normalized.audienceAgeRange || "").toLowerCase()
              ) || null
              : null;

          const sel = byId || byLabel || null;
          if (sel) setForm((prev) => (prev ? { ...prev, audienceAgeRangeId: sel.value } : prev));
          return sel;
        });

        setSelectedRange(() => {
          const byId = rangeOpts.find((o) => o.value === normalized.audienceId) || null;
          const byLabel =
            !byId && normalized.audienceRange
              ? rangeOpts.find(
                (o) =>
                  o.label.toLowerCase() === (normalized.audienceRange || "").toLowerCase()
              ) || null
              : null;
          const sel = byId || byLabel || null;
          if (sel) setForm((prev) => (prev ? { ...prev, audienceId: sel.value } : prev));
          return sel;
        });
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
    setForm(prev => {
      if (!prev) return prev;
      const nextCountryId = selectedCountry.value;
      const nextCountryName = selectedCountry.country.countryName;
      if (prev.countryId === nextCountryId && prev.country === nextCountryName) return prev;
      return { ...prev, countryId: nextCountryId, country: nextCountryName };
    });
  }, [selectedCountry]);

  useEffect(() => {
    if (!selectedCalling) return;
    setForm(prev => {
      if (!prev) return prev;
      const nextCallingId = selectedCalling.value;
      const nextCallingCode = selectedCalling.country.callingCode;
      if (prev.callingId === nextCallingId && prev.callingCode === nextCallingCode) return prev;
      return { ...prev, callingId: nextCallingId, callingCode: nextCallingCode };
    });
  }, [selectedCalling]);

  useEffect(() => {
    setForm(prev => {
      if (!prev) return prev;
      const next = selectedAge?.value || "";
      if (prev.audienceAgeRangeId === next) return prev;
      return { ...prev, audienceAgeRangeId: next };
    });
  }, [selectedAge]);

  useEffect(() => {
    setForm(prev => {
      if (!prev) return prev;
      const next = selectedRange?.value || "";
      if (prev.audienceId === next) return prev;
      return { ...prev, audienceId: next };
    });
  }, [selectedRange]);

  useEffect(() => {
    setForm(prev => {
      if (!prev) return prev;
      if (!selectedPlatform) {
        if (!prev.platformId && !prev.platformName && !prev.manualPlatformName) return prev;
        return { ...prev, platformId: "", platformName: "", manualPlatformName: "" };
      }
      const id = selectedPlatform.value;
      const name = selectedPlatform.label;
      if (prev.platformId === id && prev.platformName === name) return prev;
      return { ...prev, platformId: id, platformName: name };
    });
  }, [selectedPlatform]);

  // Only push categories while editing, and only if changed
  useEffect(() => {
    if (!isEditing) return;
    setForm(prev => {
      if (!prev) return prev;
      const next = selectedCategories.map(c => c.value);
      const same = Array.isArray(prev.categories)
        && prev.categories.length === next.length
        && prev.categories.every((v, i) => v === next[i]);
      if (same) return prev;
      return { ...prev, categories: next };
    });
  }, [selectedCategories, isEditing]);

  const onField = useCallback(<K extends keyof InfluencerData>(key: K, value: InfluencerData[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const resetEdits = useCallback(() => {
    if (!influencer) return;
    const cl = structuredClone(influencer);
    setForm(cl);
    setIsEditing(false);
    setEmailFlow("idle");
    setProfileImageFile(null);

    const countryOpt =
      countryOptions.find((o) => o.value === cl.countryId) ||
      countryOptions.find(
        (o) => o.country.countryName.toLowerCase() === (cl.country || "").toLowerCase()
      ) ||
      null;
    const callingOpt =
      codeOptions.find((o) => o.value === cl.callingId) ||
      codeOptions.find((o) => o.country.callingCode === cl.callingCode) ||
      null;
    setSelectedCountry(countryOpt);
    setSelectedCalling(callingOpt);

    setSelectedPlatform(() => {
      return (
        platforms.find((p) => p.value === cl.platformId) ||
        platforms.find(
          (p) => p.label.toLowerCase() === (cl.platformName || "").toLowerCase()
        ) ||
        null
      );
    });
    setSelectedCategories(() => {
      const ids = new Set(cl.categories || []);
      return interests.filter((i) => ids.has(i.value));
    });
    setSelectedAge(() => ages.find((a) => a.value === cl.audienceAgeRangeId) || null);
    setSelectedRange(() => ranges.find((r) => r.value === cl.audienceId) || null);
  }, [influencer, countryOptions, codeOptions, platforms, interests, ages, ranges]);

  // Hydrate selections when entering edit mode (ensures chips populated)
  useEffect(() => {
    if (!isEditing || !form) return;
    if (!selectedCategories.length && interests.length) {
      const ids = new Set(form.categories || []);
      setSelectedCategories(interests.filter((i) => ids.has(i.value)));
    }
    if (!selectedAge && ages.length && form.audienceAgeRangeId) {
      setSelectedAge(ages.find((a) => a.value === form.audienceAgeRangeId) || null);
    }
    if (!selectedRange && ranges.length && form.audienceId) {
      setSelectedRange(ranges.find((r) => r.value === form.audienceId) || null);
    }
    if (!selectedPlatform && platforms.length) {
      const sel =
        platforms.find((p) => p.value === form.platformId) ||
        platforms.find(
          (p) => p.label.toLowerCase() === (form.platformName || "").toLowerCase()
        ) ||
        null;
      setSelectedPlatform(sel);
    }
    if (!selectedCountry && countryOptions.length) {
      setSelectedCountry(
        countryOptions.find((o) => o.value === form.countryId) ||
        countryOptions.find(
          (o) =>
            o.country.countryName.toLowerCase() === (form.country || "").toLowerCase()
        ) ||
        null
      );
    }
    if (!selectedCalling && codeOptions.length) {
      setSelectedCalling(
        codeOptions.find((o) => o.value === form.callingId) ||
        codeOptions.find((o) => o.country.callingCode === form.callingCode) ||
        null
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isEditing,
    form,
    interests,
    ages,
    ranges,
    platforms,
    countryOptions,
    codeOptions,
    selectedCategories.length,
    selectedAge,
    selectedRange,
    selectedPlatform,
    selectedCountry,
    selectedCalling,
  ]);

  const saveProfile = useCallback(async () => {
    if (!form || !influencer) return;

    if (emailFlow !== "idle" && emailFlow !== "verified") {
      await Swal.fire({
        icon: "warning",
        title: "Verify your new email",
        text: "Please finish verifying the new email before saving other changes.",
      });
      return;
    }

    const hasValidGender = form.gender === 0 || form.gender === 1 || form.gender === 2;
    if (form.otpVerified && !hasValidGender) {
      await Swal.fire({
        icon: "info",
        title: "Gender required",
        text: "Please select your gender to continue.",
      });
      return;
    }

    const categoriesForSave =
      (form.categories && form.categories.length
        ? form.categories
        : selectedCategories.map((c) => c.value)) || [];
    if (categoriesForSave.length < 1 || categoriesForSave.length > 3) {
      await Swal.fire({
        icon: "error",
        title: "Pick 1–3 categories",
        text: "Please select between 1 and 3 categories.",
      });
      return;
    }

    setSaving(true);
    try {
      const influencerId = localStorage.getItem("influencerId");
      if (!influencerId) throw { message: "Missing influencerId in localStorage." };

      const fd = new FormData();
      fd.append("influencerId", influencerId);

      fd.append("name", form.name || "");
      if (form.password) fd.append("password", form.password);
      fd.append("phone", form.phone || "");
      fd.append("socialMedia", form.socialMedia || "");
      if (typeof form.gender !== "undefined") fd.append("gender", String(form.gender));
      fd.append("profileLink", form.profileLink || "");
      fd.append("bio", form.bio || "");

      if (form.platformId) fd.append("platformId", form.platformId);
      if (form.manualPlatformName) fd.append("manualPlatformName", form.manualPlatformName);

      const male = form.audienceBifurcation?.malePercentage;
      const female = form.audienceBifurcation?.femalePercentage;
      if (typeof male !== "undefined") fd.append("malePercentage", String(male));
      if (typeof female !== "undefined") fd.append("femalePercentage", String(female));

      fd.append("categories", JSON.stringify(categoriesForSave));

      if (form.audienceAgeRangeId) fd.append("audienceAgeRangeId", form.audienceAgeRangeId);
      if (form.audienceId) fd.append("audienceId", form.audienceId);

      if (form.countryId) fd.append("countryId", form.countryId);
      if (form.callingId) fd.append("callingId", form.callingId);

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

      setSelectedCountry(() => {
        const byId = countryOptions.find((o) => o.value === updated.countryId);
        const byName =
          !byId &&
          countryOptions.find(
            (o) =>
              o.country.countryName.toLowerCase() === (updated.country || "").toLowerCase()
          );
        return byId || byName || null;
      });
      setSelectedCalling(() => {
        const byId = codeOptions.find((o) => o.value === updated.callingId);
        const byCode =
          !byId && codeOptions.find((o) => o.country.callingCode === updated.callingCode);
        return byId || byCode || null;
      });
      setSelectedPlatform(() => {
        return (
          platforms.find((p) => p.value === updated.platformId) ||
          platforms.find(
            (p) => p.label.toLowerCase() === (updated.platformName || "").toLowerCase()
          ) ||
          null
        );
      });
      setSelectedAge(() => ages.find((a) => a.value === updated.audienceAgeRangeId) || null);
      setSelectedRange(() => ranges.find((r) => r.value === updated.audienceId) || null);
      setSelectedCategories(() => {
        const ids = new Set(updated.categories || []);
        return interests.filter((i) => ids.has(i.value));
      });
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
  }, [
    influencer,
    emailFlow,
    form,
    profileImageFile,
    selectedCategories,
    countryOptions,
    codeOptions,
    platforms,
    ages,
    ranges,
    interests,
  ]);

  if (loading) return <Loader />;
  if (error) return <InlineError message={error} />;

  const saveDisabled = saving || (emailFlow !== "idle" && emailFlow !== "verified");
  const showManualPlatform = selectedPlatform?.label?.toLowerCase() === "other";

  // Helper-to-SimpleOption for category MultiSelect
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
                        <Button variant="outline" size="sm" className="gap-1 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800">
                          <ImageIcon className="h-4 w-4" />
                          Upload
                        </Button>
                      </label>
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold truncate">
                    {influencer?.name || "—"}
                  </h1>
                  <p className="text-muted-foreground truncate">
                    {influencer?.platformName ? `${influencer.platformName}` : "—"}
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
                  {influencer?.socialMedia && (
                    <p className="text-muted-foreground truncate">
                      Handle: <span className="font-medium">{influencer.socialMedia}</span>
                    </p>
                  )}
                </div>
              </div>

              {!isEditing && (
                <Button onClick={() => setIsEditing(true)} className="gap-2 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800">
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
              <FieldCard
                icon={<User className="h-5 w-5 text-indigo-600" />}
                label="Full Name"
                editing={isEditing}
              >
                {isEditing ? (
                  <Input
                    value={form?.name || ""}
                    onChange={(e) => onField("name", e.target.value as any)}
                  />
                ) : (
                  <ReadText text={influencer?.name || ""} />
                )}
              </FieldCard>

              {/* Social Handle */}
              <FieldCard
                icon={<Hash className="h-5 w-5 text-indigo-600" />}
                label="Social Handle"
                editing={isEditing}
              >
                {isEditing ? (
                  <Input
                    value={form?.socialMedia || ""}
                    onChange={(e) => onField("socialMedia", e.target.value as any)}
                  />
                ) : (
                  <ReadText text={influencer?.socialMedia || ""} />
                )}
              </FieldCard>

              {/* Profile Link */}
              <FieldCard
                icon={<LinkIcon className="h-5 w-5 text-indigo-600" />}
                label="Profile Link"
                editing={isEditing}
              >
                {isEditing ? (
                  <Input
                    value={form?.profileLink || ""}
                    onChange={(e) => onField("profileLink", e.target.value as any)}
                  />
                ) : (
                  <ReadText text={influencer?.profileLink || ""} />
                )}
              </FieldCard>

              {/* Email (dual OTP) */}
              {!isEditing ? (
                <FieldCard
                  icon={<Mail className="h-5 w-5 text-indigo-600" />}
                  label="Email Address"
                  editing={false}
                >
                  <ReadText text={influencer?.email ?? ""} />
                </FieldCard>
              ) : (
                influencer &&
                form && (
                  <EmailEditorDualOTP
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
              <FieldCard
                icon={<PhoneIcon className="h-5 w-5 text-emerald-600" />}
                label="Phone Number"
                editing={isEditing}
              >
                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-[140px,1fr] gap-2">
                    <div className="sm:col-span-1">
                      <ShSelect
                        value={selectedCalling?.value || ""}
                        onValueChange={(v) =>
                          setSelectedCalling(
                            codeOptions.find((o) => o.value === v) || null
                          )
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
              <FieldCard
                icon={<Globe className="h-5 w-5 text-purple-600" />}
                label="Country"
                editing={isEditing}
              >
                {isEditing ? (
                  <ShSelect
                    value={selectedCountry?.value || ""}
                    onValueChange={(v) =>
                      setSelectedCountry(
                        countryOptions.find((o) => o.value === v) || null
                      )
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
                  <ReadText text={influencer?.country || influencer?.county || ""} />
                )}
              </FieldCard>

              {/* Gender */}
              <FieldCard
                icon={<User className="h-5 w-5 text-indigo-600" />}
                label={
                  <>
                    Gender {form?.otpVerified && <span className="text-destructive">*</span>}
                  </>
                }
                editing={isEditing}
              >
                {isEditing ? (
                  <ShSelect
                    value={form?.gender !== undefined ? String(form.gender) : ""}
                    onValueChange={(v) => {
                      if (v === "") onField("gender", undefined as any);
                      else onField("gender", Number(v) as any);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="0">Male</SelectItem>
                      <SelectItem value="1">Female</SelectItem>
                      <SelectItem value="2">Other</SelectItem>
                    </SelectContent>
                  </ShSelect>
                ) : (
                  <ReadText text={genderFromCode(influencer?.gender as any)} />
                )}
              </FieldCard>
            </div>
          </CardContent>
        </Card>

        {/* Platform & Audience */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Platform & Audience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Platform */}
              <FieldCard
                icon={<Users className="h-5 w-5 text-indigo-600" />}
                label="Platform"
                editing={isEditing}
              >
                {isEditing ? (
                  <ShSelect
                    value={selectedPlatform?.value || ""}
                    onValueChange={(v) =>
                      setSelectedPlatform(platforms.find((o) => o.value === v) || null)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Platform" />
                    </SelectTrigger>
                    <SelectContent className="bg-white max-h-72 overflow-auto">
                      {platforms.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </ShSelect>
                ) : (
                  <ReadText text={influencer?.platformName || "—"} />
                )}
              </FieldCard>

              {/* Manual Platform */}
              {isEditing && showManualPlatform && (
                <FieldCard
                  icon={<Pencil className="h-5 w-5 text-indigo-600" />}
                  label="If Other – Enter Platform Name"
                  editing={true}
                >
                  <Input
                    value={form?.manualPlatformName || ""}
                    onChange={(e) => onField("manualPlatformName", e.target.value as any)}
                  />
                </FieldCard>
              )}

              {/* Audience Age Range */}
              <FieldCard
                icon={<Calendar className="h-5 w-5 text-indigo-600" />}
                label="Audience Age Range"
                editing={isEditing}
              >
                {isEditing ? (
                  <ShSelect
                    value={selectedAge?.value || ""}
                    onValueChange={(v) =>
                      setSelectedAge(ages.find((o) => o.value === v) || null)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="e.g., 18 – 24" />
                    </SelectTrigger>
                    <SelectContent className="bg-white max-h-72 overflow-auto">
                      {ages.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </ShSelect>
                ) : (
                  <ReadText text={influencer?.audienceAgeRange || "—"} />
                )}
              </FieldCard>

              {/* Audience Range (Count) */}
              <FieldCard
                icon={<Calendar className="h-5 w-5 text-indigo-600" />}
                label="Audience Range (Count)"
                editing={isEditing}
              >
                {isEditing ? (
                  <ShSelect
                    value={selectedRange?.value || ""}
                    onValueChange={(v) =>
                      setSelectedRange(ranges.find((o) => o.value === v) || null)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="e.g., 10k – 18k" />
                    </SelectTrigger>
                    <SelectContent className="bg-white max-h-72 overflow-auto">
                      {ranges.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </ShSelect>
                ) : (
                  <ReadText text={influencer?.audienceRange || "—"} />
                )}
              </FieldCard>

              {/* Audience Gender Split */}
              <div className="lg:col-span-2">
                <Card className="border">
                  <CardContent className="pt-6">
                    <Label>Audience Gender Split</Label>
                    {isEditing ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <div>
                          <Label className="text-xs">Male %</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={form?.audienceBifurcation?.malePercentage ?? 0}
                            onChange={(e) =>
                              onField(
                                "audienceBifurcation",
                                {
                                  ...form?.audienceBifurcation,
                                  malePercentage: Math.max(
                                    0,
                                    Math.min(100, Number(e.target.value))
                                  ),
                                } as any
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Female %</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={form?.audienceBifurcation?.femalePercentage ?? 0}
                            onChange={(e) =>
                              onField(
                                "audienceBifurcation",
                                {
                                  ...form?.audienceBifurcation,
                                  femalePercentage: Math.max(
                                    0,
                                    Math.min(100, Number(e.target.value))
                                  ),
                                } as any
                              )
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-3 inline-block bg-blue-400"
                            style={{
                              width: `${pct(
                                influencer?.audienceBifurcation?.malePercentage
                              )}%`,
                            }}
                            title={`Male ${pct(
                              influencer?.audienceBifurcation?.malePercentage
                            )}%`}
                          />
                          <div
                            className="h-3 inline-block bg-pink-300"
                            style={{
                              width: `${pct(
                                influencer?.audienceBifurcation?.femalePercentage
                              )}%`,
                            }}
                            title={`Female ${pct(
                              influencer?.audienceBifurcation?.femalePercentage
                            )}%`}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>
                            Male: {pct(influencer?.audienceBifurcation?.malePercentage)}%
                          </span>
                          <span>
                            Female: {pct(influencer?.audienceBifurcation?.femalePercentage)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Categories (multi) */}
              <div className="lg:col-span-2">
                <Card className="border">
                  <CardContent className="pt-6 space-y-2 bg-white">
                    <Label>Categories (select 1–3)</Label>
                    {isEditing ? (
                      <>
                        <MultiSelect
                          values={selectedCategories.map(toSO)}
                          onChange={(opts) =>
                            setSelectedCategories(
                              interests.filter((i) => opts.some((o) => o.value === i.value))
                            )
                          }
                          options={interests.map(toSO)}
                          placeholder="Choose up to 3 categories"
                          max={3}
                        />
                        {!!selectedCategories.length && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {selectedCategories.map((c) => (
                              <Badge key={c.value} variant="secondary">
                                {c.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </>
                    ) : influencer?.categoryName?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {influencer.categoryName.map((c) => (
                          <Badge key={c} variant="secondary" className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800">
                            {c}
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

        {/* Bio */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Bio</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Textarea
                rows={4}
                value={form?.bio || ""}
                onChange={(e) => onField("bio", e.target.value as any)}
              />
            ) : (
              <p className="text-foreground whitespace-pre-wrap break-words">
                {influencer?.bio || "—"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Subscription (read-only display) */}
        {!isEditing && (
          <Card className="bg-white">
            <CardContent className="py-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-purple-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold mb-1">Subscription</h3>
                      <p className="text-2xl font-bold">
                        {influencer?.subscription?.planName || "No Plan"}
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
                      <Button className="w-full gap-2 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800">
                        <CreditCard className="h-5 w-5" />
                        Upgrade Subscription
                      </Button>
                    </div>
                  </div>

                  {!!influencer?.subscription?.features?.length && (
                    <div className="mt-5 space-y-3">
                      {influencer.subscription.features.map((feat) => {
                        const isUnlimited = feat.limit === 1; // 1 => Unlimited
                        const percent = isUnlimited
                          ? 100
                          : feat.limit > 0
                            ? Math.min(100, Math.round((feat.used / feat.limit) * 100))
                            : 0;

                        return (
                          <div key={feat.key}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="capitalize break-words">
                                {feat.key.replace(/_/g, " ")}
                              </span>

                              {isUnlimited ? (
                                <span className="inline-flex items-center gap-2">
                                  {feat.used}/∞
                                  <Badge className="ml-1">Unlimited</Badge>
                                </span>
                              ) : (
                                <span>
                                  {feat.used}/{feat.limit}
                                </span>
                              )}
                            </div>

                            <Progress value={percent} />
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
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
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
