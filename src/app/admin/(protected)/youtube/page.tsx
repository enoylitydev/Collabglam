'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Mail, RefreshCw, Search, X } from 'lucide-react';
import { post } from '@/lib/api';

type VideoItem = {
  _id?: string;
  videoId?: string;
  title?: string;
  publishedAt?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  duration?: string; // ISO 8601, e.g. PT16M5S
};

type InfluencerProfileDoc = {
  _id?: string;

  handleId: string;
  platform?: string;
  handle?: string;
  channelId?: string;

  title?: string;
  country?: string | null;
  defaultLanguage?: string | null;

  subscriberCount?: number | null;
  totalViewCount?: number | null;
  totalVideoCount?: number | null;

  avgViewsLast15?: number | null;
  engagementRateLast15?: number | null;
  uploadFrequencyPerWeek?: number | null;
  avgDaysBetweenUploads?: number | null;

  instagramHandle?: string | null;

  // ✅ manual fields
  email?: string | null;
  lastSponsor?: string | null;
  managedByAgency?: boolean | null;
  topAudienceCountry?: string | null;
  averageAudienceAge?: number | null;
  lastContactedAt?: string | null;
  followUpDates?: string[]; // ISO strings in API response
  workingHandle?: string | null;

  lastUploadAt?: string | null;
  lastVideoId?: string | null;
  lastVideoTitle?: string | null;

  topicLabels?: string[];
  topicCategories?: string[];
  keywords?: string;
  description?: string;

  bannerUrl?: string | null;
  thumbnails?: {
    default?: { url?: string; width?: number; height?: number };
    medium?: { url?: string; width?: number; height?: number };
    high?: { url?: string; width?: number; height?: number };
  } | null;

  rawChannel?: any;
  rawPlaylists?: any[];

  lastVideos?: VideoItem[];
  lastVideosLimit?: number;

  createdAt?: string;
  updatedAt?: string;
  syncedAt?: string;
};

type GetAllResponse = {
  status: string;
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  data: InfluencerProfileDoc[];
};

type SyncResponse = {
  status: string;
  handle: string;
  handleId: string;
  data: InfluencerProfileDoc;
};

type UpdateManualResponse = {
  status: string;
  handleId: string;
  data: InfluencerProfileDoc;
};

type InfluencerFilters = {
  followersMin?: string;
  followersMax?: string;
  country?: string;
  countries?: string[];
  category?: string;
  categories?: string[];
};

function normalizeHandle(input: string) {
  const s = (input || '').trim();
  if (!s) return '';
  const m = s.match(/@([A-Za-z0-9._\-]+)/);
  if (m?.[1]) return `@${m[1]}`;
  if (/^[A-Za-z0-9._\-]+$/.test(s)) return `@${s}`;
  return s.startsWith('@') ? s : `@${s}`;
}

function formatNumber(n?: number | null) {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-IN').format(n);
}

function formatPercent(x?: number | null) {
  if (x == null || !Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(2)}%`;
}

function formatBool(b?: boolean | null) {
  if (b === true) return 'Yes';
  if (b === false) return 'No';
  return 'Unknown';
}

/** force IST formatting */
function formatDate(iso?: string | null, timeZone = 'Asia/Kolkata') {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function parseISODurationToHMS(iso?: string | null) {
  if (!iso) return '—';
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return iso;

  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  const s = Number(m[3] || 0);

  const pad2 = (x: number) => String(x).padStart(2, '0');
  if (h > 0) return `${h}:${pad2(min)}:${pad2(s)}`;
  return `${min}:${pad2(s)}`;
}

function asList<T>(d: any): T[] {
  return Array.isArray(d) ? d : [];
}

function getDocId(p: InfluencerProfileDoc) {
  return p.handleId || p._id || p.channelId || p.handle || Math.random().toString(36).slice(2);
}

function ytVideoUrl(videoId?: string) {
  if (!videoId) return '';
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function ytChannelUrl(p: InfluencerProfileDoc) {
  if (p.handle) return `https://www.youtube.com/${p.handle.replace(/^@/, '@')}`;
  if (p.channelId) return `https://www.youtube.com/channel/${p.channelId}`;
  return '';
}

function toDateInputValue(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseFollowUps(text: string) {
  const raw = (text || '')
    .split(/[\n,]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const cleaned: string[] = [];
  for (const d of raw) {
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) cleaned.push(d);
  }
  return Array.from(new Set(cleaned));
}

function splitCsvOrSpace(v: string): string[] {
  return (v || '')
    .split(/[,\n]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function chipText(filters: InfluencerFilters) {
  const chips: string[] = [];

  if (filters.followersMin || filters.followersMax) {
    chips.push(
      `Followers: ${filters.followersMin || '0'} - ${filters.followersMax || '∞'}`
    );
  }

  const cs = filters.countries?.length ? filters.countries : (filters.country ? [filters.country] : []);
  if (cs.length) chips.push(`Country: ${cs.join(', ')}`);

  const cats = filters.categories?.length ? filters.categories : (filters.category ? [filters.category] : []);
  if (cats.length) chips.push(`Category: ${cats.join(', ')}`);

  return chips;
}

export default function Page() {
  const [profiles, setProfiles] = useState<InfluencerProfileDoc[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  // Handle search (sync/open)
  const [query, setQuery] = useState('');
  const [searchHint, setSearchHint] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // List state
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState('');

  // ✅ Filters (draft + active)
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filtersDraft, setFiltersDraft] = useState<InfluencerFilters>({
    followersMin: '',
    followersMax: '',
    country: '',
    category: '',
  });
  const [filtersActive, setFiltersActive] = useState<InfluencerFilters>({
    followersMin: '',
    followersMax: '',
    country: '',
    category: '',
  });

  // ✅ Details modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsHandleId, setDetailsHandleId] = useState('');
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState('');

  const [detailsForm, setDetailsForm] = useState({
    email: '',
    lastSponsor: '',
    managedByAgency: 'unknown' as 'unknown' | 'yes' | 'no',
    topAudienceCountry: '',
    averageAudienceAge: '',
    lastContactedAt: '',
    followUpDates: '',
    workingHandle: '',
  });

  const profilesByHandle = useMemo(() => {
    const map = new Map<string, InfluencerProfileDoc>();
    for (const p of profiles) {
      const h = (p.handle || '').toLowerCase().trim();
      if (h) map.set(h, p);
    }
    return map;
  }, [profiles]);

  const normalizedQuery = useMemo(() => normalizeHandle(query), [query]);
  const existingProfile = useMemo(() => {
    if (!normalizedQuery) return undefined;
    return profilesByHandle.get(normalizedQuery.toLowerCase());
  }, [normalizedQuery, profilesByHandle]);

  function buildFilterPayload(f: InfluencerFilters): InfluencerFilters {
    const out: InfluencerFilters = {};

    // followers
    if (String(f.followersMin || '').trim()) out.followersMin = String(f.followersMin).trim();
    if (String(f.followersMax || '').trim()) out.followersMax = String(f.followersMax).trim();

    // country: if comma separated => countries[]
    const cRaw = String(f.country || '').trim();
    if (cRaw) {
      const parts = splitCsvOrSpace(cRaw);
      if (parts.length > 1) out.countries = parts;
      else out.country = parts[0];
    }

    // category: if comma separated => categories[]
    const catRaw = String(f.category || '').trim();
    if (catRaw) {
      const parts = splitCsvOrSpace(catRaw);
      if (parts.length > 1) out.categories = parts;
      else out.category = parts[0];
    }

    return out;
  }

  async function loadSaved(p = 1, active: InfluencerFilters = filtersActive) {
    setError('');
    setListLoading(true);
    try {
      const filterPayload = buildFilterPayload(active);

      const resp = await post<GetAllResponse>('/youtube/getall', {
        page: p,
        limit,
        search: '', // keep separate from handle-sync search
        sortBy: 'createdAt',
        sortOrder: 'desc',
        includeRaw: false,
        includeVideos: false,

        // ✅ filters to backend
        ...filterPayload,
      });

      if (resp?.status !== 'ok') throw new Error('Failed to load saved data');

      setProfiles(asList<InfluencerProfileDoc>(resp.data));
      setTotal(resp.total || 0);
      setHasNext(!!resp.hasNext);
      setPage(resp.page || p);
    } catch (e: any) {
      setError(e?.message || 'Failed to load saved data.');
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    loadSaved(1, filtersActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setError('');
    const h = normalizeHandle(query);
    if (!h) {
      setSearchHint('');
      return;
    }
    const existing = profilesByHandle.get(h.toLowerCase());
    setSearchHint(existing ? 'Already saved. Press Open to open it.' : 'Not saved yet. Press Search to fetch & save from YouTube.');
  }, [query, profilesByHandle]);

  function upsertProfile(doc: InfluencerProfileDoc) {
    setProfiles((prev) => {
      const idx = prev.findIndex((x) => x.handleId === doc.handleId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...doc };
        return copy;
      }
      setTotal((t) => t + 1);
      return [doc, ...prev];
    });
  }

  function toggleExpand(id: string) {
    setExpanded((p) => ({ ...p, [id]: !p[id] }));
  }

  function openAndScrollTo(id: string) {
    setExpanded((p) => ({ ...p, [id]: true }));
    setTimeout(() => {
      const el = document.getElementById(`card-${id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  function openDetailsModal(p: InfluencerProfileDoc) {
    setDetailsHandleId(p.handleId);

    setDetailsForm({
      email: p.email || '',
      lastSponsor: p.lastSponsor || '',
      managedByAgency: p.managedByAgency === true ? 'yes' : p.managedByAgency === false ? 'no' : 'unknown',
      topAudienceCountry: p.topAudienceCountry || '',
      averageAudienceAge: p.averageAudienceAge != null ? String(p.averageAudienceAge) : '',
      lastContactedAt: toDateInputValue(p.lastContactedAt),
      followUpDates: Array.isArray(p.followUpDates) ? p.followUpDates.map((x) => toDateInputValue(x)).filter(Boolean).join(', ') : '',
      workingHandle: p.workingHandle || '',
    });

    setDetailsError('');
    setDetailsModalOpen(true);
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const h = normalizeHandle(query);
    if (!h) {
      setError('Please enter a valid handle.');
      return;
    }

    const existing = profilesByHandle.get(h.toLowerCase());
    if (existing?.handleId) {
      openAndScrollTo(existing.handleId);
      return;
    }

    setSearchLoading(true);
    try {
      const resp = await post<SyncResponse>('/youtube/handel-data', { handle: h, videosLimit: 15 });
      if (resp?.status !== 'ok' || !resp?.data?.handleId) throw new Error('Sync failed');

      upsertProfile(resp.data);
      openAndScrollTo(resp.data.handleId);
      setSearchHint('Fetched & saved. Expanded below.');
      setQuery(h);
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch from YouTube.');
    } finally {
      setSearchLoading(false);
    }
  }

  async function saveDetails() {
    setDetailsError('');

    const payload: any = { handleId: detailsHandleId };

    const email = detailsForm.email.trim();
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toLowerCase())) {
        setDetailsError('Enter a valid email.');
        return;
      }
      payload.email = email.toLowerCase();
    } else {
      payload.email = null;
    }

    payload.lastSponsor = detailsForm.lastSponsor.trim() || null;
    payload.topAudienceCountry = detailsForm.topAudienceCountry.trim() || null;
    payload.workingHandle = detailsForm.workingHandle.trim() || null;

    payload.managedByAgency = detailsForm.managedByAgency === 'yes' ? true : detailsForm.managedByAgency === 'no' ? false : null;

    if (detailsForm.averageAudienceAge.trim()) {
      const n = Number(detailsForm.averageAudienceAge.trim());
      if (!Number.isFinite(n) || n < 0 || n > 120) {
        setDetailsError('Average audience age must be 0–120.');
        return;
      }
      payload.averageAudienceAge = n;
    } else {
      payload.averageAudienceAge = null;
    }

    payload.lastContactedAt = detailsForm.lastContactedAt ? detailsForm.lastContactedAt : null;
    payload.followUpDates = parseFollowUps(detailsForm.followUpDates);

    setDetailsSaving(true);
    try {
      const resp = await post<UpdateManualResponse>('/youtube/profile/update-manual', payload);
      if (resp?.status !== 'ok') throw new Error('Failed to save details');
      upsertProfile(resp.data);
      setDetailsModalOpen(false);
    } catch (e: any) {
      setDetailsError(e?.message || 'Failed to save details.');
    } finally {
      setDetailsSaving(false);
    }
  }

  function applyFilters() {
    const next = { ...filtersDraft };
    setFiltersActive(next);
    loadSaved(1, next);
  }

  function clearFilters() {
    const empty: InfluencerFilters = { followersMin: '', followersMax: '', country: '', category: '' };
    setFiltersDraft(empty);
    setFiltersActive(empty);
    loadSaved(1, empty);
  }

  const activeChips = useMemo(() => chipText(buildFilterPayload(filtersActive)), [filtersActive]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">YouTube Influencer Profiles</h1>
          <p className="text-slate-600">Saved list loads from DB. Search by handle to open or fetch &amp; save.</p>
        </div>

        {/* Search + Filters card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <form onSubmit={onSearch} className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by handle (e.g., @MrBeast)"
                />
              </div>

              <button
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                type="submit"
                disabled={searchLoading}
              >
                {searchLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Searching
                  </>
                ) : existingProfile ? (
                  'Open'
                ) : (
                  'Search'
                )}
              </button>

              <button
                type="button"
                className="px-4 py-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => loadSaved(1, filtersActive)}
                disabled={listLoading}
              >
                <RefreshCw className={`w-4 h-4 ${listLoading ? 'animate-spin' : ''}`} />
                Refresh List
              </button>
            </div>

            {searchHint ? <p className="text-sm text-slate-600">{searchHint}</p> : null}

            {/* Filters toggle */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                className="text-sm font-medium text-slate-700 hover:text-slate-900"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                {filtersOpen ? 'Hide Filters' : 'Show Filters'}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                  onClick={clearFilters}
                  disabled={listLoading}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
                  onClick={applyFilters}
                  disabled={listLoading}
                >
                  Apply
                </button>
              </div>
            </div>

            {filtersOpen ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Followers Min</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={filtersDraft.followersMin || ''}
                    onChange={(e) => setFiltersDraft((p) => ({ ...p, followersMin: e.target.value }))}
                    placeholder="e.g. 100000"
                    inputMode="numeric"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Followers Max</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={filtersDraft.followersMax || ''}
                    onChange={(e) => setFiltersDraft((p) => ({ ...p, followersMax: e.target.value }))}
                    placeholder="e.g. 5000000"
                    inputMode="numeric"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Country (US, IN…)</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={filtersDraft.country || ''}
                    onChange={(e) => setFiltersDraft((p) => ({ ...p, country: e.target.value }))}
                    placeholder="US or US,IN"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">You can enter multiple: <span className="font-mono">US,IN</span></p>
                </div>

                <div>
                  <label className="text-xs text-slate-600 mb-1 block">Category</label>
                  <input
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={filtersDraft.category || ''}
                    onChange={(e) => setFiltersDraft((p) => ({ ...p, category: e.target.value }))}
                    placeholder="Entertainment or Lifestyle"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Multiple: <span className="font-mono">Entertainment,Lifestyle</span></p>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
            ) : null}
          </form>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-slate-900">Saved Profiles</h2>
              <span className="text-sm text-slate-600">{formatNumber(total)} total</span>
            </div>

            {/* active filter chips */}
            {activeChips.length ? (
              <div className="flex flex-wrap gap-2 items-center">
                {activeChips.map((c) => (
                  <span key={c} className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 border">
                    {c}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => loadSaved(Math.max(1, page - 1), filtersActive)}
                disabled={listLoading || page <= 1}
              >
                Previous
              </button>
              <button
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => loadSaved(page + 1, filtersActive)}
                disabled={listLoading || !hasNext}
              >
                Next
              </button>
            </div>
          </div>

          {listLoading && profiles.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading profiles...
            </div>
          ) : null}

          {!listLoading && profiles.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              No saved profiles yet. Use search to fetch and save influencer data.
            </div>
          ) : null}

          <div className="divide-y divide-slate-200">
            {profiles.map((p) => {
              const id = getDocId(p);
              const isOpen = !!expanded[id];
              const thumb = p.thumbnails?.default?.url || p.thumbnails?.medium?.url || p.thumbnails?.high?.url;
              const channelUrl = ytChannelUrl(p);

              return (
                <div key={id} id={`card-${id}`} className="hover:bg-slate-50 transition-colors">
                  <div className="px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      {/* left */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 shrink-0">
                            {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" /> : null}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-slate-900 truncate">{p.handle || '—'}</h3>
                              {p.platform ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-300 text-slate-600">
                                  {p.platform}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-sm text-slate-600 truncate">{p.title || '—'}</div>
                          </div>
                        </div>

                        {/* quick metrics row */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-3">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Country</div>
                            <div className="text-sm font-medium text-slate-900">{p.country || '—'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Subscribers</div>
                            <div className="text-sm font-medium text-slate-900">{formatNumber(p.subscriberCount)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Avg Views (15)</div>
                            <div className="text-sm font-medium text-slate-900">{formatNumber(p.avgViewsLast15)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Engagement</div>
                            <div className="text-sm font-medium text-slate-900">{formatPercent(p.engagementRateLast15)}</div>
                          </div>
                          <div className="hidden lg:block">
                            <div className="text-xs text-slate-500 mb-1">Last Upload</div>
                            <div className="text-sm font-medium text-slate-900">{formatDate(p.lastUploadAt)}</div>
                          </div>
                          <div className="hidden lg:block">
                            <div className="text-xs text-slate-500 mb-1">Email</div>
                            <div className="text-sm font-medium text-slate-900 truncate">{p.email || '—'}</div>
                          </div>
                        </div>

                        {/* manual mini line */}
                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                          <span>Synced: {formatDate(p.syncedAt)}</span>
                          {p.uploadFrequencyPerWeek != null ? <span>{p.uploadFrequencyPerWeek} uploads/week</span> : null}
                          {p.lastSponsor ? <span>Last Sponsor: {p.lastSponsor}</span> : null}
                          {p.managedByAgency != null ? <span>Agency: {formatBool(p.managedByAgency)}</span> : null}
                        </div>
                      </div>

                      {/* right buttons */}
                      <div className="flex items-center gap-2">
                        {channelUrl ? (
                          <a
                            href={channelUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                            title="Open channel"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Channel
                          </a>
                        ) : null}

                        <button
                          type="button"
                          className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                          onClick={() => openDetailsModal(p)}
                        >
                          <Mail className="w-4 h-4" />
                          Add Details
                        </button>

                        <button
                          type="button"
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          onClick={() => toggleExpand(id)}
                          aria-expanded={isOpen}
                          aria-label="Expand"
                        >
                          <ChevronDown className={`w-5 h-5 text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* expanded */}
                    {isOpen ? (
                      <div className="mt-6 pt-6 border-t border-slate-200 space-y-6">
                        {p.bannerUrl ? (
                          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <img src={p.bannerUrl} alt="" className="w-full h-40 object-cover" loading="lazy" />
                          </div>
                        ) : null}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="bg-slate-50 rounded-xl p-4">
                            <h4 className="font-semibold text-slate-900 mb-3">Channel Details</h4>
                            <div className="space-y-2 text-sm">
                              <Row label="Language" value={p.defaultLanguage || '—'} />
                              <Row label="Channel ID" value={p.channelId || '—'} mono />
                              <Row label="Total Videos" value={formatNumber(p.totalVideoCount)} />
                              <Row label="Total Views" value={formatNumber(p.totalViewCount)} />
                              <Row label="Instagram" value={p.instagramHandle || '—'} />
                              <Row label="Last upload" value={formatDate(p.lastUploadAt)} />
                              <Row label="Last video" value={p.lastVideoTitle || '—'} />

                              {p.lastVideoId ? (
                                <div className="pt-2">
                                  <a
                                    href={ytVideoUrl(p.lastVideoId)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                    Watch latest video
                                  </a>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="bg-slate-50 rounded-xl p-4">
                            <h4 className="font-semibold text-slate-900 mb-3">Metrics</h4>
                            <div className="space-y-2 text-sm">
                              <Row label="Subscribers" value={formatNumber(p.subscriberCount)} />
                              <Row label="Avg Views (last 15)" value={formatNumber(p.avgViewsLast15)} />
                              <Row label="Engagement (last 15)" value={formatPercent(p.engagementRateLast15)} />
                              <Row label="Uploads/week" value={p.uploadFrequencyPerWeek ?? '—'} />
                              <Row label="Avg days between uploads" value={p.avgDaysBetweenUploads ?? '—'} />
                              <Row label="Created" value={formatDate(p.createdAt)} />
                              <Row label="Updated" value={formatDate(p.updatedAt)} />
                              <Row label="Synced" value={formatDate(p.syncedAt)} />
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4">
                          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                            <h4 className="font-semibold text-slate-900">Manual Details</h4>
                            <button
                              type="button"
                              className="px-3 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                              onClick={() => openDetailsModal(p)}
                            >
                              Edit Details
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-2">
                              <Row label="Email" value={p.email || '—'} />
                              <Row label="Working Handle" value={p.workingHandle || '—'} />
                              <Row label="Last Sponsor" value={p.lastSponsor || '—'} />
                              <Row label="Managed by Agency" value={formatBool(p.managedByAgency)} />
                            </div>
                            <div className="space-y-2">
                              <Row label="Top Audience Country" value={p.topAudienceCountry || '—'} />
                              <Row label="Avg Audience Age" value={p.averageAudienceAge ?? '—'} />
                              <Row label="Last Contacted" value={formatDate(p.lastContactedAt)} />
                              <Row
                                label="Follow-ups"
                                value={p.followUpDates?.length ? p.followUpDates.map((d) => toDateInputValue(d)).filter(Boolean).join(', ') : '—'}
                              />
                            </div>
                          </div>
                        </div>

                        {p.topicLabels?.length || p.topicCategories?.length ? (
                          <div className="bg-slate-50 rounded-xl p-4">
                            <h4 className="font-semibold text-slate-900 mb-3">Topics</h4>
                            <div className="flex flex-wrap gap-2">
                              {asList<string>(p.topicLabels).map((t, i) => (
                                <span key={`tl-${i}`} className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                                  {t}
                                </span>
                              ))}
                              {asList<string>(p.topicCategories).map((t, i) => (
                                <span key={`tc-${i}`} className="px-3 py-1 bg-emerald-100 text-emerald-700 text-sm rounded-full">
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {p.keywords ? (
                          <div className="bg-slate-50 rounded-xl p-4">
                            <h4 className="font-semibold text-slate-900 mb-3">Keywords</h4>
                            <p className="text-sm text-slate-700">{p.keywords}</p>
                          </div>
                        ) : null}

                        <div className="bg-slate-50 rounded-xl p-4">
                          <h4 className="font-semibold text-slate-900 mb-3">Description</h4>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{p.description || '—'}</p>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4">
                          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                            <h4 className="font-semibold text-slate-900">Latest Videos</h4>
                            <div className="text-xs text-slate-600">
                              Showing {asList<VideoItem>(p.lastVideos).length || 0}
                              {p.lastVideosLimit ? ` (limit: ${p.lastVideosLimit})` : ''}
                            </div>
                          </div>

                          {asList<VideoItem>(p.lastVideos).length === 0 ? (
                            <div className="text-sm text-slate-600">
                              No videos in this payload. Use sync/search with <b>includeVideos</b>.
                            </div>
                          ) : (
                            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                              <table className="w-full text-sm">
                                <thead className="text-xs text-slate-600">
                                  <tr className="text-left border-b border-slate-200">
                                    <th className="py-3 px-4">Title</th>
                                    <th className="py-3 px-4 whitespace-nowrap">Published</th>
                                    <th className="py-3 px-4 whitespace-nowrap">Duration</th>
                                    <th className="py-3 px-4 whitespace-nowrap">Views</th>
                                    <th className="py-3 px-4 whitespace-nowrap">Likes</th>
                                    <th className="py-3 px-4 whitespace-nowrap">Comments</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {asList<VideoItem>(p.lastVideos).map((v) => (
                                    <tr key={v._id || v.videoId} className="hover:bg-slate-50">
                                      <td className="py-3 px-4 min-w-[320px]">
                                        {v.videoId ? (
                                          <a
                                            href={ytVideoUrl(v.videoId)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="font-medium text-blue-600 hover:text-blue-700"
                                          >
                                            {v.title || '—'}
                                          </a>
                                        ) : (
                                          v.title || '—'
                                        )}
                                      </td>
                                      <td className="py-3 px-4 whitespace-nowrap text-slate-700">{formatDate(v.publishedAt)}</td>
                                      <td className="py-3 px-4 whitespace-nowrap text-slate-700">{parseISODurationToHMS(v.duration)}</td>
                                      <td className="py-3 px-4 whitespace-nowrap text-slate-700">{formatNumber(v.viewCount)}</td>
                                      <td className="py-3 px-4 whitespace-nowrap text-slate-700">{formatNumber(v.likeCount)}</td>
                                      <td className="py-3 px-4 whitespace-nowrap text-slate-700">{formatNumber(v.commentCount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          <div className="mt-3 text-xs text-slate-500">
                            Note: <code className="px-1 py-0.5 bg-white border rounded">/youtube/getall</code> returns a light payload.
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ✅ Details Modal */}
      {detailsModalOpen ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Add / Update Details</h3>
              <button
                onClick={() => setDetailsModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-600 mb-1 block">Email Address</label>
                  <input
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    value={detailsForm.email}
                    onChange={(e) => setDetailsForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="brand@domain.com"
                    type="email"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-600 mb-1 block">Working Handle</label>
                  <input
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    value={detailsForm.workingHandle}
                    onChange={(e) => setDetailsForm((p) => ({ ...p, workingHandle: e.target.value }))}
                    placeholder="@mrbeast_official"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-600 mb-1 block">Last Sponsor</label>
                  <input
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    value={detailsForm.lastSponsor}
                    onChange={(e) => setDetailsForm((p) => ({ ...p, lastSponsor: e.target.value }))}
                    placeholder="Brand name"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-600 mb-1 block">Managed by Agency?</label>
                  <select
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                    value={detailsForm.managedByAgency}
                    onChange={(e) => setDetailsForm((p) => ({ ...p, managedByAgency: e.target.value as any }))}
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-slate-600 mb-1 block">Top Audience Country</label>
                  <input
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    value={detailsForm.topAudienceCountry}
                    onChange={(e) => setDetailsForm((p) => ({ ...p, topAudienceCountry: e.target.value }))}
                    placeholder="US / IN / UK ..."
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-600 mb-1 block">Average Audience Age</label>
                  <input
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    value={detailsForm.averageAudienceAge}
                    onChange={(e) => setDetailsForm((p) => ({ ...p, averageAudienceAge: e.target.value }))}
                    placeholder="24"
                    inputMode="numeric"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-600 mb-1 block">Last Contacted Date</label>
                  <input
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    value={detailsForm.lastContactedAt}
                    onChange={(e) => setDetailsForm((p) => ({ ...p, lastContactedAt: e.target.value }))}
                    type="date"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm text-slate-600 mb-1 block">Follow-up Dates</label>
                  <textarea
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-h-[90px]"
                    value={detailsForm.followUpDates}
                    onChange={(e) => setDetailsForm((p) => ({ ...p, followUpDates: e.target.value }))}
                    placeholder="2026-02-26, 2026-03-02 (comma or new line separated)"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Tip: Use <span className="font-mono">YYYY-MM-DD</span>. Separate by comma or new line.
                  </p>
                </div>
              </div>

              {detailsError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{detailsError}</div>
              ) : null}
            </div>

            <div className="flex gap-3 p-6 border-t border-slate-200">
              <button
                className="flex-1 px-4 py-3 border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors"
                onClick={() => setDetailsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={saveDetails}
                disabled={detailsSaving}
              >
                {detailsSaving ? 'Saving...' : 'Save Details'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Small UI helper for label/value rows */
function Row({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-600">{label}:</span>
      <span className={`font-medium text-slate-900 text-right ${mono ? 'font-mono text-xs' : ''}`}>{String(value)}</span>
    </div>
  );
}