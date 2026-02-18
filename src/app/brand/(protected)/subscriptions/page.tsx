"use client";

import React, { useEffect, useMemo, useState } from "react";
import { get, post } from "@/lib/api";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle,
  XCircle,
  CreditCard,
  Check,
  X,
  Star,
  Loader2,
  Crown,
  AlertTriangle,
  Heart,
  Mail,
  Plus,
} from "lucide-react";
import CheckoutAutoStart from "@/components/common/CheckoutAutoStart";

/** =========================
 * Types
 * ========================= */

type BillingCycle = "monthly" | "annual";

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
  _id?: string;
  planId: string;
  role: "Brand";
  name: string;
  displayName?: string;
  label?: string;
  overview?: string;

  monthlyCost: number;
  annualCost?: number; // annual total (12 months)
  currency?: string;

  isCustomPricing?: boolean;
  isStartingAt?: boolean;
  annualBillingNote?: string;

  sortOrder?: number;
  features: Feature[];
  addons?: Addon[];
  _ordered?: Feature[];
}

interface BrandData {
  name: string;
  email: string;
  subscription: { planName: string; expiresAt: string | null } | null;
}

type PaymentStatus = "idle" | "processing" | "success" | "failed";

/** =========================
 * Helpers
 * ========================= */

const STRIPE_HANDLED_KEY = "stripe_subscription_handled_session";

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const nice = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const currencySymbol = (c?: string) => (c === "INR" ? "₹" : c === "EUR" ? "€" : "$");

const LABELS: Record<string, string> = {
  // Brand (legacy + your older keys)
  searches_per_month: "Searches / month",
  profile_views_per_month: "Profile views / month",
  invites_per_month: "Influencer Invites",
  active_campaigns_limit: "Active campaigns",
  message_templates_basic_limit: "Basic message templates",
  custom_messaging: "Custom messaging",
  advanced_filters: "Advanced filters",
  dedicated_account_manager: "Dedicated account manager",
  dedicated_manager: "Dedicated manager",
  dispute_assistance: "Dispute assistance",
  support_channels: "Support",
  public_quotas_visible: "What brands see (Public Quotas)",
  setup_assistance: "Setup assistance",
  priority_verification_queue: "Priority verification queue",
  strategy_calls: "Strategy calls",
  sla_support: "SLA support",
  flexible_billing: "Flexible billing",
  contact_admin_flow: "Contact admin flow",

  // Legacy / extra
  monthly_credits: "Monthly credits",
  live_campaigns_limit: "Live campaigns",
  search_cached_only: "Search mode (cached)",
  search_fresh_uses_credits: "Fresh search uses credits",
  view_full_profiles_uses_credits: "Full profile uses credits",
  milestones_access: "Milestones",
  contracts_access: "Contracts",
  dispute_support: "Dispute support",
  profile_preview_only: "Profile preview only",

  // If you later reuse new plan keys here, it still works (fallback = nice(key))
};

const ORDER_BY_ROLE_BRAND: string[] = [
  "searches_per_month",
  "profile_views_per_month",
  "invites_per_month",
  "active_campaigns_limit",
  "custom_messaging",
  "advanced_filters",
  "support_channels",
  "dedicated_account_manager",
  "dedicated_manager",
  "dispute_assistance",
  "priority_verification_queue",
  "setup_assistance",
  "strategy_calls",
  "sla_support",
  "flexible_billing",
  "public_quotas_visible",
  "message_templates_basic_limit",
  // legacy
  "monthly_credits",
  "live_campaigns_limit",
  "search_cached_only",
  "search_fresh_uses_credits",
  "view_full_profiles_uses_credits",
  "milestones_access",
  "contracts_access",
  "dispute_support",
  "profile_preview_only",
];

const ZERO_IS_UNLIMITED = new Set<string>([
  "apply_to_campaigns_quota",
  "live_campaigns_limit",
  "active_campaigns_limit",
]);

const BOOLEAN_KEYS = new Set<string>([
  "custom_messaging",
  "advanced_filters",
  "dedicated_account_manager",
  "dedicated_manager",
  "dispute_assistance",
  "public_quotas_visible",
  "setup_assistance",
  "priority_verification_queue",
  "strategy_calls",
  "sla_support",
  "flexible_billing",
  "contact_admin_flow",
  // legacy
  "search_cached_only",
  "search_fresh_uses_credits",
  "view_full_profiles_uses_credits",
  "in_app_messaging",
  "milestones_access",
  "contracts_access",
  "dispute_support",
  "profile_preview_only",
]);

const SUPPORT_PRETTY: Record<string, string> = {
  chat: "Chat support",
  email: "Email support",
  phone: "Phone support",
};

const isUnlimited = (k: string, v: FeatureValue) =>
  v === Infinity || (typeof v === "number" && v === 0 && ZERO_IS_UNLIMITED.has(k));

const formatValue = (key: string, v: FeatureValue): string => {
  if (isUnlimited(key, v)) return "Unlimited";

  if (key === "support_channels" && Array.isArray(v)) {
    return v
      .map((s) => SUPPORT_PRETTY[String(s).toLowerCase()] ?? String(s))
      .join(" + ");
  }

  if (Array.isArray(v)) return v.length ? v.join(", ") : "None";
  if (BOOLEAN_KEYS.has(key)) return Boolean(v) ? "Yes" : "No";
  if (v == null || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
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

const isEnterpriseBrand = (p: Plan) => p.role === "Brand" && p.name?.toLowerCase() === "enterprise";
const computedLabel = (plan: Plan) => plan.label || (plan.name === "growth" ? "Popular" : undefined);

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

const stripStripeParamsFromUrl = () => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("stripe_success");
  url.searchParams.delete("stripe_cancel");
  url.searchParams.delete("session_id");
  window.history.replaceState({}, "", url.toString());
};

/** =========================
 * Component
 * ========================= */

export default function BrandSubscriptionPage() {
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

  // downgrade modal
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [submittingDowngrade, setSubmittingDowngrade] = useState(false);

  // contact-us modal
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactToast, setContactToast] = useState<{
    type: "idle" | "success" | "failed";
    message: string;
  }>({ type: "idle", message: "" });

  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  /** Stripe redirect handler */
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

          const brandId = localStorage.getItem("brandId");
          const planId = verifyResp.planId || localStorage.getItem("pendingPlanId") || "";
          if (!brandId || !planId) throw new Error("Missing brandId/planId for subscription assignment.");

          await post("/subscription/assign", {
            userType: "Brand",
            userId: brandId,
            planId,
          });

          const planName = verifyResp.planName || localStorage.getItem("pendingPlanName") || "";

          setCurrentPlan(planName || null);
          setExpiresAt(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

          localStorage.setItem("brandPlanId", planId);
          if (planName) localStorage.setItem("brandPlanName", planName);

          localStorage.removeItem("pendingPlanId");
          localStorage.removeItem("pendingPlanName");

          setPaymentStatus("success");
          setPaymentMessage("Subscription updated successfully!");
          router.refresh?.();
        } catch (e: any) {
          console.error(e);
          setPaymentStatus("failed");
          setPaymentMessage(e?.message || "Payment verification failed. Please contact support.");
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /** Load plans + current brand subscription */
  useEffect(() => {
    (async () => {
      try {
        const { plans: fetched } = await post<{ message: string; plans: Plan[] }>(
          "/subscription/list",
          { role: "Brand" }
        );

        const sorted = (fetched || [])
          .slice()
          .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

        const ORDER = ORDER_BY_ROLE_BRAND;
        const withOrdered = sorted.map((p) => {
          const known = ORDER.map((k) => p.features.find((f) => f.key === k)).filter(
            (f): f is Feature => Boolean(f)
          );
          const remaining = p.features.filter((f) => !ORDER.includes(f.key));
          return { ...p, _ordered: [...known, ...remaining] };
        });

        setPlans(withOrdered);

        const id = localStorage.getItem("brandId");
        if (id) {
          const brand = await get<BrandData>(`/brand?id=${id}`);

          setCurrentPlan(brand.subscription?.planName || null);
          setExpiresAt(brand.subscription?.expiresAt ?? null);

          setContactForm((p) => ({
            ...p,
            name: brand.name || "",
            email: brand.email || "",
          }));

          if (brand.subscription?.planName) {
            localStorage.setItem("brandPlanName", brand.subscription.planName);
          }
        }
      } catch (e) {
        console.error(e);
        setPaymentStatus("failed");
        setPaymentMessage("Unable to load subscription info. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const currentPlanObj = useMemo(
    () => plans.find((p) => p.name.toLowerCase() === currentPlan?.toLowerCase()),
    [plans, currentPlan]
  );

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

  const maxSavingsPct = useMemo(() => {
    const pcts = plans
      .map((p) => calcSavings(p)?.pct)
      .filter((v): v is number => typeof v === "number" && v > 0);
    return pcts.length ? Math.max(...pcts) : 0;
  }, [plans]);

  const handleSendContact = async (e?: React.FormEvent) => {
    e?.preventDefault();

    const name = contactForm.name.trim();
    const email = contactForm.email.trim();
    const subject = contactForm.subject.trim();
    const message = contactForm.message.trim();

    if (!name || !email || !subject || !message) {
      setContactToast({ type: "failed", message: "All fields are required." });
      return;
    }

    setContactSubmitting(true);
    setContactToast({ type: "idle", message: "" });

    try {
      await post("/contact/send", { name, email, subject, message });

      setContactToast({ type: "success", message: "Message sent successfully!" });
      setShowContactModal(false);
      setContactForm({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      console.error(err);
      setContactToast({ type: "failed", message: "Could not send message. Please try again." });
    } finally {
      setContactSubmitting(false);
    }
  };

  const openContactModal = () => {
    setContactToast({ type: "idle", message: "" });
    setContactForm((p) => ({
      ...p,
      subject: p.subject || "Enterprise plan enquiry",
      message:
        p.message || "Hi CollabGlam team, we want a custom plan for our brand. Please share details.",
    }));
    setShowContactModal(true);
  };

  const getPayAmount = (plan: Plan) => {
    if (billing === "annual") return getAnnualTotal(plan) || plan.monthlyCost * 12;
    return plan.monthlyCost;
  };

  const handleSelect = async (plan: Plan) => {
    if (processing || plan.name.toLowerCase() === currentPlan?.toLowerCase()) return;

    // Enterprise → Contact modal
    if (isEnterpriseBrand(plan) || plan.isCustomPricing) {
      openContactModal();
      return;
    }

    // Free/downgrade → downgrade modal
    if (plan.monthlyCost <= 0) {
      setSelectedPlan(plan);
      setShowDowngradeModal(true);
      setPaymentStatus("idle");
      setPaymentMessage("");
      return;
    }

    setProcessing(plan.name);
    setPaymentStatus("processing");
    setPaymentMessage("Redirecting to secure checkout…");

    try {
      const brandId = localStorage.getItem("brandId");
      if (!brandId) throw new Error("Missing brandId.");

      // pending info for after redirect
      localStorage.setItem("pendingPlanId", plan.planId);
      localStorage.setItem("pendingPlanName", plan.name);
      localStorage.setItem("pendingBillingCycle", billing);

      const amount = getPayAmount(plan);

      const resp = await post<{
        success: boolean;
        url?: string;
        sessionId?: string;
        message?: string;
      }>("/payment/Order", {
        planId: plan.planId,
        amount, // ✅ monthly or annual depending on toggle
        currency: plan.currency || "USD",
        userId: brandId,
        role: "Brand",
        billingCycle: billing, // ✅ pass through (backend can ignore safely)
      });

      if (!resp?.success || !resp?.url) throw new Error(resp?.message || "Failed to start checkout.");
      window.location.href = resp.url;
    } catch (e: any) {
      console.error(e);
      setPaymentStatus("failed");
      setPaymentMessage(e?.message || "Failed to initiate payment. Try again later.");
      setProcessing(null);
    }
  };

  const handleConfirmDowngrade = async () => {
    if (!selectedPlan) return;
    if (confirmText.trim().toUpperCase() !== "CANCEL") return;

    setSubmittingDowngrade(true);
    setPaymentStatus("processing");
    setPaymentMessage("");

    try {
      const brandId = localStorage.getItem("brandId");
      await post("/subscription/assign", {
        userType: "Brand",
        userId: brandId,
        planId: selectedPlan.planId,
      });

      setCurrentPlan(selectedPlan.name);
      setExpiresAt(null);

      localStorage.setItem("brandPlanName", selectedPlan.name);
      localStorage.setItem("brandPlanId", selectedPlan.planId);

      setPaymentStatus("success");
      setPaymentMessage(`You've moved to the ${capitalize(selectedPlan.name)} plan.`);
      setShowDowngradeModal(false);
      setConfirmText("");
    } catch {
      setPaymentStatus("failed");
      setPaymentMessage("Could not change your plan right now. Please try again.");
    } finally {
      setSubmittingDowngrade(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
        <Loader2 className="w-16 h-16 text-orange-500 animate-spin" />
        <p className="mt-4 text-gray-700">Loading your subscription…</p>
      </div>
    );
  }

  return (
    <>
      <CheckoutAutoStart role="Brand" plans={plans} loading={loading} />
      <section id="brand-subscription" className="relative py-20 font-lexend min-h-screen">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Crown className="w-8 h-8 text-orange-500" />
              <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">Brand Subscription</h2>
            </div>
            <p className="text-lg text-gray-600 mt-2">
              Simple, transparent pricing. Start free, upgrade as you grow.
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

          {/* Current plan */}
          {currentPlan && (
            <div className="max-w-2xl mx-auto mb-8">
              <div className="bg-white rounded-2xl border border-gray-200 shadow p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                    Current Plan
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {currentPlanObj?.displayName || capitalize(currentPlan)}
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

          {/* Payment status toast */}
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
                  <CheckCircle className="w-6 h-6" />
                ) : paymentStatus === "processing" ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <XCircle className="w-6 h-6" />
                )}
                <p className="font-medium">
                  {paymentMessage || (paymentStatus === "processing" ? "Working on it…" : null)}
                </p>
              </div>
            </div>
          )}

          {/* Plans grid */}
          <div className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {plans.map((plan) => {
              const id = plan._id || plan.planId;
              const isEnterprise = isEnterpriseBrand(plan) || !!plan.isCustomPricing;
              const badge = computedLabel(plan);
              const isFree = plan.monthlyCost <= 0 && !plan.isCustomPricing;
              const sym = currencySymbol(plan.currency);

              const isActive = !!currentPlan && plan.name.toLowerCase() === currentPlan.toLowerCase();
              const isProcessing = processing === plan.name;

              const badgeClasses = "bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white";
              const baseButtonClasses =
                "mt-4 w-full py-3 text-sm font-semibold rounded-md shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400";

              const borderClasses = badge ? "border-orange-300" : "border-gray-200";
              const activeClasses = isActive ? "border-orange-400 ring-2 ring-orange-300" : "";

              const annualTotal = getAnnualTotal(plan);
              const savings = calcSavings(plan);
              const showAnnual = billing === "annual" && !isFree && !isEnterprise;

              /** ENTERPRISE layout */
              if (isEnterprise) {
                return (
                  <div
                    key={id}
                    className={`group relative col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 rounded-3xl bg-white shadow-sm border ${borderClasses} ${activeClasses} lg:flex lg:items-stretch`}
                  >
                    {badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold py-1.5 px-3 rounded-full shadow ${badgeClasses}`}
                        >
                          <Star className="w-3 h-3 fill-current" /> {badge}
                        </span>
                      </div>
                    )}

                    <div className="w-full lg:w-5/12 px-8 py-10 flex flex-col justify-center gap-4">
                      <h3 className="text-3xl lg:text-4xl font-bold text-gray-900">
                        {plan.displayName || nice(plan.name)}
                      </h3>
                      <p className="text-base lg:text-lg text-gray-600">
                        {plan.overview ||
                          "The best way to run CollabGlam at scale with custom quotas, security, and billing."}
                      </p>

                      <div className="mt-4 flex items-center gap-4">
                        <button
                          onClick={() => handleSelect(plan)}
                          disabled={isActive || isProcessing}
                          className={`inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-md shadow bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:from-[#FF8C1A] hover:to-[#FF5C1E] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400 ${isActive || isProcessing ? "opacity-70 cursor-not-allowed" : ""
                            }`}
                        >
                          {isActive ? (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Current Plan
                            </>
                          ) : isProcessing ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Processing…
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4 mr-2" />
                              Contact Us
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="w-full lg:w-7/12 px-8 py-10 border-t lg:border-t-0 lg:border-l border-gray-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3">
                        {plan._ordered
                          ?.filter(({ key, value }) => isPositive(key, value))
                          .map(({ key, value, note }) => {
                            const display = formatValue(key, value);
                            const label = LABELS[key] || nice(key);

                            return (
                              <div key={key} className="flex items-start gap-2 text-sm text-gray-800">
                                <Check className="mt-0.5 h-4 w-4 text-emerald-500" />
                                <span className="leading-6">
                                  {label}
                                  {display && display !== "Yes" && display !== "Unlimited" && display !== "—" ? (
                                    <>
                                      : <strong>{display}</strong>
                                    </>
                                  ) : display === "Unlimited" ? (
                                    <>
                                      {" "}
                                      — <strong>Unlimited</strong>
                                    </>
                                  ) : null}
                                  {note && (
                                    <span className="ml-1 text-[11px] text-gray-500">({note})</span>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                );
              }

              /** NORMAL plans */
              return (
                <div
                  key={id}
                  className={`group relative flex flex-col h-full rounded-3xl bg-white shadow-sm transition-all hover:shadow-xl border ${borderClasses} ${activeClasses}`}
                >
                  {badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold py-1.5 px-3 rounded-full shadow ${badgeClasses}`}
                      >
                        <Star className="w-3 h-3 fill-current" /> {badge}
                      </span>
                    </div>
                  )}

                  <div className="px-8 pt-8 pb-6 min-h-[170px] flex flex-col">
                    <h3 className="text-2xl font-bold text-gray-900">
                      {plan.displayName || nice(plan.name)}
                    </h3>
                    <p className="text-gray-600 mt-2">
                      {plan.overview ||
                        (isFree
                          ? "Essential tools to get started with CollabGlam."
                          : "For brands growing collaborations with more credits & campaigns.")}
                    </p>
                  </div>

                  <div className="border-t border-gray-200" />

                  <div className="px-8 py-6 text-center min-h-[155px] flex flex-col items-center justify-center">
                    {isFree ? (
                      <span className="text-4xl font-extrabold tracking-tight text-gray-900">Free</span>
                    ) : billing === "annual" ? (
                      <>
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="text-4xl font-extrabold tracking-tight text-gray-900">
                            {sym}
                            {(annualTotal > 0 ? annualTotal : plan.monthlyCost * 12).toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-500">/year</span>
                        </div>

                        <div className="mt-1 text-xs text-gray-500">
                          {sym}
                          {Math.round((annualTotal > 0 ? annualTotal : plan.monthlyCost * 12) / 12).toLocaleString()}{" "}
                          / month billed annually
                          {plan.annualBillingNote ? ` • ${plan.annualBillingNote}` : ""}
                        </div>

                        {savings && (
                          <div className="mt-1 text-xs font-semibold text-emerald-700">
                            Save {savings.pct}% ({sym}
                            {Math.round(savings.amount).toLocaleString()} / year)
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="text-4xl font-extrabold tracking-tight text-gray-900">
                            {sym}
                            {plan.monthlyCost.toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-500">/month</span>
                        </div>

                        {plan.annualCost != null && plan.annualCost > 0 && (
                          <div className="mt-1 text-xs text-gray-500">
                            Annual: {sym}
                            {Number(plan.annualCost).toLocaleString()} / year
                            {plan.annualBillingNote ? ` • ${plan.annualBillingNote}` : ""}
                          </div>
                        )}
                      </>
                    )}

                    <button
                      onClick={() => handleSelect(plan)}
                      disabled={isActive || isProcessing}
                      className={`${baseButtonClasses} ${isActive || isProcessing
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200"
                          : "bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:from-[#FF8C1A] hover:to-[#FF5C1E] text-white"
                        }`}
                    >
                      {isActive ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Current Plan
                        </span>
                      ) : isProcessing ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing…
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          {isFree ? "Choose Free" : "Choose Plan"}
                        </span>
                      )}
                    </button>
                  </div>

                  <ul className="px-8 pb-8 space-y-3 mb-auto">
                    {plan._ordered?.map(({ key, value, note }) => {
                      const display = formatValue(key, value);
                      const ok = isPositive(key, value);
                      const label = LABELS[key] || nice(key);

                      return (
                        <li
                          key={key}
                          className={`flex items-start gap-3 ${ok ? "text-gray-800" : "text-gray-400"}`}
                        >
                          <span
                            className={`mt-0.5 inline-flex items-center justify-center rounded-sm ring-1 h-5 w-5 flex-shrink-0 ${ok
                                ? "bg-green-50 text-green-600 ring-green-200"
                                : "bg-gray-100 text-gray-400 ring-gray-200"
                              }`}
                          >
                            {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                          </span>
                          <span className="text-[15px] leading-6">
                            {label}
                            {display && display !== "Yes" && display !== "Unlimited" && display !== "—" ? (
                              <>
                                : <strong>{display}</strong>
                              </>
                            ) : display === "Unlimited" ? (
                              <>
                                {" "}
                                — <strong>Unlimited</strong>
                              </>
                            ) : null}
                            {note && <span className="ml-1 text-xs text-gray-500">({note})</span>}
                          </span>
                        </li>
                      );
                    })}

                    {plan.addons && plan.addons.length > 0 && (
                      <li className="mt-2">
                        <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4">
                          <div className="flex items-center mb-2 text-orange-900 font-semibold">
                            <Plus className="w-4 h-4 mr-2" /> Available Add-ons
                          </div>
                          <ul className="space-y-2">
                            {plan.addons.map((a) => {
                              const symAddon = currencySymbol(a.currency);
                              return (
                                <li key={a.key} className="text-sm text-orange-800">
                                  <span className="font-medium">{a.name}</span>{" "}
                                  <span className="opacity-80">
                                    — {symAddon}
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

                  {showAnnual && (
                    <div className="px-8 pb-6 -mt-2 text-[11px] text-gray-500 text-center">
                      Quotas reset monthly • Billing is annual
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-center text-gray-500 text-sm mt-12">
            All paid plans include a 7-day Money-Back Guarantee • No setup fees • Cancel any time •{" "}
            <Link
              href="/terms"
              className="underline underline-offset-2 hover:text-gray-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              Terms of Service
            </Link>
          </p>
        </div>

        {/* CONTACT MODAL */}
        {showContactModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowContactModal(false)} />
            <div
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-orange-50 px-8 py-6 border-b border-orange-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Contact Us</h3>
                    <p className="text-gray-600 mt-1">Send your details — we’ll reach out ASAP.</p>
                  </div>

                  <button onClick={() => setShowContactModal(false)} className="p-2 rounded-full hover:bg-white/50">
                    <X className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSendContact} className="px-8 py-6 space-y-4">
                {contactToast.type !== "idle" && (
                  <div
                    className={`p-4 rounded-2xl border text-sm ${contactToast.type === "success"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-red-50 border-red-200 text-red-800"
                      }`}
                  >
                    {contactToast.message}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Name</span>
                    <input
                      disabled
                      readOnly
                      className="mt-2 w-full rounded-xl px-4 py-3 border-2 text-gray-300 border-gray-200 cursor-not-allowed"
                      value={contactForm.name}
                      placeholder="Your name"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Email</span>
                    <input
                      disabled
                      readOnly
                      type="email"
                      className="mt-2 w-full rounded-xl px-4 py-3 border-2 border-gray-200 text-gray-300 cursor-not-allowed"
                      value={contactForm.email}
                      placeholder="you@company.com"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Subject</span>
                  <input
                    className="mt-2 w-full border-1 border-gray-200 rounded-xl px-4 py-3 focus:ring focus:ring-orange-400 focus:border-orange-400 outline-none"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="Enterprise plan enquiry"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Message</span>
                  <textarea
                    className="mt-2 w-full border-1 border-gray-200 rounded-xl px-4 py-3 focus:ring focus:ring-orange-400 focus:border-orange-400 outline-none min-h-[140px]"
                    value={contactForm.message}
                    onChange={(e) => setContactForm((p) => ({ ...p, message: e.target.value }))}
                    placeholder="Write your message..."
                    required
                  />
                </label>

                <div className="bg-gray-50 px-8 py-6 -mx-8 -mb-6 flex flex-col sm:flex-row gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowContactModal(false)}
                    className="w-48 px-6 py-3 rounded-xl bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-800 font-semibold"
                    disabled={contactSubmitting}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={contactSubmitting}
                    className={`w-48 px-6 py-3 rounded-xl font-semibold text-white transition-colors ${contactSubmitting
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:from-[#FF7236] hover:to-[#FFA135] shadow-lg"
                      }`}
                  >
                    {contactSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending…
                      </span>
                    ) : (
                      "Send message"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DOWNGRADE MODAL */}
        {showDowngradeModal && selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowDowngradeModal(false)} />
            <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
              <div className="bg-orange-50 px-8 py-6 border-b border-orange-100">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-full">
                      <AlertTriangle className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">Before you change your plan…</h3>
                      <p className="text-gray-600 mt-1">We’d hate to see you lose superpowers 😢</p>
                    </div>
                  </div>
                  <button onClick={() => setShowDowngradeModal(false)} className="p-2 rounded-full hover:bg-white/50">
                    <X className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="px-8 py-6 space-y-6">
                <p className="text-gray-700">
                  Moving to{" "}
                  <span className="font-semibold text-gray-900">{capitalize(selectedPlan.name)}</span>{" "}
                  will reduce or remove some features:
                </p>

                {featureLoss.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <XCircle className="w-5 h-5 text-red-500" />
                      <p className="font-semibold text-red-900">
                        You’ll lose access or limits will be reduced on:
                      </p>
                    </div>
                    <ul className="space-y-3">
                      {featureLoss.map((d) => (
                        <li key={d.key} className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-red-400 rounded-full" />
                          <span className="text-red-800">
                            <span className="font-medium">{LABELS[d.key] || nice(d.key)}:</span>
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
                    <Heart className="w-6 h-6 text-orange-500 mt-0.5" />
                    <div>
                      <p className="text-orange-900 font-medium mb-2">We’d love to keep you!</p>
                      <p className="text-orange-800 text-sm">
                        Need a custom plan, a pause, or a startup discount? Email{" "}
                        <a
                          className="inline-flex items-center gap-1 font-semibold underline hover:text-orange-900"
                          href="mailto:support@collabglam.com?subject=Plan%20change%20help"
                        >
                          <Mail className="w-4 h-4" />
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
                  disabled={submittingDowngrade}
                >
                  Keep my current plan
                </button>
                <button
                  onClick={handleConfirmDowngrade}
                  disabled={confirmText.trim().toUpperCase() !== "CANCEL" || submittingDowngrade}
                  className={`px-6 py-3 rounded-xl font-semibold text-white transition-colors ${confirmText.trim().toUpperCase() === "CANCEL" && !submittingDowngrade
                      ? "bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:from-[#FF7236] hover:to-[#FFA135] shadow-lg"
                      : "bg-gray-400 cursor-not-allowed"
                    }`}
                >
                  {submittingDowngrade ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Applying…
                    </span>
                  ) : (
                    "Confirm change"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
