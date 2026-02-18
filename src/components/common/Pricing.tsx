"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, X, Star, CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { post } from "@/lib/api";

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
  annualCost?: number;
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

/** Human labels for feature keys (ONLY what you still use) */
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
  dispute_help: "Dispute help",
};

/** Keep ordering clean and aligned with your "removed features" changes */
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
    "dispute_help",
    "support",
  ],
};

/** Hard-hide removed keys (matches your seed logic) */
const HIDDEN_FEATURE_KEYS_BY_ROLE: Record<Role, Set<string>> = {
  Brand: new Set(["post_campaign_analytics_report", "marketplace_fee_percent"]),
  Influencer: new Set([
    "profile_boosts_in_brand_browse_per_month",
    "campaign_analytics",
    "team_seats",
    "early_access_to_new_campaigns",
    "team_workspace",
    "media_kit_pdf_export",
    "verified_badge",
    "ai_pitch_assistant_drafts_per_month",
    "manage_creators_for_agency",
    "featured_placement_boosts_per_month",
    "platform_fee_on_payouts_percent",
  ]),
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

const currencySymbol = (c?: string) => (c === "INR" ? "₹" : c === "EUR" ? "€" : "$");

const nice = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const hasUnlimitedFlag = (v: FV) =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  ((v as any).unlimited === true || (v as any).Unlimited === true);

const isUnlimited = (_k: string, v: FV) => v === Infinity || hasUnlimitedFlag(v);

const formatValue = (key: string, v: FV): string => {
  if (isUnlimited(key, v)) {
    const fairUse = v && typeof v === "object" && !Array.isArray(v) && (v as any).fair_use;
    return fairUse ? "Unlimited (fair use)" : "Unlimited";
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

const isManagedLikePlan = (plan: Plan) => {
  const n = (plan.name || "").toLowerCase();
  const dn = (plan.displayName || "").toLowerCase();
  const label = String((plan as any)?.label || "").toLowerCase();
  const hay = `${n} ${dn} ${label}`;
  return /(managed|management|talent_management|talent management|fully managed|enterprise)/i.test(hay);
};

const computedLabel = (role: Role, plan: Plan) => {
  const n = (plan.name || "").toLowerCase();
  if (n === "growth" && role === "Brand") return "Popular";
  if (n === "creator_plus" && role === "Influencer") return "Popular";
  if (isManagedLikePlan(plan)) return "Managed";
  return undefined;
};

const isManagedOrCustomPlan = (_role: Role, plan: Plan) => {
  if (plan.cta?.action === "book_call") return true;
  // Custom is "below" stylistically (but checkout is handled separately)
  if (plan.isCustomPricing) return true;
  return isManagedLikePlan(plan);
};

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

const rolePath = (r: Role) => (r === "Brand" ? "brand" : "influencer");

// ✅ change these keys to your real auth storage keys
const isLoggedInClient = () => {
  if (typeof window === "undefined") return false;
  const token = localStorage.getItem("token"); // <- adjust if different
  return Boolean(token);
};

type PriceMeta =
  | { kind: "starting"; price: number; suffix: "/month"; note?: string }
  | { kind: "custom"; label: "Custom" }
  | { kind: "free"; label: "Free" }
  | { kind: "monthly"; price: number; suffix: "/month" }
  | { kind: "annual"; price: number; suffix: "/year"; subline?: string; savingsLine?: string };

function getPriceMeta(plan: Plan, billing: BillingCycle): PriceMeta {
  const isFree = plan.monthlyCost <= 0 && !plan.isCustomPricing;
  const sym = currencySymbol(plan.currency);
  const annualTotal = getAnnualTotal(plan);
  const savings = calcSavings(plan);

  if (plan.isCustomPricing && plan.isStartingAt) {
    return { kind: "starting", price: plan.monthlyCost, suffix: "/month", note: "starting at" };
  }

  if (plan.isCustomPricing) return { kind: "custom", label: "Custom" };
  if (isFree) return { kind: "free", label: "Free" };

  if (billing === "annual") {
    const total = annualTotal > 0 ? annualTotal : plan.monthlyCost * 12;
    const perMonth = Math.round(total / 12);

    const subline = `${sym}${perMonth.toLocaleString()} / month billed annually${plan.annualBillingNote ? ` • ${plan.annualBillingNote}` : ""
      }`;

    const savingsLine = savings
      ? `Save ${savings.pct}% (${sym}${Math.round(savings.amount).toLocaleString()} / year)`
      : undefined;

    return { kind: "annual", price: total, suffix: "/year", subline, savingsLine };
  }

  return { kind: "monthly", price: plan.monthlyCost, suffix: "/month" };
}

function PriceBlock({
  plan,
  billing,
  variant,
}: {
  plan: Plan;
  billing: BillingCycle;
  variant: "grid" | "hero";
}) {
  const sym = currencySymbol(plan.currency);
  const meta = getPriceMeta(plan, billing);

  const bigText = variant === "grid" ? "text-4xl" : "text-4xl lg:text-5xl";
  const subText = variant === "grid" ? "text-xs" : "text-xs lg:text-sm";

  if (meta.kind === "custom") {
    return <span className={`${bigText} font-extrabold tracking-tight text-gray-900`}>{meta.label}</span>;
  }

  if (meta.kind === "free") {
    return <span className={`${bigText} font-extrabold tracking-tight text-gray-900`}>{meta.label}</span>;
  }

  if (meta.kind === "starting") {
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={`${bigText} font-extrabold tracking-tight text-gray-900`}>
            {sym}
            {Number(meta.price).toLocaleString()}
          </span>
          <span className="text-sm text-gray-500">{meta.suffix}</span>
          <span className="text-xs text-gray-500">{meta.note}</span>
        </div>
      </div>
    );
  }

  if (meta.kind === "annual") {
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={`${bigText} font-extrabold tracking-tight text-gray-900`}>
            {sym}
            {Number(meta.price).toLocaleString()}
          </span>
          <span className="text-sm text-gray-500">{meta.suffix}</span>
        </div>
        {meta.subline && <div className={`${subText} text-gray-500`}>{meta.subline}</div>}
        {meta.savingsLine && <div className="text-xs font-semibold text-emerald-700">{meta.savingsLine}</div>}
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-2">
      <span className={`${bigText} font-extrabold tracking-tight text-gray-900`}>
        {sym}
        {Number(meta.price).toLocaleString()}
      </span>
      <span className="text-sm text-gray-500">{meta.suffix}</span>
    </div>
  );
}

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  activeClassName,
  align = "center",
}: {
  label: string;
  options: { label: React.ReactNode; value: T }[];
  value: T;
  onChange: (v: T) => void;
  activeClassName: string;
  align?: "left" | "center" | "right";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState({ left: 0, width: 0 });

  const idx = Math.max(0, options.findIndex((o) => o.value === value));

  const updatePill = () => {
    const el = containerRef.current;
    const active = btnRefs.current[String(options[idx]?.value)];
    if (!el || !active) return;

    const parentRect = el.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    setPill({
      left: activeRect.left - parentRect.left,
      width: activeRect.width,
    });
  };

  // Layout effect so pill positions correctly on first paint
  useLayoutEffect(() => {
    updatePill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.length]);

  // Recompute on resize for responsiveness
  useEffect(() => {
    const onResize = () => updatePill();
    window.addEventListener("resize", onResize);

    // Optional: font loading / dynamic layout tweaks
    const t = window.setTimeout(updatePill, 50);

    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options.length]);

  const justify =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";

  return (
    <div className={`w-full sm:w-auto flex ${justify}`}>
      <div className="sr-only">{label}</div>

      <div
        ref={containerRef}
        className="relative inline-flex items-center rounded-full border border-gray-200 bg-white p-1 shadow-sm"
      >
        {/* Active pill: width matches the active word */}
        <span
          aria-hidden
          className={`absolute top-1 bottom-1 rounded-full transition-all duration-200 ${activeClassName}`}
          style={{
            transform: `translateX(${pill.left}px)`,
            width: `${pill.width - 12}px`,
          }}
        />

        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              ref={(node) => {
                btnRefs.current[String(o.value)] = node;
              }}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={active}
              className={`relative z-10 whitespace-nowrap px-4 py-2 text-sm font-semibold rounded-full transition
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-300
                ${active ? "text-gray-900" : "text-gray-600 hover:text-gray-900"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BillingToggle({
  billing,
  setBilling,
  maxSavingsPct,
  accentGradient,
}: {
  billing: BillingCycle;
  setBilling: (v: BillingCycle) => void;
  maxSavingsPct: number;
  accentGradient: string; // tailwind classes (gradient)
}) {
  const isAnnual = billing === "annual";

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setBilling("monthly")}
        className={`text-sm font-semibold transition ${!isAnnual ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
          }`}
        aria-pressed={!isAnnual}
      >
        Monthly
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={isAnnual}
        onClick={() => setBilling(isAnnual ? "monthly" : "annual")}
        className={`relative inline-flex h-8 w-14 items-center rounded-full border shadow-sm transition
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-300
          ${isAnnual ? `${accentGradient} border-transparent` : "bg-gray-200 border-gray-300"}
        `}
      >
        <span className="sr-only">Toggle billing</span>
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition duration-200 ${isAnnual ? "translate-x-7" : "translate-x-1"
            }`}
        />
      </button>

      <button
        type="button"
        onClick={() => setBilling("annual")}
        className={`text-sm font-semibold transition ${isAnnual ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
          }`}
        aria-pressed={isAnnual}
      >
        Annual
      </button>

      {maxSavingsPct > 0 && (
        <span className="hidden sm:inline-flex text-[11px] font-bold bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700">
          Save up to {maxSavingsPct}%
        </span>
      )}
    </div>
  );
}

const Pricing: React.FC = () => {
  const router = useRouter();
  const roles: Role[] = ["Brand", "Influencer"];
  const [activeRole, setActiveRole] = useState<Role>("Brand");
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await post<{ message: string; plans: Plan[] }>("/subscription/list", {
          role: activeRole,
        });

        const list = (res.plans || [])
          .slice()
          .sort((a, b) => {
            const so = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
            if (so !== 0) return so;
            return (a.monthlyCost ?? 0) - (b.monthlyCost ?? 0);
          });

        if (!cancelled) setPlans(list);
      } catch (e) {
        console.error(e);
        if (!cancelled) setError("Failed to load plans. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeRole]);

  const orderedPlans = useMemo(() => {
    const ORDER = ORDER_BY_ROLE[activeRole];
    const hidden = HIDDEN_FEATURE_KEYS_BY_ROLE[activeRole] ?? new Set<string>();

    return plans.map((p) => {
      const cleaned = (p.features || []).filter((f) => !hidden.has(f.key));

      const known = ORDER.map((k) => cleaned.find((f) => f.key === k)).filter(
        (f): f is Feature => Boolean(f)
      );

      const remaining = cleaned.filter((f) => !ORDER.includes(f.key));
      return { ...p, _ordered: [...known, ...remaining] as Feature[] };
    });
  }, [plans, activeRole]);

  /** Split: grid vs hero(below)
   * Rule: sortOrder === 4 ALWAYS goes below (even if not managed/custom).
   * Also keep managed/custom below.
   */
  const { gridPlans, belowPlans, spotlightOrder } = useMemo(() => {
    const orders = orderedPlans.map((p) => p.sortOrder ?? 0);
    const has4 = orders.includes(4);
    const heroOrder = has4 ? 4 : Math.max(0, ...orders);

    const below = orderedPlans.filter(
      (p) => (p.sortOrder ?? 0) === heroOrder || isManagedOrCustomPlan(activeRole, p)
    );

    const belowIds = new Set(below.map((p) => p.planId));
    const grid = orderedPlans.filter((p) => !belowIds.has(p.planId));

    return {
      gridPlans: grid,
      belowPlans: below.sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)),
      spotlightOrder: heroOrder,
    };
  }, [orderedPlans, activeRole]);

  const maxSavingsPct = useMemo(() => {
    const pcts = plans
      .map((p) => calcSavings(p)?.pct)
      .filter((v): v is number => typeof v === "number" && v > 0);
    return pcts.length ? Math.max(...pcts) : 0;
  }, [plans]);

  const handleSelect = async (plan: Plan) => {
    const action = plan.cta?.action;

    // Book-call always goes to contact
    if (action === "book_call") {
      router.push("/contact-us");
      return;
    }

    // Custom *without* starting price => contact
    if (plan.isCustomPricing && !plan.isStartingAt) {
      router.push("/contact-us");
      return;
    }

    const pathRole = rolePath(plan.role);
    const next = `/${pathRole}/subscriptions?checkout=1&planId=${encodeURIComponent(
      plan.planId
    )}&billing=${encodeURIComponent(billing)}`;

    // store intent (optional but helpful for refresh)
    localStorage.setItem(
      "pendingCheckout",
      JSON.stringify({ planId: plan.planId, role: plan.role, billing })
    );

    // ✅ If logged in → go subscriptions and auto-start checkout
    if (isLoggedInClient()) {
      router.push(next);
      return;
    }

    router.push(`/login?role=${plan.role}&next=${encodeURIComponent(next)}`);
  };

  const isInfluencerTheme = activeRole === "Influencer";
  const badgeClasses = isInfluencerTheme
    ? "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-900"
    : "bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white";

  const buttonClasses = isInfluencerTheme
    ? "text-gray-900 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] hover:from-[#FFCF33] hover:to-[#FFE680] focus-visible:ring-yellow-400"
    : "text-white bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:from-[#FF8C1A] hover:to-[#FF5C1E] focus-visible:ring-orange-400";

  const segmentedActive = isInfluencerTheme
    ? "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58]"
    : "bg-gradient-to-r from-[#FFA135] to-[#FF7236]";

  return (
    <section id="pricing" className="relative py-20 bg-gray-50 font-lexend">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">Pricing</h2>
          <p className="text-lg text-gray-600 mt-3">Simple, transparent pricing. Start free, upgrade as you grow.</p>

          {/* Toggles */}
          <div className="mt-8">
            {/* Role toggle centered */}
            <div className="flex justify-center">
              <SegmentedControl<Role>
                label="Select role"
                options={[
                  { label: "Brands", value: "Brand" },
                  { label: "Influencers", value: "Influencer" },
                ]}
                value={activeRole}
                onChange={(v) => setActiveRole(v)}
                activeClassName={segmentedActive}
              />
            </div>

            {/* Billing toggle BELOW role, aligned to the RIGHT */}
            <div className="mt-4 flex justify-center sm:justify-end">
              <BillingToggle
                billing={billing}
                setBilling={setBilling}
                maxSavingsPct={maxSavingsPct}
                accentGradient={segmentedActive}
              />
            </div>

            {billing === "annual" && (
              <div className="mt-2 flex justify-center sm:justify-end">
                <div className="text-xs text-gray-500">Quotas reset monthly • Billing is annual</div>
              </div>
            )}
          </div>
        </div>

        {/* Grid plans (first 3) */}
        <div className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {loading &&
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-[560px] bg-white rounded-3xl border border-gray-200 shadow-sm animate-pulse" />
            ))}

          {!loading &&
            !error &&
            gridPlans.map((plan) => {
              const id = plan._id || plan.planId;
              const badge = computedLabel(activeRole, plan);

              const isFree = plan.monthlyCost <= 0 && !plan.isCustomPricing;
              const ctaText =
                plan.cta?.text || (plan.isCustomPricing ? "Contact Us" : isFree ? "Start for Free" : "Choose Plan");

              const borderClasses = badge
                ? isInfluencerTheme
                  ? "border-yellow-300"
                  : "border-orange-300"
                : "border-gray-200";

              return (
                <div
                  key={id}
                  className={`group relative flex flex-col h-full rounded-3xl bg-white shadow-sm transition-all hover:shadow-xl border ${borderClasses}`}
                >
                  {/* Badge */}
                  {badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold py-1.5 px-3 rounded-full shadow ${badgeClasses}`}>
                        <Star className="w-3 h-3 fill-current" /> {badge}
                      </span>
                    </div>
                  )}

                  {/* Header */}
                  <div className="px-8 pt-8 pb-6 min-h-[180px] flex flex-col">
                    <h3 className="text-2xl font-bold text-gray-900">{plan.displayName || nice(plan.name)}</h3>

                    {(plan.bestFor || plan.mainOutcome) && (
                      <div className="mt-3 text-sm text-gray-600 space-y-1">
                        {plan.bestFor && (
                          <div>
                            <span className="font-semibold text-gray-700">Best for:</span> {plan.bestFor}
                          </div>
                        )}
                        {plan.mainOutcome && <div className="text-gray-500">{plan.mainOutcome}</div>}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-200" />

                  {/* Price + CTA */}
                  <div className="px-8 py-6 text-center min-h-[170px] flex flex-col items-center justify-center">
                    <PriceBlock plan={plan} billing={billing} variant="grid" />

                    <button
                      onClick={() => handleSelect(plan)}
                      className={`mt-4 w-full py-3 text-sm font-semibold rounded-md shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${buttonClasses}`}
                    >
                      {ctaText}
                    </button>
                  </div>

                  {/* Features */}
                  <ul className="px-8 pb-8 space-y-3 mb-auto">
                    {plan._ordered?.map(({ key, value, note }: Feature) => {
                      const display = formatValue(key, value);
                      const ok = isPositive(key, value);
                      const label = LABELS[key] || nice(key);

                      return (
                        <li key={key} className={`flex items-start gap-3 ${ok ? "text-gray-800" : "text-gray-400"}`}>
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
                            {note && <span className="ml-1 text-xs text-gray-500">({note})</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
        </div>

        {/* HERO plan(s) below (includes ALWAYS sortOrder 4) */}
        {!loading && !error && belowPlans.length > 0 && (
          <div className="mt-12 space-y-10">
            {belowPlans.map((plan) => {
              const id = plan._id || plan.planId;
              const badge = computedLabel(activeRole, plan);

              const isHero = (plan.sortOrder ?? 0) === spotlightOrder;
              const borderColor = isInfluencerTheme ? "border-yellow-300" : "border-orange-300";

              const heroWrapper = isHero
                ? "rounded-[2rem] border bg-white shadow-sm overflow-hidden lg:min-h-[70vh]"
                : "rounded-[2rem] border bg-white shadow-sm overflow-hidden";

              return (
                <div key={id} className="relative">
                  {badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold py-1.5 px-3 rounded-full shadow ${badgeClasses}`}>
                        <Star className="w-3 h-3 fill-current" /> {badge}
                      </span>
                    </div>
                  )}

                  <div className={`${heroWrapper} ${borderColor}`}>
                    {/* Top accent */}
                    <div className={`h-1 w-full ${segmentedActive}`} />

                    <div className="lg:grid lg:grid-cols-12">
                      {/* Left */}
                      <div className="lg:col-span-5 px-8 py-10 flex flex-col justify-center">
                        <h3 className="text-3xl lg:text-5xl font-extrabold text-gray-900">
                          {plan.displayName || nice(plan.name)}
                        </h3>

                        <p className="mt-4 text-base lg:text-lg text-gray-600">
                          {plan.mainOutcome ||
                            plan.bestFor ||
                            "Best for teams that want an end-to-end solution."}
                        </p>

                        <div className="mt-6">
                          <PriceBlock plan={plan} billing={billing} variant="hero" />
                        </div>

                        <div className="mt-6 flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={() => handleSelect(plan)}
                            className={`inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-md shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${buttonClasses}`}
                          >
                            <CreditCard className="w-4 h-4 mr-2" />
                            {plan.cta?.text || (plan.isCustomPricing && !plan.isStartingAt ? "Contact Us" : "Get Started")}
                          </button>

                          <Link
                            href="/contact-us"
                            className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold rounded-md border border-gray-200 bg-white hover:bg-gray-50 text-gray-900"
                          >
                            Talk to us
                          </Link>
                        </div>

                        <div className="mt-4 text-xs text-gray-500">
                          {isHero ? "This plan is built for serious scaling." : "Need a custom setup? We can help."}
                        </div>
                      </div>

                      {/* Right */}
                      <div className="lg:col-span-7 px-8 py-10 border-t lg:border-t-0 lg:border-l border-gray-200">
                        <div className="flex items-center justify-between gap-3 mb-5">
                          <h4 className="text-sm font-bold text-gray-900 tracking-wide uppercase">
                            What you get
                          </h4>
                          {isHero && (
                            <span className="text-xs font-semibold bg-gray-100 rounded-full px-3 py-1 text-gray-700">
                              Spotlight plan
                            </span>
                          )}
                        </div>

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
                                    {display && display !== "Included" && display !== "Unlimited" && display !== "—" ? (
                                      <>
                                        : <strong>{display}</strong>
                                      </>
                                    ) : display === "Unlimited" ? (
                                      <>
                                        {" "}
                                        — <strong>Unlimited</strong>
                                      </>
                                    ) : display === "Included" ? (
                                      <>
                                        {" "}
                                        — <strong>Included</strong>
                                      </>
                                    ) : null}
                                    {note && <span className="ml-1 text-[11px] text-gray-500">({note})</span>}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="text-center text-red-600 mt-8">{error}</p>}

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
    </section>
  );
};

export default Pricing;
