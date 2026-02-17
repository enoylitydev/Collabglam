"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Check, X, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api";
import Link from "next/link";

type Role = "Brand" | "Influencer";
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

interface PlanCTA {
  text?: string;
  action?: "start" | "book_call";
}

interface Plan {
  _id?: string;
  planId: string;
  role: Role;
  name: string;
  displayName?: string;

  monthlyCost: number;
  annualCost?: number; // annual total (12 months)
  currency?: string;

  isCustomPricing?: boolean;
  isStartingAt?: boolean;
  annualBillingNote?: string;

  bestFor?: string;
  mainOutcome?: string;

  cta?: PlanCTA;

  sortOrder?: number;
  features: Feature[];
  addons?: Addon[];
  _ordered?: Feature[];
}

/** Human labels for feature keys */
const LABELS: Record<string, string> = {
  // Brand
  influencer_search_per_month: "Influencer searches / month",
  influencer_profile_views_per_month: "Influencer profile views / month",
  invites_per_month: "Invites / month",
  active_campaigns: "Active campaigns",
  platforms_supported: "Platforms supported",
  direct_email_messaging_efs: "Direct email messaging (EFS)",
  milestones_and_payouts: "Milestones & payouts",
  message_templates: "Message templates",
  advanced_filters: "Advanced filters",
  dispute_assistance: "Dispute assistance",
  support: "Support",
  creator_sourcing_and_outreach: "Creator sourcing & outreach",
  shortlist_delivered: "Shortlist delivered",
  negotiation_and_followups: "Negotiation & follow-ups",
  managed_plan_budget_note: "Creator budget note",
  marketplace_fee_percent: "Marketplace fee",

  // Influencer
  campaign_applications_per_month: "Campaign applications / month",
  priority_applications_per_month: "Priority applications / month",
  active_collaborations: "Active collaborations",
  recommended_to_brands: "Recommended to brands",
  media_kit: "Media kit",
  rate_card_builder: "Rate card builder",
  pitch_templates: "Pitch templates",
  milestone_payment_protection: "Milestone payment protection",
  payout_speed_after_milestone_approval: "Payout speed after approval",
  platform_fee_on_payouts_percent: "Platform fee on payouts",
  dispute_help: "Dispute help",
};

/** Order per role */
const ORDER_BY_ROLE: Record<Role, string[]> = {
  Brand: [
    "influencer_search_per_month",
    "influencer_profile_views_per_month",
    "invites_per_month",
    "active_campaigns",
    "platforms_supported",
    "message_templates",
    "advanced_filters",
    "dispute_assistance",
    "support",
    "direct_email_messaging_efs",
    "milestones_and_payouts",
    "creator_sourcing_and_outreach",
    "shortlist_delivered",
    "negotiation_and_followups",
    "managed_plan_budget_note",
    "marketplace_fee_percent",
  ],
  Influencer: [
    "campaign_applications_per_month",
    "priority_applications_per_month",
    "active_collaborations",
    "recommended_to_brands",
    "media_kit",
    "rate_card_builder",
    "pitch_templates",
    "milestone_payment_protection",
    "payout_speed_after_milestone_approval",
    "platform_fee_on_payouts_percent",
    "dispute_help",
    "support",
  ],
};

const BOOLEAN_KEYS = new Set<string>([
  // Brand
  "direct_email_messaging_efs",
  "milestones_and_payouts",
  "advanced_filters",
  "dispute_assistance",
  "managed_plan_budget_note",
  // Influencer
  "recommended_to_brands",
  "rate_card_builder",
  "milestone_payment_protection",
  "dispute_help",
]);

type FV = FeatureValue;

const currencySymbol = (c?: string) =>
  c === "INR" ? "₹" : c === "EUR" ? "€" : "$";

const nice = (s: string) =>
  s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const hasUnlimitedFlag = (v: FV) =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  ((v as any).unlimited === true || (v as any).Unlimited === true);

const isUnlimited = (_k: string, v: FV) => v === Infinity || hasUnlimitedFlag(v);

const formatValue = (key: string, v: FV): string => {
  if (isUnlimited(key, v)) {
    const fairUse =
      v && typeof v === "object" && !Array.isArray(v) && (v as any).fair_use;
    return fairUse ? "Unlimited (fair use)" : "Unlimited";
  }

  if (key === "marketplace_fee_percent" || key === "platform_fee_on_payouts_percent") {
    if (typeof v === "number") return `${v}%`;
    return v == null ? "—" : String(v);
  }

  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (BOOLEAN_KEYS.has(key)) return Boolean(v) ? "Included" : "—";
  if (v == null || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
};

const isPositive = (key: string, v: FV) => {
  if (isUnlimited(key, v)) return true;
  if (BOOLEAN_KEYS.has(key)) return Boolean(v);
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object" && v) return true;
  return Boolean(v);
};

const computedLabel = (role: Role, plan: Plan) => {
  if (plan.name === "growth" && role === "Brand") return "Popular";
  if (plan.name === "creator_plus" && role === "Influencer") return "Popular";
  if (role === "Brand" && plan.name === "fully_managed") return "Managed";
  return undefined;
};

/** Annual helpers */
const getAnnualTotal = (plan: Plan) => {
  // Use provided annualCost if available; else fall back to monthly*12 for paid non-custom plans
  if (typeof plan.annualCost === "number" && plan.annualCost > 0) return plan.annualCost;
  if (!plan.isCustomPricing && plan.monthlyCost > 0) return plan.monthlyCost * 12;
  return 0;
};

const calcSavings = (plan: Plan) => {
  if (plan.isCustomPricing) return null;
  if (!(plan.monthlyCost > 0)) return null;

  const annualTotal = getAnnualTotal(plan);
  const monthlyTotal = plan.monthlyCost * 12;

  // only show savings if annualTotal is truly lower than monthlyTotal
  if (!(annualTotal > 0) || !(annualTotal < monthlyTotal)) return null;

  const amount = monthlyTotal - annualTotal;
  const pct = Math.round((amount / monthlyTotal) * 100);
  return { amount, pct };
};

const Pricing: React.FC = () => {
  const router = useRouter();
  const roles: Role[] = ["Brand", "Influencer"];
  const [activeRole, setActiveRole] = useState<Role>("Brand");
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await post<{ message: string; plans: Plan[] }>(
          "/subscription/list",
          { role: activeRole }
        );

        const list = (res.plans || [])
          .slice()
          .sort((a, b) => {
            const so = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
            if (so !== 0) return so;
            return (a.monthlyCost ?? 0) - (b.monthlyCost ?? 0);
          });

        setPlans(list);
      } catch (e) {
        console.error(e);
        setError("Failed to load plans. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [activeRole]);

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

  // Show a tiny “Save up to X%” near annual toggle (subtle improvement)
  const maxSavingsPct = useMemo(() => {
    const pcts = plans
      .map((p) => calcSavings(p)?.pct)
      .filter((v): v is number => typeof v === "number" && v > 0);
    return pcts.length ? Math.max(...pcts) : 0;
  }, [plans]);

  const handleSelect = async (plan: Plan) => {
    const action = plan.cta?.action;

    if (action === "book_call" || plan.isCustomPricing) {
      router.push("/contact-us");
      return;
    }

    try {
      const r = await post<{ checkoutUrl?: string }>("/subscription/checkout", {
        planId: plan.planId,
        billingCycle: billing, // ✅ send billing choice
      });
      if (r?.checkoutUrl) window.location.href = r.checkoutUrl;
      else router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  return (
    <section id="pricing" className="relative py-20 bg-gray-50 font-lexend">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">Pricing</h2>
          <p className="text-lg text-gray-600 mt-3">
            Simple, transparent pricing. Start free, upgrade as you grow.
          </p>

          {/* Role toggle */}
          <div className="inline-flex mt-8 bg-gray-200 rounded-2xl p-1">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                aria-pressed={activeRole === role}
                className={`px-6 py-2 rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400 ${
                  activeRole === role
                    ? "bg-white shadow text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {role}s
              </button>
            ))}
          </div>

          {/* Billing toggle (NEW) */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="inline-flex bg-gray-200 rounded-2xl p-1">
              <button
                onClick={() => setBilling("monthly")}
                aria-pressed={billing === "monthly"}
                className={`px-6 py-2 rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400 ${
                  billing === "monthly"
                    ? "bg-white shadow text-gray-900"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Monthly
              </button>

              <button
                onClick={() => setBilling("annual")}
                aria-pressed={billing === "annual"}
                className={`px-6 py-2 rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400 ${
                  billing === "annual"
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

        {/* Grid */}
        <div className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading &&
            [...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-[560px] bg-white rounded-3xl border border-gray-200 shadow-sm animate-pulse"
              />
            ))}

          {!loading &&
            !error &&
            orderedPlans.map((plan) => {
              const id = plan._id || plan.planId;
              const badge = computedLabel(activeRole, plan);

              const isFree = plan.monthlyCost <= 0 && !plan.isCustomPricing;
              const sym = currencySymbol(plan.currency);

              const isInfluencerPlan =
                plan.role === "Influencer" || activeRole === "Influencer";

              const badgeClasses = isInfluencerPlan
                ? "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900"
                : "bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white";

              const buttonClasses = isInfluencerPlan
                ? "text-gray-900 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] hover:from-[#FFCF33] hover:to-[#FFE680] focus-visible:ring-yellow-400"
                : "text-white bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:from-[#FF8C1A] hover:to-[#FF5C1E] focus-visible:ring-orange-400";

              const borderClasses = badge
                ? isInfluencerPlan
                  ? "border-yellow-300"
                  : "border-orange-300"
                : "border-gray-200";

              const ctaText =
                plan.cta?.text ||
                (plan.isCustomPricing ? "Book a Call" : isFree ? "Start for Free" : "Choose Plan");

              const annualTotal = getAnnualTotal(plan);
              const savings = calcSavings(plan);
              const showAnnual = billing === "annual" && !isFree && !plan.isCustomPricing;

              const primaryPrice = (() => {
                if (plan.isCustomPricing && plan.isStartingAt) return { kind: "starting" as const };
                if (plan.isCustomPricing) return { kind: "custom" as const };
                if (isFree) return { kind: "free" as const };

                if (billing === "annual") {
                  // annual view: show annual total if possible, else fallback to monthly*12
                  const total = annualTotal > 0 ? annualTotal : plan.monthlyCost * 12;
                  return { kind: "annual" as const, value: total };
                }

                return { kind: "monthly" as const, value: plan.monthlyCost };
              })();

              return (
                <div
                  key={id}
                  className={`group relative flex flex-col h-full rounded-3xl bg-white shadow-sm transition-all hover:shadow-xl ${borderClasses}`}
                >
                  {/* Badge */}
                  {badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold py-1.5 px-3 rounded-full shadow ${badgeClasses}`}
                      >
                        <Star className="w-3 h-3 fill-current" /> {badge}
                      </span>
                    </div>
                  )}

                  {/* Header */}
                  <div className="px-8 pt-8 pb-6 min-h-[190px] flex flex-col">
                    <h3 className="text-2xl font-bold text-gray-900">
                      {plan.displayName || nice(plan.name)}
                    </h3>

                    {(plan.bestFor || plan.mainOutcome) && (
                      <div className="mt-2 text-sm text-gray-600 space-y-1">
                        {plan.bestFor && (
                          <div>
                            <span className="font-semibold text-gray-700">Best for:</span>{" "}
                            {plan.bestFor}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-gray-200" />

                  {/* Price + CTA */}
                  <div className="px-8 py-6 text-center min-h-[165px] flex flex-col items-center justify-center">
                    {primaryPrice.kind === "starting" ? (
                      <>
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="text-4xl font-extrabold tracking-tight text-gray-900">
                            {sym}
                            {plan.monthlyCost.toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-500">/month</span>
                        </div>
                      </>
                    ) : primaryPrice.kind === "custom" ? (
                      <span className="text-4xl font-extrabold tracking-tight text-gray-900">
                        Custom
                      </span>
                    ) : primaryPrice.kind === "free" ? (
                      <span className="text-4xl font-extrabold tracking-tight text-gray-900">
                        Free
                      </span>
                    ) : primaryPrice.kind === "annual" ? (
                      <>
                        <div className="flex items-baseline justify-center gap-2">
                          <span className="text-4xl font-extrabold tracking-tight text-gray-900">
                            {sym}
                            {Number(primaryPrice.value).toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-500">/year</span>
                        </div>

                        <div className="mt-1 text-xs text-gray-500">
                          {sym}
                          {Math.round(Number(primaryPrice.value) / 12).toLocaleString()} / month billed annually
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
                            {Number(primaryPrice.value).toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-500">/month</span>
                        </div>
                      </>
                    )}

                    <button
                      onClick={() => handleSelect(plan)}
                      className={`mt-4 w-full py-3 text-sm font-semibold rounded-md shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${buttonClasses}`}
                    >
                      {ctaText}
                    </button>
                  </div>

                  {/* Feature list */}
                  <ul className="px-8 pb-8 space-y-3 mb-auto">
                    {(plan as any)._ordered?.map(({ key, value, note }: Feature) => {
                      const display = formatValue(key, value);
                      const ok = isPositive(key, value);
                      const label = LABELS[key] || nice(key);

                      return (
                        <li
                          key={key}
                          className={`flex items-start gap-3 ${
                            ok ? "text-gray-800" : "text-gray-400"
                          }`}
                        >
                          <span
                            className={`mt-0.5 inline-flex items-center justify-center rounded-sm ring-1 h-5 w-5 flex-shrink-0 ${
                              ok
                                ? "bg-green-50 text-green-600 ring-green-200"
                                : "bg-gray-100 text-gray-400 ring-gray-200"
                            }`}
                          >
                            {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                          </span>

                          <span className="text-[15px] leading-6">
                            {label}
                            {display && display !== "Included" && display !== "—" ? (
                              <>
                                : <strong>{display}</strong>
                              </>
                            ) : display === "Included" ? (
                              <>
                                {" "}
                                — <strong>Included</strong>
                              </>
                            ) : null}

                            {note && (
                              <span className="ml-1 text-xs text-gray-500">({note})</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Tiny annual clarity without changing layout */}
                  {showAnnual && (
                    <div className="px-8 pb-6 -mt-2 text-[11px] text-gray-500 text-center">
                      Quotas reset monthly • Billing is annual
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {error && <p className="text-center text-red-600 mt-8">{error}</p>}

        {/* Footnote */}
        <p className="text-center text-gray-500 text-sm mt-12">
          All paid plans include a 7-day Money-Back Guarantee • No setup fees • Cancel any time •{" "}
          <Link
            href="/policy/terms-of-service"
            className="underline underline-offset-2 hover:text-gray-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            Terms of Service
          </Link>
        </p>
      </div>
    </section>
  );
};

export default Pricing;
