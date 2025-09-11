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
  Sparkles,
  Crown,
  AlertTriangle,
  Heart,
  Mail,
} from "lucide-react";

interface Feature {
  key: string;
  value: number;
}

interface Plan {
  planId: string;
  name: string;
  monthlyCost: number; // 0 or free => no Razorpay
  features: Feature[];
  featured?: boolean;
}

interface BrandData {
  subscription: { planName: string; expiresAt: string };
}

type PaymentStatus = "idle" | "processing" | "success" | "failed";

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Helpers
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const prettifyKey = (key: string) =>
  key
    .split("_")
    .map((k) => capitalize(k))
    .join(" ");

function loadScript(src: string): Promise<boolean> {
  return new Promise((res) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => res(true);
    script.onerror = () => res(false);
    document.body.appendChild(script);
  });
}

export default function BrandSubscriptionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [paymentMessage, setPaymentMessage] = useState<string>("");

  // Retention / downgrade modal state
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [submittingDowngrade, setSubmittingDowngrade] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { plans: fetched } = await post<any>("/subscription/list", {
          role: "Brand",
        });
        setPlans(fetched || []);
        const id = localStorage.getItem("brandId");
        if (id) {
          const { subscription } = await get<BrandData>(`/brand?id=${id}`);
          setCurrentPlan(subscription?.planName || null);
          setExpiresAt(subscription?.expiresAt || null);
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

  // Compute what the user would lose when moving to a cheaper/free plan
  const featureLoss = useMemo(() => {
    if (!currentPlanObj || !selectedPlan) return [] as { key: string; from: number; to: number }[];
    const mapNew = new Map(selectedPlan.features.map((f) => [f.key, f.value]));
    return currentPlanObj.features
      .map((f) => ({ key: f.key, from: f.value, to: mapNew.get(f.key) ?? 0 }))
      .filter((diff) => {
        const fromVal = diff.from;
        const toVal = diff.to;
        // Infinity handling: any finite number < Infinity
        if (fromVal === Infinity && toVal !== Infinity) return true;
        return typeof fromVal === "number" && typeof toVal === "number" && toVal < fromVal;
      });
  }, [currentPlanObj, selectedPlan]);

  const handleSelect = async (plan: Plan) => {
    if (processing || plan.name.toLowerCase() === currentPlan?.toLowerCase()) return;

    // If selecting a free / 0 amount plan => show downgrade modal, don't hit Razorpay
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

    const brandId = localStorage.getItem("brandId");
    try {
      const orderResp = await post<any>("/payment/Order", {
        planId: plan.planId,
        amount: plan.monthlyCost,
        userId: brandId,
        role: "Brand",
      });
      const { id: orderId, amount, currency } = orderResp.order;

      const options = {
        key: "rzp_test_2oIQzZ7i0uQ6sn",
        amount,
        currency,
        name: "Your Company",
        description: `${capitalize(plan.name)} Plan`,
        order_id: orderId,
        handler: async (response: any) => {
          try {
            await post("/payment/verify", { ...response, planId: plan.planId, brandId });
            await post("/subscription/assign", {
              userType: "Brand",
              userId: brandId,
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
      const brandId = localStorage.getItem("brandId");
      await post("/subscription/assign", {
        userType: "Brand",
        userId: brandId,
        planId: selectedPlan.planId,
      });
      setCurrentPlan(selectedPlan.name);
      // For free plans, we can clear expiry or set to 30d from now; using clear here.
      setExpiresAt(null);
      setPaymentStatus("success");
      setPaymentMessage("You've moved to the Free plan. We're here if you need us back!");
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
        {/* Header Section */}
        <div className="text-center space-y-4 mb-12 lg:mb-16">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Crown className="w-8 h-8 text-orange-500" />
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-900 via-orange-900 to-orange-900 bg-clip-text text-transparent">
              Brand Subscription Plans
            </h1>
          </div>
          <p className="text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            Elevate your brand presence with our comprehensive suite of marketing tools and analytics.
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
              <h3 className="text-2xl font-bold text-gray-900 mb-1">
                {capitalize(currentPlan)}
              </h3>
              {expiresAt ? (
                <p className="text-gray-600">
                  Renews on{" "}
                  <span className="font-semibold">
                    {new Date(expiresAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
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
              className={`p-4 rounded-2xl border backdrop-blur-sm flex items-center justify-center space-x-3 transition-all duration-300 ${paymentStatus === "success"
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
            const isPro = plan.name.toLowerCase() === "pro";

            return (
              <div
                key={plan.planId}
                className={`relative group transition-all duration-500 hover:scale-105 ${index % 2 === 0 ? 'hover:-rotate-1' : 'hover:rotate-1'
                  }`}
              >
                {/* Best Value Badge */}
                {isPro && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white text-xs font-bold py-2 px-4 rounded-full shadow-lg flex items-center space-x-1">
                      <Star className="w-3 h-3 fill-current" />
                      <span>BEST VALUE</span>
                    </div>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isActive && (
                  <div className="absolute -top-3 -right-3 z-10">
                    <div className="bg-orange-500 text-white rounded-full p-2 shadow-lg">
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                )}

                <div
                  className={`relative bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl overflow-hidden border transition-all duration-300 h-full flex flex-col group-hover:shadow-2xl ${isPro
                      ? "border-orange-200 shadow-orange-100/50"
                      : "border-white/20"
                    } ${isActive
                      ? "ring-2 ring-orange-400 border-orange-200"
                      : ""
                    }`}
                >
                  {/* Plan Header */}
                  <div className={`px-6 sm:px-8 pt-8 pb-6 ${isPro ? 'bg-gradient-to-br from-orange-50 to-orange-50' : ''}`}>
                    <div className="text-center space-y-4">
                      <h3 className="text-2xl sm:text-3xl font-bold text-gray-900">
                        {capitalize(plan.name)}
                      </h3>
                      <div className="space-y-1">
                        <div className="flex items-baseline justify-center space-x-1">
                          {isFree ? (
                            <span className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                              Free
                            </span>
                          ) : (
                            <>
                              <span className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                ${plan.monthlyCost}
                              </span>
                              <span className="text-xl font-medium text-gray-600">/month</span>
                            </>
                          )}
                        </div>
                        {!isFree && <p className="text-gray-600 text-sm font-medium">Billed monthly</p>}
                      </div>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="px-6 sm:px-8 pb-8 flex-1">
                    <ul className="space-y-4">
                      {plan.features.map((feature, featureIndex) => (
                        <li
                          key={feature.key}
                          className="flex items-start space-x-3 group/item"
                          style={{
                            animationDelay: `${featureIndex * 100}ms`
                          }}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            <CheckCircle className="w-5 h-5 text-orange-500 group-hover/item:text-orange-600 transition-colors" />
                          </div>
                          <span className="text-gray-700 group-hover/item:text-gray-900 transition-colors">
                            <span className="font-medium">{prettifyKey(feature.key)}:</span>{" "}
                            <span className="font-semibold">
                              {feature.value === Infinity ? "Unlimited" : feature.value.toLocaleString()}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Button */}
                  <div className="px-6 sm:px-8 pb-6 sm:pb-8">
                    <button
                      onClick={() => handleSelect(plan)}
                      disabled={isActive || isProcessing}
                      className={`w-full py-4 text-base font-semibold rounded-2xl flex items-center justify-center space-x-2 transition-all duration-300 focus:outline-none focus:ring-4 ${isActive
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
            <a href="#" className="text-orange-600 hover:text-orange-700 font-medium underline">
              Contact our support team
            </a>
          </p>
          <p className="text-sm text-gray-500">
            All plans include a 14-day money-back guarantee
          </p>
        </div>
      </div>

      {/* Downgrade / Free plan confirmation modal */}
      {showDowngradeModal && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDowngradeModal(false)}
          />
          <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-50 to-orange-50 px-8 py-6 border-b border-orange-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-100 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      Before you cancel your subscription...
                    </h3>
                    <p className="text-gray-600 mt-1">We'd hate to see you go! 😢</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDowngradeModal(false)}
                  className="p-2 rounded-full hover:bg-white/50 transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-8 py-6 space-y-6">
              <p className="text-gray-700 leading-relaxed">
                We get it—budgets change. Just a heads up: cancelling your paid plan will move you to the{" "}
                <span className="font-semibold text-gray-900">Free</span> plan, and you'll lose some of the superpowers you currently enjoy.
              </p>

              {featureLoss.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <p className="font-semibold text-red-900">
                      You'll lose access or limits will be reduced on:
                    </p>
                  </div>
                  <ul className="space-y-3">
                    {featureLoss.map((d) => (
                      <li key={d.key} className="flex items-center space-x-3">
                        <div className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0"></div>
                        <span className="text-red-800">
                          <span className="font-medium">{prettifyKey(d.key)}:</span>
                          <span className="ml-2 font-semibold">
                            {d.from === Infinity ? "Unlimited" : d.from.toLocaleString()}
                          </span>
                          <span className="mx-2 text-red-600">→</span>
                          <span className="font-semibold">
                            {d.to === Infinity ? "Unlimited" : d.to.toLocaleString()}
                          </span>
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
                    <p className="text-orange-900 font-medium mb-2">
                      We'd love to keep you!
                    </p>
                    <p className="text-orange-800 text-sm leading-relaxed">
                      If there's anything we can do—custom plan, temporary pause, or startup discount—drop us a line at{" "}
                      <a
                        className="inline-flex items-center space-x-1 font-semibold underline hover:text-orange-900 transition-colors"
                        href="mailto:support@collabglam.com?subject=Cancellation%20help"
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
                    Type <span className="font-bold text-gray-900">CANCEL</span> to confirm cancellation
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

            {/* Modal Footer */}
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
                className={`px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-400 ${confirmText.trim().toUpperCase() === "CANCEL" && !submittingDowngrade
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
                  "Cancel & move to Free"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}