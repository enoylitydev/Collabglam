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
  monthlyCost: number;
  currency?: string;
  features: Feature[];
  label?: string;
  addons?: Addon[];
}

/** New: lite response shape */
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

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const prettifyKey = (key: string) => key.split("_").map((k) => capitalize(k)).join(" ");

const FEATURE_LABELS: Record<string, string> = {
  apply_to_campaigns_quota: "Apply to Campaigns / month",
  media_kit_items_limit: "Media-kit Items",
  saved_searches: "Saved Searches",
  connect_instagram: "Connect Instagram",
  connect_youtube: "Connect YouTube",
  connect_tiktok: "Connect TikTok",
  in_app_messaging: "In-app Messaging",
  contract_esign_basic: "Contract e-sign (Template)",
  contract_esign_download_pdf: "Download Signed PDF",
  dispute_channel: "Dispute Channel",
  media_kit_sections: "Media-kit Sections",
  media_kit_builder: "Media-kit Builder",
};

/** Keys where numeric 0 means Unlimited (counts only). */
const ZERO_IS_UNLIMITED = new Set<string>(["apply_to_campaigns_quota"]);

/** Keys that are boolean in meaning even if backend sends 0/1. */
const BOOLEAN_KEYS = new Set<string>([
  "saved_searches",
  "connect_instagram",
  "connect_youtube",
  "connect_tiktok",
  "in_app_messaging",
  "contract_esign_basic",
  "contract_esign_download_pdf",
  "dispute_channel",
  "media_kit_builder",
]);

/** For these boolean-like keys, true means "Unlimited" rather than just "Included". */
const TRUE_MEANS_UNLIMITED = new Set<string>(["in_app_messaging"]);

function isUnlimited(key: string, value: any) {
  if (value === Infinity) return true;
  if (typeof value === "number" && value === 0 && ZERO_IS_UNLIMITED.has(key)) return true;
  if (BOOLEAN_KEYS.has(key) && TRUE_MEANS_UNLIMITED.has(key) && Boolean(value)) return true;
  return false;
}

function formatValue(key: string, value: any): string {
  if (isUnlimited(key, value)) return "Unlimited";

  // Handle boolean-like flags (including numeric 0/1)
  if (BOOLEAN_KEYS.has(key)) {
    const on = Boolean(value);
    return on ? "Included" : "Not included";
  }

  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? "Included" : "Not included";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function isPositive(key: string, value: any): boolean {
  if (isUnlimited(key, value)) return true;
  if (BOOLEAN_KEYS.has(key)) return Boolean(value);
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

function loadScript(src: string): Promise<boolean> {
  return new Promise((res) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => res(true);
    s.onerror = () => res(false);
    document.body.appendChild(s);
  });
}

function isLoss(fromVal: any, toVal: any, key: string): boolean {
  // Unlimited -> anything not unlimited is a loss
  if (isUnlimited(key, fromVal) && !isUnlimited(key, toVal)) return true;

  // Boolean-like semantics (handle numeric 0/1 gracefully)
  if (BOOLEAN_KEYS.has(key)) {
    const fromOn = Boolean(fromVal);
    const toOn = Boolean(toVal);
    return fromOn && !toOn;
  }

  if (typeof fromVal === "number" && typeof toVal === "number") return toVal < fromVal;
  if (typeof fromVal === "boolean" && typeof toVal === "boolean") return fromVal && !toVal;
  if (Array.isArray(fromVal) && Array.isArray(toVal)) return toVal.length < fromVal.length;
  if ((toVal === null || toVal === undefined) && (fromVal !== null && fromVal !== undefined)) return true;
  return false;
}

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
  const [submittingDowngrade, setSubmittingDowngrade] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { plans: fetched } = await post<any>("/subscription/list", { role: "Influencer" });
        setPlans(fetched || []);

        const id = localStorage.getItem("influencerId");
        if (id) {
          // 🔄 Use lite endpoint: planName, planId, expiresAt
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
    () => plans.find((p) => p.name.toLowerCase() === currentPlan?.toLowerCase()),
    [plans, currentPlan]
  );

  const featureLoss = useMemo(() => {
    if (!currentPlanObj || !selectedPlan) return [] as { key: string; from: any; to: any }[];
    const mapNew = new Map(selectedPlan.features.map((f) => [f.key, f.value]));
    const unionKeys = Array.from(
      new Set([...currentPlanObj.features.map((f) => f.key), ...selectedPlan.features.map((f) => f.key)])
    );
    return unionKeys
      .map((k) => {
        const from = currentPlanObj.features.find((f) => f.key === k)?.value;
        const to = mapNew.get(k);
        return { key: k, from, to };
      })
      .filter((diff) => isLoss(diff.from, diff.to, diff.key));
  }, [currentPlanObj, selectedPlan]);

  const handleSelect = async (plan: Plan) => {
    if (processing || plan.name.toLowerCase() === currentPlan?.toLowerCase()) return;

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

    const ok = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
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

      const options = {
        key: "rzp_test_2oIQzZ7i0uQ6sn",
        amount,
        currency,
        name: "CollabGlam",
        description: `${capitalize(plan.name)} Plan`,
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
            const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            setExpiresAt(newExpiry);
            setPaymentStatus("success");
            setPaymentMessage("Subscription updated successfully!");
            window.location.reload();
          } catch (err) {
            console.error("Subscription assignment failed", err);
            setPaymentStatus("failed");
            setPaymentMessage(
              "Payment verified but failed to assign subscription. Please contact support."
            );
          }
        },
        prefill: { name: "", email: "", contact: "" },
        theme: { color: "#FFA135" },
      } as any;

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        console.error("Payment failure:", resp.error);
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
  };

  const handleConfirmDowngrade = async () => {
    if (!selectedPlan) return;
    if (confirmText.trim().toUpperCase() !== "CANCEL") return;
    setSubmittingDowngrade(true);
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
      setPaymentStatus("success");
      setPaymentMessage(`You've moved to the ${capitalize(selectedPlan.name)} plan.`);
      setShowDowngradeModal(false);
      setConfirmText("");
    } catch (err) {
      console.error("Downgrade failed:", err);
      setPaymentStatus("failed");
      setPaymentMessage("Could not change your plan right now. Please try again.");
    } finally {
      setSubmittingDowngrade(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 mx-auto">
              <Loader2 className="w-16 h-16 text-orange-500 animate-spin" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-gray-900">Loading your plans</h3>
            <p className="text-gray-600">Please wait while we fetch your subscription options...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 sm:py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-4 mb-12 lg:mb-16">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Crown className="w-8 h-8 text-orange-500" />
            <h1 className="text-3xl sm:text-4xl lg:5xl font-bold bg-gradient-to-r from-gray-900 via-orange-900 to-orange-900 bg-clip-text text-transparent">
              Influencer Subscription Plans
            </h1>
          </div>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Unlock more campaign access and showcase a richer media-kit.
          </p>
        </div>

        {/* Current Plan Status */}
        {currentPlan && (
          <div className="max-w-2xl mx-auto mb-8 lg:mb-12">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg p-6 text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">Current Plan</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{capitalize(currentPlan)}</h3>
              {expiresAt ? (
                <p className="text-gray-600">
                  Renews on{" "}
                  <span className="font-semibold">
                    {new Date(expiresAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </p>
              ) : (
                <p className="text-gray-600">No renewal date set</p>
              )}
            </div>
          </div>
        )}

        {/* Payment Status */}
        {paymentStatus !== "idle" && (
          <div className="max-w-md mx-auto mb-8">
            <div
              className={`p-4 rounded-2xl border backdrop-blur-sm flex items-center justify-center space-x-3 transition-all duration-300 ${
                paymentStatus === "success"
                  ? "bg-emerald-50/80 border-emerald-200 text-emerald-800"
                  : paymentStatus === "processing"
                  ? "bg-orange-50/80 border-orange-200 text-orange-800"
                  : "bg-red-50/80 border-red-200 text-red-800"
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

        {/* Plans Grid */}
        <div className="grid gap-6 sm:gap-8 lg:gap-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {plans.map((plan, index) => {
            const isActive = plan.name.toLowerCase() === currentPlan?.toLowerCase();
            const isProcessing = processing === plan.name;
            const isFree = plan.monthlyCost <= 0;
            const bestValue = plan.label?.toLowerCase() === "best value";

            const ORDER: string[] = [
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
            ];

            const orderedFeatures = ORDER
              .map((k) => plan.features.find((f) => f && f.key === k))
              .filter(Boolean) as Feature[];

            const currency = plan.currency || "USD";
            const currencySymbol = currency === "INR" ? "₹" : currency === "EUR" ? "€" : "$";

            return (
              <div
                key={plan.planId}
                className={`relative group transition-all duration-500 hover:scale-105 ${
                  index % 2 === 0 ? "hover:-rotate-1" : "hover:rotate-1"
                }`}
              >
                {bestValue && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white text-xs font-bold py-2 px-4 rounded-full shadow-lg flex items-center space-x-1">
                      <Star className="w-3 h-3 fill-current" />
                      <span>{plan.label}</span>
                    </div>
                  </div>
                )}

                {isActive && (
                  <div className="absolute -top-3 -right-3 z-10">
                    <div className="bg-orange-500 text-white rounded-full p-2 shadow-lg">
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                )}

                <div
                  className={`relative bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl overflow-hidden border transition-all duration-300 h-full flex flex-col group-hover:shadow-2xl ${
                    bestValue ? "border-orange-200 shadow-orange-100/50" : "border-white/20"
                  } ${isActive ? "ring-2 ring-orange-400 border-orange-200" : ""}`}
                >
                  {/* Header */}
                  <div className={`px-6 sm:px-8 pt-8 pb-6 ${bestValue ? "bg-gradient-to-br from-orange-50 to-orange-50" : ""}`}>
                    <div className="text-center space-y-4">
                      <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">{capitalize(plan.name)}</h3>
                      <div className="space-y-1">
                        <div className="flex items-baseline justify-center space-x-1">
                          {isFree ? (
                            <span className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                              Free
                            </span>
                          ) : (
                            <>
                              <span className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                {currencySymbol}
                                {plan.monthlyCost}
                              </span>
                              <span className="text-xl font-medium text-gray-600">/month</span>
                            </>
                          )}
                        </div>
                        {!isFree && <p className="text-gray-600 text-sm font-medium">Billed monthly</p>}
                      </div>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="px-6 sm:px-8 pb-6 flex-1">
                    <ul className="space-y-4">
                      {orderedFeatures.map((feature, i) => {
                        const key = feature.key;
                        const label = FEATURE_LABELS[key] || prettifyKey(key);
                        const val = formatValue(key, feature.value);
                        const positive = isPositive(key, feature.value);
                        const showHint = key === "media_kit_items_limit" && feature.note ? feature.note : undefined;

                        return (
                          <li key={key} className="flex items-start space-x-3" style={{ animationDelay: `${i * 100}ms` }}>
                            <div className="flex-shrink-0 mt-0.5">
                              {positive ? (
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <XCircle className="w-5 h-5 text-red-500" />
                              )}
                            </div>
                            <div className="text-gray-700">
                              <span className="font-medium">{label}:</span> <span className="font-semibold">{val}</span>
                              {showHint && (
                                <span className="ml-2 inline-flex items-center text-xs text-gray-500">
                                  <Info className="w-3 h-3 mr-1" />
                                  {showHint}
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Add-ons */}
                    {plan.addons && plan.addons.length > 0 && (
                      <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50/50 p-4">
                        <div className="flex items-center mb-2 text-orange-900 font-semibold">
                          <Plus className="w-4 h-4 mr-2" />
                          Available Add-ons
                        </div>
                        <ul className="space-y-2">
                          {plan.addons.map((a) => {
                            const sym = (a.currency || "USD") === "INR" ? "₹" : (a.currency || "USD") === "EUR" ? "€" : "$";
                            return (
                              <li key={a.key} className="text-sm text-orange-800">
                                <span className="font-medium">{a.name}</span>{" "}
                                <span className="opacity-80">— {sym}{a.price} {a.type === "one_time" ? "one-time" : "/mo"}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                    <button
                      onClick={() => handleSelect(plan)}
                      disabled={isActive || isProcessing}
                      className={`w-full py-4 text-base font-semibold rounded-2xl flex items-center justify-center space-x-2 transition-all duration-300 focus:outline-none focus:ring-4 ${
                        isActive
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200"
                          : isProcessing
                          ? "bg-orange-100 text-orange-700 cursor-not-allowed border border-orange-200"
                          : "bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:from-[#FF7236] hover:to-[#FFA135] text-white shadow-lg hover:shadow-xl transform hover:scale-105 focus:ring-orange-200"
                      }`}
                    >
                      {isActive ? (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          <span>Current Plan</span>
                        </>
                      ) : isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5" />
                          <span>{isFree ? "Switch to Free" : "Choose Plan"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 lg:mt-16 space-y-4">
          <p className="text-gray-600">
            Questions about our plans?{" "}
            <a href="mailto:support@collabglam.com" className="text-orange-600 hover:text-orange-700 font-medium underline">
              Contact our support team
            </a>
          </p>
          <p className="text-sm text-gray-500">All plans include a 14-day money-back guarantee</p>
        </div>
      </div>

      {/* Downgrade Modal */}
      {showDowngradeModal && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDowngradeModal(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-orange-50 to-orange-50 px-8 py-6 border-b border-orange-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-100 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">Before you change your plan…</h3>
                    <p className="text-gray-600 mt-1">Some features may be reduced 😢</p>
                  </div>
                </div>
                <button onClick={() => setShowDowngradeModal(false)} className="p-2 rounded-full hover:bg-white/50 transition-colors">
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="px-8 py-6 space-y-6">
              <p className="text-gray-700 leading-relaxed">
                Moving to <span className="font-semibold text-gray-900">{capitalize(selectedPlan.name)}</span> will reduce or remove some features:
              </p>

              {featureLoss.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <p className="font-semibold text-red-900">You’ll lose access or limits will be reduced on:</p>
                  </div>
                  <ul className="space-y-3">
                    {featureLoss.map((d) => (
                      <li key={d.key} className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0"></div>
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

              <div className="bg-gradient-to-r from-orange-50 to-orange-50 border border-orange-200 rounded-2xl p-6">
                <div className="flex items-start space-x-3">
                  <Heart className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-orange-900 font-medium mb-2">We’d love to keep you!</p>
                    <p className="text-orange-800 text-sm leading-relaxed">
                      Need a hand?{" "}
                      <a
                        className="inline-flex items-center space-x-1 font-semibold underline hover:text-orange-900 transition-colors"
                        href="mailto:support@collabglam.com?subject=Plan%20change%20help"
                      >
                        <Mail className="w-4 h-4" />
                        <span>support@collabglam.com</span>
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700 mb-2 block">
                    Type <span className="font-bold text-gray-900">CANCEL</span> to confirm
                  </span>
                  <input
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-400 focus:border-orange-400 focus:outline-none transition-colors"
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
                className="px-6 py-3 rounded-xl bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-800 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                disabled={submittingDowngrade}
              >
                Keep my current plan
              </button>
              <button
                onClick={handleConfirmDowngrade}
                disabled={confirmText.trim().toUpperCase() !== "CANCEL" || submittingDowngrade}
                className={`px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                  confirmText.trim().toUpperCase() === "CANCEL" && !submittingDowngrade
                    ? "bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:from-[#FF7236] hover:to-[#FFA135] shadow-lg hover:shadow-xl"
                    : "bg-gray-400 cursor-not-allowed"
                }`}
              >
                {submittingDowngrade ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Applying...</span>
                  </div>
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
