"use client";

import React, { useCallback, useEffect, useMemo, useState, useId } from "react";
import Select from "react-select";
import { get, post } from "@/lib/api";
import {
  HiUser,
  HiPhone,
  HiGlobe,
  HiMail,
  HiCheck,
  HiX,
  HiCreditCard,
  HiCash,
  HiCalendar,
  HiShieldCheck,
} from "react-icons/hi";

// --- shadcn/ui imports ---
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";

/* ===================== Types & Helpers ===================== */

// --- deterministic formatting helpers (SSR-safe) ---
const FIXED_LOCALE = "en-US";
const FIXED_TZ = "UTC";

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat(FIXED_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: FIXED_TZ,
  }).format(d);
};

const formatDateTime = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat(FIXED_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: FIXED_TZ,
  }).format(d);
};

const formatUSD = (n: number) =>
  new Intl.NumberFormat(FIXED_LOCALE, { style: "currency", currency: "USD" }).format(n);

const titleizeFeatureKey = (k: string) =>
  k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

type SubscriptionFeature = {
  key: string;
  limit: number;
  used: number;
};

type BrandData = {
  name: string;
  email: string;
  phone: string; // local number (no +code)
  country: string;
  countryId: string;
  callingId: string;
  callingCode?: string; // "+91"
  brandId: string;
  createdAt: string;
  updatedAt: string;
  subscription: {
    expiresAt: string;
    startedAt: string;
    planName: string;
    features: SubscriptionFeature[];
  };
  subscriptionExpired: boolean;
  walletBalance: number;
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

const deepClone = <T,>(obj: T): T =>
  // @ts-ignore
  typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));

function normalizeBrand(data: any): BrandData {
  const s = data?.subscription ?? {};
  const brand = data?.brand ?? data;
  return {
    name: brand?.name ?? "",
    email: brand?.email ?? "",
    phone: brand?.phone ?? "",
    country: brand?.country ?? "",
    countryId: brand?.countryId ?? "",
    callingId: brand?.callingId ?? "",
    callingCode: brand?.callingcode ?? brand?.callingCode ?? "",
    brandId: brand?.brandId ?? "",
    createdAt: brand?.createdAt ?? "",
    updatedAt: brand?.updatedAt ?? "",
    subscription: {
      planName: s?.planName ?? brand?.planName ?? "",
      startedAt: s?.startedAt ?? brand?.startedAt ?? "",
      expiresAt: s?.expiresAt ?? brand?.expiresAt ?? "",
      features: Array.isArray(s?.features) ? s.features : Array.isArray(brand?.features) ? brand.features : [],
    },
    subscriptionExpired: !!brand?.subscriptionExpired,
    walletBalance: Number.isFinite(+brand?.walletBalance) ? +brand.walletBalance : 0,
  };
}

function validateEmail(email: string) {
  return /[^@\s]+@[^@\s]+\.[^@\s]+/.test(email);
}

/* ===================== Country / Calling code ===================== */

interface Country {
  _id: string;
  countryName: string;
  callingCode: string; // e.g. +91
  countryCode: string; // e.g. IN
  flag: string; // emoji or URL
}

interface CountryOption {
  value: string;
  label: string;
  country: Country;
}

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

const filterByCountryName = (option: { data: CountryOption }, raw: string) => {
  const input = raw.toLowerCase().trim();
  const { country } = option.data;
  return (
    country.countryName.toLowerCase().includes(input) ||
    country.countryCode.toLowerCase().includes(input) ||
    country.callingCode.replace(/^\+/, "").includes(input.replace(/^\+/, ""))
  );
};

/* ===================== Dual-OTP Email Editor (shadcn Dialog) ===================== */

type EmailFlowState = "idle" | "needs" | "codes_sent" | "verifying" | "verified";

const EmailEditorDualOTPRaw = ({
  brandId,
  originalEmail,
  value,
  onChange,
  onVerified,
  onStateChange,
}: {
  brandId: string;
  originalEmail: string;
  value: string;
  onChange: (v: string) => void;
  onVerified: (newEmail: string, token?: string) => void;
  onStateChange: (s: EmailFlowState) => void;
}) => {
  const [flow, setFlow] = useState<EmailFlowState>("idle");
  const [wasVerified, setWasVerified] = useState(false);
  const [oldOtp, setOldOtp] = useState("");
  const [newOtp, setNewOtp] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [open, setOpen] = useState(false);

  const needs = useMemo(() => !isEmailEqual(value, originalEmail), [value, originalEmail]);
  const valueIsValid = useMemo(() => validateEmail(value), [value]);

  // Cooldown tick
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  // Manage flow based on whether email changed
  useEffect(() => {
    if (!needs) {
      setFlow("idle");
      setOldOtp("");
      setNewOtp("");
      setErr(null);
      setMsg(null);
      setExpiresAt(null);
      onStateChange("idle");
    } else if (flow === "codes_sent" || flow === "verifying" || flow === "verified") {
      onStateChange(flow);
    } else {
      setFlow("needs");
      onStateChange("needs");
      setWasVerified(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needs, flow, value, originalEmail]);

  const requestCodes = useCallback(async () => {
    setErr(null);
    setMsg(null);
    if (!valueIsValid || busy || resendIn > 0) {
      if (valueIsValid) setOpen(true);
      return;
    }
    setBusy(true);
    try {
      const resp = await post<{
        message?: string;
        oldEmail?: string;
        newEmail?: string;
        expiresAt?: string;
      }>("/brand/requestEmailUpdate", { brandId, newEmail: value.trim().toLowerCase() });
      setFlow("codes_sent");
      setMsg(resp?.message || `OTPs sent to ${originalEmail} (current) and ${value} (new).`);
      setExpiresAt(resp?.expiresAt || null);
      setResendIn(30);
      onStateChange("codes_sent");
      setOpen(true);
    } catch (e: any) {
      setErr(e?.message || "Failed to send codes.");
    } finally {
      setBusy(false);
    }
  }, [brandId, originalEmail, value, valueIsValid, busy, resendIn, onStateChange]);

  const verifyAndPersist = useCallback(async () => {
    setErr(null);
    if (oldOtp.trim().length !== 6 || newOtp.trim().length !== 6) {
      setErr("Enter both 6-digit OTPs.");
      return;
    }
    setBusy(true);
    setFlow("verifying");
    onStateChange("verifying");
    try {
      const res = await post<{ email: string; token?: string; message?: string }>(
        "/brand/verifyEmailUpdate",
        { brandId, newEmail: value.trim().toLowerCase(), oldOtp: oldOtp.trim(), newOtp: newOtp.trim() }
      );
      const newEmail = (res as any)?.email || value.trim().toLowerCase();
      const token = (res as any)?.token;
      onVerified(newEmail, token);
      setMsg(res?.message || "Email updated successfully.");
      setFlow("verified");
      onStateChange("verified");
      setOldOtp("");
      setNewOtp("");
      setWasVerified(true);
      setOpen(false);
    } catch (e: any) {
      setErr(e?.message || "Verification failed.");
      setFlow("codes_sent");
      onStateChange("codes_sent");
    } finally {
      setBusy(false);
    }
  }, [brandId, value, oldOtp, newOtp, onVerified, onStateChange]);

  const handleOtp = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
    setter(digits);
  };

  const emailInputId = useId();
  const oldOtpId = useId();
  const newOtpId = useId();

  return (
    <div className="relative bg-white border border-gray-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200" aria-busy={busy}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center">
          <HiMail className="text-indigo-600 w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <Label className="mb-2 block text-sm text-gray-700" htmlFor={emailInputId}>
            Email Address
          </Label>

          <div className="relative">
            <Input
              id={emailInputId}
              className="pr-32"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="name@example.com"
              aria-invalid={needs && !validateEmail(value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && needs && valueIsValid && (flow === "needs" || flow === "codes_sent")) {
                  requestCodes();
                }
              }}
            />

            {/* Right side: Verified badge OR action button OR nothing */}
            {wasVerified && !needs ? (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <HiCheck className="w-4 h-4 mr-1" />
                  Verified
                </Badge>
              </div>
            ) : needs && valueIsValid ? (
              <Button
                onClick={requestCodes}
                disabled={busy}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3"
              >
                {flow === "codes_sent" ? (resendIn > 0 ? `Enter Codes (${resendIn}s)` : "Enter Codes") : (busy ? "Sending…" : "Verify")}
              </Button>
            ) : null}
          </div>

          {(msg || err) && (
            <div className="mt-3" aria-live="polite">
              {msg && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 flex items-center gap-2">
                    <HiCheck className="w-4 h-4" />
                    {msg}
                  </p>
                </div>
              )}
              {err && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 flex items-center gap-2">
                    <HiX className="w-4 h-4" />
                    {err}
                  </p>
                </div>
              )}
            </div>
          )}

          {needs && flow === "needs" && (
            <button
              type="button"
              onClick={() => onChange(originalEmail)}
              className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
            >
              Cancel change
            </button>
          )}

          {/* OTP Modal */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-lg bg-white">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <HiShieldCheck className="w-5 h-5 text-amber-600" />
                  Verify your email
                </DialogTitle>
                <DialogDescription>
                  Enter the 6-digit codes sent to <strong>{originalEmail}</strong> (current) and{" "}
                  <strong>{value}</strong> (new).
                  {expiresAt && (
                    <span className="block mt-1 text-xs text-amber-600">
                      Expires: {formatDateTime(expiresAt)}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={oldOtpId} className="text-xs text-gray-600">
                    Current Email OTP
                  </Label>
                  <Input
                    id={oldOtpId}
                    placeholder="000000"
                    value={oldOtp}
                    onChange={handleOtp(setOldOtp)}
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    className="text-center tracking-widest font-mono text-lg"
                  />
                </div>
                <div>
                  <Label htmlFor={newOtpId} className="text-xs text-gray-600">
                    New Email OTP
                  </Label>
                  <Input
                    id={newOtpId}
                    placeholder="000000"
                    value={newOtp}
                    onChange={handleOtp(setNewOtp)}
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    className="text-center tracking-widest font-mono text-lg"
                  />
                </div>
              </div>

              {(msg || err) && (
                <div className="mt-3" aria-live="polite">
                  {msg && <div className="p-2 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">{msg}</div>}
                  {err && <div className="p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">{err}</div>}
                </div>
              )}

              <DialogFooter className="mt-4 flex items-center justify-between sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || resendIn > 0}
                  onClick={requestCodes}
                  title={resendIn > 0 ? `Resend in ${resendIn}s` : "Resend codes"}
                >
                  {resendIn > 0 ? `Resend (${resendIn}s)` : "Resend Codes"}
                </Button>
                <Button
                  onClick={verifyAndPersist}
                  disabled={busy || oldOtp.length !== 6 || newOtp.length !== 6}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:transform-none"
                >
                  {busy ? "Verifying…" : "Verify & Update"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

const EmailEditorDualOTP = React.memo(EmailEditorDualOTPRaw);

/* ===================== Main Page ===================== */

export default function BrandProfilePage() {

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const router = useRouter();
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [form, setForm] = useState<BrandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailFlow, setEmailFlow] = useState<EmailFlowState>("idle");

  const [countries, setCountries] = useState<Country[]>([]);
  const countryOptions = useMemo(() => buildCountryOptions(countries), [countries]);
  const codeOptions = useMemo(() => buildCallingOptions(countries), [countries]);

  const maps = useMemo(() => {
    const co = buildCountryOptions(countries);
    const ko = buildCallingOptions(countries);
    return {
      countryById: new Map(co.map((o) => [o.value, o] as const)),
      callingById: new Map(ko.map((o) => [o.value, o] as const)),
      co,
      ko,
    };
  }, [countries]);

  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null);
  const [selectedCalling, setSelectedCalling] = useState<CountryOption | null>(null);

  const selectStyles = useMemo(
    () => ({
      control: (base: any, state: any) => ({
        ...base,
        backgroundColor: "#F9FAFB",
        borderColor: state.isFocused ? "#F97316" : "#E5E7EB",
        boxShadow: state.isFocused ? "0 0 0 2px rgba(249, 115, 22, 0.2)" : "none",
        "&:hover": { borderColor: "#F97316" },
        borderRadius: "8px",
        padding: "4px",
        minHeight: "44px",
      }),
      option: (base: any, state: any) => ({
        ...base,
        backgroundColor: state.isSelected ? "#FED7AA" : state.isFocused ? "#FFF7ED" : "transparent",
        color: state.isSelected ? "#9A3412" : "#374151",
        "&:hover": { backgroundColor: "#FFF7ED" },
      }),
      menuPortal: (base: any) => ({ ...base, zIndex: 50 }),
    }),
    []
  );

  // Initial fetch (mapping fix on first load)
  useEffect(() => {
    const brandId = typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
    if (!brandId) {
      setError("Missing brandId in localStorage.");
      setLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const [brandRes, countryRes] = await Promise.all([
          get<any>(`/brand?id=${brandId}`),
          get<Country[]>("/country/getall"),
        ]);
        if (cancelled) return;

        const countriesList = Array.isArray(countryRes) ? countryRes : [];
        setCountries(countriesList);

        const normalized = normalizeBrand(brandRes);
        setBrand(normalized);
        setForm(deepClone(normalized));

        // Compute options from the fresh list (no stale memo), with fallbacks
        const localCO = buildCountryOptions(countriesList);
        const localKO = buildCallingOptions(countriesList);

        const matchedCountry =
          localCO.find((o) => o.value === normalized.countryId) ||
          localCO.find((o) => o.country.countryName === normalized.country) ||
          null;

        const matchedCalling =
          localKO.find((o) => o.value === normalized.callingId) ||
          localKO.find((o) => o.country.callingCode === normalized.callingCode) ||
          null;

        setSelectedCountry(matchedCountry);
        setSelectedCalling(matchedCalling);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setError(e?.message || "Failed to load brand profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Secondary guard: align selections when brand / countries arrive at different times
  useEffect(() => {
    if (!brand || !countries.length) return;

    if (!selectedCountry || selectedCountry.value !== brand.countryId) {
      const c =
        maps.countryById.get(brand.countryId) ||
        maps.co.find((o) => o.country.countryName === brand.country) ||
        null;
      setSelectedCountry(c);
    }
    if (!selectedCalling || selectedCalling.value !== brand.callingId) {
      const k =
        maps.callingById.get(brand.callingId) ||
        maps.ko.find((o) => o.country.callingCode === brand.callingCode) ||
        null;
      setSelectedCalling(k);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand, countries]);

  // keep form.country / callingCode in sync with selections
  useEffect(() => {
    if (!selectedCountry) return;
    setForm((prev) =>
      prev ? { ...prev, countryId: selectedCountry.value, country: selectedCountry.country.countryName } : prev
    );
  }, [selectedCountry]);

  useEffect(() => {
    if (!selectedCalling) return;
    setForm((prev) =>
      prev ? { ...prev, callingId: selectedCalling.value, callingCode: selectedCalling.country.callingCode } : prev
    );
  }, [selectedCalling]);

  const onField = useCallback(<K extends keyof BrandData>(key: K, value: BrandData[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const resetEdits = useCallback(() => {
    if (!brand) return;
    const cl = deepClone(brand);
    setForm(cl);
    setIsEditing(false);
    setEmailFlow("idle");
    setSelectedCountry(cl.countryId ? maps.countryById.get(cl.countryId) || null : null);
    setSelectedCalling(cl.callingId ? maps.callingById.get(cl.callingId) || null : null);
  }, [brand, maps.countryById, maps.callingById]);

  const saveProfile = useCallback(async () => {
    if (!form || !brand) return;

    if (emailFlow !== "idle" && emailFlow !== "verified") {
      alert("Please finish verifying the new email before saving other changes.");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        brandId: form.brandId,
        name: form.name,
        phone: form.phone,
        countryId: form.countryId || undefined,
        callingId: form.callingId || undefined,
      };
      const updatedRaw = await post<any>("/brand/update", payload);
      const updated = normalizeBrand(updatedRaw);

      setBrand(updated);
      setForm(deepClone(updated));
      setIsEditing(false);
      setEmailFlow("idle");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }, [brand, emailFlow, form]);

  const daysLeft = useMemo(() => {
    if (!brand?.subscription.expiresAt) return null;
    const end = new Date(brand.subscription.expiresAt).getTime();
    const now = Date.now();
    const diff = Math.max(0, end - now);
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [brand?.subscription.expiresAt]);

  // 2) after ALL hooks, you may early-return
  if (loading) return <Loader />;
  if (error) return <Error message={error} />;

  const saveDisabled =
    saving || (emailFlow !== "idle" && emailFlow !== "verified");

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <Card className="mb-8 bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Brand Profile</h1>
                <p className="text-gray-600">Manage your brand information and settings</p>
              </div>
              {!isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  <HiUser className="w-5 h-5 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Profile Section */}
        <Card className="mb-8 bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-8">
            <div className="flex items-start gap-6 mb-8">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 bg-gradient-to-r from-[#FFA135] to-[#FF7236] rounded-2xl flex items-center justify-center shadow-lg">
                  <HiUser className="w-10 h-10 text-white" />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <Field
                  label="Brand Name"
                  value={form?.name ?? ""}
                  readValue={brand?.name ?? ""}
                  editing={isEditing}
                  onChange={(v) => onField("name", v as any)}
                  large
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {!isEditing ? (
                  <IconField
                    icon={HiMail}
                    label="Email Address"
                    value=""
                    readValue={brand?.email ?? ""}
                    onChange={() => { }}
                    editing={false}
                  />
                ) : (
                  brand && form && (
                    <EmailEditorDualOTP
                      brandId={brand.brandId}
                      originalEmail={brand.email}
                      value={form.email}
                      onChange={(v) => onField("email", v as any)}
                      onVerified={(newEmail, token) => {
                        setBrand((b) => (b ? { ...b, email: newEmail } : b));
                        setForm((f) => (f ? { ...f, email: newEmail } : f));
                        setEmailFlow("verified");
                        if (token) localStorage.setItem("token", token);
                      }}
                      onStateChange={setEmailFlow}
                    />
                  )
                )}

                <PhoneField
                  valueNumber={form?.phone ?? ""}
                  readValueNumber={brand?.phone ?? ""}
                  code={form?.callingCode || brand?.callingCode || ""}
                  editing={isEditing}
                  onNumberChange={(v) => onField("phone", v as any)}
                  codeOptions={codeOptions}
                  selectedCalling={selectedCalling}
                  onCallingChange={(opt) => setSelectedCalling(opt as any)}
                  selectStyles={selectStyles}
                />
              </div>

              {/* Country */}
              <div className="max-w-md">
                <CountryField
                  editing={isEditing}
                  readValue={brand?.country ?? ""}
                  countryOptions={countryOptions}
                  selectedCountry={selectedCountry}
                  onCountryChange={(opt) => setSelectedCountry(opt as CountryOption)}
                  selectStyles={selectStyles}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription & Wallet (view mode) */}
        {!isEditing && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Subscription */}
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <HiCreditCard className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle>Subscription</CardTitle>
                    <CardDescription>Plan & usage</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                {/* Plan name + status */}
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900 capitalize">
                    {brand?.subscription.planName || "No Plan"}
                  </span>
                  {!brand?.subscriptionExpired ? (
                    <Badge className="ml-1 bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Active
                    </Badge>
                  ) : (
                    <Badge className="ml-1 bg-red-100 text-red-700 border border-red-200">
                      Expired
                    </Badge>
                  )}
                </div>

                {/* Dates */}
                <div className="space-y-1 text-sm text-gray-600">
                  {brand?.subscription.startedAt && (
                    <div className="flex items-center gap-2">
                      <HiCalendar className="w-4 h-4" />
                      <span>Started: {mounted ? formatDate(brand.subscription.startedAt) : "—"}</span>
                    </div>
                  )}
                  {brand?.subscription.expiresAt && (
                    <div className="flex items-center gap-2">
                      <HiCalendar className="w-4 h-4" />
                      <span>
                        Expires: {mounted ? formatDate(brand.subscription.expiresAt) : "—"}
                        {mounted && typeof daysLeft === "number" && (
                          <span className="ml-2 text-gray-500">
                            • {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Features usage */}
                <div className="mt-2 space-y-4">
                  {(brand?.subscription.features ?? []).map((f) => {
                    const isManager = f.key === "dedicated_manager_support";
                    const rawLimit = Number.isFinite(f.limit) ? f.limit : 0;
                    const limit = Math.max(0, rawLimit);
                    const used = Math.max(0, f.used ?? 0);
                    const unlimited = limit === 0;
                    const label = isManager ? "Dedicated Manager Support" : titleizeFeatureKey(f.key);

                    if (isManager) {
                      // Special rendering for dedicated manager support
                      const status = unlimited ? "Unlimited" : limit >= 1 ? "Available" : "Not included";
                      const badgeClass = unlimited
                        ? "bg-blue-100 text-blue-700 border border-blue-200"
                        : limit >= 1
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-gray-100 text-gray-700 border border-gray-200";
                      const Icon = unlimited || limit >= 1 ? HiCheck : HiX;

                      return (
                        <div key={f.key} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm">
                            <Icon className={(unlimited || limit >= 1) ? "w-4 h-4 text-emerald-600" : "w-4 h-4 text-gray-400"} />
                            <span className="text-gray-800">{label}</span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-md ${badgeClass}`}>{status}</span>
                        </div>
                      );
                    }

                    // Quota-like features (show bar)
                    const pct = unlimited ? 100 : limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
                    const barColor =
                      unlimited
                        ? "[&>div]:bg-blue-500"
                        : used >= limit
                          ? "[&>div]:bg-red-500"
                          : pct >= 80
                            ? "[&>div]:bg-orange-500"
                            : "[&>div]:bg-emerald-500";

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
                          className={`h-2 rounded-full bg-gray-100 ${barColor}`}
                          aria-label={`${label} usage: ${used} of ${unlimited ? "unlimited" : limit}`}
                        />

                        <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                          <span className="tabular-nums">{unlimited ? "∞" : `${pct}%`}</span>
                          {unlimited ? (
                            <span className="tabular-nums flex items-center gap-1">
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Unlimited</span>
                            </span>
                          ) : (
                            <span className="tabular-nums">{Math.max(0, limit - used)} left</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Wallet */}
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <HiCash className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <CardTitle>Wallet</CardTitle>
                    <CardDescription>Balance & top-up</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-3xl font-bold text-gray-900">
                  {brand ? (mounted ? formatUSD(brand.walletBalance || 0) : "—") : "—"}
                </p>
                <p className="text-sm text-gray-600">Available for use</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Action Buttons */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4 sm:justify-end">
              {isEditing ? (
                <>
                  <Button
                    onClick={resetEdits}
                    disabled={saving}
                    variant="outline"
                    className="inline-flex items-center justify-center px-6 py-3"
                  >
                    <HiX className="w-5 h-5 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={saveProfile}
                    disabled={saveDisabled}
                    className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:transform-none"
                    title={
                      emailFlow !== "idle" && emailFlow !== "verified"
                        ? "Verify the new email to enable saving"
                        : undefined
                    }
                  >
                    <HiCheck className="w-5 h-5 mr-2" />
                    {saving ? "Saving…" : "Save Changes"}
                  </Button>
                </>
              ) : (
                <>
                  <Button className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200" onClick={() => router.push("/brand/subscriptions")}>
                    <HiCreditCard className="w-5 h-5 mr-2" />
                    Upgrade Subscription
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* -------- UI Helpers -------- */

function Loader() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
        <p className="text-gray-600 font-medium">Loading profile…</p>
      </div>
    </div>
  );
}

function Error({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <HiX className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Profile</h2>
        <p className="text-red-600 mb-4">{message}</p>
        <Button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white font-medium rounded-xl hover:shadow-md transition-all duration-200"
        >
          Try Again
        </Button>
      </div>
    </div>
  );
}

const Field = React.memo(function Field({
  label,
  value,
  readValue,
  onChange,
  editing,
  placeholder,
  large,
}: {
  label: string;
  value: string;
  readValue: string;
  onChange: (v: string) => void;
  editing: boolean;
  placeholder?: string;
  large?: boolean;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label className="block text-sm text-gray-700" htmlFor={id}>
        {label}
      </Label>
      {editing ? (
        <Input
          id={id}
          className={`${large ? "text-2xl font-bold" : "text-base"}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <p className={`${large ? "text-2xl font-bold" : "text-lg font-medium"} text-gray-900`}>
          {readValue || "—"}
        </p>
      )}
    </div>
  );
});

const IconField = React.memo(function IconField({
  icon: Icon,
  label,
  prefix,
  value,
  readValue,
  onChange,
  editing,
}: {
  icon: any;
  label: string;
  prefix?: string;
  value: string;
  readValue: string;
  onChange: (v: string) => void;
  editing: boolean;
}) {
  const id = useId();
  return (
    <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center">
          <Icon className="text-indigo-600 w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <Label className="block text-sm text-gray-700 mb-2" htmlFor={id}>
            {label}
          </Label>
          {editing ? (
            <div className="flex items-center gap-2">
              {prefix && (
                <span className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg font-medium">
                  {prefix}
                </span>
              )}
              <Input
                id={id}
                className="flex-1"
                value={value}
                onChange={(e) => onChange(e.target.value)}
              />
            </div>
          ) : (
            <p className="text-lg font-medium text-gray-900">{readValue || "—"}</p>
          )}
        </div>
      </div>
    </div>
  );
});

const PhoneField = React.memo(function PhoneField({
  valueNumber,
  readValueNumber,
  code,
  editing,
  onNumberChange,
  codeOptions,
  selectedCalling,
  onCallingChange,
  selectStyles,
}: {
  valueNumber: string;
  readValueNumber: string;
  code?: string;
  editing: boolean;
  onNumberChange: (v: string) => void;
  codeOptions: any[];
  selectedCalling: any | null;
  onCallingChange: (opt: any | null) => void;
  selectStyles: any;
}) {
  const readText = formatPhoneDisplay(code, readValueNumber);

  const handleNumber = (v: string) => {
    const sanitized = v.replace(/[^\d\s-]/g, "").replace(/^\+/, "").slice(0, 20);
    onNumberChange(sanitized);
  };

  const numberId = useId();

  return (
    <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg flex items-center justify-center">
          <HiPhone className="text-emerald-600 w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <Label className="block text-sm text-gray-700 mb-2" htmlFor={numberId}>
            Phone Number
          </Label>
          {editing ? (
            <div className="grid grid-cols-3 gap-3">
              <Select
                inputId="brandCalling"
                options={codeOptions}
                placeholder="Code"
                value={selectedCalling}
                onChange={(opt) => onCallingChange(opt as any)}
                styles={selectStyles}
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
              />
              <div className="col-span-2">
                <Input
                  id={numberId}
                  value={valueNumber}
                  onChange={(e) => handleNumber(e.target.value)}
                  placeholder="Phone number"
                  inputMode="numeric"
                  maxLength={20}
                />
              </div>
            </div>
          ) : (
            <p className="text-lg font-medium text-gray-900">{readText}</p>
          )}
        </div>
      </div>
    </div>
  );
});

const CountryField = React.memo(function CountryField({
  editing,
  readValue,
  countryOptions,
  selectedCountry,
  onCountryChange,
  selectStyles,
}: {
  editing: boolean;
  readValue: string;
  countryOptions: CountryOption[];
  selectedCountry: CountryOption | null;
  onCountryChange: (opt: CountryOption | null) => void;
  selectStyles: any;
}) {
  return (
    <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center">
          <HiGlobe className="text-purple-600 w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <Label className="block text-sm text-gray-700 mb-2">Country</Label>
          {editing ? (
            <Select
              inputId="brandCountry"
              options={countryOptions}
              placeholder="Select Country"
              value={selectedCountry}
              onChange={(opt) => onCountryChange(opt as CountryOption)}
              filterOption={filterByCountryName as any}
              styles={selectStyles}
              menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
            />
          ) : (
            <p className="text-lg font-medium text-gray-900">{readValue || "—"}</p>
          )}
        </div>
      </div>
    </div>
  );
});
