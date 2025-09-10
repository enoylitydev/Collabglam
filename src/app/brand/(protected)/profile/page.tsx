"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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

/* ===================== Types ===================== */

type SubscriptionFeature = {
  key: string;
  limit: number;
  used: number;
};

type BrandData = {
  name: string;
  email: string;
  phone: string; // local / national number (no +code)
  country: string;
  countryId: string;
  callingId: string;
  callingCode?: string; // "+91" etc
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

function normalizeBrand(data: any): BrandData {
  const s = data?.subscription ?? {};
  const brand = data?.brand ?? data; // support payloads like { message, brand }
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
      features: Array.isArray(s?.features)
        ? s.features
        : Array.isArray(brand?.features)
        ? brand.features
        : [],
    },
    subscriptionExpired: !!brand?.subscriptionExpired,
    walletBalance: Number.isFinite(+brand?.walletBalance)
      ? +brand.walletBalance
      : 0,
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
    value: c._id, // we'll submit the _id (countryId)
    label: `${c.flag} ${c.countryName}`,
    country: c,
  }));

const buildCallingOptions = (countries: Country[]): CountryOption[] => {
  const opts = countries.map((c) => ({
    value: c._id, // we'll submit _id (callingId)
    label: `${c.callingCode}`,
    country: c,
  }));
  // Move US to top if present
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

/* ===================== Dual-OTP Email Editor ===================== */

type EmailFlowState =
  | "idle" // email unchanged
  | "needs" // edited but codes not requested yet
  | "codes_sent" // /brand/emailUpdateOtp completed
  | "verifying" // submitting /brand/EmailUpdate
  | "verified"; // success

function EmailEditorDualOTP({
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
}) {
  const [flow, setFlow] = useState<EmailFlowState>("idle");
  const [oldOtp, setOldOtp] = useState("");
  const [newOtp, setNewOtp] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const needs = useMemo(() => !isEmailEqual(value, originalEmail), [value, originalEmail]);
  const valueIsValid = useMemo(() => validateEmail(value), [value]);

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
      // Ensure UI enters the "needs" state when the email first changes
      setFlow("needs");
      onStateChange("needs");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needs, flow, value, originalEmail]);

  const requestCodes = useCallback(async () => {
    setErr(null);
    setMsg(null);
    if (!valueIsValid) return; // button is hidden/disabled otherwise
    setBusy(true);
    try {
      const resp = await post<{
        message?: string;
        oldEmail?: string;
        newEmail?: string;
        expiresAt?: string;
      }>("/brand/requestEmailUpdate", { brandId, newEmail: value.trim().toLowerCase() });
      setFlow("codes_sent");
      setMsg(
        (resp && (resp.message as string)) ||
          `OTPs sent to ${originalEmail} (current) and ${value} (new).`
      );
      setExpiresAt(resp?.expiresAt || null);
      onStateChange("codes_sent");
    } catch (e: any) {
      setErr(e?.message || "Failed to send codes.");
    } finally {
      setBusy(false);
    }
  }, [brandId, originalEmail, value, valueIsValid, onStateChange]);

  const verifyAndPersist = useCallback(async () => {
    setErr(null);
    if (oldOtp.trim().length !== 6 || newOtp.trim().length !== 6) {
      setErr("Enter both 6‑digit OTPs.");
      return;
    }
    setBusy(true);
    setFlow("verifying");
    onStateChange("verifying");
    try {
      const res = await post<{ email: string; token?: string; message?: string }>(
        "/brand/EmailUpdate",
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
    } catch (e: any) {
      setErr(e?.message || "Verification failed.");
      setFlow("codes_sent");
      onStateChange("codes_sent");
    } finally {
      setBusy(false);
    }
  }, [brandId, value, oldOtp, newOtp, onVerified, onStateChange]);

  // Restrict OTP inputs to digits only
  const handleOtp = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
    setter(digits);
  };

  return (
    <div className="relative bg-white border border-gray-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center">
          <HiMail className="text-indigo-600 w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>

          {/* Always show editable input */}
          <div className="relative">
            <input
              className="w-full px-4 py-3 text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 pr-24"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="name@example.com"
              onKeyDown={(e) => {
                if (e.key === "Enter" && needs && valueIsValid && flow === "needs") {
                  requestCodes();
                }
              }}
            />

            {/* Inline Verify button — only shows when email actually changed */}
            {needs && valueIsValid && (flow === "needs" || flow === "idle") && (
              <button
                onClick={requestCodes}
                disabled={busy}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white text-sm font-medium hover:shadow-md transform hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:transform-none"
                aria-label="Send verification codes"
              >
                {busy ? "Sending…" : "Verify"}
              </button>
            )}
          </div>

          {/* Downstream actions only visible once codes are requested */}
          {needs && (flow === "codes_sent" || flow === "verifying") && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3 mb-4">
                <HiShieldCheck className="text-amber-600 w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 mb-1">
                    Verification Required
                  </p>
                  <p className="text-sm text-amber-700">
                    Enter the 6‑digit codes sent to{" "}
                    <span className="font-semibold">{originalEmail}</span> (current) and{" "}
                    <span className="font-semibold">{value}</span> (new).
                    {expiresAt && (
                      <span className="block mt-1 text-xs text-amber-600">
                        Expires: {new Date(expiresAt).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Current Email OTP
                  </label>
                  <input
                    className="w-full px-3 py-2 text-center text-lg font-mono tracking-widest bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="000000"
                    value={oldOtp}
                    onChange={handleOtp(setOldOtp)}
                    inputMode="numeric"
                    maxLength={6}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    New Email OTP
                  </label>
                  <input
                    className="w-full px-3 py-2 text-center text-lg font-mono tracking-widest bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="000000"
                    value={newOtp}
                    onChange={handleOtp(setNewOtp)}
                    inputMode="numeric"
                    maxLength={6}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={requestCodes}
                  disabled={busy}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-60"
                >
                  Resend Codes
                </button>
                <button
                  onClick={verifyAndPersist}
                  disabled={busy || oldOtp.length !== 6 || newOtp.length !== 6}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#FFA135] to-[#FF7236] rounded-lg hover:shadow-md transform hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:transform-none"
                >
                  {busy ? "Verifying…" : "Verify & Update"}
                </button>
              </div>
            </div>
          )}

          {/* Feedback */}
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

          {/* Offer quick cancel only if changed and no codes yet */}
          {needs && flow === "needs" && (
            <button
              type="button"
              onClick={() => onChange(originalEmail)}
              className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline transition-colors"
            >
              Cancel change
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== Main Page ===================== */

export default function BrandProfilePage() {
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [form, setForm] = useState<BrandData | null>(null);
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

  const selectStyles = useMemo(
    () => ({
      control: (base: any, state: any) => ({
        ...base,
        backgroundColor: "#F9FAFB",
        borderColor: state.isFocused ? "#F97316" : "#E5E7EB",
        boxShadow: state.isFocused ? "0 0 0 2px rgba(249, 115, 22, 0.2)" : "none",
        "&:hover": {
          borderColor: "#F97316",
        },
        borderRadius: "8px",
        padding: "4px",
      }),
      option: (base: any, state: any) => ({
        ...base,
        backgroundColor: state.isSelected
          ? "#FED7AA"
          : state.isFocused
          ? "#FFF7ED"
          : "transparent",
        color: state.isSelected ? "#9A3412" : "#374151",
        "&:hover": {
          backgroundColor: "#FFF7ED",
        },
      }),
    }),
    []
  );

  useEffect(() => {
    const brandId = localStorage.getItem("brandId");
    if (!brandId) {
      setError("Missing brandId in localStorage.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [brandRes, countryRes] = await Promise.all([
          get<any>(`/brand?id=${brandId}`),
          get<Country[]>("/country/getall"),
        ]);
        const countriesList = countryRes || [];
        setCountries(countriesList);

        const normalized = normalizeBrand(brandRes);
        setBrand(normalized);
        setForm(structuredClone(normalized));

        // Pre-select dropdowns based on stored ids
        const countryOpt =
          countriesList.length && normalized.countryId
            ? buildCountryOptions(countriesList).find((o) => o.value === normalized.countryId) || null
            : null;
        const callingOpt =
          countriesList.length && normalized.callingId
            ? buildCallingOptions(countriesList).find((o) => o.value === normalized.callingId) || null
            : null;
        setSelectedCountry(countryOpt);
        setSelectedCalling(callingOpt);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Failed to load brand profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // keep form.country / callingCode in sync with selections (use functional updates to avoid stale data)
  useEffect(() => {
    if (!selectedCountry) return;
    setForm((prev) => (prev ? { ...prev, countryId: selectedCountry.value, country: selectedCountry.country.countryName } : prev));
  }, [selectedCountry]);

  useEffect(() => {
    if (!selectedCalling) return;
    setForm((prev) => (prev ? { ...prev, callingId: selectedCalling.value, callingCode: selectedCalling.country.callingCode } : prev));
  }, [selectedCalling]);

  const onField = useCallback(<K extends keyof BrandData>(key: K, value: BrandData[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const resetEdits = useCallback(() => {
    if (!brand) return;
    const cl = structuredClone(brand);
    setForm(cl);
    setIsEditing(false);
    setEmailFlow("idle");
    // reset selects
    const countryOpt = countries.length
      ? buildCountryOptions(countries).find((o) => o.value === cl.countryId) || null
      : null;
    const callingOpt = countries.length
      ? buildCallingOptions(countries).find((o) => o.value === cl.callingId) || null
      : null;
    setSelectedCountry(countryOpt);
    setSelectedCalling(callingOpt);
  }, [brand, countries]);

  const saveProfile = useCallback(async () => {
    if (!form || !brand) return;

    // If email flow is mid-way, block save (email must be verified first)
    if (emailFlow !== "idle" && emailFlow !== "verified") {
      alert("Please finish verifying the new email before saving other changes.");
      return;
    }

    setSaving(true);
    try {
      // Only send fields that can be updated here
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
      setForm(structuredClone(updated));
      setIsEditing(false);
      setEmailFlow("idle");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }, [brand, emailFlow, form]);

  if (loading) return <Loader />;
  if (error) return <Error message={error} />;

  const saveDisabled = saving || (emailFlow !== "idle" && emailFlow !== "verified");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Brand Profile</h1>
              <p className="text-gray-600">Manage your brand information and settings</p>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
              >
                <HiUser className="w-5 h-5 mr-2" />
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Profile Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
          <div className="flex items-start gap-6 mb-8">
            <div className="flex-shrink-0">
              <div className="w-20 h-20 bg-gradient-to-r from-[#FFA135] to-[#FF7236] rounded-2xl flex items-center justify-center shadow-lg">
                <HiUser className="w-10 h-10 text-white" />
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              {/* Name */}
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
              {/* Email */}
              {!isEditing ? (
                <IconField
                  icon={HiMail}
                  label="Email Address"
                  value=""
                  readValue={brand?.email ?? ""}
                  onChange={() => {}}
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
                      // reflect instantly in both brand + form state
                      setBrand((b) => (b ? { ...b, email: newEmail } : b));
                      setForm((f) => (f ? { ...f, email: newEmail } : f));
                      setEmailFlow("verified");
                      if (token) {
                        localStorage.setItem("token", token);
                      }
                    }}
                    onStateChange={setEmailFlow}
                  />
                )
              )}

              {/* Phone */}
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
        </div>

        {/* Subscription & Wallet */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Subscription Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl flex items-center justify-center">
                <HiCreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Subscription</h3>
                <p className="text-2xl font-bold text-gray-900 mb-2">
                  {brand?.subscription.planName || "No Plan"}
                </p>
                <div className="space-y-1 text-sm text-gray-600">
                  {brand?.subscription.startedAt && (
                    <div className="flex items-center gap-2">
                      <HiCalendar className="w-4 h-4" />
                      <span>Started: {new Date(brand.subscription.startedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                  {brand?.subscription.expiresAt && (
                    <div className="flex items-center gap-2">
                      <HiCalendar className="w-4 h-4" />
                      <span>
                        Expires: {new Date(brand.subscription.expiresAt).toLocaleDateString()}
                        {brand?.subscriptionExpired && (
                          <span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                            Expired
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Wallet Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl flex items-center justify-center">
                <HiCash className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Wallet Balance</h3>
                <p className="text-3xl font-bold text-gray-900">
                  {brand ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(brand.walletBalance || 0) : "—"}
                </p>
                <p className="text-sm text-gray-600 mt-1">Available for use</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:justify-end">
            {isEditing ? (
              <>
                <button
                  onClick={resetEdits}
                  disabled={saving}
                  className="inline-flex items-center justify-center px-6 py-3 text-gray-700 bg-gray-100 border border-gray-300 rounded-xl hover:bg-gray-200 transition-all duration-200 disabled:opacity-60"
                >
                  <HiX className="w-5 h-5 mr-2" />
                  Cancel
                </button>
                <button
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
                </button>
              </>
            ) : (
              <>
                <button className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                  <HiCreditCard className="w-5 h-5 mr-2" />
                  Upgrade Subscription
                </button>
                <button className="inline-flex items-center justify-center px-6 py-3 text-gray-700 bg-gray-100 border border-gray-300 rounded-xl hover:bg-gray-200 transition-all duration-200">
                  Cancel Subscription
                </button>
              </>
            )}
          </div>
        </div>
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
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white font-medium rounded-xl hover:shadow-md transition-all duration-200"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

function Field({
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
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {editing ? (
        <input
          className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200 ${
            large ? "text-2xl font-bold" : "text-base"
          }`}
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
}

function IconField({
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
  return (
    <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center">
          <Icon className="text-indigo-600 w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
          {editing ? (
            <div className="flex items-center gap-2">
              {prefix && (
                <span className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg font-medium">
                  {prefix}
                </span>
              )}
              <input
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
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
}

function PhoneField({
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
  return (
    <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg flex items-center justify-center">
          <HiPhone className="text-emerald-600 w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
          {editing ? (
            <div className="grid grid-cols-3 gap-3">
              <Select
                inputId="brandCalling"
                options={codeOptions}
                placeholder="Code"
                value={selectedCalling}
                onChange={(opt) => onCallingChange(opt as any)}
                styles={selectStyles}
              />
              <div className="col-span-2">
                <input
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                  value={valueNumber}
                  onChange={(e) => onNumberChange(e.target.value)}
                  placeholder="Phone number"
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
}

function CountryField({
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
          {editing ? (
            <Select
              inputId="brandCountry"
              options={countryOptions}
              placeholder="Select Country"
              value={selectedCountry}
              onChange={(opt) => onCountryChange(opt as CountryOption)}
              filterOption={filterByCountryName as any}
              styles={selectStyles}
            />
          ) : (
            <p className="text-lg font-medium text-gray-900">{readValue || "—"}</p>
          )}
        </div>
      </div>
    </div>
  );
}