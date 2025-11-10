"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Check, X, Star, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";

type Role = "Brand" | "Influencer";

type FeatureValue = number | boolean | string | string[] | null | undefined;

interface Feature {
  key: string;
  value: FeatureValue;
  note?: string;
}

interface Addon {
  key: string;
  name: string;
  type: "one_time" | "recurring";
  price: number;
  currency?: string;
  payload?: any;
}

interface Plan {
  _id?: string;
  planId: string;
  role: Role;
  name: string;
  monthlyCost: number;
  currency?: string;
  label?: string; // e.g. "Best Value"
  features: Feature[];
  addons?: Addon[];
  // Internal - computed
  _ordered?: Feature[];
}

/** Friendly labels per key */
const LABELS: Record<string, string> = {
  // Brand
  invites_per_month: "Invites / month",
  monthly_credits: "Monthly credits",
  live_campaigns_limit: "Live campaigns",
  search_cached_only: "Search mode (cached)",
  search_fresh_uses_credits: "Fresh search uses credits",
  view_full_profiles_uses_credits: "Full profile uses credits",
  in_app_messaging: "In‑app messaging",
  milestones_access: "Milestones",
  contracts_access: "Contracts",
  dispute_support: "Dispute support",
  profile_preview_only: "Profile preview only",

  // Influencer
  apply_to_campaigns_quota: "Campaign applications / month",
  media_kit_items_limit: "Media‑kit items",
  saved_searches: "Saved searches",
  connect_instagram: "Connect Instagram",
  connect_youtube: "Connect YouTube",
  connect_tiktok: "Connect TikTok",
  contract_esign_basic: "Contract e‑sign (template)",
  contract_esign_download_pdf: "Download signed PDF",
  dispute_channel: "Dispute channel",
  media_kit_sections: "Media‑kit sections",
  media_kit_builder: "Media‑kit builder",
};

/** Curated display order per role */
const ORDER_BY_ROLE: Record<Role, string[]> = {
  Brand: [
    "invites_per_month",
    "live_campaigns_limit",
    "monthly_credits",
    "search_cached_only",
    "search_fresh_uses_credits",
    "view_full_profiles_uses_credits",
    "milestones_access",
    "contracts_access",
    "in_app_messaging",
    "dispute_support",
    "profile_preview_only",
  ],
  Influencer: [
    "apply_to_campaigns_quota",
    "media_kit_items_limit",
    "saved_searches",
    "connect_instagram",
    "connect_youtube",
    "connect_tiktok",
    "contract_esign_download_pdf",
    "in_app_messaging",
    "dispute_channel",
    "media_kit_sections",
    "media_kit_builder",
  ],
};

/** Keys where 0 means "Unlimited" */
const ZERO_IS_UNLIMITED = new Set<string>(["apply_to_campaigns_quota", "live_campaigns_limit"]);

/** Keys that are boolean (0/1) even if numeric is sent */
const BOOLEAN_KEYS = new Set<string>([
  "search_cached_only",
  "search_fresh_uses_credits",
  "view_full_profiles_uses_credits",
  "in_app_messaging",
  "milestones_access",
  "contracts_access",
  "dispute_support",
  "connect_instagram",
  "connect_youtube",
  "connect_tiktok",
  "contract_esign_basic",
  "contract_esign_download_pdf",
  "dispute_channel",
  "profile_preview_only",
  "saved_searches", // in V1: presence toggle (no per‑plan cap yet)
  "media_kit_builder",
]);

/** When a boolean is true, display "Unlimited" instead of "Yes" */
const TRUE_MEANS_UNLIMITED = new Set<string>([
  "in_app_messaging", // messaging is not metered in V1
]);

/** Format helpers */
const isUnlimited = (key: string, v: FeatureValue) =>
  v === Infinity || (typeof v === "number" && v === 0 && ZERO_IS_UNLIMITED.has(key));

const formatValue = (key: string, v: FeatureValue): string => {
  // 1) Explicit unlimited (0 for certain count keys)
  if (isUnlimited(key, v)) return "Unlimited";

  // 2) Booleans (including numeric 0/1)
  if (BOOLEAN_KEYS.has(key)) {
    const on = Boolean(v);
    if (on && TRUE_MEANS_UNLIMITED.has(key)) return "Unlimited";
    return on ? "Yes" : "No";
  }

  // 3) Lists
  if (Array.isArray(v)) return v.length ? v.join(", ") : "None";

  // 4) Nullish / empty string
  if (v === null || v === undefined || v === "") return "—";

  // 5) Numbers (counts)
  if (typeof v === "number") return v.toLocaleString();

  // 6) Fallback to string
  return String(v);
};

/** Used to color the check/cross icon */
const isPositive = (key: string, v: FeatureValue): boolean => {
  if (isUnlimited(key, v)) return true;
  if (BOOLEAN_KEYS.has(key)) return Boolean(v);
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v);
};

const currencySymbol = (c?: string) => (c === "INR" ? "₹" : c === "EUR" ? "€" : "$ ");

const Pricing: React.FC = () => {
  const router = useRouter();
  const roles: Role[] = ["Brand", "Influencer"];
  const [activeRole, setActiveRole] = useState<Role>("Brand");

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // fetch plans whenever role changes
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await post<{ message: string; plans: Plan[] }>("/subscription/list", {
          role: activeRole,
        });
        setPlans(res.plans || []);
      } catch (e) {
        console.error(e);
        setError("Failed to load plans. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [activeRole]);

  // display order + append any unrecognized keys at end
  const orderedPlans = useMemo(() => {
    const ORDER = ORDER_BY_ROLE[activeRole];
    return plans.map((p) => {
      const known = ORDER.map((k) => p.features.find((f) => f.key === k)).filter(
        (f): f is Feature => Boolean(f)
      );
      const remaining = p.features.filter((f) => !ORDER.includes(f.key));
      return { ...p, _ordered: [...known, ...remaining] as Feature[] };
    });
  }, [plans, activeRole]);

  return (
    <section id="pricing" className="py-20 bg-gray-50 font-lexend">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">{activeRole} Plans</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Simple, transparent pricing. Start free, upgrade as you grow.
          </p>

          {/* Role Switcher */}
          <div className="inline-flex mt-8 bg-gray-200 rounded-lg p-1">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  activeRole === role ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {role}s
              </button>
            ))}
          </div>
        </div>

        {/* Loading / Error */}
        {loading && (
          <div className="grid lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-3xl shadow-lg animate-pulse p-8 flex flex-col h-full">
                <div className="h-6 bg-gray-300 rounded mb-4 w-1/2" />
                <div className="h-4 bg-gray-300 rounded mb-6 w-1/3" />
                <div className="h-12 bg-gray-300 rounded mb-6 w-full" />
                <div className="flex-1 space-y-4 mb-8">
                  {[...Array(5)].map((__, idx) => (
                    <div key={idx} className="h-4 bg-gray-300 rounded w-full" />
                  ))}
                </div>
                <div className="h-10 bg-gray-300 rounded w-full" />
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-center text-red-600">{error}</p>}

        {/* Plans grid */}
        <div className="grid lg:grid-cols-4 gap-8 max-w-8xl mx-auto">
          {!loading &&
            orderedPlans.map((plan) => {
              const id = plan._id || plan.planId;
              const isFree = plan.monthlyCost <= 0;
              const sym = currencySymbol(plan.currency);

              return (
                <div
                  key={id}
                  className="relative bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col h-full"
                >
                  {/* Badge (label) */}
                  {/* {plan.label && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <div className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white text-xs font-bold py-2 px-4 rounded-full shadow-lg flex items-center space-x-1">
                        <Star className="w-3 h-3 fill-current" />
                        <span>{plan.label}</span>
                      </div>
                    </div>
                  )} */}

                  <div className="p-8 flex-1 flex flex-col">
                    {/* Header */}
                    <h3 className="text-2xl font-bold text-gray-900 mb-2 text-center">
                      {plan.name.charAt(0).toUpperCase() + plan.name.slice(1)}
                    </h3>
                    <p className="text-gray-600 mb-6 text-center">{isFree ? "Forever free" : "Paid plan"}</p>

                    {/* Price */}
                    <div className="mb-6 text-center">
                      {isFree ? (
                        <span className="text-4xl font-bold text-gray-900 justify-center text-center">Free</span>
                      ) : (
                        <div className="flex items-baseline justify-center">
                          <span className="text-5xl font-bold text-gray-900 text-center">
                            {sym}
                            {plan.monthlyCost}
                          </span>
                          <span className="text-gray-600 ml-2">/month</span>
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <div className="space-y-4 mb-8">
                      {(plan as any)._ordered.map(({ key, value, note }: Feature) => {
                        const display = formatValue(key, value);
                        const positive = isPositive(key, value);
                        const Icon = positive ? Check : X;
                        const iconColor = positive ? "text-green-500" : "text-red-500";
                        const label =
                          LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

                        return (
                          <div key={key} className="flex items-start">
                            <Icon className={`h-5 w-5 ${iconColor} mr-2 mt-0.5 flex-shrink-0`} />
                            <span className="text-gray-700">
                              {label}: <strong>{display}</strong>
                              {note && <span className="ml-2 text-xs text-gray-500 align-middle">({note})</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add-ons (if present, e.g., Discovery Pack) */}
                    {plan.addons && plan.addons.length > 0 && (
                      <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50/50 p-4">
                        <div className="flex items-center mb-2 text-orange-900 font-semibold">
                          <Plus className="w-4 h-4 mr-2" />
                          Available Add‑ons
                        </div>
                        <ul className="space-y-2">
                          {plan.addons.map((a) => (
                            <li key={a.key} className="text-sm text-orange-800">
                              <span className="font-medium">{a.name}</span>{" "}
                              <span className="opacity-80">
                                — {currencySymbol(a.currency)}
                                {a.price} {a.type === "one_time" ? "one-time" : "/mo"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action */}
                    <div className="mt-auto">
                      <button
                        className="
                          w-full py-4 px-6
                          bg-gradient-to-r from-[#FFA135] to-[#FF7236]
                          text-white font-bold text-lg
                          rounded-lg
                          transition-all duration-200 transform
                          shadow-lg cursor-pointer
                          hover:bg-gradient-to-r hover:from-[#FF8C1A] hover:to-[#FF5C1E]
                          hover:scale-105
                        "
                        onClick={() => router.push("/login")}
                      >
                        {isFree ? "Start Free" : "Choose Plan"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footnote */}
        <p className="text-center text-gray-500 text-sm mt-12">
          All paid plans include a 7‑day Money‑Back Guarantee • No setup fees • Cancel any time
        </p>
      </div>
    </section>
  );
};

export default Pricing;
