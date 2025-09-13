// =============================================
// === file: app/brand/browse-influencers/components/FilterSidebarPro.tsx
// =============================================
"use client";

import React, { useMemo, useState } from "react";
import { BadgeCheck, CheckCircle2, Flag, Globe, Hash, Mail, SearchCheck, User, Users2, Youtube, Instagram, Music2, CalendarClock, SortDesc, RefreshCw, SlidersHorizontal, CircleHelp, Filter, Percent, Eye, ThumbsUp, PlayCircle, Tag, AtSign } from "lucide-react";
import type { Category, Country, CountryOption, Option, Platform, SearchFilters } from "../types";
import { cn } from "@/lib/utils"; // if you don't have cn, replace with a simple join

// Lightweight platform pill
function PlatformPill({ label, active, icon, onClick }: { label: Platform; active: boolean; icon: React.ReactNode; onClick: () => void; }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition",
        active ? "text-white bg-gradient-to-r from-[#FFA135] to-[#FF7236] border-transparent" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
      )}
    >
      <span className="inline-flex items-center justify-center w-5 h-5">{icon}</span>
      <span className="font-medium capitalize">{label}</span>
    </button>
  );
}

function Section({ title, right, children, defaultOpen = true }: { title: string; right?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border bg-white">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="text-sm font-semibold flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-gray-500" /> {title}</div>
        <div className="flex items-center gap-2">
          {right}
          <button onClick={() => setOpen((v) => !v)} className="text-xs text-gray-600 hover:underline">{open ? "Hide" : "Show"}</button>
        </div>
      </div>
      {open && <div className="px-3 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

function Labeled({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1">{icon} {label}</div>
      {children}
    </div>
  );
}

export function FilterSidebarPro({
  open,
  onClose,
  categories,
  countries,
  audienceSizeOptions,
  ageOptions,
  platformOptions,
  selectedPlatforms,
  setSelectedPlatforms,
  sortBy,
  setSortBy,
  filters,
  setFilters,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  countries: Country[];
  audienceSizeOptions: { _id: string; range: string }[];
  ageOptions: Option[];
  platformOptions: Option[];
  selectedPlatforms: Platform[];
  setSelectedPlatforms: (v: Platform[]) => void;
  sortBy: "relevance" | "followers" | "engagement" | "recent";
  setSortBy: (v: any) => void;
  filters: SearchFilters;
  setFilters: (fn: (prev: SearchFilters) => SearchFilters | SearchFilters) => void;
  onApply: () => void;
}) {
  const isIG = selectedPlatforms.length === 1 && selectedPlatforms.includes("instagram");
  const isTT = selectedPlatforms.length === 1 && selectedPlatforms.includes("tiktok");
  const isYT = selectedPlatforms.length === 1 && selectedPlatforms.includes("youtube");
  const multi = selectedPlatforms.length > 1;

  const togglePlatform = (p: Platform) => {
    if (selectedPlatforms.includes(p)) {
      setSelectedPlatforms(selectedPlatforms.filter((x: Platform) => x !== p));
    } else {
      setSelectedPlatforms([...selectedPlatforms, p]);
    }
  };

  const set = (patch: Partial<SearchFilters>) => setFilters((prev) => ({ ...prev, ...patch }));

  return (
    <aside className="hidden md:flex fixed left-[21rem] top-0 h-screen w-72 lg:w-80 xl:w-[22rem] border-r bg-white z-40 overflow-y-auto">
      <div className="w-full p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Filters</div>
          <button onClick={onClose} className="text-sm text-gray-500 hover:underline">Close</button>
        </div>

        {/* Platforms */}
        <Section title="Platforms" right={<span className="text-[11px] text-gray-500">Choose one or many</span>}>
          <div className="grid grid-cols-2 gap-2">
            <PlatformPill label="youtube" active={selectedPlatforms.includes("youtube")} onClick={() => togglePlatform("youtube")} icon={<Youtube className="w-4 h-4" />} />
            <PlatformPill label="tiktok" active={selectedPlatforms.includes("tiktok")} onClick={() => togglePlatform("tiktok")} icon={<Music2 className="w-4 h-4" />} />
            <PlatformPill label="instagram" active={selectedPlatforms.includes("instagram")} onClick={() => togglePlatform("instagram")} icon={<Instagram className="w-4 h-4" />} />
          </div>
        </Section>

        {/* Quick */}
        <Section title="Quick" defaultOpen>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Verified only" icon={<BadgeCheck className="w-3.5 h-3.5" />}> 
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!filters.verifiedOnly} onChange={(e) => set({ verifiedOnly: e.target.checked })} />
                Limit to verified
              </label>
            </Labeled>

            <Labeled label="Sort" icon={<SortDesc className="w-3.5 h-3.5" />}>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                <option value="relevance">Relevance</option>
                <option value="followers">Followers</option>
                <option value="engagement">Engagement</option>
                <option value="recent">Recent</option>
              </select>
            </Labeled>
          </div>
        </Section>

        {/* Influencer */}
        <Section title="Influencer">
          <div className="space-y-3">
            {/* Followers */}
            <Labeled label="Followers (min–max)" icon={<Users2 className="w-3.5 h-3.5" />}>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="0" value={filters.minFollowers ?? 0} onChange={(e) => set({ minFollowers: Number(e.target.value) || 0 })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <input type="number" placeholder="10,000,000" value={filters.maxFollowers ?? 10_000_000} onChange={(e) => set({ maxFollowers: Number(e.target.value) || 10_000_000 })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </div>
            </Labeled>

            {/* Engagement % */}
            <Labeled label="Engagement rate % (min–max)" icon={<Percent className="w-3.5 h-3.5" />}>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="0.1" placeholder="0" value={filters.minEngagement ?? 0} onChange={(e) => set({ minEngagement: Number(e.target.value) || 0 })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <input type="number" step="0.1" placeholder="100" value={filters.maxEngagement ?? 100} onChange={(e) => set({ maxEngagement: Number(e.target.value) || 100 })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">Converted to ratio for Modash automatically.</p>
            </Labeled>

            {/* Language / Gender / Last posted */}
            <div className="grid grid-cols-3 gap-2">
              <Labeled label="Lang" icon={<Globe className="w-3.5 h-3.5" />}>
                <input placeholder="en" value={filters.languageCode ?? ""} onChange={(e) => set({ languageCode: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </Labeled>
              <Labeled label="Gender" icon={<User className="w-3.5 h-3.5" />}>
                <select value={filters.influencerGender ?? ""} onChange={(e) => set({ influencerGender: (e.target.value || undefined) as any })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option value="">Any</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </Labeled>
              <Labeled label="Last posted (days)" icon={<CalendarClock className="w-3.5 h-3.5" />}>
                <input type="number" min={1} placeholder="90" value={filters.lastPostedDays ?? 90} onChange={(e) => set({ lastPostedDays: Number(e.target.value) || undefined })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </Labeled>
            </div>

            {/* Contact / Artist */}
            <div className="grid grid-cols-2 gap-2">
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!filters.hasEmail} onChange={(e) => set({ hasEmail: e.target.checked })} /> <Mail className="w-3.5 h-3.5" /> Has email</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!filters.isOfficialArtist} onChange={(e) => set({ isOfficialArtist: e.target.checked })} /> <CheckCircle2 className="w-3.5 h-3.5" /> Official artist</label>
            </div>

            {/* Bio contains */}
            <Labeled label="Bio contains" icon={<SearchCheck className="w-3.5 h-3.5" />}>
              <input placeholder="e.g. photos videos" value={filters.bioQuery ?? ""} onChange={(e) => set({ bioQuery: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            </Labeled>

            {/* Views */}
            <div className="grid grid-cols-2 gap-2">
              <Labeled label="Min views" icon={<Eye className="w-3.5 h-3.5" />}>
                <input type="number" value={filters.viewsMin ?? ""} onChange={(e) => set({ viewsMin: e.target.value ? Number(e.target.value) : undefined })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </Labeled>
              <Labeled label="Max views" icon={<Eye className="w-3.5 h-3.5" />}>
                <input type="number" value={filters.viewsMax ?? ""} onChange={(e) => set({ viewsMax: e.target.value ? Number(e.target.value) : undefined })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </Labeled>
            </div>

            {/* Keywords */}
            <Labeled label="Keywords (comma separated)" icon={<Tag className="w-3.5 h-3.5" />}>
              <input
                placeholder="fashion, travel, tech"
                value={(filters.keywords || []).join(", ")}
                onChange={(e) => set({ keywords: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />
            </Labeled>

            {/* Text tags */}
            <div className="grid grid-cols-2 gap-2">
              <Labeled label="# Hashtag" icon={<Hash className="w-3.5 h-3.5" />}>
                <input placeholder="carsofinstagram" onChange={(e) => set({ relevanceTags: e.target.value ? ["#" + e.target.value.replace(/^#/, "")] : undefined })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </Labeled>
              <Labeled label="@ Mention" icon={<AtSign className="w-3.5 h-3.5" />}>
                <input placeholder="topgear" onChange={(e) => set({ audienceRelevanceTags: e.target.value ? ["@" + e.target.value.replace(/^@/, "")] : undefined })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </Labeled>
            </div>

            {/* Followers growth */}
            <Labeled label="Followers growth (value & operator)" icon={<RefreshCw className="w-3.5 h-3.5" />}>
              <div className="grid grid-cols-3 gap-2">
                <select value={filters.followersGrowthRate?.interval ?? "i1month"} onChange={(e) => set({ followersGrowthRate: { interval: e.target.value as any, value: filters.followersGrowthRate?.value ?? 0.1, operator: filters.followersGrowthRate?.operator ?? "gt" } })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option value="i1month">1m</option>
                  <option value="i3months">3m</option>
                  <option value="i6months">6m</option>
                  <option value="i12months">12m</option>
                </select>
                <input type="number" step="0.01" placeholder="0.10" value={filters.followersGrowthRate?.value ?? ""} onChange={(e) => set({ followersGrowthRate: { interval: filters.followersGrowthRate?.interval ?? "i1month", value: Number(e.target.value), operator: filters.followersGrowthRate?.operator ?? "gt" } })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <select value={filters.followersGrowthRate?.operator ?? "gt"} onChange={(e) => set({ followersGrowthRate: { interval: filters.followersGrowthRate?.interval ?? "i1month", value: filters.followersGrowthRate?.value ?? 0, operator: e.target.value as any } })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option value="gt">&gt;</option>
                  <option value="lt">&lt;</option>
                  <option value="eq">=</option>
                </select>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">Fraction (0.20 = 20%)</p>
            </Labeled>
          </div>
        </Section>

        {/* Audience */}
        <Section title="Audience">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Labeled label="Male %" icon={<Users2 className="w-3.5 h-3.5" />}>
                <select className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option>All</option><option>0–10%</option><option>10–25%</option><option>25–50%</option><option>50–75%</option><option>75–100%</option>
                </select>
              </Labeled>
              <Labeled label="Female %" icon={<Users2 className="w-3.5 h-3.5" />}>
                <select className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option>All</option><option>0–10%</option><option>10–25%</option><option>25–50%</option><option>50–75%</option><option>75–100%</option>
                </select>
              </Labeled>
            </div>
            <Labeled label="Age group" icon={<Users2 className="w-3.5 h-3.5" />}>
              <select className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm">
                <option>All Ages</option>
                {ageOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Labeled>
            {/* Optional weighting knobs (ids + weights) can be added here if needed */}
          </div>
        </Section>

        {/* Instagram-specific */}
        {(isIG || multi) && (
          <Section title={`Instagram-specific ${multi ? "(when IG selected)" : ""}`} defaultOpen={isIG}>
            <div className="space-y-3">
              <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={!!(filters as any).hasSponsoredPosts} onChange={(e) => set({ hasSponsoredPosts: e.target.checked } as any)} /> Has sponsored posts</label>
              <div className="grid grid-cols-2 gap-2">
                <Labeled label="Reels plays min" icon={<PlayCircle className="w-3.5 h-3.5" />}>
                  <input type="number" value={(filters as any).reelsPlaysMin ?? ""} onChange={(e) => set({ reelsPlaysMin: e.target.value ? Number(e.target.value) : undefined } as any)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                </Labeled>
                <Labeled label="Reels plays max" icon={<PlayCircle className="w-3.5 h-3.5" />}>
                  <input type="number" value={(filters as any).reelsPlaysMax ?? ""} onChange={(e) => set({ reelsPlaysMax: e.target.value ? Number(e.target.value) : undefined } as any)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                </Labeled>
              </div>
              <Labeled label="Account types (IDs)" icon={<CircleHelp className="w-3.5 h-3.5" />}>
                <input placeholder="e.g. 2, 7" onChange={(e) => set({ accountTypes: e.target.value.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)) } as any)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </Labeled>
              <Labeled label="Brands (IDs)" icon={<Tag className="w-3.5 h-3.5" />}>
                <input placeholder="e.g. 1708, 13" onChange={(e) => set({ brands: e.target.value.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)) } as any)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </Labeled>
              <Labeled label="Interests (IDs)" icon={<Tag className="w-3.5 h-3.5" />}>
                <input placeholder="e.g. 3, 21, 1" onChange={(e) => set({ interests: e.target.value.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)) } as any)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
              </Labeled>
            </div>
          </Section>
        )}

        {/* TikTok-specific */}
        {(isTT || multi) && (
          <Section title={`TikTok-specific ${multi ? "(when TikTok selected)" : ""}`} defaultOpen={isTT}>
            <div className="space-y-3">
              <Labeled label="Likes growth" icon={<ThumbsUp className="w-3.5 h-3.5" />}>
                <div className="grid grid-cols-3 gap-2">
                  <select onChange={(e) => set({ likesGrowthRate: { interval: e.target.value as any, value: (filters as any).likesGrowthRate?.value ?? 0.2, operator: (filters as any).likesGrowthRate?.operator ?? "gt" } } as any)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                    <option value="i1month">1m</option>
                    <option value="i3months">3m</option>
                    <option value="i6months">6m</option>
                  </select>
                  <input type="number" step="0.01" placeholder="0.20" onChange={(e) => set({ likesGrowthRate: { interval: (filters as any).likesGrowthRate?.interval ?? "i1month", value: Number(e.target.value), operator: (filters as any).likesGrowthRate?.operator ?? "gt" } } as any)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                  <select onChange={(e) => set({ likesGrowthRate: { interval: (filters as any).likesGrowthRate?.interval ?? "i1month", value: (filters as any).likesGrowthRate?.value ?? 0, operator: e.target.value as any } } as any)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                    <option value="gt">&gt;</option>
                    <option value="lt">&lt;</option>
                    <option value="eq">=</option>
                  </select>
                </div>
              </Labeled>
              <div className="grid grid-cols-2 gap-2">
                <Labeled label="Shares min" icon={<RefreshCw className="w-3.5 h-3.5" />}>
                  <input type="number" onChange={(e) => set({ sharesMin: e.target.value ? Number(e.target.value) : undefined } as any)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                </Labeled>
                <Labeled label="Shares max" icon={<RefreshCw className="w-3.5 h-3.5" />}>
                  <input type="number" onChange={(e) => set({ sharesMax: e.target.value ? Number(e.target.value) : undefined } as any)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                </Labeled>
                <Labeled label="Saves min" icon={<RefreshCw className="w-3.5 h-3.5" />}>
                  <input type="number" onChange={(e) => set({ savesMin: e.target.value ? Number(e.target.value) : undefined } as any)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                </Labeled>
                <Labeled label="Saves max" icon={<RefreshCw className="w-3.5 h-3.5" />}>
                  <input type="number" onChange={(e) => set({ savesMax: e.target.value ? Number(e.target.value) : undefined } as any)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                </Labeled>
              </div>
              {/* Text tags already available in Influencer section via #/@ */}
            </div>
          </Section>
        )}

        {/* YouTube-specific */}
        {(isYT || multi) && (
          <Section title={`YouTube-specific ${multi ? "(when YouTube selected)" : ""}`} defaultOpen={isYT}>
            <Labeled label="Views growth" icon={<Eye className="w-3.5 h-3.5" />}>
              <div className="grid grid-cols-3 gap-2">
                <select onChange={(e) => set({ viewsGrowthRate: { interval: e.target.value as any, value: (filters as any).viewsGrowthRate?.value ?? 0.2, operator: (filters as any).viewsGrowthRate?.operator ?? "gt" } } as any)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option value="i1month">1m</option>
                  <option value="i3months">3m</option>
                  <option value="i6months">6m</option>
                </select>
                <input type="number" step="0.01" placeholder="0.20" onChange={(e) => set({ viewsGrowthRate: { interval: (filters as any).viewsGrowthRate?.interval ?? "i1month", value: Number(e.target.value), operator: (filters as any).viewsGrowthRate?.operator ?? "gt" } } as any)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                <select onChange={(e) => set({ viewsGrowthRate: { interval: (filters as any).viewsGrowthRate?.interval ?? "i1month", value: (filters as any).viewsGrowthRate?.value ?? 0, operator: e.target.value as any } } as any)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <option value="gt">&gt;</option>
                  <option value="lt">&lt;</option>
                  <option value="eq">=</option>
                </select>
              </div>
            </Labeled>
          </Section>
        )}

        {/* Footer actions */}
        <div className="sticky bottom-0 left-0 right-0 bg-white pt-3 pb-1 border-t">
          <div className="flex gap-2">
            <button onClick={onApply} className="flex-1 rounded-xl px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:opacity-90">
              Apply Filters
            </button>
            <button
              type="button"
              onClick={() => {
                setFilters({ minFollowers: 0, maxFollowers: 10_000_000, minEngagement: 0, maxEngagement: 100, location: "", categories: [], verifiedOnly: false } as any);
              }}
              className="rounded-xl px-4 py-2 text-sm border border-gray-200"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
