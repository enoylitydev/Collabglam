'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Info, RefreshCw, Search } from 'lucide-react';
import swal from 'sweetalert';
import { get } from '@/lib/api';
import { Checkbox } from '@/components/animate-ui/components/radix/checkbox';

type LangObj = { code?: string; name?: string };

type InfluencerDoc = {
  _id?: string;
  provider?: string; // youtube | instagram | tiktok
  platform?: string; // sometimes API uses platform
  userId?: string;

  fullname?: string;
  handle?: string;
  username?: string;

  country?: string | null;
  city?: string | null;
  state?: string | null;
  language?: LangObj | null;

  followers?: number | null;
  averageViews?: number | null;

  engagements?: number | null;
  engagementRate?: number | null;

  isPrivate?: boolean | null;
  isVerified?: boolean | null;

  picture?: string | null;
  url?: string | null;

  createdAt?: string;
  updatedAt?: string;

  influencerId?: string;
  influencer?: string;
};

type ListResponse = {
  page: number; // 0-indexed
  limit: number;
  total: number;
  results: InfluencerDoc[];
};

type InfluencerFilters = {
  followersMin?: string;
  followersMax?: string;
  country?: string; // CSV: US,IN
  provider?: string; // all | youtube | instagram | tiktok
};

type Platform = 'youtube' | 'instagram' | 'tiktok';

const PLATFORM_OPTIONS: { key: Platform; label: string }[] = [
  { key: 'youtube', label: 'YouTube' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
];

function showErr(message: string) {
  return swal({
    title: 'Error',
    text: message || 'Something went wrong.',
    icon: 'error',
  });
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

function splitCsv(v: string): string[] {
  return (v || '')
    .split(/[,\n]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function chipText(filters: InfluencerFilters) {
  const chips: string[] = [];
  if (filters.provider && filters.provider !== 'all') chips.push(`Provider: ${filters.provider}`);
  if (filters.followersMin || filters.followersMax) {
    chips.push(`Followers: ${filters.followersMin || '0'} - ${filters.followersMax || '∞'}`);
  }
  const countries = splitCsv(filters.country || '');
  if (countries.length) chips.push(`Country: ${countries.join(', ')}`);
  return chips;
}

/**
 * ✅ USE userId as primary key (what you asked).
 * Fallbacks ONLY if userId missing.
 */
function getRowKey(p: InfluencerDoc) {
  const base = String(p.userId || '').trim();
  if (base) return base;

  const fallback = String(p._id || p.influencerId || p.handle || p.username || p.url || '').trim();
  return fallback || 'missing_id';
}

/** safe dom id (no special chars) */
function toDomId(key: string) {
  return `row_${String(key).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export default function Page() {
  const SAVED_ENDPOINT = '/modash/saved';
  const USERS_ENDPOINT = '/modash/users';

  const [items, setItems] = useState<InfluencerDoc[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [usersItems, setUsersItems] = useState<InfluencerDoc[]>([]);
  const [view, setView] = useState<'saved' | 'users'>('saved');

  // paging
  const [page, setPage] = useState(1); // UI is 1-indexed
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  // search
  const [query, setQuery] = useState('');
  const [searchHint, setSearchHint] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // platform multi-select
  const [searchPlatforms, setSearchPlatforms] = useState<Record<Platform, boolean>>({
    youtube: true,
    instagram: true,
    tiktok: true,
  });

  // ✅ selection keyed by rowKey (userId)
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // filters
  const [filtersDraft, setFiltersDraft] = useState<InfluencerFilters>({
    provider: 'all',
    followersMin: '',
    followersMax: '',
    country: '',
  });

  const [filtersActive, setFiltersActive] = useState<InfluencerFilters>({
    provider: 'all',
    followersMin: '',
    followersMax: '',
    country: '',
  });

  const activeChips = useMemo(() => chipText(filtersActive), [filtersActive]);

  const selectedPlatformKeys = useMemo(() => {
    return PLATFORM_OPTIONS.filter((p) => !!searchPlatforms[p.key]).map((p) => p.key);
  }, [searchPlatforms]);

  const platformChip = useMemo(() => {
    if (selectedPlatformKeys.length === 0) return 'Platforms: none';
    if (selectedPlatformKeys.length === 3) return 'Platforms: All';
    return `Platforms: ${selectedPlatformKeys.join(', ')}`;
  }, [selectedPlatformKeys]);

  const selectedCount = useMemo(() => Object.values(selectedIds).filter(Boolean).length, [selectedIds]);

  // ✅ map handle -> rowKey (for jump)
  const itemsByHandle = useMemo(() => {
    const map = new Map<string, { key: string; doc: InfluencerDoc }>();
    for (const x of items) {
      const h = (x.handle || x.username || '').toLowerCase().trim();
      if (h) map.set(h, { key: getRowKey(x), doc: x });
    }
    return map;
  }, [items]);

  function toggleExpand(rowKey: string) {
    setExpanded((p) => ({ ...p, [rowKey]: !p[rowKey] }));
  }

  function openAndScrollTo(rowKey: string) {
    setExpanded((p) => ({ ...p, [rowKey]: true }));
    setTimeout(() => {
      const el = document.getElementById(toDomId(rowKey));
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  function toggleSelect(rowKey: string, checked: boolean) {
    setSelectedIds((prev) => ({ ...prev, [rowKey]: checked }));
  }

  function clearSelection() {
    setSelectedIds({});
  }

  function selectAllOnPage(list: InfluencerDoc[]) {
    const next: Record<string, boolean> = {};
    for (const it of list) next[getRowKey(it)] = true;
    setSelectedIds((prev) => ({ ...prev, ...next }));
  }

  function clearSelectionOnPage(list: InfluencerDoc[]) {
    setSelectedIds((prev) => {
      const next = { ...prev };
      for (const it of list) delete next[getRowKey(it)];
      return next;
    });
  }

  function buildSavedParams(pUI: number, f: InfluencerFilters, q: string) {
    const params: Record<string, any> = {
      page: Math.max(0, pUI - 1),
      limit,
      sort: 'updatedAt',
      dir: 'desc',
    };

    const qClean = String(q || '').trim();
    if (qClean) params.q = qClean;

    if (selectedPlatformKeys.length === 1) params.platform = selectedPlatformKeys[0];
    else if (selectedPlatformKeys.length > 1) params.platforms = selectedPlatformKeys.join(',');

    if (f.provider && f.provider !== 'all') params.provider = f.provider;
    if (String(f.followersMin || '').trim()) params.followersMin = String(f.followersMin).trim();
    if (String(f.followersMax || '').trim()) params.followersMax = String(f.followersMax).trim();
    if (String(f.country || '').trim()) params.country = String(f.country).trim();

    return params;
  }

  function buildUsersParams(pUI: number, q: string) {
    const params: Record<string, any> = {
      page: Math.max(0, pUI - 1),
      limit,
    };

    const qClean = String(q || '').trim();
    if (qClean) params.q = qClean;

    if (selectedPlatformKeys.length === 1) params.platform = selectedPlatformKeys[0];
    else if (selectedPlatformKeys.length > 1) params.platforms = selectedPlatformKeys.join(',');

    return params;
  }

  async function loadSaved(pUI = 1, f: InfluencerFilters = filtersActive, q = '') {
    setListLoading(true);
    try {
      const resp = await get<ListResponse>(SAVED_ENDPOINT, buildSavedParams(pUI, f, q));

      setView('saved');
      setUsersItems([]);

      const results = Array.isArray(resp?.results) ? resp.results : [];
      setItems(results);
      setTotal(resp?.total || 0);

      const serverPage = Number(resp?.page ?? 0);
      const serverLimit = Number(resp?.limit ?? limit);
      const serverTotal = Number(resp?.total ?? 0);

      setPage(serverPage + 1);
      setHasNext((serverPage + 1) * serverLimit < serverTotal);
    } catch (e: any) {
      await showErr(e?.message || 'Failed to load saved influencers.');
    } finally {
      setListLoading(false);
    }
  }

  async function loadUsers(pUI = 1, q = '') {
    setListLoading(true);
    try {
      const resp = await get<ListResponse>(USERS_ENDPOINT, buildUsersParams(pUI, q));

      setView('users');

      const results = Array.isArray(resp?.results) ? resp.results : [];
      setUsersItems(results);

      setTotal(resp?.total || results.length || 0);

      const serverPage = Number(resp?.page ?? 0);
      const serverLimit = Number(resp?.limit ?? limit);
      const serverTotal = Number(resp?.total ?? results.length ?? 0);

      setPage(serverPage + 1);
      setHasNext((serverPage + 1) * serverLimit < serverTotal);
    } catch (e: any) {
      await showErr(e?.message || 'Failed to load users.');
    } finally {
      setListLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    loadSaved(1, filtersActive, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // hint
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setSearchHint('');
      return;
    }
  }, [query, itemsByHandle]);

  // type search (debounced) => saved only
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    if (view !== 'saved') return;
    if (selectedPlatformKeys.length === 0) return;

    const q = query.trim();

    if (!q) {
      loadSaved(1, filtersActive, '');
      return;
    }

    const t = setTimeout(() => {
      loadSaved(1, filtersActive, q);
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filtersActive, selectedPlatformKeys.join('|'), view]);

  function applyFilters() {
    const next = { ...filtersDraft };
    setFiltersActive(next);
    loadSaved(1, next, query.trim());
  }

  function clearFilters() {
    const empty: InfluencerFilters = { provider: 'all', followersMin: '', followersMax: '', country: '' };
    setFiltersDraft(empty);
    setFiltersActive(empty);
    loadSaved(1, empty, query.trim());
  }

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();

    if (selectedPlatformKeys.length === 0) {
      await showErr('Select at least one platform.');
      return;
    }

    const q = query.trim();
    if (!q) {
      await showErr('Please enter a handle/username to search.');
      return;
    }

    // quick jump if already loaded
    const existing = itemsByHandle.get(q.toLowerCase());
    if (existing?.key) {
      setView('saved');
      openAndScrollTo(existing.key);
      return;
    }

    setSearchLoading(true);
    try {
      // 1) Search SAVED first
      const savedResp = await get<ListResponse>(SAVED_ENDPOINT, buildSavedParams(1, filtersActive, q));
      const savedResults = Array.isArray(savedResp?.results) ? savedResp.results : [];

      if (savedResults.length) {
        setView('saved');
        setUsersItems([]);
        setItems(savedResults);

        setTotal(savedResp?.total || savedResults.length);

        const serverPage = Number(savedResp?.page ?? 0);
        const serverLimit = Number(savedResp?.limit ?? limit);
        const serverTotal = Number(savedResp?.total ?? savedResults.length);

        setPage(serverPage + 1);
        setHasNext((serverPage + 1) * serverLimit < serverTotal);

        openAndScrollTo(getRowKey(savedResults[0]));
        return;
      }

      // 2) fallback to USERS
      await loadUsers(1, q);
    } catch (e: any) {
      await showErr(e?.message || 'Search failed.');
    } finally {
      setSearchLoading(false);
    }
  }

  const currentItems = view === 'saved' ? items : usersItems;

  // header checkbox state
  const allOnPageSelected = useMemo(() => {
    if (!currentItems.length) return false;
    return currentItems.every((it) => !!selectedIds[getRowKey(it)]);
  }, [currentItems, selectedIds]);

  const someOnPageSelected = useMemo(() => {
    if (!currentItems.length) return false;
    return currentItems.some((it) => !!selectedIds[getRowKey(it)]);
  }, [currentItems, selectedIds]);

  const headerCheckState = useMemo(() => {
    if (allOnPageSelected) return true;
    if (someOnPageSelected) return 'indeterminate';
    return false;
  }, [allOnPageSelected, someOnPageSelected]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{view === 'saved' ? 'Modash Influencers' : 'Users Results'}</h1>
        </div>

        {/* Search + Filters */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Search & Filters</h2>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                {activeChips.length ? (
                  activeChips.map((c) => (
                    <span
                      key={c}
                      className="text-xs px-3 py-1 rounded-full bg-white text-slate-700 border border-slate-200 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
                    >
                      {c}
                    </span>
                  ))
                ) : (
                  <span className="text-xs px-3 py-1 rounded-full bg-white text-slate-600 border border-slate-200">No active filters</span>
                )}

                <span className="text-xs px-3 py-1 rounded-full bg-slate-900 text-white">{platformChip}</span>
              </div>
            </div>
          </div>

          <form onSubmit={onSearch} className="p-6 space-y-5">
            {/* Search row */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-6">
                <label className="text-xs font-medium text-slate-600 mb-2 block">Handle / Username</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    className="w-full pl-12 pr-4 py-3.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. @SamZonebd or soulsyncav"
                  />
                </div>
              </div>

              {/* Platforms multi-select */}
              <div className="lg:col-span-3">
                <label className="text-xs font-medium text-slate-600 mb-2 block">Platforms</label>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {PLATFORM_OPTIONS.map((p) => {
                      const checked = !!searchPlatforms[p.key];
                      return (
                        <label key={p.key} className="flex items-center gap-2 cursor-pointer select-none">
                          <Checkbox checked={checked} onCheckedChange={(v: any) => setSearchPlatforms((prev) => ({ ...prev, [p.key]: !!v }))} />
                          <span className="text-sm text-slate-800">{p.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  className="w-full h-[52px] px-5 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  type="submit"
                  disabled={searchLoading || listLoading}
                >
                  {searchLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Searching…
                    </>
                  ) : (
                    'Search'
                  )}
                </button>

                <button
                  type="button"
                  className="w-full h-[52px] px-5 rounded-lg font-semibold border border-slate-300 text-slate-800 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  onClick={() => {
                    setView('saved');
                    setUsersItems([]);
                    setQuery('');
                    clearSelection();
                    loadSaved(1, filtersActive, '');
                  }}
                  disabled={listLoading}
                  title="Reload saved list"
                >
                  <RefreshCw className={`w-4 h-4 ${listLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
            {/* Filters */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Filters</div>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <label className="text-[11px] font-semibold text-slate-600 mb-2 block uppercase tracking-wide">Provider</label>
                    <select
                      className="w-full px-3 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      value={filtersDraft.provider || 'all'}
                      onChange={(e) => setFiltersDraft((p) => ({ ...p, provider: e.target.value }))}
                    >
                      <option value="all">All</option>
                      <option value="youtube">YouTube</option>
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                    </select>
                  </div>

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
                      placeholder="GB or GB,IN"
                    />
                    <p className="text-[11px] text-slate-500 mt-2">
                      Multiple: <span className="font-mono">GB,IN</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap mt-5 justify-center">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg border cursor-pointer border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={clearFilters}
                    disabled={listLoading}
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg bg-slate-900 cursor-pointer hover:bg-slate-800 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={applyFilters}
                    disabled={listLoading}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* top toolbar */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-slate-900">{view === 'saved' ? 'Saved Results' : 'Users Results'}</h2>
              <span className="text-sm text-slate-600">{formatNumber(total)} total</span>
              {selectedCount ? (
                <span className="text-sm text-slate-700">
                  • Selected <b>{selectedCount}</b>
                </span>
              ) : null}
            </div>
          </div>

          {/* table header row */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-1 flex items-center">
                <Checkbox
                  checked={headerCheckState as any}
                  onCheckedChange={(v: any) => {
                    const checked = !!v;
                    checked ? selectAllOnPage(currentItems) : clearSelectionOnPage(currentItems);
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

          {listLoading && currentItems.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading...
            </div>
          ) : null}

          {!listLoading && currentItems.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">Click on Search for Global Search.</div>
          ) : null}

          <div className="divide-y divide-slate-200">
            {currentItems.map((p) => {
              const rowKey = getRowKey(p);
              const domId = toDomId(rowKey);

              const isOpen = !!expanded[rowKey];
              const thumb = p.picture || '';
              const url = p.url || '';
              const checked = !!selectedIds[rowKey];

              const providerLabel = p.provider || p.platform;

              return (
                <div key={rowKey} id={domId} className="hover:bg-slate-50 transition-colors">
                  <div className="px-6 py-4">
                    <div className="grid grid-cols-12 items-start gap-3">
                      {/* checkbox */}
                      <div className="col-span-1 pt-2">
                        <Checkbox checked={checked} onCheckedChange={(v: any) => toggleSelect(rowKey, !!v)} />
                      </div>

                      {/* handle column */}
                      <div className="col-span-9 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 shrink-0">
                            {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" /> : null}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-slate-900 truncate">{p.handle || p.username || '—'}</h3>

                              {providerLabel ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-300 text-slate-600">
                                  {providerLabel}
                                </span>
                              ) : null}

                              {p.isVerified ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                                  Verified
                                </span>
                              ) : null}
                            </div>

                            <div className="text-sm text-slate-600 truncate">{p.fullname || '—'}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-3">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Country</div>
                            <div className="text-sm font-medium text-slate-900">{p.country || '—'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Followers</div>
                            <div className="text-sm font-medium text-slate-900">{formatNumber(p.followers)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Avg Views</div>
                            <div className="text-sm font-medium text-slate-900">{formatNumber(p.averageViews)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Engagement</div>
                            <div className="text-sm font-medium text-slate-900">{formatPercent(p.engagementRate)}</div>
                          </div>
                          <div className="hidden lg:block">
                            <div className="text-xs text-slate-500 mb-1">Engagements</div>
                            <div className="text-sm font-medium text-slate-900">{formatNumber(p.engagements)}</div>
                          </div>
                          <div className="hidden lg:block">
                            <div className="text-xs text-slate-500 mb-1">{view === 'saved' ? 'Updated' : 'Created'}</div>
                            <div className="text-sm font-medium text-slate-900">
                              {view === 'saved' ? formatDate(p.updatedAt) : formatDate(p.createdAt)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                          <span>Private: {formatBool(p.isPrivate)}</span>
                          {p.userId ? <span>UserId: {p.userId}</span> : null}
                        </div>
                      </div>

                      {/* actions */}
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                            title="Open profile"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Open
                          </a>
                        ) : null}

                        <button
                          type="button"
                          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                          onClick={() => toggleExpand(rowKey)}
                          aria-expanded={isOpen}
                          aria-label="Expand"
                        >
                          <ChevronDown className={`w-5 h-5 text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="mt-6 pt-6 border-t border-slate-200 space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="bg-slate-50 rounded-xl p-4">
                            <h4 className="font-semibold text-slate-900 mb-3">Profile Details</h4>
                            <div className="space-y-2 text-sm">
                              <Row label="User ID" value={p.userId || '—'} mono />
                              <Row label="Username" value={p.username || '—'} />
                              <Row label="Handle" value={p.handle || '—'} />
                              <Row label="City" value={p.city || '—'} />
                              <Row label="State" value={p.state || '—'} />
                              <Row label="Country" value={p.country || '—'} />
                              <Row label="Language" value={p.language?.name || p.language?.code || '—'} />
                            </div>
                          </div>

                          <div className="bg-slate-50 rounded-xl p-4">
                            <h4 className="font-semibold text-slate-900 mb-3">Metrics</h4>
                            <div className="space-y-2 text-sm">
                              <Row label="Followers" value={formatNumber(p.followers)} />
                              <Row label="Average Views" value={formatNumber(p.averageViews)} />
                              <Row label="Engagement Rate" value={formatPercent(p.engagementRate)} />
                              <Row label="Engagements" value={formatNumber(p.engagements)} />
                              <Row label="Verified" value={formatBool(p.isVerified)} />
                              <Row label="Private" value={formatBool(p.isPrivate)} />
                              <Row label="Created" value={formatDate(p.createdAt)} />
                              <Row label="Updated" value={formatDate(p.updatedAt)} />
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
                onClick={() => {
                  const next = Math.max(1, page - 1);
                  view === 'saved' ? loadSaved(next, filtersActive, query.trim()) : loadUsers(next, query.trim());
                }}
                disabled={listLoading || page <= 1}
              >
                Previous
              </button>

              <button
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  const next = page + 1;
                  view === 'saved' ? loadSaved(next, filtersActive, query.trim()) : loadUsers(next, query.trim());
                }}
                disabled={listLoading || !hasNext}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-600">{label}:</span>
      <span className={`font-medium text-slate-900 text-right ${mono ? 'font-mono text-xs' : ''}`}>{String(value)}</span>
    </div>
  );
}