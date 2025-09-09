"use client";

import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { get, post } from "@/lib/api";
import {
  HiUser,
  HiPhone,
  HiGlobe,
  HiMail,
  HiCheck,
  HiX,
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

  const needs = useMemo(
    () => value.trim().toLowerCase() !== originalEmail.trim().toLowerCase(),
    [value, originalEmail]
  );

  useEffect(() => {
    if (!needs) {
      setFlow("idle");
      setOldOtp("");
      setNewOtp("");
      setErr(null);
      setMsg(null);
      onStateChange("idle");
    } else if (flow === "codes_sent" || flow === "verifying") {
      onStateChange(flow);
    } else {
      onStateChange("needs");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needs, flow, value, originalEmail]);

  async function requestCodes() {
    setErr(null);
    setMsg(null);
    if (!validateEmail(value)) {
      setErr("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const resp = await post<{
        message?: string;
        oldEmail?: string;
        newEmail?: string;
        expiresAt?: string;
      }>("/brand/emailUpdateOtp", { brandId, newEmail: value });
      setFlow("codes_sent");
      setMsg(
        (resp && (resp.message as string)) ||
          `OTPs sent to ${originalEmail} (current) and ${value} (new).`
      );
      onStateChange("codes_sent");
    } catch (e: any) {
      setErr(e?.message || "Failed to send codes.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndPersist() {
    setErr(null);
    if (!oldOtp.trim() || !newOtp.trim()) {
      setErr("Enter both OTPs.");
      return;
    }
    setBusy(true);
    setFlow("verifying");
    onStateChange("verifying");
    try {
      const res = await post<{ email: string; token?: string; message?: string }>(
        "/brand/EmailUpdate",
        { brandId, newEmail: value, oldOtp: oldOtp.trim(), newOtp: newOtp.trim() }
      );
      const newEmail = (res as any)?.email || value;
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
  }

  return (
    <div className="flex items-start bg-gray-50 p-4 rounded-lg">
      <HiMail className="text-gray-500 mr-3 mt-1" />
      <div className="flex-1">
        <p className="text-sm text-gray-500">Email</p>

        {/* Always show editable input */}
        <div className="relative">
          <input
            className="w-full text-gray-700 font-medium focus:outline-none bg-transparent pb-1"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="name@example.com"
          />
          <span className="pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-[#FFA135] to-[#FF7236]" />
        </div>

        {/* Actions for edited emails */}
        {needs && (
          <div className="mt-3 space-y-3">
            {flow === "needs" && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  To change your email, request OTP codes.
                </p>
                <button
                  onClick={requestCodes}
                  disabled={busy || !validateEmail(value)}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:opacity-90 transition disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Verify"}
                </button>
              </div>
            )}

            {(flow === "codes_sent" || flow === "verifying") && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Enter the 6‑digit codes sent to <span className="font-semibold">{originalEmail}</span> (old) and <span className="font-semibold">{value}</span> (new).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <input
                      className="w-full text-gray-700 font-medium focus:outline-none bg-transparent pb-1 tracking-widest"
                      placeholder="Old email OTP"
                      value={oldOtp}
                      onChange={(e) => setOldOtp(e.target.value)}
                      inputMode="numeric"
                      maxLength={6}
                    />
                    <span className="pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-[#FFA135] to-[#FF7236]" />
                  </div>
                  <div className="relative">
                    <input
                      className="w-full text-gray-700 font-medium focus:outline-none bg-transparent pb-1 tracking-widest"
                      placeholder="New email OTP"
                      value={newOtp}
                      onChange={(e) => setNewOtp(e.target.value)}
                      inputMode="numeric"
                      maxLength={6}
                    />
                    <span className="pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-[#FFA135] to-[#FF7236]" />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={requestCodes}
                    disabled={busy}
                    className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition"
                  >
                    Resend Codes
                  </button>
                  <button
                    onClick={verifyAndPersist}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:opacity-90 transition disabled:opacity-60"
                  >
                    {busy ? "Verifying…" : "Verify & Update"}
                  </button>
                </div>
              </div>
            )}

            {(msg || err) && (
              <div className="mt-1">
                {msg && <p className="text-sm text-green-600">{msg}</p>}
                {err && <p className="text-sm text-red-600">{err}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== Main Page ===================== */

export default function BrandProfilePage() {
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [form, setForm] = useState<BrandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Email flow state controls Save button
  const [emailFlow, setEmailFlow] = useState<EmailFlowState>("idle");

  // Countries / calling codes
  const [countries, setCountries] = useState<Country[]>([]);
  const countryOptions = useMemo(() => buildCountryOptions(countries), [countries]);
  const codeOptions = useMemo(() => buildCallingOptions(countries), [countries]);
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null);
  const [selectedCalling, setSelectedCalling] = useState<CountryOption | null>(null);

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
        setCountries(countryRes || []);
        const normalized = normalizeBrand(brandRes);
        setBrand(normalized);
        setForm(structuredClone(normalized));

        // Pre-select dropdowns based on stored ids
        const co = countryRes || [];
        const countryOpt =
          co.length && normalized.countryId
            ? buildCountryOptions(co).find((o) => o.value === normalized.countryId) || null
            : null;
        const callingOpt =
          co.length && normalized.callingId
            ? buildCallingOptions(co).find((o) => o.value === normalized.callingId) || null
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

  // keep form.country / callingCode in sync with selections (for read-mode display)
  useEffect(() => {
    if (!form) return;
    if (selectedCountry) {
      setForm({
        ...form,
        countryId: selectedCountry.value,
        country: selectedCountry.country.countryName,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry]);

  useEffect(() => {
    if (!form) return;
    if (selectedCalling) {
      setForm({
        ...form,
        callingId: selectedCalling.value,
        callingCode: selectedCalling.country.callingCode,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCalling]);

  const onField = <K extends keyof BrandData>(key: K, value: BrandData[K]) => {
    if (!form) return;
    setForm({ ...form, [key]: value });
  };

  const resetEdits = () => {
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
  };

  const saveProfile = async () => {
    if (!form || !brand) return;

    // If email flow is mid-way, block save (email must be verified first)
    if (emailFlow !== "idle" && emailFlow !== "verified") {
      alert("Please finish verifying the new email before saving other changes.");
      return;
    }

    setSaving(true);
    try {
      // 1) Update profile fields (name/phone/countryId/callingId)
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
  };

  if (loading) return <Loader />;
  if (error) return <Error message={error} />;

  return (
    <section className="min-h-screen py-12">
      <div className="max-w-5xl mx-auto bg-white p-8 rounded-xl shadow-md">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-800">Brand Profile</h2>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white px-4 py-2 rounded-lg shadow hover:opacity-90 transition cursor-pointer"
            >
              <HiUser className="mr-2" /> Edit Profile
            </button>
          ) : null}
        </div>

        {/* Top Row */}
        <div className="flex items-start gap-4 mb-8">
          <div className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white rounded-full p-3">
            <HiUser size={32} />
          </div>

          <div className="flex-1 space-y-4">
            {/* Name */}
            <Field
              label="Name"
              value={form?.name ?? ""}
              readValue={brand?.name ?? ""}
              editing={isEditing}
              onChange={(v) => onField("name", v as any)}
              large
            />

            {/* Contact grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email */}
              {!isEditing ? (
                <IconField
                  icon={HiMail}
                  label="Email"
                  value={""}
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

              {/* Phone (calling code + number) */}
              <PhoneField
                valueNumber={form?.phone ?? ""}
                readValueNumber={brand?.phone ?? ""}
                code={form?.callingCode || brand?.callingCode || ""}
                editing={isEditing}
                onNumberChange={(v) => onField("phone", v as any)}
                codeOptions={codeOptions}
                selectedCalling={selectedCalling}
                onCallingChange={(opt) => setSelectedCalling(opt as any)}
              />

              {/* Country dropdown */}
              <div className="flex items-center bg-gray-50 p-4 rounded-lg">
                <HiGlobe className="text-gray-500 mr-3" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Country</p>
                  {!isEditing ? (
                    <p className="text-gray-700 font-medium">{brand?.country || "—"}</p>
                  ) : (
                    <Select
                      inputId="brandCountry"
                      options={countryOptions}
                      placeholder="Select Country"
                      value={selectedCountry}
                      onChange={(opt) => setSelectedCountry(opt as CountryOption)}
                      filterOption={filterByCountryName as any}
                      styles={{
                        control: (base: any) => ({
                          ...base,
                          backgroundColor: "#F9FAFB",
                          borderColor: "#E5E7EB",
                        }),
                      }}
                      className="mt-1"
                      required
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-end space-x-3">
          {isEditing ? (
            <>
              <button
                onClick={resetEdits}
                className="flex items-center px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                disabled={saving}
              >
                <HiX className="mr-1" /> Cancel
              </button>
              <button
                onClick={saveProfile}
                className="flex items-center px-4 py-2 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white rounded-lg shadow hover:opacity-90 transition disabled:opacity-60"
                disabled={saving || (emailFlow !== "idle" && emailFlow !== "verified")}
                title={
                  emailFlow !== "idle" && emailFlow !== "verified"
                    ? "Verify the new email to enable saving"
                    : undefined
                }
              >
                <HiCheck className="mr-1" /> {saving ? "Saving…" : "Save Changes"}
              </button>
            </>
          ) : (
            <>
              <button className="px-4 py-2 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white rounded-lg hover:opacity-90 transition cursor-pointer">
                Upgrade Subscription
              </button>
              <button className="px-4 py-2 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white rounded-lg hover:opacity-90 transition cursor-pointer">
                Cancel Subscription
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* -------- UI Helpers -------- */

function Loader() {
  return (
    <div className="flex items-center justify-center h-full py-20">
      <span className="text-gray-500">Loading profile…</span>
    </div>
  );
}

function Error({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full py-20">
      <span className="text-red-500">{message}</span>
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
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      {editing ? (
        <div className={`relative ${large ? "pt-1" : ""}`}>
          <input
            className={`w-full text-gray-700 font-medium focus:outline-none bg-transparent pb-1 ${
              large ? "text-2xl font-bold" : ""
            }`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
          <span className="pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-[#FFA135] to-[#FF7236]" />
        </div>
      ) : (
        <p className={`${large ? "text-2xl font-bold" : "font-medium"} text-gray-800`}>
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
    <div className="flex items-center bg-gray-50 p-4 rounded-lg">
      <Icon className="text-gray-500 mr-3" />
      <div className="flex-1">
        <p className="text-sm text-gray-500">{label}</p>
        {editing ? (
          <div className="flex items-center gap-2">
            {prefix ? (
              <span className="px-2 py-1 rounded bg-gray-200 text-gray-700 text-sm select-none">
                {prefix}
              </span>
            ) : null}
            <div className="relative w-full">
              <input
                className="w-full text-gray-700 font-medium focus:outline-none bg-transparent pb-1"
                value={value}
                onChange={(e) => onChange(e.target.value)}
              />
              <span className="pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-[#FFA135] to-[#FF7236]" />
            </div>
          </div>
        ) : (
          <p className="text-gray-700 font-medium">{readValue || "—"}</p>
        )}
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
}: {
  valueNumber: string;
  readValueNumber: string;
  code?: string;
  editing: boolean;
  onNumberChange: (v: string) => void;
  codeOptions: any[];
  selectedCalling: any | null;
  onCallingChange: (opt: any | null) => void;
}) {
  const readText = formatPhoneDisplay(code, readValueNumber);
  return (
    <div className="flex items-center bg-gray-50 p-4 rounded-lg">
      <HiPhone className="text-gray-500 mr-3" />
      <div className="flex-1">
        <p className="text-sm text-gray-500">Phone</p>
        {editing ? (
          <div className="grid grid-cols-3 gap-2 items-center">
            <Select
              inputId="brandCalling"
              options={codeOptions}
              placeholder="+Code"
              value={selectedCalling}
              onChange={(opt) => onCallingChange(opt as any)}
              styles={{
                control: (base: any) => ({
                  ...base,
                  backgroundColor: "#F9FAFB",
                  borderColor: "#E5E7EB",
                }),
              }}
            />
            <div className="col-span-2 relative w-full">
              <input
                className="w-full text-gray-700 font-medium focus:outline-none bg-transparent pb-1"
                value={valueNumber}
                onChange={(e) => onNumberChange(e.target.value)}
                placeholder="Phone number"
              />
              <span className="pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-[#FFA135] to-[#FF7236]" />
            </div>
          </div>
        ) : (
          <p className="text-gray-700 font-medium">{readText}</p>
        )}
      </div>
    </div>
  );
}