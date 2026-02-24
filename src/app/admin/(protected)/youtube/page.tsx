'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, Mail, RefreshCw, Search, X, Download, Info } from 'lucide-react';
import swal from 'sweetalert';
import { post } from '@/lib/api';
import { Checkbox } from '@/components/animate-ui/components/radix/checkbox';

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

function showErr(message: string) {
  return swal({
    title: 'Error',
    text: message || 'Something went wrong.',
    icon: 'error',
  });
}

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
    chips.push(`Followers: ${filters.followersMin || '0'} - ${filters.followersMax || '∞'}`);
  }

  const cs = filters.countries?.length ? filters.countries : filters.country ? [filters.country] : [];
  if (cs.length) chips.push(`Country: ${cs.join(', ')}`);

  const cats = filters.categories?.length ? filters.categories : filters.category ? [filters.category] : [];
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

  // ✅ selection
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // Handle search (sync/open)
  const [query, setQuery] = useState('');
  const [searchHint, setSearchHint] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  // List state
  const [listLoading, setListLoading] = useState(false);

  // ✅ Filters (draft + active)
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

  // ✅ CSV download
  const [downloadLimit, setDownloadLimit] = useState('500');
  const [downloadLoading, setDownloadLoading] = useState(false);

  // ✅ Details modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsHandleId, setDetailsHandleId] = useState('');
  const [detailsSaving, setDetailsSaving] = useState(false);

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

    if (String(f.followersMin || '').trim()) out.followersMin = String(f.followersMin).trim();
    if (String(f.followersMax || '').trim()) out.followersMax = String(f.followersMax).trim();

    const cRaw = String(f.country || '').trim();
    if (cRaw) {
      const parts = splitCsvOrSpace(cRaw);
      if (parts.length > 1) out.countries = parts;
      else out.country = parts[0];
    }

    const catRaw = String(f.category || '').trim();
    if (catRaw) {
      const parts = splitCsvOrSpace(catRaw);
      if (parts.length > 1) out.categories = parts;
      else out.category = parts[0];
    }

    return out;
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => ({ ...prev, [id]: checked }));
  }

  function clearSelection() {
    setSelectedIds({});
  }

  function selectAllOnPage(list: InfluencerProfileDoc[]) {
    const next: Record<string, boolean> = {};
    for (const it of list) next[getDocId(it)] = true;
    setSelectedIds((prev) => ({ ...prev, ...next }));
  }

  function clearSelectionOnPage(list: InfluencerProfileDoc[]) {
    setSelectedIds((prev) => {
      const next = { ...prev };
      for (const it of list) delete next[getDocId(it)];
      return next;
    });
  }

  const selectedCount = useMemo(() => Object.values(selectedIds).filter(Boolean).length, [selectedIds]);

  // ✅ header checkbox state (all / indeterminate / none)
  const allOnPageSelected = useMemo(() => {
    if (!profiles.length) return false;
    return profiles.every((it) => !!selectedIds[getDocId(it)]);
  }, [profiles, selectedIds]);

  const someOnPageSelected = useMemo(() => {
    if (!profiles.length) return false;
    return profiles.some((it) => !!selectedIds[getDocId(it)]);
  }, [profiles, selectedIds]);

  const headerCheckState = useMemo(() => {
    if (allOnPageSelected) return true;
    if (someOnPageSelected) return 'indeterminate';
    return false;
  }, [allOnPageSelected, someOnPageSelected]);

  async function loadSaved(p = 1, active: InfluencerFilters = filtersActive) {
    setListLoading(true);
    try {
      const filterPayload = buildFilterPayload(active);

      const resp = await post<GetAllResponse>('/youtube/getall', {
        page: p,
        limit,
        search: '',
        sortBy: 'createdAt',
        sortOrder: 'desc',
        includeRaw: false,
        includeVideos: false,
        ...filterPayload,
      });

      if (resp?.status !== 'ok') throw new Error('Failed to load saved data');

      setProfiles(asList<InfluencerProfileDoc>(resp.data));
      setTotal(resp.total || 0);
      setHasNext(!!resp.hasNext);
      setPage(resp.page || p);

      // optional: reset selection on new page
      setSelectedIds({});
    } catch (e: any) {
      await showErr(e?.message || 'Failed to load saved data.');
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    loadSaved(1, filtersActive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
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

    setDetailsModalOpen(true);
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();

    const h = normalizeHandle(query);
    if (!h) {
      await showErr('Please enter a valid handle.');
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
      await showErr(e?.message || 'Failed to fetch from YouTube.');
    } finally {
      setSearchLoading(false);
    }
  }

  async function saveDetails() {
    const payload: any = { handleId: detailsHandleId };

    const email = detailsForm.email.trim();
    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toLowerCase())) {
        await showErr('Enter a valid email.');
        return;
      }
      payload.email = email.toLowerCase();
    } else {
      payload.email = null;
    }

    payload.lastSponsor = detailsForm.lastSponsor.trim() || null;
    payload.topAudienceCountry = detailsForm.topAudienceCountry.trim() || null;
    payload.workingHandle = detailsForm.workingHandle.trim() || null;

    payload.managedByAgency =
      detailsForm.managedByAgency === 'yes' ? true : detailsForm.managedByAgency === 'no' ? false : null;

    if (detailsForm.averageAudienceAge.trim()) {
      const n = Number(detailsForm.averageAudienceAge.trim());
      if (!Number.isFinite(n) || n < 0 || n > 120) {
        await showErr('Average audience age must be 0–120.');
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
      await showErr(e?.message || 'Failed to save details.');
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

  async function downloadCsv() {
    const n = parseInt(downloadLimit, 10);
    if (!Number.isFinite(n) || n <= 0) {
      await showErr('Enter a valid download count (e.g. 500).');
      return;
    }

    setDownloadLoading(true);
    try {
      const filterPayload = buildFilterPayload(filtersActive);

      const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
      const url = API_BASE ? `${API_BASE}/youtube/export-csv` : `/youtube/export-csv`;

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          limit: n,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          search: '',
          ...filterPayload,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(txt || `Export failed (${resp.status})`);
      }

      const blob = await resp.blob();

      let filename = '';
      const cd = resp.headers.get('content-disposition') || '';
      const m = cd.match(/filename="([^"]+)"/i);
      if (m?.[1]) filename = m[1];

      if (!filename) {
        const ts = new Date();
        const stamp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}_${String(
          ts.getHours()
        ).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}${String(ts.getSeconds()).padStart(2, '0')}`;
        filename = `influencers_${stamp}.csv`;
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      await showErr(e?.message || 'Failed to download CSV.');
    } finally {
      setDownloadLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">YouTube Influencer Profiles</h1>
          <p className="text-slate-600">Saved list loads from DB. Search by handle to open or fetch &amp; save.</p>
        </div>

        {/* Search + Filters card */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Search Influencer</h2>
                <p className="text-sm text-slate-600 mt-0.5">Search by handle to open saved profiles or fetch &amp; save from YouTube.</p>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                {activeChips.length ? (
                  <>
                    {activeChips.slice(0, 4).map((c) => (
                      <span
                        key={c}
                        className="text-xs px-3 py-1 rounded-full bg-white text-slate-700 border border-slate-200 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
                      >
                        {c}
                      </span>
                    ))}
                    {activeChips.length > 4 ? (
                      <span className="text-xs px-3 py-1 rounded-full bg-slate-900 text-white">+{activeChips.length - 4}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-xs px-3 py-1 rounded-full bg-white text-slate-600 border border-slate-200">No active filters</span>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={onSearch} className="p-6 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-7">
                <label className="text-xs font-medium text-slate-600 mb-2 block">YouTube Handle</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    className="w-full pl-12 pr-4 py-3.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. @MrBeast"
                  />
                </div>
              </div>

              <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  className="w-full h-[52px] px-5 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  type="submit"
                  disabled={searchLoading}
                >
                  {searchLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Searching…
                    </>
                  ) : existingProfile ? (
                    'Open Profile'
                  ) : (
                    'Search & Save'
                  )}
                </button>

                <button
                  type="button"
                  className="w-full h-[52px] px-5 rounded-lg font-semibold border border-slate-300 text-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  onClick={() => loadSaved(1, filtersActive)}
                  disabled={listLoading}
                  title="Reload list from database"
                >
                  <RefreshCw className={`w-4 h-4 ${listLoading ? 'animate-spin' : ''}`} />
                  Refresh List
                </button>
              </div>
            </div>

            {searchHint ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex gap-3 items-start">
                <div className="mt-0.5">
                  <Info className="w-5 h-5 text-slate-500" />
                </div>
                <p className="text-sm text-slate-700">{searchHint}</p>
              </div>
            ) : null}

            {/* Filters */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Filters</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Use comma-separated values for multiple countries/categories (e.g., <span className="font-mono">US,IN</span>).
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={clearFilters}
                    disabled={listLoading}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={applyFilters}
                    disabled={listLoading}
                  >
                    Apply Filters
                  </button>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <label className="text-[11px] font-semibold text-slate-600 mb-2 block uppercase tracking-wide">Followers Min</label>
                    <input
                      className="w-full px-3 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      value={filtersDraft.followersMin || ''}
                      onChange={(e) => setFiltersDraft((p) => ({ ...p, followersMin: e.target.value }))}
                      placeholder="100000"
                      inputMode="numeric"
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <label className="text-[11px] font-semibold text-slate-600 mb-2 block uppercase tracking-wide">Followers Max</label>
                    <input
                      className="w-full px-3 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      value={filtersDraft.followersMax || ''}
                      onChange={(e) => setFiltersDraft((p) => ({ ...p, followersMax: e.target.value }))}
                      placeholder="5000000"
                      inputMode="numeric"
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <label className="text-[11px] font-semibold text-slate-600 mb-2 block uppercase tracking-wide">Country</label>
                    <input
                      className="w-full px-3 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      value={filtersDraft.country || ''}
                      onChange={(e) => setFiltersDraft((p) => ({ ...p, country: e.target.value }))}
                      placeholder="US or US,IN"
                    />
                    <p className="text-[11px] text-slate-500 mt-2">
                      Multiple: <span className="font-mono">US,IN</span>
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <label className="text-[11px] font-semibold text-slate-600 mb-2 block uppercase tracking-wide">Category</label>
                    <input
                      className="w-full px-3 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      value={filtersDraft.category || ''}
                      onChange={(e) => setFiltersDraft((p) => ({ ...p, category: e.target.value }))}
                      placeholder="Entertainment or Lifestyle"
                    />
                    <p className="text-[11px] text-slate-500 mt-2">
                      Multiple: <span className="font-mono">Entertainment,Lifestyle</span>
                    </p>
                  </div>
                </div>

                {/* CSV row */}
                <div className="mt-5 pt-5 border-t border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        className="w-[150px] px-3 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white pr-14"
                        value={downloadLimit}
                        onChange={(e) => setDownloadLimit(e.target.value)}
                        placeholder="500"
                        inputMode="numeric"
                        title="How many rows to export"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">rows</span>
                    </div>

                    <button
                      type="button"
                      className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
                      onClick={downloadCsv}
                      disabled={downloadLoading}
                      title="Download CSV with active filters"
                    >
                      <Download className="w-4 h-4" />
                      {downloadLoading ? 'Downloading…' : 'Download CSV'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* minimal toolbar (no “Saved Profiles” heading) */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-slate-600">
                <b className="text-slate-900">{formatNumber(total)}</b> total
              </span>
              {selectedCount ? (
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-600 text-white">Selected: {selectedCount}</span>
              ) : null}

              {activeChips.length ? (
                <div className="flex flex-wrap gap-2 items-center">
                  {activeChips.map((c) => (
                    <span key={c} className="text-xs px-3 py-1 rounded-full bg-slate-100 text-slate-700 border">
                      {c}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* ✅ Table header row */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-1 flex items-center">
                <Checkbox
                  checked={headerCheckState as any}
                  onCheckedChange={(v: any) => {
                    const checked = !!v;
                    checked ? selectAllOnPage(profiles) : clearSelectionOnPage(profiles);
                  }}
                />
              </div>

              <div className="col-span-9">
                <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Handle</div>
              </div>

              <div className="col-span-2 text-right">
                <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Actions</div>
              </div>
            </div>
          </div>

          {listLoading && profiles.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading profiles...
            </div>
          ) : null}

          {!listLoading && profiles.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">No saved profiles yet. Use search to fetch and save influencer data.</div>
          ) : null}

          <div className="divide-y divide-slate-200">
            {profiles.map((p) => {
              const id = getDocId(p);
              const isOpen = !!expanded[id];
              const checked = !!selectedIds[id];
              const thumb = p.thumbnails?.default?.url || p.thumbnails?.medium?.url || p.thumbnails?.high?.url;
              const channelUrl = ytChannelUrl(p);

              return (
                <div key={id} id={`card-${id}`} className="hover:bg-slate-50 transition-colors">
                  <div className="px-6 py-4">
                    {/* ✅ aligned with header */}
                    <div className="grid grid-cols-12 items-start gap-3">
                      {/* checkbox */}
                      <div className="col-span-1 pt-2">
                        <Checkbox checked={checked} onCheckedChange={(v: any) => toggleSelect(id, !!v)} />
                      </div>

                      {/* handle column */}
                      <div className="col-span-9 min-w-0">
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

                        {/* metrics */}
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

                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                          <span>Synced: {formatDate(p.syncedAt)}</span>
                          {p.uploadFrequencyPerWeek != null ? <span>{p.uploadFrequencyPerWeek} uploads/week</span> : null}
                          {p.lastSponsor ? <span>Last Sponsor: {p.lastSponsor}</span> : null}
                          {p.managedByAgency != null ? <span>Agency: {formatBool(p.managedByAgency)}</span> : null}
                        </div>
                      </div>

                      {/* actions column */}
                      <div className="col-span-2 flex items-center justify-end gap-2">
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
                          Add
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
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ✅ Pagination footer */}
          <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm text-slate-600">
              Page <span className="font-semibold text-slate-900">{page}</span>
              {total ? (
                <>
                  {' '}
                  • <span className="font-semibold text-slate-900">{formatNumber(total)}</span> total
                </>
              ) : null}
            </div>

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