"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Select from "react-select";
import { get, post } from "@/lib/api"; // used for JSON + FormData endpoints
import {
  HiUser,
  HiUserGroup,
  HiPhone,
  HiGlobe,
  HiMail,
  HiCheck,
  HiX,
  HiCreditCard,
  HiCalendar,
  HiShieldCheck,
  HiLink,
  HiHashtag,
  HiPencil,
  HiPhotograph,
} from "react-icons/hi";

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
interface Country { _id: string; countryName: string; callingCode: string; countryCode: string; flag: string; }
interface CountryOption { value: string; label: string; country: Country; }

interface Platform { _id: string; platformId?: string; name: string; }
interface PlatformOption { value: string; label: string; raw: Platform; }

interface Interest { _id: string; name: string; }
interface InterestOption { value: string; label: string; raw: Interest; }

interface AudienceAgeRange { _id: string; audienceId: string; range: string; } // API uses audienceId to look up
interface AudienceAgeOption { value: string; label: string; raw: AudienceAgeRange; }

interface AudienceRange { _id: string; range: string; }
interface AudienceRangeOption { value: string; label: string; raw: AudienceRange; }

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
  if (s === "2" || s === "other" || s === "non-binary" || s === "nonbinary" || s === "nb") return 2;

  const n = Number(s);
  return n === 0 || n === 1 || n === 2 ? (n as 0 | 1 | 2) : undefined;
}

function validateEmail(email: string) { return /[^@\s]+@[^@\s]+\.[^@\s]+/.test(email); }

/* Build options */
const buildCountryOptions = (countries: Country[]): CountryOption[] => countries.map((c) => ({ value: c._id, label: `${c.flag} ${c.countryName}`, country: c }));
const buildCallingOptions = (countries: Country[]): CountryOption[] => {
  const opts = countries.map((c) => ({ value: c._id, label: `${c.callingCode}`, country: c }));
  const usIdx = opts.findIndex((o) => o.country.countryCode === "US");
  if (usIdx > -1) { const [us] = opts.splice(usIdx, 1); opts.unshift(us); }
  return opts;
};

const buildPlatformOptions = (rows: Platform[]): PlatformOption[] => rows.map((p) => ({ value: p.platformId || p._id, label: p.name, raw: p }));
const buildInterestOptions = (rows: Interest[]): InterestOption[] => rows.map((r) => ({ value: r._id, label: r.name, raw: r }));
const buildAgeOptions = (rows: AudienceAgeRange[]): AudienceAgeOption[] => rows.map((r) => ({ value: r.audienceId, label: r.range, raw: r }));
const buildCountOptions = (rows: AudienceRange[]): AudienceRangeOption[] => rows.map((r) => ({ value: r._id, label: r.range, raw: r }));

const filterByCountryName = (option: { data: CountryOption }, raw: string) => {
  const input = raw.toLowerCase().trim();
  const { country } = option.data;
  return (
    country.countryName.toLowerCase().includes(input) ||
    country.countryCode.toLowerCase().includes(input) ||
    country.callingCode.replace(/^\+/, "").includes(input.replace(/^\+/, ""))
  );
};

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
      // IMPORTANT: backend expects role: "Influencer"
      const resp = await post<{ message?: string }>(
        "/requestEmailUpdate",
        { influencerId, newEmail: value.trim().toLowerCase(), role: "Influencer" }
      );
      setFlow("codes_sent");
      setMsg(resp?.message || `OTPs sent to ${originalEmail} (current) and ${value} (new).`);
      onStateChange("codes_sent");
    } catch (e: any) {
      setErr(e?.message || "Failed to send codes.");
    } finally { setBusy(false); }
  }, [influencerId, originalEmail, value, valueIsValid, onStateChange]);

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
      await post<{ message?: string }>(
        "/verifyEmailUpdateOtp",
        {
          influencerId,
          role: "Influencer",
          oldEmailOtp: oldOtp.trim(),
          newEmailOtp: newOtp.trim(),
          newEmail: value.trim().toLowerCase(),
        }
      );
      onVerified(value.trim().toLowerCase());
      setMsg("Email updated successfully.");
      setFlow("verified");
      onStateChange("verified");
      setOldOtp("");
      setNewOtp("");
    } catch (e: any) {
      setErr(e?.message || "Verification failed.");
      setFlow("codes_sent");
      onStateChange("codes_sent");
    } finally { setBusy(false); }
  }, [influencerId, value, oldOtp, newOtp, onVerified, onStateChange]);

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
          <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>

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
            {needs && valueIsValid && (flow === "needs" || flow === "idle") && (
              <button
                onClick={requestCodes}
                disabled={busy}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white text-sm font-medium hover:shadow-md transform hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:transform-none"
              >
                {busy ? "Sending…" : "Verify"}
              </button>
            )}
          </div>

          {needs && (flow === "codes_sent" || flow === "verifying") && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3 mb-4">
                <HiShieldCheck className="text-amber-600 w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800 mb-1">Verification Required</p>
                  <p className="text-sm text-amber-700">
                    Enter the 6-digit codes sent to <span className="font-semibold">{originalEmail}</span> (current) and <span className="font-semibold">{value}</span> (new).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Current Email OTP</label>
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
                  <label className="block text-xs font-medium text-gray-600 mb-2">New Email OTP</label>
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

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
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
            <button type="button" onClick={() => onChange(originalEmail)} className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline transition-colors">
              Cancel change
            </button>
          )}
        </div>
      </div>
    </div>
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
      }),
      option: (base: any, state: any) => ({
        ...base,
        backgroundColor: state.isSelected ? "#FED7AA" : state.isFocused ? "#FFF7ED" : "transparent",
        color: state.isSelected ? "#9A3412" : "#374151",
        "&:hover": { backgroundColor: "#FFF7ED" },
      }),
      multiValue: (base: any) => ({ ...base, backgroundColor: "#FFE8CC" }),
      multiValueLabel: (base: any) => ({ ...base, color: "#7C2D12" }),
      multiValueRemove: (base: any) => ({ ...base, color: "#7C2D12", ":hover": { backgroundColor: "#F59E0B", color: "white" } }),
    }),
    []
  );

  useEffect(() => {
    const influencerId = localStorage.getItem("influencerId");
    if (!influencerId) {
      setError("Missing influencerId in localStorage.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [infRes, countryRes, platRes, interestRes, ageRes, rangeRes] = await Promise.all([
          get<any>(`/influencer/getbyid?id=${influencerId}`),
          get<Country[]>("/country/getall"),
          get<Platform[]>("/platform/getall"),
          get<Interest[]>("/interest/getList"),
          get<AudienceAgeRange[]>("/audienceRange/getAll"), // returns items with audienceId + range (age)
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
          if (normalized.countryId) return countryOpts.find((o) => o.value === normalized.countryId) || null;
          if (normalized.country) return countryOpts.find((o) => o.country.countryName.toLowerCase() === normalized.country.toLowerCase()) || null;
          return null;
        });
        setSelectedCalling(() => {
          if (normalized.callingId) return callingOpts.find((o) => o.value === normalized.callingId) || null;
          if (normalized.callingCode) return callingOpts.find((o) => o.country.callingCode === normalized.callingCode) || null;
          return null;
        });

        setSelectedPlatform(() => {
          if (!normalized.platformName && !normalized.platformId) return null;
          // match by platformId (preferred) or by name fallback
          return (
            platformOpts.find((o) => o.value === normalized.platformId) ||
            platformOpts.find((o) => o.label.toLowerCase() === (normalized.platformName || "").toLowerCase()) ||
            null
          );
        });

        setSelectedCategories(() => {
          // 1) Try by IDs from backend
          const haveIds = Array.isArray(normalized.categories) && normalized.categories.length > 0;
          let picked = [] as InterestOption[];

          if (haveIds) {
            const idSet = new Set(normalized.categories);
            picked = interestOpts.filter((o) => idSet.has(o.value));
          }

          // 2) Fallback: match by names when only categoryName is present
          if (!picked.length && Array.isArray(normalized.categoryName) && normalized.categoryName.length) {
            const nameSet = new Set(normalized.categoryName.map((n: string) => n.trim().toLowerCase()));
            picked = interestOpts.filter((o) => nameSet.has(o.label.trim().toLowerCase()));
          }

          // 3) Ensure the form carries IDs (so save works)
          if (picked.length) {
            setForm((prev) => (prev ? { ...prev, categories: picked.map((p) => p.value) } : prev));
          }

          return picked.slice(0, 3);
        });

        setSelectedAge(() => {
          const byId = ageOpts.find((o) => o.value === normalized.audienceAgeRangeId) || null;
          const byLabel = !byId && normalized.audienceAgeRange
            ? ageOpts.find((o) => o.label.toLowerCase() === normalized.audienceAgeRange!.toLowerCase()) || null
            : null;

          const sel = byId || byLabel || null;
          if (sel) setForm((prev) => (prev ? { ...prev, audienceAgeRangeId: sel.value } : prev));
          return sel;
        });

        setSelectedRange(() => {
          const byId = rangeOpts.find((o) => o.value === normalized.audienceId) || null;
          const byLabel =
            !byId && normalized.audienceRange
              ? rangeOpts.find((o) => o.label.toLowerCase() === normalized.audienceRange!.toLowerCase()) || null
              : null;
          const sel = byId || byLabel || null;
          if (sel) setForm((prev) => (prev ? { ...prev, audienceId: sel.value } : prev));
          return sel;
        });

      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Failed to load influencer profile.");
      } finally { setLoading(false); }
    })();
  }, []);

  // keep form.country / callingCode in sync with selections
  useEffect(() => {
    if (!selectedCountry) return;
    setForm((prev) => prev ? { ...prev, countryId: selectedCountry.value, country: selectedCountry.country.countryName } : prev);
  }, [selectedCountry]);

  useEffect(() => {
    if (!selectedCalling) return;
    setForm((prev) => prev ? { ...prev, callingId: selectedCalling.value, callingCode: selectedCalling.country.callingCode } : prev);
  }, [selectedCalling]);

  useEffect(() => {
    if (!selectedPlatform) {
      setForm((prev) => prev ? { ...prev, platformId: "", platformName: "", manualPlatformName: "" } : prev);
      return;
    }
    setForm((prev) => prev ? { ...prev, platformId: selectedPlatform.value, platformName: selectedPlatform.label } : prev);
  }, [selectedPlatform]);

  useEffect(() => {
    setForm((prev) => prev ? { ...prev, categories: selectedCategories.map((c) => c.value) } : prev);
  }, [selectedCategories]);

  useEffect(() => {
    setForm((prev) => prev ? { ...prev, audienceAgeRangeId: selectedAge?.value || "" } : prev);
  }, [selectedAge]);

  useEffect(() => {
    setForm((prev) => prev ? { ...prev, audienceId: selectedRange?.value || "" } : prev);
  }, [selectedRange]);

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

    const countryOpt = countries.length ? buildCountryOptions(countries).find((o) => o.value === cl.countryId) || buildCountryOptions(countries).find((o) => o.country.countryName.toLowerCase() === (cl.country || "").toLowerCase()) || null : null;
    const callingOpt = countries.length ? buildCallingOptions(countries).find((o) => o.value === cl.callingId) || buildCallingOptions(countries).find((o) => o.country.callingCode === cl.callingCode) || null : null;
    setSelectedCountry(countryOpt);
    setSelectedCalling(callingOpt);

    setSelectedPlatform(() => {
      return platforms.find((p) => p.value === cl.platformId) || platforms.find((p) => p.label.toLowerCase() === (cl.platformName || "").toLowerCase()) || null;
    });
    setSelectedCategories(() => {
      const ids = new Set(cl.categories || []);
      return interests.filter((i) => ids.has(i.value));
    });
    setSelectedAge(() => ages.find((a) => a.value === cl.audienceAgeRangeId) || null);
    setSelectedRange(() => ranges.find((r) => r.value === cl.audienceId) || null);
  }, [influencer, countries, platforms, interests, ages, ranges]);

  const saveProfile = useCallback(async () => {
    if (!form || !influencer) return;

    // Block save if email change mid-flow
    if (emailFlow !== "idle" && emailFlow !== "verified") {
      alert("Please finish verifying the new email before saving other changes.");
      return;
    }

    // Enforce gender requirement when otpVerified === true
    const hasValidGender = form.gender === 0 || form.gender === 1 || form.gender === 2;
    if (form.otpVerified && !hasValidGender) {
      alert("Please select your gender to continue.");
      return;
    }

    // Categories validation (1–3)
    if ((form.categories?.length || 0) < 1 || (form.categories?.length || 0) > 3) {
      alert("Please select between 1 and 3 categories.");
      return;
    }

    setSaving(true);
    try {
      const influencerId = localStorage.getItem("influencerId");
      if (!influencerId) throw { message: "Missing influencerId in localStorage." };

      // Build multipart form for optional profile image
      const fd = new FormData();
      fd.append("influencerId", influencerId);

      // Simple fields (conditionally include password)
      fd.append("name", form.name || "");
      if (form.password) fd.append("password", form.password);
      fd.append("phone", form.phone || "");
      fd.append("socialMedia", form.socialMedia || "");
      if (typeof form.gender !== "undefined") fd.append("gender", String(form.gender));
      fd.append("profileLink", form.profileLink || "");
      fd.append("bio", form.bio || "");

      // Platform (supports "Other" via manualPlatformName)
      if (form.platformId) fd.append("platformId", form.platformId);
      if (form.manualPlatformName) fd.append("manualPlatformName", form.manualPlatformName);

      // Audience bifurcation
      const male = form.audienceBifurcation?.malePercentage;
      const female = form.audienceBifurcation?.femalePercentage;
      if (typeof male !== "undefined") fd.append("malePercentage", String(male));
      if (typeof female !== "undefined") fd.append("femalePercentage", String(female));

      // Categories (backend expects JSON array or array-like string)
      fd.append("categories", JSON.stringify(form.categories || []));

      // Audience ranges
      if (form.audienceAgeRangeId) fd.append("audienceAgeRangeId", form.audienceAgeRangeId);
      if (form.audienceId) fd.append("audienceId", form.audienceId);

      // Country / Calling code
      if (form.countryId) fd.append("countryId", form.countryId);
      if (form.callingId) fd.append("callingId", form.callingId);

      if (profileImageFile) fd.append("profileImage", profileImageFile);

      // ✅ use our axios post helper directly with FormData
      await post<{ message?: string }>("/influencer/updateProfile", fd);

      // Refresh profile
      const updatedRaw = await get<any>(`/influencer/getbyid?id=${influencerId}`);
      const updated = normalizeInfluencer(updatedRaw);

      setInfluencer(updated);
      setForm(structuredClone(updated));
      setIsEditing(false);
      setEmailFlow("idle");
      setProfileImageFile(null);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to save profile.");
    } finally { setSaving(false); }
  }, [influencer, emailFlow, form, profileImageFile]);

  if (loading) return <Loader />;
  if (error) return <Error message={error} />;

  const saveDisabled = saving || (emailFlow !== "idle" && emailFlow !== "verified");
  const showManualPlatform = selectedPlatform?.label?.toLowerCase() === "other";

  return (
    <section className="min-h-screen py-8 sm:py-12">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center relative flex-shrink-0">
                {form?.profileImage || influencer?.profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form?.profileImage || influencer?.profileImage || ""} alt={influencer?.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-r from-[#FFA135] to-[#FF7236] flex items-center justify-center">
                    <HiUser className="w-10 h-10 text-white" />
                  </div>
                )}
                {isEditing && (
                  <label className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 cursor-pointer">
                    <HiPhotograph /> Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setProfileImageFile(f);
                        if (f) {
                          const reader = new FileReader();
                          reader.onload = () => setForm((prev) => prev ? { ...prev, profileImage: String(reader.result) } : prev);
                          reader.readAsDataURL(f);
                        }
                      }}
                    />
                  </label>
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{influencer?.name || "—"}</h1>
                <p className="text-gray-600 truncate">
                  {influencer?.platformName ? `${influencer.platformName}` : "—"}
                  {influencer?.profileLink && (
                    <>
                      {" • "}
                      <a href={influencer.profileLink} className="text-[#FFBF00] underline" target="_blank" rel="noreferrer">Profile Link</a>
                    </>
                  )}
                </p>
                {influencer?.socialMedia && (
                  <p className="text-gray-600 truncate">Handle: <span className="font-medium">{influencer.socialMedia}</span></p>
                )}
              </div>
            </div>

            {!isEditing && (
              <button onClick={() => setIsEditing(true)} className="inline-flex items-center justify-center px-5 sm:px-6 py-3 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 cursor-pointer w-full sm:w-auto">
                <HiPencil className="w-5 h-5 mr-2" />
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Profile & Contact */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6 sm:mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Name */}
            <IconField icon={HiUser} label="Full Name" value={form?.name || ""} readValue={influencer?.name || ""} onChange={(v) => onField("name", v as any)} editing={isEditing} />

            {/* Social Handle */}
            <IconField icon={HiHashtag} label="Social Handle" value={form?.socialMedia || ""} readValue={influencer?.socialMedia || ""} onChange={(v) => onField("socialMedia", v as any)} editing={isEditing} />

            {/* Profile Link */}
            <IconField icon={HiLink} label="Profile Link" value={form?.profileLink || ""} readValue={influencer?.profileLink || ""} onChange={(v) => onField("profileLink", v as any)} editing={isEditing} />

            {/* Email (dual OTP when editing) */}
            {!isEditing ? (
              <IconField icon={HiMail} label="Email Address" value="" readValue={influencer?.email ?? ""} onChange={() => { }} editing={false} />
            ) : (
              influencer && form && (
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
            <PhoneField
              valueNumber={form?.phone ?? ""}
              readValueNumber={influencer?.phone ?? ""}
              code={form?.callingCode || influencer?.callingCode || ""}
              editing={isEditing}
              onNumberChange={(v) => onField("phone", v as any)}
              codeOptions={codeOptions}
              selectedCalling={selectedCalling}
              onCallingChange={(opt) => setSelectedCalling(opt as any)}
              selectStyles={selectStyles}
            />

            {/* Country */}
            <CountryField
              editing={isEditing}
              readValue={influencer?.country || influencer?.county || ""}
              countryOptions={countryOptions}
              selectedCountry={selectedCountry}
              onCountryChange={(opt) => setSelectedCountry(opt as CountryOption)}
              selectStyles={selectStyles}
            />

            {/* Gender (required when otpVerified === true) */}
            <GenderField editing={isEditing} value={form?.gender} readValue={genderFromCode(influencer?.gender as any)} onChange={(v) => onField("gender", v as any)} required={!!form?.otpVerified} />

            {/* Password (optional change) */}
          </div>
        </div>

        {/* Platform & Audience */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6 sm:mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform & Audience</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Platform Select */}
            <SelectField label="Platform" icon={HiUserGroup} options={platforms} value={selectedPlatform} onChange={(opt) => setSelectedPlatform(opt as PlatformOption)} placeholder="Select Platform" styles={selectStyles} readValue={influencer?.platformName || "—"} editing={isEditing} />

            {/* Manual Platform (when Other) */}
            {isEditing && showManualPlatform && (
              <IconField icon={HiPencil} label="If Other – Enter Platform Name" value={form?.manualPlatformName || ""} readValue={form?.manualPlatformName || ""} onChange={(v) => onField("manualPlatformName", v as any)} editing={true} />
            )}

            {/* Audience Age Range (e.g., 18–24) */}
            <SelectField label="Audience Age Range" icon={HiCalendar} options={ages} value={selectedAge} onChange={(opt) => setSelectedAge(opt as AudienceAgeOption)} placeholder="e.g., 18 – 24" styles={selectStyles} readValue={influencer?.audienceAgeRange || "—"} editing={isEditing} />

            {/* Audience Range (Count) (e.g., 10k–18k) */}
            <SelectField label="Audience Range (Count)" icon={HiCalendar} options={ranges} value={selectedRange} onChange={(opt) => setSelectedRange(opt as AudienceRangeOption)} placeholder="e.g., 10k – 18k" styles={selectStyles} readValue={influencer?.audienceRange || "—"} editing={isEditing} />

            {/* Audience Gender Split */}
            <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-3">Audience Gender Split</label>
              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <NumberField label="Male %" value={form?.audienceBifurcation?.malePercentage ?? 0} min={0} max={100} onChange={(v) => onField("audienceBifurcation", { ...form?.audienceBifurcation, malePercentage: v } as any)} />
                  <NumberField label="Female %" value={form?.audienceBifurcation?.femalePercentage ?? 0} min={0} max={100} onChange={(v) => onField("audienceBifurcation", { ...form?.audienceBifurcation, femalePercentage: v } as any)} />
                </div>
              ) : (
                <div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className="h-3 inline-block bg-blue-400" style={{ width: `${pct(influencer?.audienceBifurcation?.malePercentage)}%` }} title={`Male ${pct(influencer?.audienceBifurcation?.malePercentage)}%`} />
                    <div className="h-3 inline-block bg-pink-300" style={{ width: `${pct(influencer?.audienceBifurcation?.femalePercentage)}%` }} title={`Female ${pct(influencer?.audienceBifurcation?.femalePercentage)}%`} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>Male: {pct(influencer?.audienceBifurcation?.malePercentage)}%</span>
                    <span>Female: {pct(influencer?.audienceBifurcation?.femalePercentage)}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Categories (multi) */}
            <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Categories (select 1–3)</label>
              {isEditing ? (
                <Select isMulti options={interests} value={selectedCategories} onChange={(opts) => setSelectedCategories((opts as InterestOption[]) || [])} styles={selectStyles} placeholder="Choose up to 3 categories" />
              ) : influencer?.categoryName?.length ? (
                <div className="flex flex-wrap gap-2 mt-1">
                  {influencer.categoryName.map((c) => (
                    <span key={c} className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded-full">{c}</span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">—</p>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6 sm:mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Bio</h3>
          {isEditing ? (
            <textarea className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200" rows={4} value={form?.bio || ""} onChange={(e) => onField("bio", e.target.value as any)} />
          ) : (
            <p className="text-gray-700 whitespace-pre-wrap break-words">{influencer?.bio || "—"}</p>
          )}
        </div>

        {/* Subscription (read-only display) */}
        {!isEditing && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <div className="flex items-start gap-4 flex-col sm:flex-row">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl flex items-center justify-center">
                <HiCreditCard className="w-6 h-6 text-purple-600" />
              </div>

              <div className="flex-1 min-w-0 w-full">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Subscription</h3>
                    <p className="text-2xl font-bold text-gray-900 mb-1">{influencer?.subscription?.planName || "No Plan"}</p>
                    <div className="space-y-1 text-sm text-gray-600">
                      {influencer?.subscription?.startedAt && (
                        <div className="flex items-center gap-2"><HiCalendar className="w-4 h-4" /><span>Started: {formatDate(influencer.subscription.startedAt)}</span></div>
                      )}
                      {influencer?.subscription?.expiresAt && (
                        <div className="flex items-center gap-2"><HiCalendar className="w-4 h-4" /><span>Expires: {formatDate(influencer.subscription.expiresAt)}{influencer?.subscriptionExpired && (<span className="ml-2 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">Expired</span>)}</span></div>
                      )}
                    </div>
                  </div>

                  <div className="w-full sm:w-auto">
                    <button className="w-full inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 cursor-pointer">
                      <HiCreditCard className="w-5 h-5 mr-2" />
                      Upgrade Subscription
                    </button>
                  </div>
                </div>

                {influencer?.subscription?.features?.length ? (
                  <div className="mt-5 space-y-3">
                    {influencer.subscription.features.map((feat) => {
                      const percent = feat.limit > 0 ? Math.min(100, Math.round((feat.used / feat.limit) * 100)) : 0;
                      return (
                        <div key={feat.key}>
                          <div className="flex justify-between text-sm">
                            <span className="capitalize text-gray-700 break-words">{feat.key.replace(/_/g, " ")}</span>
                            <span className="text-gray-600">{feat.used}/{feat.limit}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] h-2 rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        {isEditing && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mt-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-end">
              <button onClick={resetEdits} disabled={saving} className="inline-flex items-center justify-center px-6 py-3 text-gray-700 bg-gray-100 border border-gray-300 rounded-xl hover:bg-gray-200 transition-all duration-200 disabled:opacity-60 w-full sm:w-auto">
                <HiX className="w-5 h-5 mr-2" />
                Cancel
              </button>
              <button
                onClick={saveProfile}
                disabled={saveDisabled}
                className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-60 disabled:transform-none w-full sm:w-auto"
                title={emailFlow !== "idle" && emailFlow !== "verified" ? "Verify the new email to enable saving" : undefined}
              >
                <HiCheck className="w-5 h-5 mr-2" />
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* -------- Small UI helpers -------- */
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
        <p className="text-red-600 mb-4 break-words">{message}</p>
        <button onClick={() => window.location.reload()} className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white font-medium rounded-xl hover:shadow-md transition-all duration-200">
          Try Again
        </button>
      </div>
    </div>
  );
}

function IconField({ icon: Icon, label, prefix, value, readValue, onChange, editing }: { icon: any; label: string; prefix?: string; value: string; readValue: string; onChange: (v: string) => void; editing: boolean; }) {
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
              {prefix && (<span className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg font-medium">{prefix}</span>)}
              <input className="flex-1 min-w-0 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200" value={value} onChange={(e) => onChange(e.target.value)} />
            </div>
          ) : (
            <p className="text-lg font-medium text-gray-900 break-words">{readValue || "—"}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PhoneField({ valueNumber, readValueNumber, code, editing, onNumberChange, codeOptions, selectedCalling, onCallingChange, selectStyles, }: { valueNumber: string; readValueNumber: string; code?: string; editing: boolean; onNumberChange: (v: string) => void; codeOptions: any[]; selectedCalling: any | null; onCallingChange: (opt: any | null) => void; selectStyles: any; }) {
  const readText = formatPhoneDisplay(code, readValueNumber);
  const visibleCode = (selectedCalling && selectedCalling.country?.callingCode) || code || "";
  return (
    <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg flex items-center justify-center">
          <HiPhone className="text-emerald-600 w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select inputId="influencerCalling" options={codeOptions} placeholder="Code" value={selectedCalling} onChange={(opt) => onCallingChange(opt as any)} styles={selectStyles} />
              <div className="sm:col-span-2 relative">
                {visibleCode && (
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-600 pointer-events-none select-none">{visibleCode}</span>
                )}
                <input
                  type="tel"
                  className={`w-full ${visibleCode ? "pl-16" : "pl-4"} pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200`}
                  value={valueNumber}
                  onChange={(e) => onNumberChange(e.target.value)}
                  placeholder="Phone number"
                />
              </div>
            </div>
          ) : (
            <p className="text-lg font-medium text-gray-900 break-words">{readText}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CountryField({ editing, readValue, countryOptions, selectedCountry, onCountryChange, selectStyles, }: { editing: boolean; readValue: string; countryOptions: CountryOption[]; selectedCountry: CountryOption | null; onCountryChange: (opt: CountryOption | null) => void; selectStyles: any; }) {
  return (
    <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg flex items-center justify-center">
          <HiGlobe className="text-purple-600 w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
          {editing ? (
            <Select inputId="influencerCountry" options={countryOptions} placeholder="Select Country" value={selectedCountry} onChange={(opt) => onCountryChange(opt as CountryOption)} filterOption={filterByCountryName as any} styles={selectStyles} />
          ) : (
            <p className="text-lg font-medium text-gray-900 break-words">{readValue || "—"}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function GenderField({ editing, value, readValue, onChange, required, }: { editing: boolean; value?: 0 | 1 | 2; readValue: string; onChange: (v: 0 | 1 | 2 | undefined) => void; required?: boolean; }) {
  return (
    <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center">
          <HiUser className="text-indigo-600 w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-700 mb-2">Gender {required && <span className="text-red-500">*</span>}</label>
          {editing ? (
            <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200" value={value !== undefined ? String(value) : ""} onChange={(e) => { const v = e.target.value; if (v === "") onChange(undefined); else onChange(Number(v) as 0 | 1 | 2); }}>
              <option value="">Select gender</option>
              <option value="0">Male</option>
              <option value="1">Female</option>
              <option value="2">Other</option>
            </select>
          ) : (
            <p className="text-lg font-medium text-gray-900">{readValue || "—"}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, min = 0, max = 100 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-2">{label}</label>
      <input type="number" min={min} max={max} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200" value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))} />
    </div>
  );
}

function SelectField({ label, icon: Icon, options, value, onChange, placeholder, styles, readValue, editing, }: { label: string; icon: any; options: any[]; value: any; onChange: (opt: any) => void; placeholder?: string; styles: any; readValue?: string; editing: boolean; }) {
  return (
    <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center">
          <Icon className="text-indigo-600 w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
          {editing ? (
            <Select options={options} value={value} onChange={onChange} placeholder={placeholder} styles={styles} />
          ) : (
            <p className="text-lg font-medium text-gray-900 break-words">{readValue || "—"}</p>
          )}
        </div>
      </div>
    </div>
  );
}
