"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { post } from "@/lib/api";

type BillingCycle = "monthly" | "annual";

type Plan = {
  planId: string;
  name: string;
  monthlyCost: number;
  annualCost?: number;
  currency?: string;
};

function getAnnualTotal(plan: Plan) {
  if (typeof plan.annualCost === "number" && plan.annualCost > 0) return plan.annualCost;
  return plan.monthlyCost * 12;
}

export default function CheckoutAutoStart({
  role,
  plans,
  loading,
}: {
  role: "Brand" | "Influencer";
  plans: Plan[];
  loading: boolean;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    const checkout = params.get("checkout") === "1";
    const planId = params.get("planId");
    const billing = (params.get("billing") || params.get("billingCycle") || "monthly") as BillingCycle;

    if (!checkout || !planId) return;
    if (started.current) return;

    // wait until plans loaded so we can compute amount/currency
    if (loading) return;
    if (!plans?.length) return;

    const token = localStorage.getItem("token");
    if (!token) {
      const next = `${pathname}?${params.toString()}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    const userId =
      role === "Brand" ? localStorage.getItem("brandId") : localStorage.getItem("influencerId");

    if (!userId) {
      const next = `${pathname}?${params.toString()}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    const plan = plans.find((p) => p.planId === planId);
    if (!plan) {
      console.log("[CheckoutAutoStart] planId not found in plans:", planId);
      return;
    }

    started.current = true;

    (async () => {
      try {
        const amount = billing === "annual" ? getAnnualTotal(plan) : plan.monthlyCost;

        // store pending (your verify handler uses these)
        if (role === "Influencer") {
          localStorage.setItem("pendingInfluencerPlanId", plan.planId);
          localStorage.setItem("pendingInfluencerPlanName", plan.name);
          localStorage.setItem("pendingInfluencerBillingCycle", billing);
        } else {
          localStorage.setItem("pendingBrandPlanId", plan.planId);
          localStorage.setItem("pendingBrandPlanName", plan.name);
          localStorage.setItem("pendingBrandBillingCycle", billing);
        }

        const resp = await post<{
          success: boolean;
          url?: string;
          message?: string;
        }>("/payment/Order", {
          planId: plan.planId,
          amount,
          currency: plan.currency || "USD",
          userId,
          role, // "Brand" | "Influencer"
          billingCycle: billing,
          name: plan.name, // optional, helps your backend resolve plan name
        });

        if (!resp?.success || !resp?.url) throw new Error(resp?.message || "Checkout failed");

        window.location.href = resp.url;
      } catch (e) {
        console.error("[CheckoutAutoStart] failed:", e);
      }
    })();
  }, [params, pathname, router, role, plans, loading]);

  return null;
}
