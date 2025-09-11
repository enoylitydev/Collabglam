"use client";

import React, { useState, useEffect } from "react";
import { get, post } from "@/lib/api";
import {
  CheckCircle,
  XCircle,
  CreditCard,
  Check,
  Star,
  Loader2,
  Sparkles,
} from "lucide-react";

interface Feature {
  key: string;
  value: number;
}

interface Plan {
  planId: string;
  name: string;
  monthlyCost: number;
  features: Feature[];
  featured?: boolean;
}

interface InfluencerData {
  subscription: {
    planName: string;
    expiresAt: string;
  };
}

type PaymentStatus = "idle" | "processing" | "success" | "failed";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const prettifyKey = (key: string) =>
  key
    .split("_")
    .map((k) => capitalize(k))
    .join(" ");

const GOLD_GRAD = "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58]";
const GOLD_TEXT_GRAD = "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] bg-clip-text text-transparent";
const BRAND_TEXT = "text-gray-800"; // prefer this for most text

function loadScript(src: string): Promise<boolean> {
  return new Promise((res) => {
    // Avoid duplicating the script if it's already appended
    if (document.querySelector(`script[src='${src}']`)) return res(true);
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => res(true);
    script.onerror = () => res(false);
    document.body.appendChild(script);
  });
}

export default function InfluencerSubscriptionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [paymentMessage, setPaymentMessage] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const { plans: fetched } = await post<{ plans: Plan[] }>(
          "/subscription/list",
          { role: "Influencer" }
        );
        setPlans(fetched);

        const influencerId = localStorage.getItem("influencerId");
        if (influencerId) {
          const { subscription } = await get<InfluencerData>(
            `/influencer/getbyid?id=${influencerId}`
          );
          setCurrentPlan(subscription.planName);
          setExpiresAt(subscription.expiresAt);
        }
      } catch (e) {
        console.error("Failed to load subscription info", e);
        setPaymentStatus("failed");
        setPaymentMessage("Unable to load subscription info.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (paymentStatus === "success") {
      const timer = setTimeout(() => {
        window.location.reload();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [paymentStatus]);

  const handleSelect = async (plan: Plan) => {
    if (processing || plan.name === currentPlan) return;
    setProcessing(plan.name);
    setPaymentStatus("processing");
    setPaymentMessage("");

    const sdkLoaded = await loadScript(
      "https://checkout.razorpay.com/v1/checkout.js"
    );
    if (!sdkLoaded) {
      setPaymentStatus("failed");
      setPaymentMessage("Payment SDK failed to load. Check your connection.");
      setProcessing(null);
      return;
    }

    const influencerId = localStorage.getItem("influencerId");
    try {
      const { order } = await post<any>("/payment/Order", {
        planId: plan.planId,
        amount: plan.monthlyCost,
        userId: influencerId,
        role: "Influencer",
      });
      const { id: orderId, amount, currency } = order;

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY || "rzp_test_2oIQzZ7i0uQ6sn", // prefer env var
        amount,
        currency,
        name: "Your Company",
        description: `${capitalize(plan.name)} Plan`,
        order_id: orderId,
        handler: async (resp: any) => {
          try {
            await post("/payment/verify", {
              ...resp,
              planId: plan.planId,
              userId: influencerId,
            });
            await post("/subscription/assign", {
              userType: "Influencer",
              userId: influencerId,
              planId: plan.planId,
            });
            setCurrentPlan(plan.name);
            // Ideally, fetch the new expiry from the server; temporary client-side estimate below
            const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            setExpiresAt(newExpiry);
            setPaymentStatus("success");
            setPaymentMessage("Subscription updated successfully!");
          } catch (err) {
            console.error("Subscription assignment failed", err);
            setPaymentStatus("failed");
            setPaymentMessage("Payment verified but failed to assign subscription.");
          }
        },
        prefill: { name: "", email: "", contact: "" },
        theme: { color: "#FFBF00" },
      } as any;

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (failure: any) => {
        console.error("Payment failure:", failure.error);
        setPaymentStatus("failed");
        setPaymentMessage(`Payment Failed: ${failure.error.description}`);
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

  const daysLeft = expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 mx-auto">
              <Loader2 className="w-16 h-16 text-[#FFBF00] animate-spin" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className={`text-xl font-semibold ${BRAND_TEXT}`}>Loading your plans</h3>
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
            <Sparkles className="w-8 h-8 text-[#FFBF00]" />
            <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold ${GOLD_TEXT_GRAD}`}>
              Influencer Plans
            </h1>
          </div>
          <p className={`text-lg sm:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed ${BRAND_TEXT}`}>
            Choose the perfect plan to amplify your influence and grow your audience with our comprehensive suite of tools.
          </p>
        </div>

        {/* Current Plan Status */}
        {currentPlan && expiresAt && (
          <div className="max-w-2xl mx-auto mb-8 lg:mb-12">
            <div className={`bg-white/80 backdrop-blur-sm rounded-2xl border border-yellow-200 shadow-lg p-6 text-center ${BRAND_TEXT}`}>
              <div className="flex items-center justify-center space-x-2 mb-2">
                <CheckCircle className="w-5 h-5 text-[#FFBF00]" />
                <span className="text-sm font-medium text-gray-600 uppercase tracking-wide">Current Plan</span>
              </div>
              <h3 className="text-2xl font-bold">{capitalize(currentPlan)}</h3>
              <p className="text-gray-700">
                Expires on{" "}
                <span className="font-semibold">
                  {new Date(expiresAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                {daysLeft !== null && (
                  <span className="text-gray-500"> ({daysLeft} day{daysLeft === 1 ? "" : "s"} left)</span>
                )}
              </p>
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
                  ? "bg-yellow-50/90 border-yellow-200 text-yellow-900"
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
              <p className="font-medium">{paymentMessage}</p>
            </div>
          </div>
        )}

        {/* Plans Grid */}
        <div className="grid gap-6 sm:gap-8 lg:gap-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {plans.map((plan, index) => {
            const isActive = plan.name === currentPlan;
            const isProcessing = processing === plan.name;
            const isFeatured = plan.featured;

            return (
              <div
                key={plan.planId}
                className={`relative group transition-all duration-500 hover:scale-105 ${
                  index % 2 === 0 ? "hover:-rotate-1" : "hover:rotate-1"
                }`}
              >
                {/* Featured Badge */}
                {isFeatured && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className={`${GOLD_GRAD} text-gray-800 text-xs font-bold py-2 px-4 rounded-full shadow-lg flex items-center space-x-1 border border-yellow-200`}> 
                      <Star className="w-3 h-3" />
                      <span>MOST POPULAR</span>
                    </div>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isActive && (
                  <div className="absolute -top-3 -right-3 z-10">
                    <div className="bg-[#FFBF00] text-white rounded-full p-2 shadow-lg">
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                )}

                <div
                  className={`relative bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl overflow-hidden border transition-all duration-300 h-full flex flex-col group-hover:shadow-2xl ${
                    isFeatured ? "border-yellow-200 shadow-yellow-100/50" : "border-white/20"
                  } ${isActive ? "ring-2 ring-[#FFBF00] border-yellow-200" : ""}`}
                >
                  {/* Plan Header */}
                  <div className={`px-6 sm:px-8 pt-8 pb-6 ${isFeatured ? "bg-gradient-to-br from-amber-50 to-yellow-50" : ""}`}>
                    <div className="text-center space-y-4">
                      <h3 className={`text-2xl sm:text-3xl font-bold ${BRAND_TEXT}`}>{capitalize(plan.name)}</h3>
                      <div className="space-y-1">
                        <div className="flex items-baseline justify-center space-x-1">
                          <span className={`text-5xl sm:text-6xl font-bold ${GOLD_TEXT_GRAD}`}>
                            ${""}{plan.monthlyCost}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm font-medium">/month</p>
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
                          style={{ animationDelay: `${featureIndex * 100}ms` }}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            <CheckCircle className="w-5 h-5 text-[#FFBF00] group-hover/item:text-[#E6A800] transition-colors" />
                          </div>
                          <span className={`text-gray-700 group-hover/item:text-gray-900 transition-colors ${BRAND_TEXT}`}>
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
                      className={`w-full py-4 text-base font-semibold rounded-2xl flex items-center justify-center space-x-2 transition-all duration-300 focus:outline-none focus:ring-4 ${
                        isActive
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200"
                          : isProcessing
                          ? "bg-yellow-100 text-yellow-800 cursor-not-allowed border border-yellow-200"
                          : isFeatured
                          ? `${GOLD_GRAD} hover:brightness-105 ${BRAND_TEXT} shadow-lg hover:shadow-xl transform hover:scale-105 focus:ring-yellow-200 border border-yellow-200`
                          : `${GOLD_GRAD} hover:brightness-105 ${BRAND_TEXT} shadow-lg hover:shadow-xl transform hover:scale-105 focus:ring-yellow-200 border border-yellow-200`
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
                          <span>Choose Plan</span>
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
          <p className={`text-gray-700 ${BRAND_TEXT}`}>
            Questions about our plans?{" "}
            <a href="#" className={`font-semibold underline ${GOLD_TEXT_GRAD}`}>
              Contact our support team
            </a>
          </p>
          <p className="text-sm text-gray-500">All plans include a 14-day money-back guarantee</p>
        </div>
      </div>
    </div>
  );
}
