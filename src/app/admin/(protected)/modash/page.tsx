'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ChevronDown, ExternalLink, Info, RefreshCw, Search, Download } from 'lucide-react';
import swal from 'sweetalert';
import { get } from '@/lib/api';
import { Checkbox } from '@/components/animate-ui/components/radix/checkbox';

const DASH = '--';

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

  // ✅ added for category display (backend projection includes it)
  category?: string[] | string | null;
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

  // ✅ UI uses multi-select
  countries?: string[];

  // ✅ keep legacy key for backend compatibility (CSV: "US,IN")
  country?: string;

  provider?: string; // all | youtube | instagram | tiktok

  // ✅ Category filter (comma-separated in UI)
  category?: string; // "Lifestyle" or "Lifestyle,Tech"
  categories?: string[]; // optional parsed form
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
  if (n == null || !Number.isFinite(n)) return DASH;
  return new Intl.NumberFormat('en-IN').format(n);
}

function formatPercent(x?: number | null) {
  if (x == null || !Number.isFinite(x)) return DASH;
  return `${(x * 100).toFixed(2)}%`;
}

function formatBool(b?: boolean | null) {
  if (b === true) return 'Yes';
  if (b === false) return 'No';
  return DASH;
}

function formatDate(iso?: string | null, timeZone = 'Asia/Kolkata') {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return DASH;

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

function countriesToCsv(f: InfluencerFilters) {
  if (Array.isArray(f.countries) && f.countries.length) return f.countries.join(',');
  const legacy = String(f.country || '').trim();
  return legacy;
}

function categoriesFromFilter(f: InfluencerFilters) {
  const arr = Array.isArray(f.categories) && f.categories.length ? f.categories : splitCsv(String(f.category || ''));
  return Array.from(new Set(arr.map((x) => x.trim()).filter(Boolean)));
}

function chipText(filters: InfluencerFilters) {
  const chips: string[] = [];
  if (filters.provider && filters.provider !== 'all') chips.push(`Provider: ${filters.provider}`);
  if (filters.followersMin || filters.followersMax) {
    chips.push(`Followers: ${filters.followersMin || '0'} - ${filters.followersMax || '∞'}`);
  }

  const cs = Array.isArray(filters.countries) && filters.countries.length ? filters.countries : splitCsv(filters.country || '');
  if (cs.length) chips.push(`Country: ${cs.join(', ')}`);

  const cats = categoriesFromFilter(filters);
  if (cats.length) chips.push(`Category: ${cats.join(', ')}`);

  return chips;
}

/**
 * ✅ USE userId as primary key.
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

/** --- Country list for dropdown (common) --- */
const COUNTRY_OPTIONS: Array<{ code: string; name: string }> = [
  { code: 'US', name: 'United States' },
  { code: 'IN', name: 'India' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'IE', name: 'Ireland' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'GR', name: 'Greece' },
  { code: 'TR', name: 'Turkey' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'RU', name: 'Russia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'MX', name: 'Mexico' },
  { code: 'PE', name: 'Peru' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'EG', name: 'Egypt' },
  { code: 'KE', name: 'Kenya' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'IL', name: 'Israel' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'CN', name: 'China' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'NP', name: 'Nepal' },
];

function countryLabel(code: string) {
  const c = COUNTRY_OPTIONS.find((x) => x.code === code);
  return c ? `${c.code} — ${c.name}` : code;
}

function MultiCountrySelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter((c) => c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s));
  }, [q]);

  const summary = value?.length ? value.join(', ') : 'All';

  function updatePos() {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 8, width: r.width });
  }

  function toggle(code: string) {
    const next = new Set(value || []);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(Array.from(next).sort());
  }

  useEffect(() => {
    if (!open) return;

    updatePos();

    const onReflow = () => updatePos();
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const overlay =
    open && pos && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-[9999]">
            <div className="absolute inset-0 bg-black/10" onClick={() => setOpen(false)} />

            <div
              className="fixed rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
              style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: 'min(70vh, 520px)' }}
            >
              <div className="p-3 border-b border-slate-200">
                <input
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search"
                  autoFocus
                />
                <div className="mt-2 flex items-center justify-between">
                  <button type="button" className="text-xs font-semibold text-slate-700 hover:underline" onClick={() => onChange([])}>
                    Clear
                  </button>
                  <span className="text-xs text-slate-500">{value.length} selected</span>
                </div>
              </div>

              <div className="max-h-[420px] overflow-auto p-2">
                {filtered.map((c) => {
                  const checked = value.includes(c.code);
                  return (
                    <label key={c.code} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <Checkbox checked={checked} onCheckedChange={() => toggle(c.code)} />
                      <span className="text-sm text-slate-800">{countryLabel(c.code)}</span>
                    </label>
                  );
                })}

                {!filtered.length ? <div className="px-2 py-6 text-center text-sm text-slate-500">No countries found</div> : null}
              </div>

              <div className="p-3 border-t border-slate-200 bg-slate-50">
                <button
                  type="button"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
                  onClick={() => setOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="w-full px-3 py-3 border border-slate-300 rounded-xl bg-white text-left flex items-center justify-between gap-2 hover:bg-slate-50"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (!v && next) updatePos();
            return next;
          });
        }}
      >
        <span className="text-sm text-slate-800 truncate">{summary}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {overlay}
    </>
  );
}

export default function Page() {
  const SAVED_ENDPOINT = '/modash/saved';
  const USERS_ENDPOINT = '/modash/users';
  const EXPORT_ENDPOINT = '/modash/export-csv';

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

  // ✅ selection keyed by rowKey (userId/fallback)
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  // ✅ store modash _id for exporting selected
  const [selectedMeta, setSelectedMeta] = useState<Record<string, { modashId?: string }>>({});

  // ✅ CSV download
  const [downloadLimit, setDownloadLimit] = useState('');
  const [downloadLoading, setDownloadLoading] = useState(false);

  // ✅ filters (draft + active)
  const [filtersDraft, setFiltersDraft] = useState<InfluencerFilters>({
    provider: 'all',
    followersMin: '',
    followersMax: '',
    countries: [],
    category: '',
  });

  const [filtersActive, setFiltersActive] = useState<InfluencerFilters>({
    provider: 'all',
    followersMin: '',
    followersMax: '',
    countries: [],
    category: '',
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

  // ✅ selected modash ids (only those we actually have _id for)
  const selectedModashIds = useMemo(() => {
    return Object.entries(selectedIds)
      .filter(([, v]) => v)
      .map(([rowKey]) => selectedMeta[rowKey]?.modashId)
      .filter(Boolean) as string[];
  }, [selectedIds, selectedMeta]);

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

  // ✅ updated selection to store modashId when available
  function toggleSelect(rowKey: string, checked: boolean, modashId?: string) {
    setSelectedIds((prev) => ({ ...prev, [rowKey]: checked }));

    setSelectedMeta((prev) => {
      const next = { ...prev };
      if (!checked) {
        delete next[rowKey];
        return next;
      }
      next[rowKey] = { modashId: modashId || next[rowKey]?.modashId };
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds({});
    setSelectedMeta({});
  }

  function selectAllOnPage(list: InfluencerDoc[]) {
    const nextIds: Record<string, boolean> = {};
    const nextMeta: Record<string, { modashId?: string }> = {};

    for (const it of list) {
      const key = getRowKey(it);
      nextIds[key] = true;
      if (it._id) nextMeta[key] = { modashId: String(it._id) };
    }

    setSelectedIds((prev) => ({ ...prev, ...nextIds }));
    setSelectedMeta((prev) => ({ ...prev, ...nextMeta }));
  }

  function clearSelectionOnPage(list: InfluencerDoc[]) {
    setSelectedIds((prev) => {
      const next = { ...prev };
      for (const it of list) delete next[getRowKey(it)];
      return next;
    });

    setSelectedMeta((prev) => {
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

    if (String(f.followersMin || '').trim()) params.minFollowers = String(f.followersMin).trim();
    if (String(f.followersMax || '').trim()) params.maxFollowers = String(f.followersMax).trim();

    const countryCsv = countriesToCsv(f);
    if (countryCsv) params.country = countryCsv;

    // ✅ Category (backend supports: category OR categories; it splits by comma)
    const cats = categoriesFromFilter(f);
    if (cats.length) params.category = cats.join(',');

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

  // hint (optional)
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
    // normalize categories once (optional)
    const cats = categoriesFromFilter(filtersDraft);
    const next: InfluencerFilters = {
      ...filtersDraft,
      categories: cats,
    };

    setFiltersActive(next);
    loadSaved(1, next, query.trim());
  }

  function clearFilters() {
    const empty: InfluencerFilters = {
      provider: 'all',
      followersMin: '',
      followersMax: '',
      countries: [],
      country: '',
      category: '',
      categories: [],
    };
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

  function getApiUrl(path: string) {
    const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
    return API_BASE ? `${API_BASE}${path}` : path;
  }

  async function downloadCsvAll() {
    if (view !== 'saved') {
      await showErr('CSV export works for Saved Results only.');
      return;
    }

    const n = parseInt(downloadLimit, 10);
    if (!Number.isFinite(n) || n <= 0) {
      await showErr('Enter a valid download count.');
      return;
    }

    setDownloadLoading(true);
    try {
      const url = getApiUrl(EXPORT_ENDPOINT);

      const payload: any = {
        limit: n,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        sort: 'updatedAt',
        dir: 'desc',
      };

      // ✅ Prefer provider dropdown. If provider=all and exactly 1 platform selected -> use that.
      const providerDrop = String(filtersActive.provider || 'all').toLowerCase();
      if (providerDrop && providerDrop !== 'all') payload.provider = providerDrop;
      else if (selectedPlatformKeys.length === 1) payload.provider = selectedPlatformKeys[0];

      if (String(filtersActive.followersMin || '').trim()) payload.minFollowers = Number(String(filtersActive.followersMin).trim());
      if (String(filtersActive.followersMax || '').trim()) payload.maxFollowers = Number(String(filtersActive.followersMax).trim());

      const qClean = String(query || '').trim();
      if (qClean) payload.search = qClean;

      const countryCsv = countriesToCsv(filtersActive);
      if (countryCsv) payload.country = countryCsv;

      // ✅ Category export (backend splits comma string)
      const cats = categoriesFromFilter(filtersActive);
      if (cats.length) payload.category = cats.join(',');

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
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
      if (!filename) filename = `modash_saved_${n}.csv`;

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

  async function downloadCsvSelected() {
    if (view !== 'saved') {
      await showErr('Selected export works for Saved Results only.');
      return;
    }

    if (!selectedModashIds.length) {
      await showErr('Select at least 1 saved influencer to export.');
      return;
    }

    setDownloadLoading(true);
    try {
      const url = getApiUrl(EXPORT_ENDPOINT);

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          modashIds: selectedModashIds,
          sortBy: 'updatedAt',
          sortOrder: 'desc',
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
      if (!filename) filename = `modash_selected_${selectedModashIds.length}.csv`;

      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e: any) {
      await showErr(e?.message || 'Failed to download selected CSV.');
    } finally {
      setDownloadLoading(false);
    }
  }

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
                    placeholder="e.g. @SamZonebd"
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
                  <div className="text-xs text-slate-600 mt-0.5">Country is multi-select. Category supports comma-separated.</div>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* Provider */}
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

                  {/* Followers min */}
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

                  {/* Followers max */}
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

                  {/* Country multi-select */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <label className="text-[11px] font-semibold text-slate-600 mb-2 block uppercase tracking-wide">
                      Country (Multi-select)
                    </label>
                    <MultiCountrySelect
                      value={filtersDraft.countries || []}
                      onChange={(next) =>
                        setFiltersDraft((p) => ({
                          ...p,
                          countries: next,
                          country: '', // clear legacy text to avoid conflicts
                        }))
                      }
                    />
                    <p className="text-[11px] text-slate-500 mt-2">Pick multiple (US, IN, GB…)</p>
                  </div>

                  {/* Category */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <label className="text-[11px] font-semibold text-slate-600 mb-2 block uppercase tracking-wide">Category</label>
                    <input
                      className="w-full px-3 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      value={filtersDraft.category || ''}
                      onChange={(e) =>
                        setFiltersDraft((p) => ({
                          ...p,
                          category: e.target.value,
                          categories: [], // normalize on Apply
                        }))
                      }
                      placeholder="Fitness or Fitness,Beauty"
                    />
                    <p className="text-[11px] text-slate-500 mt-2">
                      Multiple: <span className="font-mono">Fitness,Beauty</span>
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

                {/* CSV Download */}
                <div className="mt-6 pt-5 border-t border-slate-200">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative">
                        <input
                          className="w-[160px] px-3 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white pr-14"
                          value={downloadLimit}
                          onChange={(e) => setDownloadLimit(e.target.value)}
                          placeholder="No. of."
                          inputMode="numeric"
                          title="How many rows to export (no pagination)"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">rows</span>
                      </div>

                      <button
                        type="button"
                        className="px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
                        onClick={downloadCsvAll}
                        disabled={downloadLoading || listLoading}
                        title="Download CSV by limit (no pagination)"
                      >
                        <Download className="w-4 h-4" />
                        {downloadLoading ? 'Downloading…' : 'Download CSV'}
                      </button>

                      <button
                        type="button"
                        className="px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
                        onClick={downloadCsvSelected}
                        disabled={downloadLoading || selectedModashIds.length === 0}
                        title="Download CSV for selected influencers only"
                      >
                        <Download className="w-4 h-4" />
                        Download Selected ({selectedModashIds.length})
                      </button>

                      {selectedCount ? (
                        <button
                          type="button"
                          className="px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors"
                          onClick={clearSelection}
                          disabled={downloadLoading}
                          title="Clear selected"
                        >
                          Clear Selection
                        </button>
                      ) : null}
                    </div>

                    {view !== 'saved' ? (
                      <div className="text-xs text-slate-500">
                        Note: CSV export works on <b>Saved Results</b>.
                      </div>
                    ) : null}
                  </div>
                </div>

                {searchHint ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex gap-3 items-start">
                    <div className="mt-0.5">
                      <Info className="w-5 h-5 text-slate-500" />
                    </div>
                    <p className="text-sm text-slate-700">{searchHint}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </form>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
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
                  checked={
                    currentItems.length
                      ? currentItems.every((it) => !!selectedIds[getRowKey(it)])
                        ? (true as any)
                        : currentItems.some((it) => !!selectedIds[getRowKey(it)])
                        ? ('indeterminate' as any)
                        : (false as any)
                      : (false as any)
                  }
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

              const providerLabel = p.provider || p.platform || DASH;

              return (
                <div key={rowKey} id={domId} className="hover:bg-slate-50 transition-colors">
                  <div className="px-6 py-4">
                    <div className="grid grid-cols-12 items-start gap-3">
                      {/* checkbox */}
                      <div className="col-span-1 pt-2">
                        <Checkbox checked={checked} onCheckedChange={(v: any) => toggleSelect(rowKey, !!v, p._id ? String(p._id) : undefined)} />
                      </div>

                      {/* handle column */}
                      <div className="col-span-9 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-200 shrink-0">
                            {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" /> : null}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-slate-900 truncate">{p.handle || p.username || DASH}</h3>

                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-300 text-slate-600">{providerLabel}</span>

                              {p.isVerified ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                                  Verified
                                </span>
                              ) : null}
                            </div>

                            <div className="text-sm text-slate-600 truncate">{p.fullname || DASH}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-3">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">Country</div>
                            <div className="text-sm font-medium text-slate-900">{p.country || DASH}</div>
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
                            <div className="text-sm font-medium text-slate-900">{view === 'saved' ? formatDate(p.updatedAt) : formatDate(p.createdAt)}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                          <span>Private: {formatBool(p.isPrivate)}</span>
                          {p.userId ? <span>UserId: {p.userId}</span> : <span>UserId: {DASH}</span>}
                        </div>
                      </div>

                      {/* actions */}
                      <div className="col-span-2 flex flex-col items-end gap-2">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                            title="Open profile"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Open
                          </a>
                        ) : null}

                        {p.userId ? (
                          <Link
                            href={`/mediakit/${encodeURIComponent(p.userId)}?platform=${encodeURIComponent(
                              String((p.platform || p.provider || 'youtube')).toLowerCase()
                            )}&handle=${encodeURIComponent(String(p.handle || p.username || ''))}`}
                            className="w-full px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                            title="View MediaKit"
                          >
                            <Info className="w-4 h-4" />
                            View
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="w-full px-4 py-2 border border-slate-200 text-slate-400 text-sm font-medium rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
                            disabled
                            title="No userId found"
                          >
                            <Info className="w-4 h-4" />
                            View
                          </button>
                        )}

                        <button type="button" className="p-2 hover:bg-slate-100 rounded-lg transition-colors" onClick={() => toggleExpand(rowKey)} aria-expanded={isOpen} aria-label="Expand">
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
                              <Row label="User ID" value={p.userId || DASH} mono />
                              <Row label="Username" value={p.username || DASH} />
                              <Row label="Handle" value={p.handle || DASH} />
                              <Row label="City" value={p.city || DASH} />
                              <Row label="State" value={p.state || DASH} />
                              <Row label="Country" value={p.country || DASH} />
                              <Row label="Language" value={p.language?.name || p.language?.code || DASH} />
                              <Row label="Category" value={Array.isArray(p.category) ? p.category.join(', ') : p.category || DASH} />
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

          {/* Pagination footer */}
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