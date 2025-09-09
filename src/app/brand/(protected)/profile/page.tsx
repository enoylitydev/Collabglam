"use client";

import React, { useEffect, useMemo, useState } from "react";
import { get, post } from "@/lib/api";
import {
  HiUser,
  HiPhone,
  HiGlobe,
  HiMail,
  HiCheck,
  HiX,
  HiPlus,
  HiTrash,
} from "react-icons/hi";

type SubscriptionFeature = {
  key: string;
  limit: number;
  used: number;
};

type BrandData = {
  name: string;
  email: string;
  phone: string;            // local / national number (no +code)
  country: string;
  countryId: string;
  callingId: string;
  callingCode?: string;     // "+91" etc
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

// Utility: format calling code + phone nicely for display
function formatPhoneDisplay(code?: string, num?: string) {
  const c = (code || "").trim();
  const n = (num || "").trim();
  if (!c && !n) return "—";
  // Avoid double + if phone already has code
  if (n.startsWith("+")) return n;
  return `${c ? c : ""}${c && n ? " " : ""}${n}`;
}

// Normalize API payload to expected shape
function normalizeBrand(data: any): BrandData {
  const s = data?.subscription ?? {};
  return {
    name: data?.name ?? "",
    email: data?.email ?? "",
    phone: data?.phone ?? "",
    country: data?.country ?? "",
    countryId: data?.countryId ?? "",
    callingId: data?.callingId ?? "",
    callingCode: data?.callingcode ?? data?.callingCode ?? "", // accept either
    brandId: data?.brandId ?? "",
    createdAt: data?.createdAt ?? "",
    updatedAt: data?.updatedAt ?? "",
    subscription: {
      planName: s?.planName ?? data?.planName ?? "",
      startedAt: s?.startedAt ?? data?.startedAt ?? "",
      expiresAt: s?.expiresAt ?? data?.expiresAt ?? "",
      features: Array.isArray(s?.features)
        ? s.features
        : Array.isArray(data?.features)
          ? data.features
          : [],
    },
    subscriptionExpired: !!data?.subscriptionExpired,
    walletBalance: Number.isFinite(+data?.walletBalance) ? +data.walletBalance : 0,
  };
}

export default function BrandProfilePage() {
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [form, setForm] = useState<BrandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const brandId = localStorage.getItem("brandId");
    if (!brandId) {
      setError("Missing brandId in localStorage.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await get<any>(`/brand?id=${brandId}`);
        const normalized = normalizeBrand(data);
        setBrand(normalized);
        setForm(structuredClone(normalized));
      } catch (e: any) {
        console.error(e);
        setError(e?.message || "Failed to load brand profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onField = <K extends keyof BrandData>(key: K, value: BrandData[K]) => {
    if (!form) return;
    setForm({ ...form, [key]: value });
  };

  const onSubField = <K extends keyof BrandData["subscription"]>(
    key: K,
    value: BrandData["subscription"][K]
  ) => {
    if (!form) return;
    setForm({
      ...form,
      subscription: { ...form.subscription, [key]: value },
    });
  };

  const addFeature = () => {
    if (!form) return;
    const features = form.subscription?.features ?? [];
    const next: SubscriptionFeature = { key: "", limit: 0, used: 0 };
    onSubField("features", [...features, next]);
  };

  const updateFeature = (idx: number, patch: Partial<SubscriptionFeature>) => {
    if (!form) return;
    const features = [...(form.subscription?.features ?? [])];
    features[idx] = { ...features[idx], ...patch };
    onSubField("features", features);
  };

  const removeFeature = (idx: number) => {
    if (!form) return;
    const features = [...(form.subscription?.features ?? [])];
    features.splice(idx, 1);
    onSubField("features", features);
  };

  const resetEdits = () => {
    setForm(brand ? structuredClone(brand) : null);
    setIsEditing(false);
  };

  const saveProfile = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        brandId: form.brandId,
        // Ensure backend receives its original key
        callingcode: form.callingCode ?? "",
      };
      const updatedRaw = await post<any>("/brand/update", payload);
      const updated = normalizeBrand(updatedRaw);
      setBrand(updated);
      setForm(structuredClone(updated));
      setIsEditing(false);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  // Fallbacks to render subscription fields even if API sometimes sends them top-level
  const sub = useMemo(() => {
    const sForm = form?.subscription ?? ({} as BrandData["subscription"]);
    const sBrand = brand?.subscription ?? ({} as BrandData["subscription"]);
    const formAny = form as any;
    const brandAny = brand as any;
    return {
      form: {
        planName: sForm?.planName ?? formAny?.planName ?? "",
        startedAt: sForm?.startedAt ?? formAny?.startedAt ?? "",
        expiresAt: sForm?.expiresAt ?? formAny?.expiresAt ?? "",
      },
      read: {
        planName: sBrand?.planName ?? brandAny?.planName ?? "",
        startedAt: sBrand?.startedAt ?? brandAny?.startedAt ?? "",
        expiresAt: sBrand?.expiresAt ?? brandAny?.expiresAt ?? "",
      },
    };
  }, [form, brand]);

  const featureList = useMemo(() => {
    const fromForm = form?.subscription?.features;
    const fromBrand = brand?.subscription?.features;
    if (isEditing) return Array.isArray(fromForm) ? fromForm : [];
    return Array.isArray(fromBrand) ? fromBrand : [];
  }, [isEditing, form?.subscription?.features, brand?.subscription?.features]);

  if (loading) return <Loader />;
  if (error) return <Error message={error} />;

  function formatISODate(dateStr: string): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  function capitalizeFirst(value: string) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  return (
    <section className="min-h-screen py-12">
      <div className="max-w-5xl mx-auto bg-white p-8 rounded-xl shadow-md">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-800">Brand Profile</h2>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white px-4 py-2 rounded-lg shadow hover:bg-pink-600 transition"
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

            {/* Contact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email */}
              <IconField
                icon={HiMail}
                label="Email"
                value={form?.email ?? ""}
                readValue={brand?.email ?? ""}
                editing={isEditing}
                onChange={(v) => onField("email", v as any)}
              />

              {/* Phone (calling code + number) */}
              <PhoneField
                valueNumber={form?.phone ?? ""}
                readValueNumber={brand?.phone ?? ""}
                code={form?.callingCode || brand?.callingCode || ""}
                editing={isEditing}
                onNumberChange={(v) => onField("phone", v as any)}
              />

              {/* Country */}
              <IconField
                icon={HiGlobe}
                label="Country"
                value={form?.country ?? ""}
                readValue={brand?.country ?? ""}
                editing={isEditing}
                onChange={(v) => onField("country", v as any)}
              />
            </div>
          </div>

          {/* (Right-side Wallet/Expiry summary removed) */}
        </div>

        {/* Subscription Block */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Subscription</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Field
              label="Plan Name"
              value={capitalizeFirst(sub.form.planName)}
              readValue={capitalizeFirst(sub.read.planName)}
              editing={isEditing}
              onChange={(v) => onSubField("planName", v as any)}
            />
            <Field
              label="Started At"
              value={isEditing ? (form?.subscription?.startedAt ?? "") : formatISODate(sub.form.startedAt)}
              readValue={formatISODate(sub.read.startedAt)}
              editing={isEditing}
              onChange={(v) => onSubField("startedAt", v as any)}
              placeholder="YYYY-MM-DD"
            />
            <Field
              label="Expires At"
              value={sub.form.expiresAt}
              readValue={sub.read.expiresAt}
              editing={isEditing}
              onChange={(v) => onSubField("expiresAt", v as any)}
              placeholder="ISO string"
            />
          </div>

          {/* Features */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-700">Features</h4>
              {isEditing && (
                <button
                  onClick={addFeature}
                  className="flex items-center px-3 py-2 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white rounded-md hover:opacity-90 transition cursor-pointer"
                >
                  <HiPlus className="mr-1" /> Add Feature
                </button>
              )}
            </div>

            <div className="space-y-3">
              {/* Edit mode */}
              {isEditing &&
                featureList.map((feat, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 gap-3 items-center bg-gray-50 p-3 rounded-lg"
                  >
                    <div className="col-span-6">
                      <SmallField
                        label="Key"
                        value={feat.key}
                        editing={true}
                        onChange={(v) => updateFeature(idx, { key: v })}
                        placeholder="e.g., influencer_search_quota"
                      />
                    </div>
                    <div className="col-span-3">
                      <SmallField
                        label="Limit"
                        type="number"
                        value={String(feat.limit)}
                        editing={true}
                        onChange={(v) =>
                          updateFeature(idx, { limit: Number.isNaN(+v) ? 0 : +v })
                        }
                      />
                    </div>
                    <div className="col-span-3">
                      <SmallField
                        label="Used"
                        type="number"
                        value={String(feat.used)}
                        editing={true}
                        onChange={(v) =>
                          updateFeature(idx, { used: Number.isNaN(+v) ? 0 : +v })
                        }
                      />
                    </div>
                    <div className="col-span-12 flex justify-end">
                      <button
                        onClick={() => removeFeature(idx)}
                        className="flex items-center px-3 py-2 bg-red-500 text-white rounded-md hover:opacity-90 transition"
                      >
                        <HiTrash className="mr-1" /> Remove
                      </button>
                    </div>
                  </div>
                ))}

              {/* Read mode */}
              {!isEditing &&
                (featureList.length > 0 ? (
                  <div className="space-y-2">
                    {featureList.map((feat, i) => {
                      const pct =
                        feat.limit > 0 ? Math.min(100, (feat.used / feat.limit) * 100) : 0;
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-sm">
                            <span className="capitalize text-gray-700">
                              {feat.key.replace(/_/g, " ")}
                            </span>
                            <span className="text-gray-600">
                              {feat.used}/{feat.limit}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-[#ef2f5b] h-2 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No features configured.</p>
                ))}
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
                disabled={saving}
              >
                <HiCheck className="mr-1" /> {saving ? "Saving…" : "Save Changes"}
              </button>
            </>
          ) : (
            <>
              <button className="px-4 py-2 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white rounded-lg hover:bg-blue-600 transition">
                Upgrade Subscription
              </button>
              <button className="px-4 py-2 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white rounded-lg hover:bg-pink-600 transition">
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
        <input
          className={`w-full text-gray-700 font-medium border-b-2 border-[#ef2f5b] focus:outline-none ${large ? "text-2xl font-bold" : ""
            }`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
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
            <input
              className="w-full text-gray-700 font-medium border-b-2 border-[#ef2f5b] focus:outline-none bg-transparent"
              value={value}
              onChange={(e) => onChange(e.target.value)}
            />
          </div>
        ) : (
          <p className="text-gray-700 font-medium">{readValue || "—"}</p>
        )}
      </div>
    </div>
  );
}

/** Phone field that always shows "+code number" in read mode */
function PhoneField({
  valueNumber,
  readValueNumber,
  code,
  editing,
  onNumberChange,
}: {
  valueNumber: string;
  readValueNumber: string;
  code?: string;
  editing: boolean;
  onNumberChange: (v: string) => void;
}) {
  const readText = formatPhoneDisplay(code, readValueNumber);
  return (
    <div className="flex items-center bg-gray-50 p-4 rounded-lg">
      <HiPhone className="text-gray-500 mr-3" />
      <div className="flex-1">
        <p className="text-sm text-gray-500">Phone</p>
        {editing ? (
          <div className="flex items-center gap-2">
            {code ? (
              <span className="px-2 py-1 rounded bg-gray-200 text-gray-700 text-sm select-none">
                {code}
              </span>
            ) : null}
            <input
              className="w-full text-gray-700 font-medium border-b-2 border-[#ef2f5b] focus:outline-none bg-transparent"
              value={valueNumber}
              onChange={(e) => onNumberChange(e.target.value)}
              placeholder="Phone number"
            />
          </div>
        ) : (
          <p className="text-gray-700 font-medium">{readText}</p>
        )}
      </div>
    </div>
  );
}

function SmallField({
  label,
  value,
  onChange,
  editing,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editing: boolean;
  type?: "text" | "number";
  placeholder?: string;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {editing ? (
        <input
          type={type}
          className="w-full text-sm text-gray-700 font-medium border-b-2 border-[#ef2f5b] focus:outline-none bg-transparent"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <p className="text-sm text-gray-800">{value || "—"}</p>
      )}
    </div>
  );
}
