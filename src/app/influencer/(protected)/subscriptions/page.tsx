"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { get, post } from "@/lib/api";
import {
  CheckCircle,
  XCircle,
  CreditCard,
  X,
  Star,
  Loader2,
  Crown,
  AlertTriangle,
  Heart,
  Mail,
  Plus,
  Info,
} from "lucide-react";

/** Types */
interface Feature {
  key: string;
  value: any;
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
  planId: string;
  name: string;
  displayName?: string;
  monthlyCost: number;
  currency?: string;
  features: Feature[];
  label?: string;
  addons?: Addon[];
  overview?: string;
  autoRenew?: boolean;
  isCustomPricing?: boolean;
  status?: string;
  durationMins?: number;
  sortOrder?: number;
}
interface InfluencerLite {
  influencerId: string;
  name: string;
  email: string;
  planId: string | null;
  planName: string | null;
  expiresAt?: string | null;
}
type PaymentStatus = "idle" | "processing" | "success" | "failed";

declare global {
  interface Window {
    Razorpay: any;
  }
}

/** Icon sizing (single source of truth) */
const ICON = {
  base: 20, // ✅ consistent everywhere
  hero: 32, // header crown only
} as const;

const iconClass = "shrink-0"; // prevents layout shift in flex rows

/** Helpers */
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const prettifyKey = (key: string) => key.split("_").map(capitalize).join(" ");
const currencySym = (c?: string) => (c === "INR" ? "₹" : c === "EUR" ? "€" : "$");

/** Pretty mappings */
const SUPPORT_PRETTY: Record<string, string> = {
  chat: "Chat support",
  email: "Email support",
  phone: "Phone support",
};
const ENUM_PRETTY: Record<string, Record<string, string>> = {
  media_kit: {
    included_standard: "Included (Standard)",
    included: "Included",
    shared_team_kit: "Shared team kit",
  },
  team_manager_tools: {
    not_available: "Not available",
    available: "Available",
    pro: "Available (Pro)",
  },
  dashboard_access: {
    basic: "Basic",
    standard: "Standard",
    advanced: "Advanced",
    team_workspace: "Team workspace",
  },
  active_collaborations_limit: {
    team_managed: "Team-managed",
  },
};

const FEATURE_LABELS: Record<string, string> = {
  apply_to_campaigns_quota: "Apply to Campaigns / month",
  active_collaborations_limit: "Active collaborations",
  media_kit: "Media-kit",
  support_channels: "Support",
  team_manager_tools: "Team manager tools",
  team_manager_tools_managed_creators: "Managed creators",
  dashboard_access: "Dashboard access",

  // Extras
  in_app_messaging: "In-app messaging",
  contract_esign_basic: "Contract e-sign (template)",
  contract_esign_download_pdf: "Download signed PDF",
  dispute_channel: "Dispute channel",
  media_kit_sections: "Media-kit sections",
  media_kit_builder: "Media-kit builder",
};

/** Semantics */
const BOOLEAN_KEYS = new Set<string>([
  "in_app_messaging",
  "contract_esign_basic",
  "contract_esign_download_pdf",
  "dispute_channel",
  "media_kit_builder",
]);
const ZERO_IS_UNLIMITED = new Set<string>(["apply_to_campaigns_quota", "active_collaborations_limit"]);
const TRUE_MEANS_UNLIMITED = new Set<string>(["in_app_messaging"]);

const isUnlimited = (k: string, v: any) =>
  v === Infinity ||
  (typeof v === "number" && v === 0 && ZERO_IS_UNLIMITED.has(k)) ||
  (BOOLEAN_KEYS.has(k) && TRUE_MEANS_UNLIMITED.has(k) && Boolean(v));

const formatValue = (key: string, value: any): string => {
  if (isUnlimited(key, value)) return "Unlimited";

  const enumMap = ENUM_PRETTY[key];
  if (enumMap) {
    const pretty = enumMap[String(value)];
    if (pretty) return pretty;
  }

  if (key === "support_channels" && Array.isArray(value)) {
    return value.length ? value.map((s) => SUPPORT_PRETTY[String(s).toLowerCase()] ?? String(s)).join(" + ") : "—";
  }

  if (key === "team_manager_tools_managed_creators" && value && typeof value === "object") {
    const { min, max } = value as { min?: number; max?: number };
    if (min != null && max != null) return `${min.toLocaleString()}–${max.toLocaleString()} creators`;
    if (min != null) return `${min.toLocaleString()}+ creators`;
    if (max != null) return `Up to ${max.toLocaleString()} creators`;
    return "—";
  }

  if (BOOLEAN_KEYS.has(key)) return Boolean(value) ? "Included" : "Not included";

  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? "Included" : "Not included";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (value == null || value === "") return "—";
  return String(value);
};

const isPositive = (key: string, v: any) => {
  if (isUnlimited(key, v)) return true;
  if (BOOLEAN_KEYS.has(key)) return Boolean(v);
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return true;
  return Boolean(v);
};

/** Feature order (defined once, not per-render) */
const FEATURE_ORDER: string[] = [
  "apply_to_campaigns_quota",
  "active_collaborations_limit",
  "media_kit",
  "support_channels",
  "team_manager_tools",
  "team_manager_tools_managed_creators",
  "dashboard_access",
  "in_app_messaging",
  "contract_esign_basic",
  "contract_esign_download_pdf",
  "dispute_channel",
  "media_kit_sections",
  "media_kit_builder",
];
const FEATURE_ORDER_SET = new Set(FEATURE_ORDER);

/** Load Razorpay SDK once */
const loadRazorpay = () =>
  new Promise<boolean>((res) => {
    if (typeof window !== "undefined" && window.Razorpay) return res(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => res(true);
    s.onerror = () => res(false);
    document.body.appendChild(s);
  });

/** UI Component */
export default function InfluencerSubscriptionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [paymentMessage, setPaymentMessage] = useState<string>("");

  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [confirming, setConfirming] = useState(false);

  const currentPlanKey = (currentPlan ?? "").toLowerCase();

  const planTitle = useCallback((p: Plan) => p.displayName || capitalize(p.name), []);

  /** Load plans + current influencer (lite) */
  useEffect(() => {
    (async () => {
      try {
        const { plans: fetched } = await post<any>("/subscription/list", { role: "Influencer" });

        const rank = (n: string) =>
          ({ free: 0, creator_plus: 2, creator_pro: 3, agency: 9 } as any)[n.toLowerCase()] ?? 5;

        const sorted = (fetched || [])
          .slice()
          .sort(
            (a: Plan, b: Plan) =>
              (a.sortOrder ?? 999) - (b.sortOrder ?? 999) ||
              rank(a.name) - rank(b.name) ||
              a.monthlyCost - b.monthlyCost
          );

        setPlans(sorted);

        const id = localStorage.getItem("influencerId");
        if (id) {
          const lite = await get<InfluencerLite>(`/influencer/lite?id=${id}`);
          setCurrentPlan(lite?.planName || null);
          setExpiresAt(lite?.expiresAt ?? null);
        }
      } catch (e) {
        console.error("Failed to fetch subscription data", e);
        setPaymentStatus("failed");
        setPaymentMessage("Unable to load subscription info.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const currentPlanObj = useMemo(
    () => plans.find((p) => p.name.toLowerCase() === currentPlanKey),
    [plans, currentPlanKey]
  );

  /** Diff preview for downgrade */
  const featureLoss = useMemo(() => {
    if (!currentPlanObj || !selectedPlan) return [] as { key: string; from: any; to: any }[];

    const mapNew = new Map(selectedPlan.features.map((f) => [f.key, f.value]));
    const union = Array.from(
      new Set([...currentPlanObj.features.map((f) => f.key), ...selectedPlan.features.map((f) => f.key)])
    );

    return union
      .map((k) => {
        const from = currentPlanObj.features.find((f) => f.key === k)?.value;
        const to = mapNew.get(k);

        const loss = (() => {
          if (isUnlimited(k, from) && !isUnlimited(k, to)) return true;
          if (BOOLEAN_KEYS.has(k)) return Boolean(from) && !Boolean(to);
          if (typeof from === "number" && typeof to === "number") return to < from;
          if (typeof from === "boolean" && typeof to === "boolean") return from && !to;
          if (Array.isArray(from) && Array.isArray(to)) return to.length < from.length;
          if ((from == null) !== (to == null)) return from != null && to == null;
          return false;
        })();

        return loss ? { key: k, from, to } : null;
      })
      .filter(Boolean) as { key: string; from: any; to: any }[];
  }, [currentPlanObj, selectedPlan]);

  /** Checkout / assignment */
  const handleSelect = useCallback(
    async (plan: Plan) => {
      if (processing || plan.name.toLowerCase() === currentPlanKey) return;

      // Free / 0 amount => downgrade flow
      if (plan.monthlyCost <= 0) {
        setSelectedPlan(plan);
        setShowDowngradeModal(true);
        setPaymentStatus("idle");
        setPaymentMessage("");
        return;
      }

      setProcessing(plan.name);
      setPaymentStatus("processing");
      setPaymentMessage("");

      const ok = await loadRazorpay();
      if (!ok) {
        setPaymentStatus("failed");
        setPaymentMessage("Payment SDK failed to load. Please check your connection.");
        setProcessing(null);
        return;
      }

      const influencerId = localStorage.getItem("influencerId");
      try {
        const orderResp = await post<any>("/payment/Order", {
          planId: plan.planId,
          amount: plan.monthlyCost,
          userId: influencerId,
          role: "Influencer",
        });

        const { id: orderId, amount, currency } = orderResp.order;

        const rzp = new window.Razorpay({
          key: "rzp_live_Rroqo7nHdOmQco",
          amount,
          currency,
          name: "CollabGlam",
          description: `${plan.displayName || capitalize(plan.name)} Plan`,
          order_id: orderId,
          handler: async (response: any) => {
            try {
              await post("/payment/verify", { ...response, planId: plan.planId, influencerId });
              await post("/subscription/assign", {
                userType: "Influencer",
                userId: influencerId,
                planId: plan.planId,
              });

              setCurrentPlan(plan.name);
              setExpiresAt(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

              localStorage.setItem("influencerPlanName", plan.name);
              localStorage.setItem("influencerPlanId", plan.planId);

              setPaymentStatus("success");
              setPaymentMessage("Subscription updated successfully!");
              // ✅ removed window.location.reload() for better UX/perf
            } catch (err) {
              console.error("Subscription assignment failed", err);
              setPaymentStatus("failed");
              setPaymentMessage("Payment verified but failed to assign subscription. Please contact support.");
            }
          },
          prefill: { name: "", email: "", contact: "" },
          theme: { color: "#FFA135" },
        });

        rzp.on("payment.failed", (resp: any) => {
          setPaymentStatus("failed");
          setPaymentMessage(`Payment Failed: ${resp.error.description}`);
        });

        rzp.open();
      } catch (err) {
        console.error("Order creation failed:", err);
        setPaymentStatus("failed");
        setPaymentMessage("Failed to initiate payment. Try again later.");
      } finally {
        setProcessing(null);
      }
    },
    [processing, currentPlanKey]
  );

  const handleConfirmDowngrade = useCallback(async () => {
    if (!selectedPlan) return;
    if (confirmText.trim().toUpperCase() !== "CANCEL") return;

    setConfirming(true);
    setPaymentStatus("processing");
    setPaymentMessage("");

    try {
      const influencerId = localStorage.getItem("influencerId");
      await post("/subscription/assign", { userType: "Influencer", userId: influencerId, planId: selectedPlan.planId });

      setCurrentPlan(selectedPlan.name);
      setExpiresAt(null);

      localStorage.setItem("influencerPlanName", selectedPlan.name);
      localStorage.setItem("influencerPlanId", selectedPlan.planId);

      setPaymentStatus("success");
      setPaymentMessage(`You've moved to the ${planTitle(selectedPlan)} plan.`);
      setShowDowngradeModal(false);
      setConfirmText("");
    } catch {
      setPaymentStatus("failed");
      setPaymentMessage("Could not change your plan right now. Please try again.");
    } finally {
      setConfirming(false);
    }
  }, [selectedPlan, confirmText, planTitle]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto">
            <Loader2 size={ICON.hero} className={`${iconClass} text-orange-500 animate-spin`} />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Loading your plans</h3>
          <p className="text-gray-600">Please wait while we fetch your subscription options…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Crown size={ICON.hero} className={`${iconClass} text-orange-500`} />
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900">Influencer Subscription Plans</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">Unlock more campaign access and showcase a richer media-kit.</p>
        </div>

        {/* Current plan pill */}
        {currentPlan && (
          <div className="max-w-2xl mx-auto mb-10">
            <div className="bg-white rounded-2xl border border-gray-200 shadow p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle size={ICON.base} className={`${iconClass} text-emerald-600`} />
                <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">Current Plan</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">
                {planTitle(currentPlanObj || ({ name: currentPlan } as Plan))}
              </h3>
              <p className="text-gray-600 mt-1">
                {expiresAt ? (
                  <>
                    Renews on{" "}
                    <span className="font-semibold">
                      {new Date(expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </span>
                  </>
                ) : (
                  "No renewal date set"
                )}
              </p>
            </div>
          </div>
        )}

        {/* Status toast */}
        {paymentStatus !== "idle" && (
          <div className="max-w-md mx-auto mb-8">
            <div
              className={`p-4 rounded-2xl border flex items-center justify-center gap-3 ${
                paymentStatus === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : paymentStatus === "processing"
                  ? "bg-orange-50 border-orange-200 text-orange-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {paymentStatus === "success" ? (
                <CheckCircle size={ICON.base} className={iconClass} />
              ) : paymentStatus === "processing" ? (
                <Loader2 size={ICON.base} className={`${iconClass} animate-spin`} />
              ) : (
                <XCircle size={ICON.base} className={iconClass} />
              )}
              <p className="font-medium">{paymentMessage || (paymentStatus === "processing" ? "Working on it…" : null)}</p>
            </div>
          </div>
        )}

        {/* Cards */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {plans.map((plan) => {
            const isActive = plan.name.toLowerCase() === currentPlanKey;
            const isProcessing = processing === plan.name;
            const isFree = plan.monthlyCost <= 0;
            const highlighted = ["best value", "popular"].includes((plan.label || "").toLowerCase());
            const sym = currencySym(plan.currency);

            const fmap = new Map(plan.features.map((f) => [f.key, f]));
            const ordered = FEATURE_ORDER.map((k) => fmap.get(k)).filter(Boolean) as Feature[];
            const leftovers = plan.features.filter((f) => !FEATURE_ORDER_SET.has(f.key));
            const features = [...ordered, ...leftovers];

            return (
              <div
                key={plan.planId}
                className={`relative bg-white rounded-3xl border shadow-sm hover:shadow-lg transition-all flex flex-col h-full
                  ${highlighted ? "border-yellow-300" : "border-yellow-200"}
                  ${isActive ? "ring-2 ring-yellow-400" : ""}`}
              >
                {/* Badge */}
                {highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-white py-1.5 px-3 rounded-full shadow bg-gradient-to-r from-[#FFA135] to-[#FF7236]">
                      <Star size={ICON.base} className={`${iconClass} fill-current`} /> {plan.label}
                    </span>
                  </div>
                )}

                {/* Header & Price */}
                <div className="px-8 pt-8 pb-4 text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{planTitle(plan)}</h3>

                  {plan.overview && <p className="text-sm text-gray-600 max-w-md mx-auto mb-3">{plan.overview}</p>}

                  <div className="flex items-baseline justify-center gap-2">
                    {isFree ? (
                      <>
                        <span className="text-5xl font-extrabold text-gray-900">Free</span>
                        <span className="text-sm text-gray-600">(forever)</span>
                      </>
                    ) : (
                      <>
                        <span className="text-5xl font-extrabold text-gray-900">
                          {sym}
                          {plan.monthlyCost}
                        </span>
                        <span className="text-xl text-gray-600">/month</span>
                      </>
                    )}
                  </div>
                  {!isFree && <p className="text-sm text-gray-600 mt-1">Billed monthly</p>}
                </div>

                {/* CTA */}
                <div className="px-8 pb-2">
                  <button
                    onClick={() => handleSelect(plan)}
                    disabled={isActive || isProcessing}
                    className={`w-full py-4 text-base font-semibold rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer
                      ${
                        isActive
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200"
                          : isProcessing
                          ? "bg-yellow-100 text-yellow-700 cursor-not-allowed border border-yellow-200"
                          : "bg-gradient-to-r from-[#FFBF00] to-[#FFBF00] hover:from-[#FFBF00] hover:to-[#FFDB58] text-white shadow-lg hover:shadow-xl"
                      }`}
                  >
                    {isActive ? (
                      <>
                        <CheckCircle size={ICON.base} className={iconClass} />
                        <span>Current Plan</span>
                      </>
                    ) : isProcessing ? (
                      <>
                        <Loader2 size={ICON.base} className={`${iconClass} animate-spin`} />
                        <span>Processing…</span>
                      </>
                    ) : (
                      <>
                        <CreditCard size={ICON.base} className={iconClass} />
                        <span>{isFree ? "Start Free" : "Choose Plan"}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Features */}
                <div className="px-8 pt-5 pb-6 flex-1">
                  <ul className="space-y-4">
                    {features.map((f) => {
                      const label = FEATURE_LABELS[f.key] || prettifyKey(f.key);
                      const val = formatValue(f.key, f.value);
                      const ok = isPositive(f.key, f.value);

                      return (
                        <li key={f.key} className="flex items-start gap-3">
                          {ok ? (
                            <CheckCircle size={ICON.base} className={`${iconClass} text-emerald-600 mt-0.5`} />
                          ) : (
                            <XCircle size={ICON.base} className={`${iconClass} text-red-500 mt-0.5`} />
                          )}
                          <div className="text-gray-700">
                            <span className="font-medium">{label}:</span>{" "}
                            <span className="font-semibold">{val}</span>
                            {f.note && (
                              <span className="ml-2 inline-flex items-center text-xs text-gray-500">
                                <Info size={ICON.base} className={`${iconClass} mr-1`} /> {f.note}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}

                    {/* Add-ons */}
                    {plan.addons && plan.addons.length > 0 && (
                      <li className="mt-2">
                        <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4">
                          <div className="flex items-center mb-2 text-orange-900 font-semibold">
                            <Plus size={ICON.base} className={`${iconClass} mr-2`} /> Available Add-ons
                          </div>
                          <ul className="space-y-2">
                            {plan.addons.map((a) => {
                              const symb = currencySym(a.currency);
                              return (
                                <li key={a.key} className="text-sm text-orange-800">
                                  <span className="font-medium">{a.name}</span>{" "}
                                  <span className="opacity-80">
                                    — {symb}
                                    {a.price} {a.type === "one_time" ? "one-time" : "/mo"}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-gray-600">
            Questions about our plans?{" "}
            <a href="mailto:support@collabglam.com" className="text-orange-600 hover:text-orange-700 font-medium underline">
              Contact our support team
            </a>
          </p>
          <p className="text-sm text-gray-500 mt-2">All plans include a 14-day money-back guarantee</p>
        </div>
      </div>

      {/* Downgrade modal */}
      {showDowngradeModal && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowDowngradeModal(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-orange-50 px-8 py-6 border-b border-orange-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-full">
                    <AlertTriangle size={ICON.base} className={`${iconClass} text-orange-600`} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Before you change your plan…</h3>
                    <p className="text-gray-600 mt-1">Some features may be reduced 😢</p>
                  </div>
                </div>
                <button onClick={() => setShowDowngradeModal(false)} className="p-2 rounded-full hover:bg-white/50">
                  <X size={ICON.base} className={`${iconClass} text-gray-500`} />
                </button>
              </div>
            </div>

            <div className="px-8 py-6 space-y-6">
              <p className="text-gray-700">
                Moving to <span className="font-semibold text-gray-900">{planTitle(selectedPlan)}</span> will reduce or remove some features:
              </p>

              {featureLoss.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <XCircle size={ICON.base} className={`${iconClass} text-red-500`} />
                    <p className="font-semibold text-red-900">You’ll lose access or limits will be reduced on:</p>
                  </div>
                  <ul className="space-y-3">
                    {featureLoss.map((d) => (
                      <li key={d.key} className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-red-400 rounded-full" />
                        <span className="text-red-800">
                          <span className="font-medium">{prettifyKey(d.key)}:</span>
                          <span className="ml-2 font-semibold">{formatValue(d.key, d.from)}</span>
                          <span className="mx-2 text-red-600">→</span>
                          <span className="font-semibold">{formatValue(d.key, d.to)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <Heart size={ICON.base} className={`${iconClass} text-orange-500 mt-0.5`} />
                  <div>
                    <p className="text-orange-900 font-medium mb-2">We’d love to keep you!</p>
                    <p className="text-orange-800 text-sm">
                      Need a custom plan, a pause, or a startup discount? Email{" "}
                      <a
                        className="inline-flex items-center gap-1 font-semibold underline hover:text-orange-900"
                        href="mailto:support@collabglam.com?subject=Plan%20change%20help"
                      >
                        <Mail size={ICON.base} className={iconClass} />
                        <span>support@collabglam.com</span>
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700 mb-2 block">
                    Type <span className="font-bold text-gray-900">CANCEL</span> to confirm
                  </span>
                  <input
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 outline-none"
                    placeholder="Type CANCEL here..."
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="bg-gray-50 px-8 py-6 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => setShowDowngradeModal(false)}
                className="px-6 py-3 rounded-xl bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-800 font-semibold"
                disabled={confirming}
              >
                Keep my current plan
              </button>
              <button
                onClick={handleConfirmDowngrade}
                disabled={confirmText.trim().toUpperCase() !== "CANCEL" || confirming}
                className={`px-6 py-3 rounded-xl font-semibold text-white transition-colors ${
                  confirmText.trim().toUpperCase() === "CANCEL" && !confirming
                    ? "bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:from-[#FF7236] hover:to-[#FFA135] shadow-lg"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                {confirming ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={ICON.base} className={`${iconClass} animate-spin`} /> Applying…
                  </span>
                ) : (
                  "Confirm change"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
