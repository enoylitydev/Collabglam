"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useId } from "react";
import Select from "react-select";
import { get, post } from "@/lib/api";
import { resolveFileUrl } from "@/lib/files";
import {
  HiUser,
  HiPhone,
  HiGlobe,
  HiMail,
  HiCheck,
  HiX,
  HiCreditCard,
  HiCalendar,
  HiShieldCheck,
  HiUpload,
} from "react-icons/hi";

// shadcn/ui
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";

// SweetAlert2
import Swal, { SweetAlertIcon, SweetAlertOptions } from "sweetalert2";

/* ===================== SweetAlert helpers ===================== */
const fire = (opts: SweetAlertOptions) =>
  Swal.fire({
    confirmButtonColor: "#FF7236",
    cancelButtonColor: "#6B7280",
    ...opts,
  });

const toast = (icon: SweetAlertIcon, title: string, text?: string) =>
  Swal.fire({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
    icon,
    title,
    text,
  });

/* ===================== Formatting helpers (SSR-safe) ===================== */
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

/* ===================== Types ===================== */
type SubscriptionFeature = { key: string; limit: number; used: number };

type BrandData = {
  brandId: string;
  name: string;
  pocName: string;

  email: string;
  phone: string;
  country: string;
  countryId: string;
  callingId: string;
  callingCode?: string;

  website?: string;
  instagramHandle?: string;
  companySize?: string;
  referralCode?: string;

  categoryId?: string;
  categoryName?: string;
  businessType?: string;

  logoUrl?: string;
  logoFileId?: string;
  logoFilename?: string;

  brandAliasEmail: string;

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
type CategoryItem = { _id: string; name: string; id?: number };
type BusinessTypeItem = { _id: string; name: string };
type MetaOptions = { categories: CategoryItem[]; businessTypes: BusinessTypeItem[] };
type SimpleOption = { value: string; label: string };

/* ===================== Small utils ===================== */
const isEmailEqual = (a = "", b = "") => a.trim().toLowerCase() === b.trim().toLowerCase();
const deepClone = <T,>(obj: T): T =>
  // @ts-ignore
  typeof structuredClone === "function" ? structuredClone(obj) : JSON.parse(JSON.stringify(obj));

function validateEmail(email: string) {
  return /[^@\s]+@[^@\s]+\.[^@\s]+/.test(email);
}

function formatPhoneDisplay(code?: string, num?: string) {
  const c = (code || "").trim();
  const n = (num || "").trim();
  if (!c && !n) return "—";
  if (n.startsWith("+")) return n;
  return `${c ? c : ""}${c && n ? " " : ""}${n}`;
}

function normalizeBrand(data: any): BrandData {
  const s = data?.subscription ?? {};
  const brand = data?.brand ?? data;

  // best-effort logo URL
  let logoUrl: string | undefined = brand?.logoUrl;
  if (!logoUrl) {
    if (brand?.logoFilename) logoUrl = `/file/${encodeURIComponent(brand.logoFilename)}`;
    else if (brand?.logoFileId) logoUrl = `/file/id/${brand.logoFileId}`;
  }

  const brandAliasEmail = brand?.brandAliasEmail ?? brand?.aliasEmail ?? "";

  const populatedCategory = brand?.category;
  const categoryId =
    populatedCategory && typeof populatedCategory === "object"
      ? populatedCategory._id
      : brand?.categoryId ?? brand?.category ?? "";

  const categoryName =
    (populatedCategory && typeof populatedCategory === "object"
      ? populatedCategory.name
      : brand?.categoryName) ?? "";

  return {
    brandId: brand?.brandId ?? "",
    name: brand?.name ?? "",
    pocName: brand?.pocName ?? brand?.name ?? "",

    email: brand?.email ?? "",
    phone: brand?.phone ?? "",
    country: brand?.country ?? "",
    countryId: brand?.countryId ?? "",
    callingId: brand?.callingId ?? "",
    callingCode: brand?.callingcode ?? brand?.callingCode ?? "",

    website: brand?.website ?? "",
    instagramHandle: brand?.instagramHandle ?? "",
    companySize: brand?.companySize ?? "",
    referralCode: brand?.referralCode ?? "",

    categoryId: categoryId || "",
    categoryName: categoryName || "",
    businessType: brand?.businessType ?? "",

    logoUrl,
    logoFileId: brand?.logoFileId ?? "",
    logoFilename: brand?.logoFilename ?? "",
    brandAliasEmail,

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

/* ===================== Options builders ===================== */
const buildCountryOptions = (countries: Country[]): CountryOption[] =>
  countries.map((c) => ({
    value: c._id,
    label: `${c.flag} ${c.countryName}`,
    country: c,
  }));

const buildCallingOptions = (countries: Country[]): CountryOption[] => {
  const opts = countries.map((c) => ({ value: c._id, label: `${c.callingCode}`, country: c }));
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

/* ===================== Styling tokens ===================== */
const CG_GRADIENT = "bg-gradient-to-r from-[#FFA135] to-[#FF7236]";
const CG_ICON = `${CG_GRADIENT} text-white`;
const inputClass =
  "h-11 bg-gray-50 border-gray-200 focus-visible:ring-2 focus-visible:ring-[#FF7236]/25 focus-visible:ring-offset-0";
const panelClass =
  "bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200";

/* ===================== Email Update (Single OTP to NEW email) ===================== */
type EmailFlowState = "idle" | "needs" | "code_sent" | "verifying" | "verified";

const EmailEditorNewEmailOTP = ({
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
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [open, setOpen] = useState(false);

  const needs = useMemo(() => !isEmailEqual(value, originalEmail), [value, originalEmail]);
  const valueIsValid = useMemo(() => validateEmail(value), [value]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  useEffect(() => {
    if (!needs) {
      setFlow("idle");
      setOtp("");
      setExpiresAt(null);
      onStateChange("idle");
      return;
    }
    if (flow === "idle" || flow === "verified") {
      setFlow("needs");
      onStateChange("needs");
      return;
    }
    onStateChange(flow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needs]);

  const requestCode = useCallback(async () => {
    if (!valueIsValid || busy || resendIn > 0) return;

    setBusy(true);
    try {
      const resp = await post<{ message?: string; expiresAt?: string }>("/brand/requestEmailUpdate", {
        brandId,
        newEmail: value.trim().toLowerCase(),
      });

      setFlow("code_sent");
      onStateChange("code_sent");
      setExpiresAt(resp?.expiresAt || null);
      setResendIn(30);
      setOpen(true);

      toast("success", "OTP sent", `Code sent to ${value.trim().toLowerCase()}`);
    } catch (e: any) {
      await fire({ icon: "error", title: "Failed to send OTP", text: e?.message || "Please try again." });
    } finally {
      setBusy(false);
    }
  }, [brandId, value, valueIsValid, busy, resendIn, onStateChange]);

  const verifyAndPersist = useCallback(async () => {
    if (otp.trim().length !== 6) {
      await fire({ icon: "warning", title: "Enter the 6-digit OTP" });
      return;
    }

    setBusy(true);
    setFlow("verifying");
    onStateChange("verifying");

    try {
      const res = await post<{ email: string; token?: string; message?: string }>("/brand/verifyEmailUpdate", {
        brandId,
        newEmail: value.trim().toLowerCase(),
        otp: otp.trim(),
      });

      const newEmail = res?.email || value.trim().toLowerCase();
      onVerified(newEmail, res?.token);

      setFlow("verified");
      onStateChange("verified");
      setOtp("");
      setOpen(false);

      await fire({ icon: "success", title: "Email updated", text: res?.message || "Email updated successfully." });
    } catch (e: any) {
      setFlow("code_sent");
      onStateChange("code_sent");
      await fire({
        icon: "error",
        title: "Verification failed",
        text: e?.message || "Invalid or expired OTP.",
      });
    } finally {
      setBusy(false);
    }
  }, [brandId, value, otp, onVerified, onStateChange]);

  const emailInputId = useId();
  const otpId = useId();

  return (
    <div className={panelClass + " p-5"}>
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${CG_ICON}`}>
          <HiMail className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <Label className="mb-2 block text-sm text-gray-700" htmlFor={emailInputId}>
            Email Address
          </Label>

          <Input
            id={emailInputId}
            className={inputClass}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="name@example.com"
            aria-invalid={needs && !validateEmail(value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && needs && valueIsValid) requestCode();
            }}
          />

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {needs && valueIsValid ? (
              <Button
                onClick={requestCode}
                disabled={busy}
                className={`${CG_GRADIENT} text-white disabled:opacity-60`}
              >
                {flow === "code_sent"
                  ? resendIn > 0
                    ? `Enter OTP (${resendIn}s)`
                    : "Enter OTP"
                  : busy
                    ? "Sending…"
                    : "Verify"}
              </Button>
            ) : null}

            {needs ? (
              <button
                type="button"
                onClick={() => onChange(originalEmail)}
                className="text-sm text-red-500 hover:text-red-700 transition-colors ml-auto"
              >
                Cancel
              </button>
            ) : null}
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-[95vw] sm:max-w-lg bg-white">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${CG_ICON}`}>
                    <HiShieldCheck className="w-5 h-5" />
                  </span>
                  Verify new email
                </DialogTitle>
                <DialogDescription>
                  Enter the 6-digit OTP sent to <strong className="break-words">{value}</strong>.
                  {expiresAt ? (
                    <span className="block mt-1 text-xs text-gray-600">Expires: {formatDateTime(expiresAt)}</span>
                  ) : null}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor={otpId} className="text-sm text-gray-700">
                  OTP
                </Label>
                <Input
                  id={otpId}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  maxLength={6}
                  className={`${inputClass} text-center tracking-widest font-mono text-lg`}
                />
              </div>

              <DialogFooter className="mt-4 flex items-center justify-between sm:justify-end gap-2">
                <Button type="button" variant="outline" disabled={busy || resendIn > 0} onClick={requestCode}>
                  {resendIn > 0 ? `Resend (${resendIn}s)` : "Resend OTP"}
                </Button>

                <Button
                  onClick={verifyAndPersist}
                  disabled={busy || otp.length !== 6}
                  className={`${CG_GRADIENT} text-white px-6 disabled:opacity-60`}
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

const EmailEditor = React.memo(EmailEditorNewEmailOTP);

/* ===================== Page ===================== */
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
  const [meta, setMeta] = useState<MetaOptions>({ categories: [], businessTypes: [] });

  // react-select selected values
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null);
  const [selectedCalling, setSelectedCalling] = useState<CountryOption | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<SimpleOption | null>(null);
  const [selectedBusinessType, setSelectedBusinessType] = useState<SimpleOption | null>(null);

  // logo: pick now, upload only on Save Changes (single API call)
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>("");

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    };
  }, [logoPreviewUrl]);

  const countryOptions = useMemo(() => buildCountryOptions(countries), [countries]);
  const codeOptions = useMemo(() => buildCallingOptions(countries), [countries]);

  const categoryOptions2 = useMemo<SimpleOption[]>(
    () => (meta.categories || []).map((c) => ({ value: c._id, label: c.name })),
    [meta.categories]
  );

  const businessTypeOptions2 = useMemo<SimpleOption[]>(
    () => (meta.businessTypes || []).map((b) => ({ value: b.name, label: b.name })),
    [meta.businessTypes]
  );

  const maps = useMemo(() => {
    const co = countryOptions;
    const ko = codeOptions;
    return {
      countryById: new Map(co.map((o) => [o.value, o] as const)),
      callingById: new Map(ko.map((o) => [o.value, o] as const)),
      co,
      ko,
    };
  }, [countryOptions, codeOptions]);

  const selectStyles = useMemo(
    () => ({
      container: (base: any) => ({ ...base, width: "100%", minWidth: 0 }),
      control: (base: any, state: any) => ({
        ...base,
        backgroundColor: "#F9FAFB",
        borderColor: state.isFocused ? "#FF7236" : "#E5E7EB",
        boxShadow: state.isFocused ? "0 0 0 2px rgba(255, 114, 54, 0.18)" : "none",
        "&:hover": { borderColor: "#FF7236" },
        borderRadius: "12px",
        padding: "2px",
        minHeight: "44px",
      }),
      valueContainer: (base: any) => ({ ...base, overflow: "hidden" }),
      singleValue: (base: any) => ({
        ...base,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }),
      option: (base: any, state: any) => ({
        ...base,
        backgroundColor: state.isSelected ? "rgba(255, 114, 54, 0.12)" : state.isFocused ? "rgba(255, 114, 54, 0.08)" : "transparent",
        color: "#111827",
      }),
      menuPortal: (base: any) => ({ ...base, zIndex: 50 }),
    }),
    []
  );

  const onField = useCallback(<K extends keyof BrandData>(key: K, value: BrandData[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  // Initial fetch
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
        const [brandRes, countryRes, metaRes] = await Promise.all([
          get<any>(`/brand?id=${brandId}`),
          get<Country[]>("/country/getall"),
          get<MetaOptions>("/brand/metaOptions"),
        ]);

        if (cancelled) return;

        const countriesList = Array.isArray(countryRes) ? countryRes : [];
        setCountries(countriesList);
        setMeta(metaRes || { categories: [], businessTypes: [] });

        const normalized = normalizeBrand(brandRes);
        setBrand(normalized);
        setForm(deepClone(normalized));

        if (typeof window !== "undefined" && normalized.brandAliasEmail) {
          localStorage.setItem("brandAliasEmail", normalized.brandAliasEmail);
        }

        const co = buildCountryOptions(countriesList);
        const ko = buildCallingOptions(countriesList);

        const matchedCountry =
          co.find((o) => o.value === normalized.countryId) ||
          co.find((o) => o.country.countryName === normalized.country) ||
          null;

        const matchedCalling =
          ko.find((o) => o.value === normalized.callingId) ||
          ko.find((o) => o.country.callingCode === normalized.callingCode) ||
          null;

        setSelectedCountry(matchedCountry);
        setSelectedCalling(matchedCalling);

        setSelectedCategory(
          normalized.categoryId ? { value: normalized.categoryId, label: normalized.categoryName || "Selected" } : null
        );
        setSelectedBusinessType(
          normalized.businessType ? { value: normalized.businessType, label: normalized.businessType } : null
        );
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

  // keep form synced to selects
  useEffect(() => {
    if (!form) return;

    setForm((prev) =>
      prev
        ? {
          ...prev,
          countryId: selectedCountry?.value || prev.countryId,
          country: selectedCountry?.country.countryName || prev.country,
        }
        : prev
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountry?.value]);

  useEffect(() => {
    if (!form) return;

    setForm((prev) =>
      prev
        ? {
          ...prev,
          callingId: selectedCalling?.value || prev.callingId,
          callingCode: selectedCalling?.country.callingCode || prev.callingCode,
        }
        : prev
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCalling?.value]);

  useEffect(() => {
    if (!form) return;
    setForm((p) => (p ? { ...p, categoryId: selectedCategory?.value || "", categoryName: selectedCategory?.label || "" } : p));
  }, [selectedCategory]);

  useEffect(() => {
    if (!form) return;
    setForm((p) => (p ? { ...p, businessType: selectedBusinessType?.value || "" } : p));
  }, [selectedBusinessType]);

  const resetEdits = useCallback(() => {
    if (!brand) return;
    const cl = deepClone(brand);
    setForm(cl);

    setIsEditing(false);
    setEmailFlow("idle");

    setSelectedCountry(cl.countryId ? maps.countryById.get(cl.countryId) || null : null);
    setSelectedCalling(cl.callingId ? maps.callingById.get(cl.callingId) || null : null);

    setSelectedCategory(cl.categoryId ? { value: cl.categoryId, label: cl.categoryName || "Selected" } : null);
    setSelectedBusinessType(cl.businessType ? { value: cl.businessType, label: cl.businessType } : null);

    setSelectedLogoFile(null);
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl("");

    toast("info", "Changes discarded");
  }, [brand, maps.countryById, maps.callingById, logoPreviewUrl]);

  const refetchBrand = useCallback(
    async (id?: string) => {
      const brandId = id ?? (typeof window !== "undefined" ? localStorage.getItem("brandId") : null);
      if (!brandId) return;

      try {
        const brandRes = await get<any>(`/brand?id=${brandId}`);
        const normalized = normalizeBrand(brandRes);

        setBrand(normalized);
        setForm(deepClone(normalized));

        if (typeof window !== "undefined" && normalized.brandAliasEmail) {
          localStorage.setItem("brandAliasEmail", normalized.brandAliasEmail);
        }

        setSelectedCountry(
          maps.countryById.get(normalized.countryId) || maps.co.find((o) => o.country.countryName === normalized.country) || null
        );
        setSelectedCalling(
          maps.callingById.get(normalized.callingId) || maps.ko.find((o) => o.country.callingCode === normalized.callingCode) || null
        );

        setSelectedCategory(
          normalized.categoryId ? { value: normalized.categoryId, label: normalized.categoryName || "Selected" } : null
        );
        setSelectedBusinessType(
          normalized.businessType ? { value: normalized.businessType, label: normalized.businessType } : null
        );
      } catch (e) {
        console.error(e);
        toast("error", "Failed to refresh", "Couldn't reload brand after saving.");
      }
    },
    [maps]
  );

  const onPickLogo = useCallback((file?: File) => {
    if (!file) return;

    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setSelectedLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));

    toast("success", "Logo selected", "Click Save Changes to upload.");
  }, [logoPreviewUrl]);

  const saveProfile = useCallback(async () => {
    if (!form || !brand) return;

    if (emailFlow !== "idle" && emailFlow !== "verified") {
      await fire({
        icon: "warning",
        title: "Verify the new email first",
        text: "Finish email verification to save.",
      });
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();

      fd.append("brandId", form.brandId);

      fd.append("name", form.name || "");
      fd.append("pocName", form.pocName || "");

      fd.append("phone", form.phone || "");
      fd.append("countryId", form.countryId || "");
      fd.append("callingId", form.callingId || "");

      fd.append("website", form.website || "");
      fd.append("instagramHandle", form.instagramHandle || "");
      fd.append("companySize", form.companySize || "");
      fd.append("referralCode", form.referralCode || "");

      fd.append("categoryId", form.categoryId || "");
      fd.append("businessType", form.businessType || "");

      // ✅ attach logo only if selected
      if (selectedLogoFile) fd.append("file", selectedLogoFile);

      const token = (typeof window !== "undefined" && localStorage.getItem("token")) || "";

      // ✅ axios post (your wrapper)
      await post("/brand/update", fd);

      await refetchBrand(form.brandId);

      setIsEditing(false);
      setEmailFlow("idle");

      setSelectedLogoFile(null);
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      setLogoPreviewUrl("");

      await fire({ icon: "success", title: "Profile saved" });
    } catch (e: any) {
      console.error(e);
      await fire({
        icon: "error",
        title: "Failed to save profile",
        text: e?.message || "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }, [brand, emailFlow, form, refetchBrand, selectedLogoFile, logoPreviewUrl]);


  const daysLeft = useMemo(() => {
    if (!brand?.subscription.expiresAt) return null;
    const end = new Date(brand.subscription.expiresAt).getTime();
    const diff = Math.max(0, end - Date.now());
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [brand?.subscription.expiresAt]);

  if (loading) return <Loader />;
  if (error) return <Error message={error} />;

  const saveDisabled = saving || (emailFlow !== "idle" && emailFlow !== "verified");
  const brandLogoUrl = resolveFileUrl(logoPreviewUrl || form?.logoUrl || brand?.logoUrl);

  return (
    <div className="min-h-screen py-6 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <Card className="mb-6 sm:mb-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <CardContent className="p-5 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Brand Profile</h1>
                <p className="text-gray-600 mt-1">Manage your brand information and settings</p>
              </div>

              {!isEditing ? (
                <Button
                  onClick={() => setIsEditing(true)}
                  className={`${CG_GRADIENT} text-white w-full sm:w-auto rounded-xl px-6 py-3 shadow hover:opacity-95`}
                >
                  <HiUser className="w-5 h-5 mr-2" />
                  Edit Profile
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                  <Button
                    type="button"
                    onClick={resetEdits}
                    disabled={saving}
                    variant="outline"
                    className="rounded-xl h-11"
                  >
                    <HiX className="w-5 h-5 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={saveProfile}
                    disabled={saveDisabled}
                    className={`${CG_GRADIENT} text-white rounded-xl h-11 shadow hover:opacity-95 disabled:opacity-60`}
                    title={
                      emailFlow !== "idle" && emailFlow !== "verified"
                        ? "Verify the new email to enable saving"
                        : undefined
                    }
                  >
                    <HiCheck className="w-5 h-5 mr-2" />
                    {saving ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Profile */}
        <Card className="mb-6 sm:mb-8 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <CardContent className="p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 mb-8">
              {/* Logo */}
              <div className="flex flex-col items-center gap-3">
                <div className={`w-20 h-20 rounded-full overflow-hidden ring-4 ring-gray-100 ${CG_GRADIENT}`}>
                  {brandLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brandLogoUrl} alt={`${brand?.name || "Brand"} logo`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <HiUser className="w-10 h-10 text-white" />
                    </div>
                  )}
                </div>

                {isEditing && (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onPickLogo(f);
                        e.currentTarget.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl h-10"
                      onClick={() => fileRef.current?.click()}
                    >
                      <HiUpload className="w-4 h-4 mr-2" />
                      {selectedLogoFile ? "Change Logo" : "Select Logo"}
                    </Button>
                    {selectedLogoFile ? (
                      <p className="text-xs text-gray-600 max-w-[220px] text-center break-words">
                        Selected: <span className="font-medium">{selectedLogoFile.name}</span>
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              {/* Brand Name */}
              <div className="w-full max-w-2xl">
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

            {/* Contact */}
            <SectionTitle title="Contact Information" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <IconField
                icon={HiUser}
                label="POC Name"
                value={form?.pocName ?? ""}
                readValue={brand?.pocName ?? ""}
                onChange={(v) => onField("pocName", v as any)}
                editing={isEditing}
              />

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
                brand &&
                form && (
                  <EmailEditor
                    brandId={brand.brandId}
                    originalEmail={brand.email}
                    value={form.email}
                    onChange={(v) => onField("email", v as any)}
                    onVerified={(newEmail, token) => {
                      setBrand((b) => (b ? { ...b, email: newEmail } : b));
                      setForm((f) => (f ? { ...f, email: newEmail } : f));
                      setEmailFlow("verified");

                      if (typeof window !== "undefined" && token) {
                        localStorage.setItem("token", token);
                      }
                    }}
                    onStateChange={setEmailFlow}
                  />
                )
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
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

              <CountryField
                editing={isEditing}
                readValue={brand?.country ?? ""}
                countryOptions={countryOptions}
                selectedCountry={selectedCountry}
                onCountryChange={(opt) => setSelectedCountry(opt as CountryOption)}
                selectStyles={selectStyles}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
              <IconField
                icon={HiMail}
                label="Brand Alias Email"
                value=""
                readValue={brand?.brandAliasEmail ?? ""}
                onChange={() => { }}
                editing={false}
              />
              <div className="hidden lg:block" />
            </div>

            {/* Business */}
            <div className="mt-10">
              <SectionTitle title="Business Information" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <SelectPanel label="Category" editing={isEditing} readValue={brand?.categoryName || "—"}>
                <Select
                  inputId="brandCategory"
                  options={categoryOptions2}
                  value={selectedCategory}
                  onChange={(opt) => setSelectedCategory(opt as any)}
                  styles={selectStyles}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                />
              </SelectPanel>

              <SelectPanel label="Business Type" editing={isEditing} readValue={brand?.businessType || "—"}>
                <Select
                  inputId="brandBusinessType"
                  options={businessTypeOptions2}
                  value={selectedBusinessType}
                  onChange={(opt) => setSelectedBusinessType(opt as any)}
                  styles={selectStyles}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                />
              </SelectPanel>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
              <IconField
                icon={HiGlobe}
                label="Website"
                value={form?.website ?? ""}
                readValue={brand?.website ?? ""}
                onChange={(v) => onField("website", v as any)}
                editing={isEditing}
                placeholder="https://yourbrand.com"
              />

              <IconField
                icon={HiGlobe}
                label="Instagram Handle"
                value={form?.instagramHandle ?? ""}
                readValue={brand?.instagramHandle ?? ""}
                onChange={(v) => onField("instagramHandle", v as any)}
                editing={isEditing}
                placeholder="@yourbrand"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
              <SelectPanel label="Company Size" editing={isEditing} readValue={brand?.companySize || "—"}>
                <select
                  className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:ring-2 focus:ring-[#FF7236]/25"
                  value={form?.companySize ?? ""}
                  onChange={(e) => onField("companySize", e.target.value as any)}
                >
                  <option value="">Select</option>
                  <option value="1-10">1-10</option>
                  <option value="11-50">11-50</option>
                  <option value="51-200">51-200</option>
                  <option value="200+">200+</option>
                </select>
              </SelectPanel>

              <div className="hidden lg:block" />
            </div>
          </CardContent>
        </Card>

        {/* Wallet + Subscription (view mode only) */}
        {!isEditing && (
          <div className="flex flex-col gap-6 mb-10">
            <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${CG_ICON}`}>
                    <HiGlobe className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle>Wallet</CardTitle>
                    <CardDescription>Balance</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-3xl font-bold text-gray-900">
                  {brand ? (mounted ? formatUSD(brand.walletBalance || 0) : "—") : "—"}
                </p>
                <p className="text-sm text-gray-600">Available for use</p>
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-200 rounded-2xl shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${CG_ICON}`}>
                      <HiCreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle>Subscription</CardTitle>
                      <CardDescription>Plan &amp; usage</CardDescription>
                    </div>
                  </div>

                  <Button
                    className={`${CG_GRADIENT} text-white rounded-xl px-4 py-2 shadow hover:opacity-95`}
                    onClick={() => router.push("/brand/subscriptions")}
                  >
                    <HiCreditCard className="w-5 h-5 mr-2" />
                    Upgrade Subscription
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-2xl font-bold text-gray-900 capitalize">
                    {brand?.subscription.planName || "No Plan"}
                  </span>
                  {!brand?.subscriptionExpired ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">Active</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 border border-red-200">Expired</Badge>
                  )}
                </div>

                <div className="space-y-1 text-sm text-gray-600">
                  {brand?.subscription.startedAt ? (
                    <div className="flex items-center gap-2">
                      <HiCalendar className="w-4 h-4" />
                      <span>Started: {mounted ? formatDate(brand.subscription.startedAt) : "—"}</span>
                    </div>
                  ) : null}

                  {brand?.subscription.expiresAt ? (
                    <div className="flex items-center gap-2">
                      <HiCalendar className="w-4 h-4" />
                      <span>
                        Expires: {mounted ? formatDate(brand.subscription.expiresAt) : "—"}
                        {mounted && typeof daysLeft === "number" ? (
                          <span className="ml-2 text-gray-500">
                            • {daysLeft} day{daysLeft === 1 ? "" : "s"} left
                          </span>
                        ) : null}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-2 space-y-4">
                  {(brand?.subscription.features ?? []).map((f) => {
                    const isManager = f.key === "dedicated_manager_support";
                    const rawLimit = Number.isFinite(f.limit) ? f.limit : 0;
                    const limit = Math.max(0, rawLimit);
                    const used = Math.max(0, f.used ?? 0);
                    const unlimited = limit === 0;
                    const label = isManager ? "Dedicated Manager Support" : titleizeFeatureKey(f.key);

                    if (isManager) {
                      const status = unlimited ? "Unlimited" : limit >= 1 ? "Available" : "Not included";
                      const badgeClass = unlimited
                        ? `${CG_GRADIENT} text-white border border-transparent`
                        : limit >= 1
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-gray-100 text-gray-700 border border-gray-200";
                      const Icon = unlimited || limit >= 1 ? HiCheck : HiX;

                      return (
                        <div key={f.key} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm min-w-0">
                            <Icon className={unlimited || limit >= 1 ? "w-4 h-4 text-[#FF7236]" : "w-4 h-4 text-gray-400"} />
                            <span className="text-gray-800 break-words">{label}</span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-md whitespace-nowrap ${badgeClass}`}>{status}</span>
                        </div>
                      );
                    }

                    const pct = unlimited ? 100 : limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

                    const barClasses = unlimited
                      ? "[&>div]:bg-gradient-to-r [&>div]:from-[#FFA135] [&>div]:to-[#FF7236]"
                      : used >= limit
                        ? "[&>div]:bg-red-500"
                        : pct >= 80
                          ? "[&>div]:bg-orange-500"
                          : "[&>div]:bg-emerald-500";

                    return (
                      <div key={f.key} className="group">
                        <div className="flex items-center justify-between mb-1 text-sm gap-3">
                          <span className="text-gray-800 break-words">{label}</span>
                          <span className="text-gray-500 tabular-nums whitespace-nowrap">
                            {used} / {unlimited ? "∞" : limit}
                          </span>
                        </div>

                        <Progress value={pct} className={`h-2 rounded-full bg-gray-100 ${barClasses}`} />

                        <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                          <span className="tabular-nums">{unlimited ? "∞" : `${pct}%`}</span>
                          {unlimited ? (
                            <span className={`tabular-nums px-2 py-0.5 rounded ${CG_GRADIENT} text-white`}>
                              Unlimited
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
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================== UI helpers ===================== */
function SectionTitle({ title }: { title: string }) {
  return <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>;
}

function Loader() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        <p className="text-gray-600 font-medium">Loading profile…</p>
      </div>
    </div>
  );
}

function Error({ message }: { message: string }) {
  useEffect(() => {
    fire({ icon: "error", title: "Error Loading Profile", text: message });
  }, [message]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md mx-auto text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <HiX className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Profile</h2>
        <p className="text-red-600 mb-4">{message}</p>
        <Button onClick={() => window.location.reload()} className={`${CG_GRADIENT} text-white rounded-xl px-6 py-3 shadow hover:opacity-95`}>
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
    <div className="space-y-2 min-w-0">
      <Label className="block text-sm text-gray-700" htmlFor={id}>
        {label}
      </Label>
      {editing ? (
        <Input
          id={id}
          className={`${inputClass} ${large ? "text-xl sm:text-2xl font-bold" : "text-sm"}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <p className={`${large ? "text-xl sm:text-2xl font-bold" : "text-lg font-medium"} text-gray-900 break-words`}>
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
  placeholder,
}: {
  icon: any;
  label: string;
  prefix?: string;
  value: string;
  readValue: string;
  onChange: (v: string) => void;
  editing: boolean;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <div className={`${panelClass} p-5 min-w-0`}>
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${CG_ICON}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <Label className="block text-sm text-gray-700 mb-2" htmlFor={id}>
            {label}
          </Label>
          {editing ? (
            <div className="flex items-center gap-2 min-w-0">
              {prefix ? (
                <span className="px-3 h-11 flex items-center bg-gray-100 text-gray-700 text-sm rounded-xl font-medium whitespace-nowrap">
                  {prefix}
                </span>
              ) : null}
              <Input
                id={id}
                className={`${inputClass} flex-1`}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
              />
            </div>
          ) : (
            <p className="text-lg font-medium text-gray-900 break-words">{readValue || "—"}</p>
          )}
        </div>
      </div>
    </div>
  );
});

function SelectPanel({
  label,
  editing,
  readValue,
  children,
}: {
  label: string;
  editing: boolean;
  readValue: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${panelClass} p-5 min-w-0`}>
      <Label className="block text-sm text-gray-700 mb-2">{label}</Label>
      {editing ? children : <p className="text-lg font-medium text-gray-900 break-words">{readValue}</p>}
    </div>
  );
}

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
  const numberId = useId();

  const handleNumber = (v: string) => {
    const sanitized = v.replace(/[^\d\s-]/g, "").replace(/^\+/, "").slice(0, 20);
    onNumberChange(sanitized);
  };

  return (
    <div className={`${panelClass} p-5 min-w-0`}>
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${CG_ICON}`}>
          <HiPhone className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <Label className="block text-sm text-gray-700 mb-2" htmlFor={numberId}>
            Phone Number
          </Label>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
              <div className="min-w-0">
                <Select
                  inputId="brandCalling"
                  options={codeOptions}
                  placeholder="Code"
                  value={selectedCalling}
                  onChange={(opt) => onCallingChange(opt as any)}
                  styles={selectStyles}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                />
              </div>
              <div className="sm:col-span-2 min-w-0">
                <Input
                  id={numberId}
                  value={valueNumber}
                  onChange={(e) => handleNumber(e.target.value)}
                  placeholder="Phone number"
                  inputMode="numeric"
                  maxLength={20}
                  className={inputClass}
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
    <div className={`${panelClass} p-5 w-full min-w-0`}>
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${CG_ICON}`}>
          <HiGlobe className="w-5 h-5" />
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
            <p className="text-lg font-medium text-gray-900 break-words">{readValue || "—"}</p>
          )}
        </div>
      </div>
    </div>
  );
});
