"use client";

import React, { useEffect, useMemo, useState } from "react";
import { get, post } from "@/lib/api";
import {
  HiCheckCircle,
  HiXCircle,
  HiCreditCard,
  HiCheck,
  HiX,
} from "react-icons/hi";

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
        theme: { color: "#db2777" },
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
      <div className="flex justify-center items-center h-64 bg-white rounded-lg shadow-lg">
        <HiCreditCard className="animate-spin text-4xl text-orange-600" />
        <span className="ml-3">Loading plans…</span>
      </div>
    );
  }

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-6 bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-4xl font-extrabold text-center text-gray-900 mb-4">
          Choose Your Subscription
        </h2>

        {currentPlan && (
          <div className="text-center mb-8">
            <span className="font-medium text-gray-700">Current plan:</span>{" "}
            <span className="font-semibold text-orange-600">
              {capitalize(currentPlan)}
            </span>{" "}
            {expiresAt ? (
              <span className="text-gray-500">
                (renews on {new Date(expiresAt).toLocaleDateString()})
              </span>
            ) : (
              <span className="text-gray-500">(no renewal date)</span>
            )}
          </div>
        )}

        {paymentStatus !== "idle" && (
          <div
            className={`max-w-md mx-auto mb-6 p-4 rounded-lg text-center flex items-center justify-center space-x-2 ${paymentStatus === "success"
                ? "bg-green-100 text-green-800"
                : paymentStatus === "processing"
                  ? "bg-orange-50 text-orange-800"
                  : "bg-red-100 text-red-800"
              }`}
          >
            {paymentStatus === "success" ? (
              <HiCheck className="text-2xl" />
            ) : paymentStatus === "processing" ? (
              <HiCreditCard className="text-2xl animate-spin" />
            ) : (
              <HiX className="text-2xl" />
            )}
            <p>
              {paymentMessage ||
                (paymentStatus === "processing" ? "Working on it…" : null)}
            </p>
          </div>
        )}

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const isActive =
              plan.name.toLowerCase() === currentPlan?.toLowerCase();
            const isProcessing = processing === plan.name;
            const isFree = plan.monthlyCost <= 0;
            return (
              <div
                key={plan.planId}
                className={`relative bg-white rounded-2xl shadow-md overflow-hidden transform transition duration-300 hover:shadow-xl hover:-translate-y-2 ${plan.name.toLowerCase() === "pro" ? "ring-4 ring-orange-500" : ""
                  }`}
              >
                {plan.name.toLowerCase() === "pro" && (
                  <div className="absolute top-0 left-0 bg-orange-600 text-white text-xs font-semibold py-1 px-3 uppercase">
                    Best Value
                  </div>
                )}
                <div className="p-8 flex flex-col h-full">
                  <h3 className="text-2xl font-semibold text-gray-800 mb-4">
                    {capitalize(plan.name)}
                  </h3>
                  <p className="text-5xl font-bold text-gray-900 mb-6">
                    {isFree ? (
                      <>Free</>
                    ) : (
                      <>
                        ${plan.monthlyCost}
                        <span className="text-xl font-light">/mo</span>
                      </>
                    )}
                  </p>
                  <ul className="space-y-3 flex-1 mb-8">
                    {plan.features.map((f) => (
                      <li key={f.key} className="flex items-start">
                        <HiCheckCircle className="text-orange-500 mt-1 mr-3" />
                        <span className="text-gray-700">
                          {prettifyKey(f.key)}: {f.value === Infinity ? "Unlimited" : f.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleSelect(plan)}
                    disabled={isActive || isProcessing}
                    className={`w-full py-3 text-lg font-semibold rounded-lg transition focus:outline-none flex items-center justify-center space-x-2 ${isActive
                        ? "bg-gray-400 cursor-not-allowed text-white"
                        : "bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:from-[#FF7236] hover:to-[#FFA135] cursor-pointer"
                      } ${isProcessing ? "opacity-75 cursor-not-allowed" : ""}`}
                  >
                    {isActive ? (
                      <>
                        <HiCheckCircle />
                        <span>Current</span>
                      </>
                    ) : isProcessing ? (
                      <>
                        <span>Processing…</span>
                      </>
                    ) : (
                      <>
                        <span>{isFree ? "Switch to Free" : "Select Plan"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Downgrade / Free plan confirmation modal */}
      {showDowngradeModal && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDowngradeModal(false)}
          />
          <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-8 mx-4">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900">
                Before you cancel your subscription… 😢
              </h3>
              <button
                onClick={() => setShowDowngradeModal(false)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <HiX className="text-xl" />
              </button>
            </div>

            <p className="text-gray-700 mb-4">We get it—budgets change. Just a heads up: cancelling your paid plan will move you to the <span className="font-semibold">Free</span> plan, and you’ll lose some of the superpowers you currently enjoy.</p>

            {featureLoss.length > 0 && (
              <div className="mb-6">
                <p className="font-medium text-gray-800 mb-2">
                  You’ll lose access or limits will be reduced on:
                </p>
                <ul className="space-y-2">
                  {featureLoss.map((d) => (
                    <li key={d.key} className="flex items-start text-sm">
                      <HiXCircle className="text-red-500 mr-2 mt-0.5" />
                      <span className="text-gray-700">
                        {prettifyKey(d.key)}:
                        <span className="ml-1 font-semibold">
                          {d.from === Infinity ? "Unlimited" : d.from}
                        </span>
                        <span className="mx-1">→</span>
                        <span className="font-semibold">
                          {d.to === Infinity ? "Unlimited" : d.to}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
              <p className="text-orange-900">
                ❤️ We’d love to keep you! If there’s anything we can do—custom plan,
                temporary pause, or startup discount—drop a line at
                <a
                  className="underline font-semibold ml-1"
                  href="mailto:support@collabglam.com?subject=Cancellation%20help"
                >
                  support@collabglam.com
                </a>
                .
              </p>
            </div>

            <div className="mb-6">
              <p className="text-xs text-gray-500 mt-1">
                Type <span className="font-semibold">CANCEL</span> to confirm.
              </p>
              <input
                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-orange-400 focus:outline-none"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={() => setShowDowngradeModal(false)}
                className="px-5 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold"
                disabled={submittingDowngrade}
              >
                Keep my current plan
              </button>
              <button
                onClick={handleConfirmDowngrade}
                disabled={confirmText.trim().toUpperCase() !== "CANCEL" || submittingDowngrade}
                className={`px-5 py-3 rounded-lg font-semibold text-white ${confirmText.trim().toUpperCase() === "CANCEL" && !submittingDowngrade
                    ? "bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:from-[#FF7236] hover:to-[#FFA135]"
                    : "bg-gray-400 cursor-not-allowed"
                  }`}
              >
                {submittingDowngrade ? "Applying…" : "Cancel & move to Free"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
