"use client";

import React, { useEffect, useMemo, useState } from "react";
import { get, post } from "@/lib/api";
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
  Info,
} from "lucide-react";

/** Types */
interface Feature { key: string; value: any; note?: string; }
interface Addon { key: string; name: string; type: "one_time" | "recurring"; price: number; currency?: string; payload?: any; }
interface Plan {
  planId: string;
  name: string;
  monthlyCost: number;
  currency?: string;
  features: Feature[];
  label?: string;
  addons?: Addon[];
}
interface BrandData { subscription: { planName: string; expiresAt: string | null } | null; }
type PaymentStatus = "idle" | "processing" | "success" | "failed";

declare global { interface Window { Razorpay: any; } }

/** Helpers */
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const prettifyKey = (key: string) => key.split("_").map((k) => capitalize(k)).join(" ");
const currencySym = (c?: string) => (c === "INR" ? "₹" : c === "EUR" ? "€" : "$");

const PLAN_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  basic: 2,
  growth: 3,
  pro: 4,
  premium: 5,
  // enterprise must be LAST
  enterprise: 999,
};

// Unknown names default just before Premium so Enterprise still ends last.
const rankOf = (name: string) => PLAN_RANK[name.toLowerCase()] ?? 4;

const sortPlansForBrand = (list: Plan[]) =>
  list.slice().sort((a, b) => {
    const ra = rankOf(a.name);
    const rb = rankOf(b.name);
    if (ra !== rb) return ra - rb;
    // tie-breakers to keep things stable
    if (a.monthlyCost !== b.monthlyCost) return a.monthlyCost - b.monthlyCost;
    return a.name.localeCompare(b.name);
  });

const FEATURE_LABELS: Record<string, string> = {
  searches_per_month: "Searches / month",
  profile_views_per_month: "Profile views / month",
  invites_per_month: "Invites / month",
  active_campaigns_limit: "Active campaigns",
  message_templates_basic_limit: "Basic message templates",
  custom_messaging: "Custom messaging",
  advanced_filters: "Advanced filters",
  support_channels: "Support",
  dedicated_account_manager: "Dedicated account manager",
  dedicated_manager: "Dedicated manager",
  dispute_assistance: "Dispute assistance",
  public_quotas_visible: "What brands see (Public Quotas)",
  setup_assistance: "Setup assistance",
  priority_verification_queue: "Priority verification queue",
  strategy_calls: "Strategy calls",
  sla_support: "SLA support",
  flexible_billing: "Flexible billing",
  // legacy fallbacks
  monthly_credits: "Monthly Credits",
  live_campaigns_limit: "Live Campaigns",
  search_cached_only: "Search Mode (Cached only)",
  search_fresh_uses_credits: "Fresh Search Uses Credits",
  view_full_profiles_uses_credits: "Full Profile View Uses Credits",
  in_app_messaging: "In-app Messaging",
  contracts_access: "Contracts",
  milestones_access: "Milestones",
  dispute_support: "Dispute Support",
  profile_preview_only: "Profile preview only",
};

const BOOLEAN_KEYS = new Set<string>([
  "custom_messaging", "advanced_filters", "dedicated_account_manager", "dedicated_manager", "dispute_assistance",
  "public_quotas_visible", "setup_assistance", "priority_verification_queue", "strategy_calls", "sla_support", "flexible_billing",
  "search_cached_only", "search_fresh_uses_credits", "view_full_profiles_uses_credits", "in_app_messaging",
  "contracts_access", "milestones_access", "dispute_support", "profile_preview_only",
]);

const ZERO_IS_UNLIMITED = new Set<string>(["active_campaigns_limit", "live_campaigns_limit", "apply_to_campaigns_quota"]);
const TRUE_MEANS_UNLIMITED = new Set<string>(["in_app_messaging"]);
const SUPPORT_PRETTY: Record<string, string> = { chat: "Chat support", email: "Email support", phone: "Phone support" };

const isUnlimited = (k: string, v: any) =>
  v === Infinity || (typeof v === "number" && v === 0 && ZERO_IS_UNLIMITED.has(k)) ||
  (BOOLEAN_KEYS.has(k) && TRUE_MEANS_UNLIMITED.has(k) && Boolean(v));

const formatValue = (key: string, value: any): string => {
  if (isUnlimited(key, value)) return "Unlimited";
  if (key === "support_channels" && Array.isArray(value)) return value.length ? value.map(s => SUPPORT_PRETTY[s?.toLowerCase?.()] ?? String(s)).join(" + ") : "—";
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

const loadScript = (src: string) => new Promise<boolean>((res) => {
  const s = document.createElement("script"); s.src = src; s.onload = () => res(true); s.onerror = () => res(false); document.body.appendChild(s);
});

/** Component */
export default function BrandSubscriptionPage() {
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

  useEffect(() => {
    (async () => {
      try {
        const { plans: fetched } = await post<any>("/subscription/list", { role: "Brand" });
        setPlans(sortPlansForBrand(fetched || []));
        const id = localStorage.getItem("brandId");
        if (id) {
          const { subscription } = await get<BrandData>(`/brand?id=${id}`);
          setCurrentPlan(subscription?.planName || null);
          setExpiresAt(subscription?.expiresAt ?? null);

          if (subscription?.planName) {
            localStorage.setItem("brandPlanName", subscription.planName);
          }
        }

      } catch {
        setPaymentStatus("failed"); setPaymentMessage("Unable to load subscription info.");
      } finally { setLoading(false); }
    })();
  }, []);

  const currentPlanObj = useMemo(
    () => plans.find((p) => p.name.toLowerCase() === currentPlan?.toLowerCase()),
    [plans, currentPlan]
  );

  // Loss preview
  const featureLoss = useMemo(() => {
    if (!currentPlanObj || !selectedPlan) return [] as { key: string; from: any; to: any }[];
    const mapNew = new Map(selectedPlan.features.map((f) => [f.key, f.value]));
    const union = Array.from(new Set([...currentPlanObj.features.map(f => f.key), ...selectedPlan.features.map(f => f.key)]));
    return union.map(k => {
      const from = currentPlanObj.features.find(f => f.key === k)?.value;
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
    }).filter(Boolean) as { key: string; from: any; to: any }[];
  }, [currentPlanObj, selectedPlan]);

  const handleSelect = async (plan: Plan) => {
    if (processing || plan.name.toLowerCase() === currentPlan?.toLowerCase()) return;

    if (plan.name.toLowerCase() === "enterprise") { window.location.href = "/contact-us"; return; }

    if (plan.monthlyCost <= 0) {
      setSelectedPlan(plan); setShowDowngradeModal(true); setPaymentStatus("idle"); setPaymentMessage(""); return;
    }

    setProcessing(plan.name); setPaymentStatus("processing"); setPaymentMessage("");
    const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    if (!ok) { setPaymentStatus("failed"); setPaymentMessage("Payment SDK failed to load."); setProcessing(null); return; }

    const brandId = localStorage.getItem("brandId");
    try {
      const orderResp = await post<any>("/payment/Order", { planId: plan.planId, amount: plan.monthlyCost, userId: brandId, role: "Brand" });
      const { id: order_id, amount, currency } = orderResp.order;
      const rzp = new window.Razorpay({
        key: "rzp_test_2oIQzZ7i0uQ6sn",
        amount, currency,
        name: "CollabGlam",
        description: `${capitalize(plan.name)} Plan`,
        order_id,
        handler: async (response: any) => {
          try {
            await post("/payment/verify", { ...response, planId: plan.planId, brandId });
            await post("/subscription/assign", { userType: "Brand", userId: brandId, planId: plan.planId });

            setCurrentPlan(plan.name);
            setExpiresAt(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

            localStorage.setItem("brandPlanName", plan.name);
            localStorage.setItem("brandPlanId", plan.planId);

            setPaymentStatus("success");
            setPaymentMessage("Subscription updated successfully!");
            window.location.reload(); // optional, state + LS are already correct
          } catch {
            setPaymentStatus("failed");
            setPaymentMessage("Payment verified but failed to assign subscription. Please contact support.");
          }
        },
        prefill: { name: "", email: "", contact: "" },
        theme: { color: "#FFA135" },
      });
      rzp.on("payment.failed", (resp: any) => { setPaymentStatus("failed"); setPaymentMessage(`Payment Failed: ${resp.error.description}`); });
      rzp.open();
    } catch {
      setPaymentStatus("failed"); setPaymentMessage("Failed to initiate payment. Try again later.");
    } finally { setProcessing(null); }
  };

  const handleConfirmDowngrade = async () => {
    if (!selectedPlan) return;
    if (confirmText.trim().toUpperCase() !== "CANCEL") return;
    setSubmittingDowngrade(true); setPaymentStatus("processing"); setPaymentMessage("");
    try {
      const brandId = localStorage.getItem("brandId");
      await post("/subscription/assign", { userType: "Brand", userId: brandId, planId: selectedPlan.planId });

      setCurrentPlan(selectedPlan.name);
      setExpiresAt(null);

      localStorage.setItem("brandPlanName", selectedPlan.name);
      localStorage.setItem("brandPlanId", selectedPlan.planId);

      setPaymentStatus("success");
      setPaymentMessage(`You've moved to the ${capitalize(selectedPlan.name)} plan.`);
      setShowDowngradeModal(false);
      setConfirmText("");

    } catch {
      setPaymentStatus("failed"); setPaymentMessage("Could not change your plan right now. Please try again.");
    } finally { setSubmittingDowngrade(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <Loader2 className="w-16 h-16 text-orange-500 animate-spin" />
        <p className="mt-4 text-gray-700">Loading your plans…</p>
      </div>
    );
  }

  /** Display order to mirror Pricing page hierarchy */
  const ORDER: string[] = [
    "searches_per_month", "profile_views_per_month", "invites_per_month", "active_campaigns_limit",
    "message_templates_basic_limit", "custom_messaging", "advanced_filters", "support_channels",
    "dedicated_account_manager", "dedicated_manager", "dispute_assistance", "public_quotas_visible",
    "setup_assistance", "priority_verification_queue", "strategy_calls", "sla_support", "flexible_billing",
    "live_campaigns_limit", "monthly_credits", "search_cached_only", "search_fresh_uses_credits",
    "view_full_profiles_uses_credits", "milestones_access", "contracts_access", "in_app_messaging",
    "dispute_support", "profile_preview_only",
  ];

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header (aligned to Pricing page style) */}
        <div className="text-center mb-14">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Crown className="w-8 h-8 text-orange-500" />
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900">Brand Subscription Plans</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Simple, transparent pricing. Start free, upgrade as you grow.
          </p>
        </div>

        {/* Current plan pill */}
        {currentPlan && (
          <div className="max-w-2xl mx-auto mb-10">
            <div className="bg-white rounded-2xl border border-gray-200 shadow p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">Current Plan</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900">{capitalize(currentPlan)}</h3>
              <p className="text-gray-600 mt-1">
                {expiresAt ? (
                  <>Renews on{" "}
                    <span className="font-semibold">
                      {new Date(expiresAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </span>
                  </>
                ) : "No renewal date set"}
              </p>
            </div>
          </div>
        )}

        {/* Status toast */}
        {paymentStatus !== "idle" && (
          <div className="max-w-md mx-auto mb-8">
            <div className={`p-4 rounded-2xl border flex items-center justify-center gap-3 ${paymentStatus === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : paymentStatus === "processing" ? "bg-orange-50 border-orange-200 text-orange-800"
                : "bg-red-50 border-red-200 text-red-800"}`}>
              {paymentStatus === "success" ? <CheckCircle className="w-6 h-6" /> :
                paymentStatus === "processing" ? <Loader2 className="w-6 h-6 animate-spin" /> :
                  <XCircle className="w-6 h-6" />}
              <p className="font-medium">{paymentMessage || (paymentStatus === "processing" ? "Working on it…" : null)}</p>
            </div>
          </div>
        )}

        {/* Cards (mirrors Pricing page) */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {plans.map((plan) => {
            const isActive = plan.name.toLowerCase() === currentPlan?.toLowerCase();
            const isProcessing = processing === plan.name;
            const isFree = plan.monthlyCost <= 0;
            const isEnterprise = plan.name.toLowerCase() === "enterprise";
            const highlighted = ["best value", "popular"].includes((plan.label || "").toLowerCase());
            const sym = currencySym(plan.currency);

            // ordered feature slice
            const fmap = new Map(plan.features.map(f => [f.key, f]));
            const features = ORDER.map(k => fmap.get(k)).filter(Boolean) as Feature[];

            return (
              <div
                key={plan.planId}
                className={`relative bg-white rounded-3xl border shadow-sm hover:shadow-lg transition-all flex flex-col h-full ${highlighted ? "border-orange-300" : "border-gray-200"
                  } ${isActive ? "ring-2 ring-orange-400" : ""}`}
              >
                {highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-white py-1.5 px-3 rounded-full shadow
                      bg-gradient-to-r from-[#FFA135] to-[#FF7236]">
                      <Star className="w-3 h-3 fill-current" /> {plan.label}
                    </span>
                  </div>
                )}

                {/* Header & Price */}
                <div className="px-8 pt-8 pb-6 text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{capitalize(plan.name)}</h3>
                  <div className="flex items-baseline justify-center gap-2">
                    {isEnterprise ? (
                      <span className="text-5xl font-extrabold text-gray-900">Custom</span>
                    ) : isFree ? (
                      <>
                        <span className="text-5xl font-extrabold text-gray-900">Free</span>
                        <span className="text-sm text-gray-600">(forever)</span>
                      </>
                    ) : (
                      <>
                        <span className="text-5xl font-extrabold text-gray-900">
                          {sym}{plan.monthlyCost}
                        </span>
                        <span className="text-xl text-gray-600">/month</span>
                      </>
                    )}
                  </div>
                  {!isFree && !isEnterprise && <p className="text-sm text-gray-600 mt-1">Billed monthly</p>}
                </div>

                {/* CTA directly under price – rectangular */}
                <div className="px-8">
                  <button
                    onClick={() => handleSelect(plan)}
                    disabled={isActive || isProcessing}
                    className={`w-full py-4 text-base font-semibold rounded-md flex items-center justify-center gap-2 transition-all
                      ${isActive
                        ? "bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200"
                        : isProcessing
                          ? "bg-orange-100 text-orange-700 cursor-not-allowed border border-orange-200"
                          : "bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:from-[#FF7236] hover:to-[#FFA135] text-white shadow-lg hover:shadow-xl"}`}
                  >
                    {isActive ? (
                      <><CheckCircle className="w-5 h-5" /><span>Current Plan</span></>
                    ) : isProcessing ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /><span>Processing…</span></>
                    ) : (
                      <><CreditCard className="w-5 h-5" />
                        <span>{isEnterprise ? "Contact Us" : isFree ? "Choose Free" : "Choose Plan"}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Features */}
                <div className="px-8 py-6 flex-1">
                  <ul className="space-y-4">
                    {features.map((f) => {
                      const label = FEATURE_LABELS[f.key] || prettifyKey(f.key);
                      const val = formatValue(f.key, f.value);
                      const ok = isPositive(f.key, f.value);
                      return (
                        <li key={f.key} className="flex items-start gap-3">
                          {ok ? <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-500 mt-0.5" />}
                          <div className="text-gray-700">
                            <span className="font-medium">{label}:</span> <span className="font-semibold">{val}</span>
                            {f.note && (
                              <span className="ml-2 inline-flex items-center text-xs text-gray-500">
                                <Info className="w-3 h-3 mr-1" /> {f.note}
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
                            <Plus className="w-4 h-4 mr-2" /> Available Add-ons
                          </div>
                          <ul className="space-y-2">
                            {plan.addons.map((a) => {
                              const sym = currencySym(a.currency);
                              return (
                                <li key={a.key} className="text-sm text-orange-800">
                                  <span className="font-medium">{a.name}</span>{" "}
                                  <span className="opacity-80">— {sym}{a.price} {a.type === "one_time" ? "one-time" : "/mo"}</span>
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
                  <div className="p-2 bg-orange-100 rounded-full"><AlertTriangle className="w-6 h-6 text-orange-600" /></div>
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
                Moving to <span className="font-semibold text-gray-900">{capitalize(selectedPlan.name)}</span> will reduce or remove some features:
              </p>

              {featureLoss.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <XCircle className="w-5 h-5 text-red-500" />
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
                  <Heart className="w-6 h-6 text-orange-500 mt-0.5" />
                  <div>
                    <p className="text-orange-900 font-medium mb-2">We’d love to keep you!</p>
                    <p className="text-orange-800 text-sm">
                      Need a custom plan, a pause, or a startup discount? Email{" "}
                      <a className="inline-flex items-center gap-1 font-semibold underline hover:text-orange-900"
                        href="mailto:support@collabglam.com?subject=Plan%20change%20help">
                        <Mail className="w-4 h-4" /><span>support@collabglam.com</span>
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
                {submittingDowngrade ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Applying…</span> : "Confirm change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
