"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { get, post } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
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
import CheckoutAutoStart from "../../../../components/common/CheckoutAutoStart";

/** =========================
 * Types
 * ========================= */

type BillingCycle = "monthly" | "annual";
type PaymentStatus = "idle" | "processing" | "success" | "failed";

type FeatureValue =
  | number
  | boolean
  | string
  | string[]
  | Record<string, any>
  | null
  | undefined;

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
  planId: string;
  name: string;
  displayName?: string;

  monthlyCost: number;
  annualCost?: number; // ✅ annual total (12 months)
  annualBillingNote?: string;

  currency?: string;
  features: Feature[];
  label?: string;
  addons?: Addon[];
  overview?: string;

  autoRenew?: boolean;
  isCustomPricing?: boolean;
  isStartingAt?: boolean;

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

/** =========================
 * UI constants
 * ========================= */

const ICON = { base: 20, hero: 32 } as const;
const iconClass = "shrink-0";

/** =========================
 * Helpers
 * ========================= */

const STRIPE_HANDLED_KEY = "stripe_influencer_handled_session";

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const prettifyKey = (key: string) => key.split("_").map(capitalize).join(" ");
const currencySym = (c?: string) => (c === "INR" ? "₹" : c === "EUR" ? "€" : "$");

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

const isUnlimited = (k: string, v: FeatureValue) =>
  v === Infinity ||
  (typeof v === "number" && v === 0 && ZERO_IS_UNLIMITED.has(k)) ||
  (BOOLEAN_KEYS.has(k) && TRUE_MEANS_UNLIMITED.has(k) && Boolean(v));

const formatValue = (key: string, value: FeatureValue): string => {
  if (isUnlimited(key, value)) return "Unlimited";

  const enumMap = ENUM_PRETTY[key];
  if (enumMap) {
    const pretty = enumMap[String(value)];
    if (pretty) return pretty;
  }

  if (key === "support_channels" && Array.isArray(value)) {
    return value.length
      ? value.map((s) => SUPPORT_PRETTY[String(s).toLowerCase()] ?? String(s)).join(" + ")
      : "—";
  }

  if (key === "team_manager_tools_managed_creators" && value && typeof value === "object" && !Array.isArray(value)) {
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

const isPositive = (key: string, v: FeatureValue) => {
  if (isUnlimited(key, v)) return true;
  if (BOOLEAN_KEYS.has(key)) return Boolean(v);
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object" && v) return true;
  return Boolean(v);
};

/** Feature order */
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

/** Annual helpers */
const getAnnualTotal = (plan: Plan) => {
  if (typeof plan.annualCost === "number" && plan.annualCost > 0) return plan.annualCost;
  if (!plan.isCustomPricing && plan.monthlyCost > 0) return plan.monthlyCost * 12;
  return 0;
};

const calcSavings = (plan: Plan) => {
  if (plan.isCustomPricing) return null;
  if (!(plan.monthlyCost > 0)) return null;

  const annualTotal = getAnnualTotal(plan);
  const monthlyTotal = plan.monthlyCost * 12;

  if (!(annualTotal > 0) || !(annualTotal < monthlyTotal)) return null;

  const amount = monthlyTotal - annualTotal;
  const pct = Math.round((amount / monthlyTotal) * 100);
  return { amount, pct };
};

/** =========================
 * Component
 * ========================= */

export default function InfluencerSubscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [billing, setBilling] = useState<BillingCycle>("monthly");

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

  /** Remove Stripe query params instantly (prevents reload/loop) */
  const stripStripeParamsFromUrl = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("stripe_success");
    url.searchParams.delete("stripe_cancel");
    url.searchParams.delete("session_id");
    window.history.replaceState({}, "", url.toString());
  }, []);

  /** ✅ Handle Stripe redirect back (success/cancel) */
  useEffect(() => {
    const stripeSuccess = searchParams.get("stripe_success");
    const stripeCancel = searchParams.get("stripe_cancel");
    const sessionId = searchParams.get("session_id");

    if (stripeCancel) {
      stripStripeParamsFromUrl();
      setPaymentStatus("failed");
      setPaymentMessage("Payment cancelled.");
      return;
    }

    if (stripeSuccess && sessionId) {
      if (typeof window !== "undefined") {
        const handled = sessionStorage.getItem(STRIPE_HANDLED_KEY);
        if (handled === sessionId) {
          stripStripeParamsFromUrl();
          return;
        }
        sessionStorage.setItem(STRIPE_HANDLED_KEY, sessionId);
      }

      stripStripeParamsFromUrl();

      (async () => {
        setPaymentStatus("processing");
        setPaymentMessage("Verifying payment…");

        try {
          const verifyResp = await post<{
            success: boolean;
            message?: string;
            planId?: string;
            planName?: string;
          }>("/payment/verify", { sessionId });

          if (!verifyResp?.success) throw new Error(verifyResp?.message || "Payment not verified.");

          const influencerId = localStorage.getItem("influencerId");
          const planId = verifyResp.planId || localStorage.getItem("pendingInfluencerPlanId") || "";
          const planName = verifyResp.planName || localStorage.getItem("pendingInfluencerPlanName") || "";

          if (!influencerId || !planId) throw new Error("Missing influencerId/planId for subscription assignment.");

          await post("/subscription/assign", {
            userType: "Influencer",
            userId: influencerId,
            planId,
          });

          setCurrentPlan(planName || null);
          setExpiresAt(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

          localStorage.setItem("influencerPlanId", planId);
          if (planName) localStorage.setItem("influencerPlanName", planName);

          localStorage.removeItem("pendingInfluencerPlanId");
          localStorage.removeItem("pendingInfluencerPlanName");
          localStorage.removeItem("pendingInfluencerBillingCycle");

          setPaymentStatus("success");
          setPaymentMessage("Subscription updated successfully!");
          setProcessing(null);
          router.refresh?.();
        } catch (e: any) {
          console.error(e);
          setPaymentStatus("failed");
          setPaymentMessage(e?.message || "Payment verification failed. Please contact support.");
          setProcessing(null);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, stripStripeParamsFromUrl]);

  /** Load plans + current influencer */
  useEffect(() => {
    (async () => {
      try {
        const { plans: fetched } = await post<{ plans: Plan[] }>("/subscription/list", { role: "Influencer" });

        // optional ranking for stability
        const rank = (n: string) =>
          ({ free: 0, creator_plus: 2, creator_pro: 3, agency: 9 } as any)[n.toLowerCase()] ?? 5;

        const sorted = (fetched || [])
          .slice()
          .sort(
            (a, b) =>
              (a.sortOrder ?? 999) - (b.sortOrder ?? 999) ||
              rank(a.name) - rank(b.name) ||
              (a.monthlyCost ?? 0) - (b.monthlyCost ?? 0)
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

  const maxSavingsPct = useMemo(() => {
    const pcts = plans
      .map((p) => calcSavings(p)?.pct)
      .filter((v): v is number => typeof v === "number" && v > 0);
    return pcts.length ? Math.max(...pcts) : 0;
  }, [plans]);

  /** Diff preview for downgrade */
  const featureLoss = useMemo(() => {
    if (!currentPlanObj || !selectedPlan) return [] as { key: string; from: any; to: any }[];

    const mapNew = new Map(selectedPlan.features.map((f) => [f.key, f.value]));
    const union = Array.from(
      new Set([
        ...currentPlanObj.features.map((f) => f.key),
        ...selectedPlan.features.map((f) => f.key),
      ])
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

  const getPayAmount = useCallback(
    (plan: Plan) => {
      if (billing === "annual") return getAnnualTotal(plan) || plan.monthlyCost * 12;
      return plan.monthlyCost;
    },
    [billing]
  );

  /** Stripe checkout (paid plans) + downgrade modal (free plan) */
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
      setPaymentMessage(billing === "annual" ? "Redirecting to annual checkout…" : "Redirecting to secure checkout…");

      try {
        const influencerId = localStorage.getItem("influencerId");
        if (!influencerId) throw new Error("Missing influencerId.");

        localStorage.setItem("pendingInfluencerPlanId", plan.planId);
        localStorage.setItem("pendingInfluencerPlanName", plan.name);
        localStorage.setItem("pendingInfluencerBillingCycle", billing);

        const amount = getPayAmount(plan);

        const resp = await post<{
          success: boolean;
          url?: string;
          sessionId?: string;
          message?: string;
        }>("/payment/Order", {
          planId: plan.planId,
          amount, // ✅ monthly or annual based on toggle
          currency: plan.currency || "USD",
          userId: influencerId,
          role: "Influencer",
          billingCycle: billing, // ✅ backend can use or ignore
        });

        if (!resp?.success || !resp?.url) throw new Error(resp?.message || "Failed to start checkout.");
        window.location.href = resp.url;
      } catch (err: any) {
        console.error("Stripe checkout start failed:", err);
        setPaymentStatus("failed");
        setPaymentMessage(err?.message || "Failed to initiate payment. Try again later.");
        setProcessing(null);
      }
    },
    [processing, currentPlanKey, billing, getPayAmount]
  );

  const handleConfirmDowngrade = useCallback(async () => {
    if (!selectedPlan) return;
    if (confirmText.trim().toUpperCase() !== "CANCEL") return;

    setConfirming(true);
    setPaymentStatus("processing");
    setPaymentMessage("");

    try {
      const influencerId = localStorage.getItem("influencerId");
      await post("/subscription/assign", {
        userType: "Influencer",
        userId: influencerId,
        planId: selectedPlan.planId,
      });

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
    <>
      <CheckoutAutoStart role="Influencer" plans={plans} loading={loading} />

      <div className="min-h-screen py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Crown size={ICON.hero} className={`${iconClass} text-orange-500`} />
              <h1 className="text-4xl lg:text-5xl font-bold text-gray-900">Influencer Subscription Plans</h1>
            </div>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Unlock more campaign access and showcase a richer media-kit.
            </p>

            {/* Billing toggle (NEW) */}
            <div className="mt-6 flex items-center justify-center gap-2">
              <div className="inline-flex bg-gray-200 rounded-2xl p-1">
                <button
                  onClick={() => setBilling("monthly")}
                  aria-pressed={billing === "monthly"}
                  className={`px-6 py-2 rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400 ${billing === "monthly"
                      ? "bg-white shadow text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                    }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBilling("annual")}
                  aria-pressed={billing === "annual"}
                  className={`px-6 py-2 rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400 ${billing === "annual"
                      ? "bg-white shadow text-gray-900"
                      : "text-gray-600 hover:text-gray-900"
                    }`}
                >
                  Annual
                </button>
              </div>

              {maxSavingsPct > 0 && (
                <span className="text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-full px-3 py-1 shadow-sm">
                  Save up to {maxSavingsPct}%
                </span>
              )}
            </div>
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
                        {new Date(expiresAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
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
                className={`p-4 rounded-2xl border flex items-center justify-center gap-3 ${paymentStatus === "success"
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
                <p className="font-medium">
                  {paymentMessage || (paymentStatus === "processing" ? "Working on it…" : null)}
                </p>
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
              const annualTotal = getAnnualTotal(plan);
              const savings = calcSavings(plan);

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
                  {highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-white py-1.5 px-3 rounded-full shadow bg-gradient-to-r from-[#FFA135] to-[#FF7236]">
                        <Star size={ICON.base} className={`${iconClass} fill-current`} /> {plan.label}
                      </span>
                    </div>
                  )}

                  <div className="px-8 pt-8 pb-4 text-center">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{planTitle(plan)}</h3>

                    {plan.overview && (
                      <p className="text-sm text-gray-600 max-w-md mx-auto mb-3">{plan.overview}</p>
                    )}

                    {/* Price */}
                    <div className="flex flex-col items-center justify-center">
                      {isFree ? (
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="text-5xl font-extrabold text-gray-900">Free</span>
                          <span className="text-sm text-gray-600">(forever)</span>
                        </div>
                      ) : billing === "annual" ? (
                        <>
                          <div className="flex items-baseline justify-center gap-2">
                            <span className="text-5xl font-extrabold text-gray-900">
                              {sym}
                              {(annualTotal > 0 ? annualTotal : plan.monthlyCost * 12).toLocaleString()}
                            </span>
                            <span className="text-lg text-gray-600">/year</span>
                          </div>

                          <p className="text-sm text-gray-600 mt-1">
                            {sym}
                            {Math.round((annualTotal > 0 ? annualTotal : plan.monthlyCost * 12) / 12).toLocaleString()}{" "}
                            / month billed annually
                            {plan.annualBillingNote ? ` • ${plan.annualBillingNote}` : ""}
                          </p>

                          {savings && (
                            <p className="text-xs font-semibold text-emerald-700 mt-1">
                              Save {savings.pct}% ({sym}
                              {Math.round(savings.amount).toLocaleString()} / year)
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="flex items-baseline justify-center gap-2">
                            <span className="text-5xl font-extrabold text-gray-900">
                              {sym}
                              {Number(plan.monthlyCost).toLocaleString()}
                            </span>
                            <span className="text-xl text-gray-600">/month</span>
                          </div>

                          {plan.annualCost != null && plan.annualCost > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              Annual: {sym}
                              {Number(plan.annualCost).toLocaleString()} / year
                              {plan.annualBillingNote ? ` • ${plan.annualBillingNote}` : ""}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="px-8 pb-2">
                    <button
                      onClick={() => handleSelect(plan)}
                      disabled={isActive || isProcessing}
                      className={`w-full py-4 text-base font-semibold rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer
                      ${isActive
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200"
                          : isProcessing
                            ? "bg-yellow-100 text-yellow-700 cursor-not-allowed border border-yellow-200"
                            : "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] hover:from-[#FFCF33] hover:to-[#FFE680] text-gray-900 shadow-lg hover:shadow-xl"
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

                    {!isFree && billing === "annual" && (
                      <p className="text-[11px] text-gray-500 text-center mt-2">
                        Quotas reset monthly • Billing is annual
                      </p>
                    )}
                  </div>

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
                                      {Number(a.price).toLocaleString()}{" "}
                                      {a.type === "one_time" ? "one-time" : "/mo"}
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

          <div className="text-center mt-12">
            <p className="text-gray-600">
              Questions about our plans?{" "}
              <a
                href="mailto:support@collabglam.com"
                className="text-orange-600 hover:text-orange-700 font-medium underline"
              >
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
                  Moving to <span className="font-semibold text-gray-900">{planTitle(selectedPlan)}</span> will reduce or remove
                  some features:
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
                            <span className="font-medium">{FEATURE_LABELS[d.key] || prettifyKey(d.key)}:</span>
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
                  className={`px-6 py-3 rounded-xl font-semibold text-white transition-colors ${confirmText.trim().toUpperCase() === "CANCEL" && !confirming
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
    </>
  );
}
