"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Check, X, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api";

type Role = "Brand" | "Influencer";
type FeatureValue = number | boolean | string | string[] | Record<string, any> | null | undefined;

interface Feature { key: string; value: FeatureValue; note?: string; }
interface Addon { key: string; name: string; type: "one_time" | "recurring"; price: number; currency?: string; payload?: any; }
interface Plan {
  _id?: string;
  planId: string;
  role: Role;
  name: string;
  displayName?: string;
  label?: string;
  overview?: string;
  monthlyCost: number;
  currency?: string;
  isCustomPricing?: boolean;
  sortOrder?: number;
  features: Feature[];
  addons?: Addon[];
  _ordered?: Feature[];
}

/** Labels */
const LABELS: Record<string, string> = {
  // Brand (new keys)
  searches_per_month: "Searches / month",
  profile_views_per_month: "Profile views / month",
  invites_per_month: "Invites / month",
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
  // Legacy fallbacks
  monthly_credits: "Monthly credits",
  live_campaigns_limit: "Live campaigns",
  search_cached_only: "Search mode (cached)",
  search_fresh_uses_credits: "Fresh search uses credits",
  view_full_profiles_uses_credits: "Full profile uses credits",
  milestones_access: "Milestones",
  contracts_access: "Contracts",
  dispute_support: "Dispute support",
  profile_preview_only: "Profile preview only",
  // Influencer
  apply_to_campaigns_quota: "Campaign applications / month",
  active_collaborations_limit: "Active collaborations",
  media_kit: "Media Kit",
  media_kit_items_limit: "Media-kit items",
  saved_searches: "Saved searches",
  connect_instagram: "Connect Instagram",
  connect_youtube: "Connect YouTube",
  connect_tiktok: "Connect TikTok",
  contract_esign_basic: "Contract e-sign (template)",
  contract_esign_download_pdf: "Download signed PDF",
  dispute_channel: "Dispute channel",
  media_kit_sections: "Media-kit sections",
  media_kit_builder: "Media-kit builder",
  team_manager_tools: "Team / Manager tools",
  team_manager_tools_managed_creators: "Manage creators",
  dashboard_access: "Dashboard access",
};

const ORDER_BY_ROLE: Record<Role, string[]> = {
  Brand: [
    "searches_per_month","profile_views_per_month","invites_per_month","active_campaigns_limit",
    "custom_messaging","advanced_filters","support_channels","dedicated_account_manager","dedicated_manager",
    "dispute_assistance","priority_verification_queue","setup_assistance","strategy_calls","sla_support",
    "flexible_billing","public_quotas_visible","message_templates_basic_limit",
    // legacy
    "monthly_credits","live_campaigns_limit","search_cached_only","search_fresh_uses_credits",
    "view_full_profiles_uses_credits","milestones_access","contracts_access","dispute_support","profile_preview_only",
  ],
  Influencer: [
    "apply_to_campaigns_quota","active_collaborations_limit","media_kit","support_channels",
    "team_manager_tools","team_manager_tools_managed_creators","dashboard_access",
    // optional/legacy
    "media_kit_items_limit","saved_searches","connect_instagram","connect_youtube","connect_tiktok",
    "contract_esign_basic","contract_esign_download_pdf","dispute_channel","media_kit_sections","media_kit_builder",
  ],
};

const ZERO_IS_UNLIMITED = new Set<string>(["apply_to_campaigns_quota","live_campaigns_limit"]);
const BOOLEAN_KEYS = new Set<string>([
  "custom_messaging","advanced_filters","dedicated_account_manager","dedicated_manager","dispute_assistance",
  "public_quotas_visible","setup_assistance","priority_verification_queue","strategy_calls","sla_support","flexible_billing",
  "contact_admin_flow",
  // legacy
  "search_cached_only","search_fresh_uses_credits","view_full_profiles_uses_credits","in_app_messaging","milestones_access",
  "contracts_access","dispute_support","profile_preview_only","saved_searches","media_kit_builder","connect_instagram",
  "connect_youtube","connect_tiktok","contract_esign_basic","contract_esign_download_pdf","dispute_channel",
]);

const SUPPORT_PRETTY: Record<string,string> = { chat:"Chat support", email:"Email support", phone:"Phone support" };
type FV = FeatureValue;
const isUnlimited = (k:string,v:FV) => v===Infinity || (typeof v==="number" && v===0 && ZERO_IS_UNLIMITED.has(k));
const currencySymbol = (c?:string) => (c==="INR"?"₹":c==="EUR"?"€":"$");
const isEnterpriseBrand = (p:Plan) => p.role==="Brand" && p.name?.toLowerCase()==="enterprise";
const computedLabel = (role:Role,plan:Plan) =>
  plan.label || ((role==="Brand" && plan.name==="growth") || (role==="Influencer" && plan.name==="creator_plus") ? "Popular" : undefined);
const nice = (s:string) => s.replace(/_/g," ").replace(/^\w/,c=>c.toUpperCase());

const formatValue = (key:string, v:FV): string => {
  if (isUnlimited(key,v)) return "Unlimited";
  if (key==="support_channels" && Array.isArray(v)) return v.map(s=>SUPPORT_PRETTY[String(s).toLowerCase()] ?? String(s)).join(" + ");
  if (key==="media_kit" && typeof v==="string") return v==="included_standard"?"Included (Standard)": v==="included"?"Included": nice(v);
  if (key==="team_manager_tools_managed_creators" && v && typeof v==="object") {
    const {min,max} = v as any; if (min!=null && max!=null) return `Manage ${min}–${max} creators`;
  }
  if (Array.isArray(v)) return v.length ? v.join(", ") : "None";
  if (BOOLEAN_KEYS.has(key)) return Boolean(v) ? "Yes" : "No";
  if (v==null || v==="") return "—";
  if (typeof v==="number") return v.toLocaleString();
  return String(v);
};

const isPositive = (key:string,v:FV) => {
  if (isUnlimited(key,v)) return true;
  if (BOOLEAN_KEYS.has(key)) return Boolean(v);
  if (typeof v==="boolean") return v;
  if (typeof v==="number") return v>0;
  if (Array.isArray(v)) return v.length>0;
  if (typeof v==="object") return true;
  return Boolean(v);
};

const Pricing: React.FC = () => {
  const router = useRouter();
  const roles: Role[] = ["Brand","Influencer"];
  const [activeRole, setActiveRole] = useState<Role>("Brand");

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  useEffect(()=>{ (async ()=>{
    setLoading(true); setError(null);
    try{
      const res = await post<{message:string; plans:Plan[]}>("/subscription/list", { role: activeRole });
      const list = (res.plans || []).slice().sort((a,b)=> (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
      setPlans(list);
    }catch(e){ console.error(e); setError("Failed to load plans. Please try again."); }
    finally{ setLoading(false); }
  })(); },[activeRole]);

  const orderedPlans = useMemo(()=>{
    const ORDER = ORDER_BY_ROLE[activeRole];
    return plans.map((p)=>{
      const known = ORDER.map(k=>p.features.find(f=>f.key===k)).filter((f):f is Feature => Boolean(f));
      const remaining = p.features.filter(f=>!ORDER.includes(f.key));
      return { ...p, _ordered: [...known, ...remaining] as Feature[] };
    });
  },[plans,activeRole]);

  const handleSelect = async (plan:Plan) => {
    if (isEnterpriseBrand(plan)) { router.push("/contact-us"); return; }
    try{
      const r = await post<{checkoutUrl?:string}>("/subscription/checkout", { planId: plan.planId });
      if (r?.checkoutUrl) window.location.href = r.checkoutUrl;
      else router.push("/login");
    }catch{ router.push("/login"); }
  };

  return (
    <section id="pricing" className="relative py-20 bg-gray-50 font-lexend">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900">Pricing</h2>
          <p className="text-lg text-gray-600 mt-3">Simple, transparent pricing. Start free, upgrade as you grow.</p>

          <div className="inline-flex mt-8 bg-gray-200 rounded-2xl p-1">
            {["Brand","Influencer"].map((role)=>(
              <button
                key={role}
                onClick={()=>setActiveRole(role as Role)}
                aria-pressed={activeRole===role}
                className={`px-6 py-2 rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400 ${
                  activeRole===role ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {role}s
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading && [...Array(3)].map((_,i)=>(
            <div key={i} className="h-[560px] bg-white rounded-3xl border border-gray-200 shadow-sm animate-pulse" />
          ))}

          {!loading && !error && orderedPlans.map((plan)=>{
            const id = plan._id || plan.planId;
            const badge = computedLabel(activeRole, plan);
            const isEnterprise = isEnterpriseBrand(plan);
            const isFree = plan.monthlyCost<=0 && !plan.isCustomPricing;
            const sym = currencySymbol(plan.currency);

            return (
              <div
                key={id}
                className={`group relative flex flex-col h-full rounded-3xl border bg-white shadow-sm transition-all hover:shadow-xl ${
                  badge ? "border-orange-300" : "border-gray-200"
                }`}
              >
                {/* Badge */}
                {badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-white py-1.5 px-3 rounded-full shadow
                      bg-gradient-to-r from-[#FFA135] to-[#FF7236]">
                      <Star className="w-3 h-3 fill-current" /> {badge}
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="px-8 pt-8">
                  <h3 className="text-2xl font-bold text-gray-900">
                    {plan.displayName || nice(plan.name)}
                  </h3>
                  <p className="text-gray-600 mt-2">
                    {plan.overview ||
                      (isEnterprise
                        ? "For larger teams needing custom quotas, billing and support."
                        : "For individuals and teams growing their collaborations.")}
                  </p>
                </div>

                {/* Divider */}
                <div className="mt-6 border-t border-gray-200" />

                {/* Price (centered) + rectangular CTA below */}
                <div className="px-8 py-6 text-center">
                  {isEnterprise ? (
                    <span className="text-4xl font-extrabold tracking-tight text-gray-900">Custom</span>
                  ) : isFree ? (
                    <>
                      <span className="text-4xl font-extrabold tracking-tight text-gray-900">Free</span>
                    </>
                  ) : (
                    <div className="flex items-baseline justify-center gap-2">
                      <span className="text-4xl font-extrabold tracking-tight text-gray-900">
                        {sym}{plan.monthlyCost.toLocaleString()}
                      </span>
                      <span className="text-sm text-gray-500">/month</span>
                    </div>
                  )}

                  <button
                    onClick={()=>handleSelect(plan)}
                    className="mt-4 w-full py-3 text-sm font-semibold text-white
                      bg-gradient-to-r from-[#FFA135] to-[#FF7236]
                      hover:from-[#FF8C1A] hover:to-[#FF5C1E]
                      rounded-md shadow focus-visible:outline-none
                      focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-400"
                  >
                    {isEnterprise ? "Contact Us" : isFree ? "Start for Free" : "Chose Plan"}
                  </button>
                </div>

                {/* Feature list */}
                <ul className="px-8 pb-8 space-y-3 mt-auto">
                  {(plan as any)._ordered?.map(({ key, value, note }: Feature) => {
                    const display = formatValue(key, value);
                    const ok = isPositive(key, value);
                    const label = LABELS[key] || nice(key);

                    return (
                      <li key={key} className={`flex items-start gap-3 ${ok ? "text-gray-800" : "text-gray-400"}`}>
                        <span className={`mt-0.5 inline-flex items-center justify-center rounded-sm ring-1 h-5 w-5 flex-shrink-0
                          ${ok ? "bg-green-50 text-green-600 ring-green-200" : "bg-gray-100 text-gray-400 ring-gray-200"}`}>
                          {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        </span>
                        <span className="text-[15px] leading-6">
                          {label}
                          {display && display !== "Yes" && display !== "Unlimited" && display !== "—" ? (
                            <>: <strong>{display}</strong></>
                          ) : display === "Unlimited" ? (
                            <> — <strong>Unlimited</strong></>
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

        {error && <p className="text-center text-red-600 mt-8">{error}</p>}

        {/* Footnote */}
        <p className="text-center text-gray-500 text-sm mt-12">
          All paid plans include a 7-day Money-Back Guarantee • No setup fees • Cancel any time
        </p>
      </div>
    </section>
  );
};

export default Pricing;
