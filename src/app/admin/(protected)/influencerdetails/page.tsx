// app/influencers/page.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { get } from "@/lib/api";

// Adjust this type to match your backend response precisely if needed.
type Influencer = {
  id?: string | number;
  handle: string;
  email: string;
  platform: string;
};

const DUMMY_INFLUENCERS: Influencer[] = [
  { id: 1, handle: "@tech_kriti", email: "kriti@example.com", platform: "Instagram" },
  { id: 2, handle: "@gadget_guru", email: "guru@example.com", platform: "YouTube" },
  { id: 3, handle: "@style_sana", email: "sana@example.com", platform: "TikTok" },
  { id: 4, handle: "@travel_tanay", email: "tanay@example.com", platform: "Instagram" },
  { id: 5, handle: "@fit_farhan", email: "farhan@example.com", platform: "YouTube" },
  { id: 6, handle: "@code_chai", email: "chai@example.com", platform: "Twitter/X" },
  { id: 7, handle: "@foodie_fiza", email: "fiza@example.com", platform: "Instagram" },
  { id: 8, handle: "@music_meera", email: "meera@example.com", platform: "YouTube" },
  { id: 9, handle: "@finance_faiz", email: "faiz@example.com", platform: "LinkedIn" },
  { id: 10, handle: "@gaming_gautam", email: "gautam@example.com", platform: "Twitch" },
  { id: 11, handle: "@makeup_manya", email: "manya@example.com", platform: "Instagram" },
  { id: 12, handle: "@health_hemant", email: "hemant@example.com", platform: "Facebook" },
  { id: 13, handle: "@diy_diya", email: "diya@example.com", platform: "YouTube" },
  { id: 14, handle: "@art_aarav", email: "aarav@example.com", platform: "Instagram" },
  { id: 15, handle: "@dance_dhriti", email: "dhriti@example.com", platform: "TikTok" },
  { id: 16, handle: "@book_bhavya", email: "bhavya@example.com", platform: "Twitter/X" },
  { id: 17, handle: "@news_neeraj", email: "neeraj@example.com", platform: "Twitter/X" },
  { id: 18, handle: "@startup_siya", email: "siya@example.com", platform: "LinkedIn" },
  { id: 19, handle: "@edtech_ekta", email: "ekta@example.com", platform: "YouTube" },
  { id: 20, handle: "@photography_parth", email: "parth@example.com", platform: "Instagram" },
  { id: 21, handle: "@cars_kabir", email: "kabir@example.com", platform: "YouTube" },
  { id: 22, handle: "@science_sumeet", email: "sumeet@example.com", platform: "Twitter/X" },
  { id: 23, handle: "@home_hina", email: "hina@example.com", platform: "Facebook" },
  { id: 24, handle: "@garden_gopal", email: "gopal@example.com", platform: "Instagram" },
  { id: 25, handle: "@astro_ananya", email: "ananya@example.com", platform: "YouTube" },
  { id: 26, handle: "@crypto_kiran", email: "kiran@example.com", platform: "Twitter/X" },
  { id: 27, handle: "@policy_priya", email: "priya@example.com", platform: "LinkedIn" },
  { id: 28, handle: "@movies_mihir", email: "mihir@example.com", platform: "YouTube" },
  { id: 29, handle: "@fashion_faiza", email: "faiza@example.com", platform: "Instagram" },
  { id: 30, handle: "@sports_samar", email: "samar@example.com", platform: "Twitter/X" },
];

export default function InfluencersPage() {
  const endpoint = "/influencers"; // <-- update if your backend route differs
  const useDummy = process.env.NEXT_PUBLIC_USE_DUMMY === "true";

  const [loading, setLoading] = useState(!useDummy);
  const [error, setError] = useState<string | null>(null);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [platformFilter, setPlatformFilter] = useState<string>("All");

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const PAGE_SIZE = 15; // options: 10, 20, 50

  // gradient/hover classes only for table headers (Handle, Email, Platform)
  const thBase = "px-4 py-2 text-left text-sm font-medium rounded-md transition-colors";
  const thHover = "text-gray-800 hover:bg-gradient-to-r hover:from-[#FFA135] hover:to-[#FF7236] hover:text-white";

  // Fetch from backend unless in dummy mode
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (useDummy) return;
      setLoading(true);
      setError(null);
      try {
        const rows = await get<Influencer[]>(endpoint);
        if (mounted) setInfluencers(rows || []);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Failed to load influencer data.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [endpoint, useDummy]);

  const baseData = useMemo<Influencer[]>(() => {
    if (useDummy) return DUMMY_INFLUENCERS;
    if (error) return DUMMY_INFLUENCERS; // graceful fallback
    if (!loading && influencers.length === 0) return DUMMY_INFLUENCERS;
    return influencers;
  }, [useDummy, error, loading, influencers]);

  const showingDummy = baseData === DUMMY_INFLUENCERS;

  const platforms = useMemo(() => {
    const set = new Set<string>(baseData.map((d) => d.platform).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [baseData]);

  const filtered = useMemo(() => {
    if (platformFilter === "All") return baseData;
    return baseData.filter((d) => d.platform === platformFilter);
  }, [baseData, platformFilter]);

  // If filters or pageSize change, keep page in range
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
  }, [filtered.length, page]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, total);
  const pageRows = filtered.slice(startIdx, endIdx);

  // Reset to first page when platform changes
  useEffect(() => {
    setPage(1);
  }, [platformFilter]);

  function toCSV(rows: Influencer[]) {
    const esc = (v: unknown) => {
      const s = String(v ?? "");
if (/["\n,]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
return s;
    };
  const header = ["Handle", "Email", "Platform"].join(",");
  const body = rows.map((r) => [esc(r.handle), esc(r.email), esc(r.platform)].join(",")).join("\n");
  return header + "\n" + body + "\n";
}

  function downloadCSV() {
    const csv = toCSV(filtered); // export respects current filter (not just current page)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "influencers.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="p-6">
      {/* THEME GRADIENT HEADER */}
      <div className="mb-4 rounded-xl p-4 shadow bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Influencers</h1>
            {showingDummy && (
              <span className="text-xs rounded-md border border-white/30 bg-white/15 px-2 py-1">
                Showing dummy data
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm" htmlFor="platformFilter">Platform:</label>
            <select
              id="platformFilter"
              className="rounded-md border border-white/30 bg-white/10 px-2 py-1 text-sm text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/40"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
            >
              {platforms.map((p) => (
                <option key={p} value={p} className="text-black">{p}</option>
              ))}
            </select>

            <button
              onClick={downloadCSV}
              className="ml-2 rounded-md px-3 py-1.5 text-sm shadow-sm bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:opacity-90"
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {error && !showingDummy && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-700 mb-3">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-white">
            <tr>
              <th scope="col" className={`${thBase} ${thHover}`}>Handle</th>
              <th scope="col" className={`${thBase} ${thHover}`}>Email</th>
              <th scope="col" className={`${thBase} ${thHover}`}>Platform</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading && !showingDummy ? (
              <tr>
                <td className="px-4 py-3 text-gray-500" colSpan={3}>Loading…</td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-gray-500" colSpan={3}>No records match the selected filter.</td>
              </tr>
            ) : (
              pageRows.map((inf) => (
                <tr key={String(inf.id ?? inf.email ?? inf.handle)}>
                  <td className="px-4 py-2">{inf.handle?.startsWith("@") ? inf.handle : `@${inf.handle}`}</td>
                  <td className="px-4 py-2">
                    <a href={`mailto:${inf.email}`} className="underline">{inf.email}</a>
                  </td>
                  <td className="px-4 py-2">{inf.platform}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          {total > 0 ? (
            <>Showing <span className="font-medium">{startIdx + 1}</span>–<span className="font-medium">{endIdx}</span> of <span className="font-medium">{total}</span></>
          ) : (
            <>Showing 0 of 0</>
          )}
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(1)}
            disabled={page === 1}
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            First
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            Prev
          </button>
          <span className="text-sm text-gray-700">
            Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || total === 0}
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages || total === 0}
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
          >
            Last
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Tip: set <code>NEXT_PUBLIC_USE_DUMMY=true</code> in your env to always render dummy data.
      </p>
    </main>
  );
}
