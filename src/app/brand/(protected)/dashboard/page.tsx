"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  HiOutlineChartBar,
  HiOutlineUsers,
  HiOutlineCurrencyDollar,
  HiSearch,
} from "react-icons/hi";
import { format } from "date-fns";
import { post } from "@/lib/api";

/* ---------------- types ---------------- */

type CampaignRow = {
  id: string;
  campaignsId: string;
  productOrServiceName: string;
  goal: string;
  budget: number;
  isActive: number;
  createdAt: string | null;

  hasAcceptedInfluencer: boolean;
  influencerId: string | null;
  contractId: string | null;

  appliedInfluencersCount: number;
};

type BrandDashboardHomePayload = {
  brandName: string;
  totalCreatedCampaigns: number;
  totalHiredInfluencers: number;
  totalAppliedInfluencers: number;
  budgetRemaining: number;

  campaignsMode: "all" | "accepted";
  campaigns: CampaignRow[];
};

type InboxRow = {
  threadId: string;
  influencer: { influencerId: string | null; name: string };
  subject: string;
  snippet: string;
  lastMessageAt: string | null;
  lastMessageDirection: string | null;
  status: string;
};

type InboxResponse = {
  brand?: { brandId: string; name: string };
  conversations: InboxRow[];
};

/* ---------------- helpers ---------------- */

const truncate = (text: string, max = 100) => {
  const t = (text || "").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
};

const fmtDate = (d: string | null | undefined, fmt = "MMM d, yyyy") => {
  if (!d) return "";
  try {
    return format(new Date(d), fmt);
  } catch {
    return "";
  }
};

const dirLabel = (dir: string | null | undefined) => {
  const v = (dir || "").toLowerCase();
  if (v.includes("brand_to_influencer")) return "Sent";
  if (v.includes("influencer_to_brand")) return "Reply";
  return "";
};

const statusTone = (status: string | null | undefined) => {
  const s = (status || "").toLowerCase();
  if (s.includes("active")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (s.includes("archived")) return "bg-gray-50 text-gray-700 border-gray-100";
  if (s.includes("pending")) return "bg-yellow-50 text-yellow-800 border-yellow-100";
  return "bg-indigo-50 text-indigo-700 border-indigo-100";
};

/* ---------------- page ---------------- */

export default function BrandDashboardHome() {
  const router = useRouter();

  const [data, setData] = useState<BrandDashboardHomePayload | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);

  // campaigns search
  const [searchTerm, setSearchTerm] = useState("");

  // inbox preview
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [inboxSearch, setInboxSearch] = useState("");

  const today = format(new Date(), "MMMM d, yyyy");
  const accentFrom = "#FFA135";
  const accentTo = "#FF7236";

  useEffect(() => {
    const brandId =
      typeof window !== "undefined" ? localStorage.getItem("brandId") : null;

    if (!brandId) {
      setFatalError("No brandId found in localStorage");
      return;
    }

    (async () => {
      setInboxLoading(true);
      setInboxError(null);

      const [dashRes, inboxRes] = await Promise.allSettled([
        post<BrandDashboardHomePayload>("/dash/brand", { brandId }),
        post<InboxResponse>("/emails/brand/influencer-list", { brandId, limit: 25 }),
      ]);

      // dashboard (fatal if fails)
      if (dashRes.status === "fulfilled") {
        setData(dashRes.value);
      } else {
        const err: any = dashRes.reason;
        setFatalError(
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Could not load dashboard"
        );
      }

      // inbox (non-fatal if fails)
      if (inboxRes.status === "fulfilled") {
        const conv = inboxRes.value?.conversations;
        setInbox(Array.isArray(conv) ? conv : []);
      } else {
        const err: any = inboxRes.reason;
        setInboxError(
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Could not load inbox"
        );
        setInbox([]);
      }

      setInboxLoading(false);
    })();
  }, []);

  const filteredCampaigns = useMemo(() => {
    if (!data?.campaigns?.length) return [];
    const q = searchTerm.trim().toLowerCase();
    if (!q) return data.campaigns;

    return data.campaigns.filter((c) => {
      const hay = `${c.productOrServiceName || ""} ${c.goal || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, searchTerm]);

  const filteredInbox = useMemo(() => {
    const q = inboxSearch.trim().toLowerCase();
    if (!q) return inbox;

    return inbox.filter((t) => {
      const hay = `${t.influencer?.name || ""} ${t.subject || ""} ${t.snippet || ""} ${t.status || ""
        } ${t.lastMessageDirection || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [inbox, inboxSearch]);

  if (fatalError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-red-500">{fatalError}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Loading dashboard…</p>
      </div>
    );
  }

  const {
    brandName,
    totalCreatedCampaigns,
    totalHiredInfluencers,
    totalAppliedInfluencers,
    budgetRemaining,
    campaignsMode,
  } = data;

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
        <main className="flex-1 px-6 py-8">
          {/* Welcome */}
          <div className="rounded-lg bg-white p-6 mb-8 mt-4 md:mt-6">
            <h2
              className="text-xl font-semibold mb-2"
              style={{
                background: `linear-gradient(to right, ${accentFrom}, ${accentTo})`,
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              Welcome Back, {brandName}!
            </h2>
            <p className="text-gray-700">Here's a quick overview of your account as of {today}.</p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              icon={<HiOutlineChartBar className="text-[#ef2f5b]" size={32} />}
              label="Created Campaigns"
              value={totalCreatedCampaigns}
              accentFrom={accentFrom}
            />
            <StatCard
              icon={<HiOutlineUsers className="text-[#4f46e5]" size={32} />}
              label="Hired Influencers"
              value={totalHiredInfluencers.toLocaleString()}
              accentFrom={accentFrom}
            />
            <StatCard
              icon={<HiOutlineUsers className="text-[#f59e0b]" size={32} />}
              label="Total Applied"
              value={totalAppliedInfluencers.toLocaleString()}
              accentFrom={accentFrom}
            />
            <StatCard
              icon={<HiOutlineCurrencyDollar className="text-[#10b981]" size={32} />}
              label="Budget Remaining"
              value={`$${budgetRemaining.toLocaleString()}`}
              accentFrom={accentFrom}
            />
          </div>

          {/* Main grid */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Campaigns */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
              <div className="flex items-start sm:items-center justify-between gap-4 mb-4 flex-col sm:flex-row">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Campaigns</h2>
                  <p className="text-xs text-gray-500">
                    Showing <span className="font-semibold">{campaignsMode}</span> campaigns
                  </p>
                </div>

                <div className="relative w-full sm:max-w-xs">
                  <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search campaigns…"
                    className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
                  />
                </div>
              </div>

              {!filteredCampaigns.length ? (
                <div className="flex min-h-[440px] w-full items-center justify-center">
                  <div className="py-10 text-center text-gray-500 flex flex-wrap items-center justify-center gap-4">
                    <button
                      onClick={() => router.push("/brand/browse-influencer")}
                      className="w-64 rounded-xl px-5 py-3 font-semibold shadow-sm transition border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 cursor-pointer"
                    >
                      Browse Influencers
                    </button>

                    <button
                      onClick={() => router.push("/brand/add-edit-campaign")}
                      className="w-64 rounded-xl px-4 py-3 text-white font-semibold shadow hover:shadow-md transition cursor-pointer"
                      style={{ background: `linear-gradient(to right, ${accentFrom}, ${accentTo})` }}
                    >
                      Create New Campaign
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  <table className="w-full table-fixed text-left text-sm">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="text-gray-500 border-b">
                        <th className="py-3 pr-2 w-[34%]">Campaign</th>
                        <th className="py-3 pr-2 w-[16%] hidden md:table-cell">Goal</th>
                        <th className="py-3 pr-2 w-[14%]">Budget</th>
                        <th className="py-3 pr-2 w-[20%]">Applied</th>
                        <th className="py-3 pr-2 w-[10%] hidden lg:table-cell">Influencer</th>
                        <th className="py-3 w-[6%] text-right">Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredCampaigns.map((c) => {
                        const id = c.campaignsId || c.id;
                        const applied = Number(c.appliedInfluencersCount || 0);

                        return (
                          <tr key={c.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 pr-4 font-medium text-gray-800 align-top">
                              <div className="min-w-0">
                                <div className="truncate" title={c.productOrServiceName || ""}>
                                  {truncate(c.productOrServiceName || "—", 40)}
                                </div>

                                {!!c.createdAt && (
                                  <div className="text-xs text-gray-500">{fmtDate(c.createdAt)}</div>
                                )}
                              </div>
                            </td>

                            <td className="py-3 pr-2 text-gray-700 hidden md:table-cell">
                              <div className="truncate" title={c.goal || ""}>{c.goal || "—"}</div>
                            </td>

                            <td className="py-3 pr-2 text-gray-700">
                              ${Number(c.budget || 0).toLocaleString()}
                            </td>

                            <td className="py-3 pr-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (c.hasAcceptedInfluencer) {
                                    router.push(`/brand/active-campaign/active-inf?id=${id}`);
                                  } else {
                                    router.push(`/brand/created-campaign/applied-inf?id=${id}`);
                                  }
                                }}
                                className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 hover:border-gray-300 transition cursor-pointer"
                                title={c.hasAcceptedInfluencer ? "Open active influencers" : "Open applied influencers"}
                              >
                                <span
                                  className={`inline-flex min-w-[28px] justify-center rounded-full px-2 py-0.5 text-xs font-bold ${applied > 0 ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500"
                                    }`}
                                >
                                  {applied.toLocaleString()}
                                </span>

                                <span className="text-gray-700 group-hover:text-gray-900">Applied</span>

                                <span className="text-[11px] font-medium text-gray-400 group-hover:text-gray-500">
                                  {c.hasAcceptedInfluencer ? "→ Active" : "→ List"}
                                </span>
                              </button>
                            </td>
                            <td className="py-3 pr-4 hidden lg:table-cell">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${c.hasAcceptedInfluencer ? "bg-indigo-100 text-indigo-700" : "bg-yellow-100 text-yellow-700"
                                }`}>
                                {c.hasAcceptedInfluencer ? "Accepted" : "Not accepted"}
                              </span>
                            </td>

                            <td className="py-3 text-right">
                              <button
                                className="text-sm font-semibold"
                                style={{
                                  background: `linear-gradient(to right, ${accentFrom}, ${accentTo})`,
                                  WebkitBackgroundClip: "text",
                                  color: "transparent",
                                }}
                                onClick={() => router.push(`/brand/created-campaign/view-campaign?id=${id}`)}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right panel: Inbox (LIST only, no message count) */}
            <div className="lg:col-span-1 bg-white rounded-lg shadow p-6 flex flex-col min-h-[520px]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Inbox</h3>
                  <p className="text-xs text-gray-500">Recent conversations</p>
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/brand/emails")}
                  className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition"
                  title="Open full inbox"
                >
                  Open
                </button>
              </div>

              {/* Inbox search */}
              <div className="mt-4 relative">
                <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={inboxSearch}
                  onChange={(e) => setInboxSearch(e.target.value)}
                  placeholder="Search name / subject / message…"
                  className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
                />
              </div>

              {/* Inbox list */}
              <div className="mt-4 flex-1 overflow-auto rounded-lg border border-gray-100 divide-y divide-gray-100">
                {inboxLoading ? (
                  <div className="p-4 text-sm text-gray-500">Loading inbox…</div>
                ) : inboxError ? (
                  <div className="p-4 text-sm text-gray-500">{inboxError}</div>
                ) : !filteredInbox.length ? (
                  <div className="p-4 text-sm text-gray-500">No conversations yet.</div>
                ) : (
                  filteredInbox.map((t) => {
                    const name = t.influencer?.name || "Influencer";
                    const initial = name.trim().slice(0, 1).toUpperCase();

                    const when = t.lastMessageAt ? fmtDate(t.lastMessageAt, "MMM d") : "";
                    const whenFull = t.lastMessageAt ? fmtDate(t.lastMessageAt, "MMM d, yyyy") : "";

                    const dLabel = dirLabel(t.lastMessageDirection);

                    const subject = (t.subject || "").trim() || "No subject";
                    const snippet = (t.snippet || "").trim();

                    return (
                      <button
                        key={t.threadId}
                        type="button"
                        onClick={() => router.push(`/brand/email?threadId=${t.threadId}`)}
                        className="w-full text-left p-3 hover:bg-gray-50 transition flex items-start gap-3"
                        title="Open conversation"
                      >
                        <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-700 shrink-0">
                          {initial}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-800 truncate">{name}</div>

                              {/* ✅ Subject */}
                              <div className="text-sm font-semibold text-gray-700 truncate" title={subject}>
                                {subject}
                              </div>
                            </div>

                            <div className="shrink-0 text-right">
                              <div className="text-[11px] text-gray-400" title={whenFull}>
                                {when}
                              </div>

                              <div className="mt-1 flex items-center justify-end gap-2">
                                {dLabel ? (
                                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
                                    {dLabel}
                                  </span>
                                ) : null}

                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${statusTone(
                                    t.status || "active"
                                  )}`}
                                >
                                  {t.status || "active"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* ✅ Snippet */}
                          {snippet ? (
                            <div className="mt-1 text-xs text-gray-500 truncate" title={snippet}>
                              {truncate(snippet, 140)}
                            </div>
                          ) : (
                            <div className="mt-1 text-xs text-gray-400 italic">No message preview</div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ---------------- components ---------------- */

const StatCard = ({ icon, label, value, accentFrom, onClick }: any) => (
  <div
    className={`bg-white rounded-lg shadow p-5 flex items-center space-x-4 transition-shadow ${onClick ? "cursor-pointer hover:shadow-lg" : ""
      }`}
    onClick={onClick}
  >
    <div className="p-3 rounded-full" style={{ backgroundColor: `${accentFrom}20` }}>
      {icon}
    </div>
    <div>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
      <p className="text-gray-600">{label}</p>
    </div>
  </div>
);
