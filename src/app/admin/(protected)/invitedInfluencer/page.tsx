'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ChevronDown, Copy, Filter } from 'lucide-react';
import swal from 'sweetalert';
import { get } from '@/lib/api';
import { Checkbox } from '@/components/animate-ui/components/radix/checkbox';

const DASH = '--';

type InvitationItem = {
  invitationId?: string;
  brandId?: string;
  brandName?: string | null;

  influencerId?: string | null;
  influencerName?: string | null;

  campaignId?: string;
  campaignsId?: string;
  productOrServiceName?: string | null;

  platform?: string | null;
  handle?: string | null;
  status?: string | null;
  modashUserId?: string | null;

  createdAt?: string;
  updatedAt?: string;
};

type InvitationsResponse = {
  status: string;
  page: number; // 1-indexed
  limit: number;
  total: number;
  pages: number;
  invitations: InvitationItem[];
};

function showErr(message: string) {
  return swal({
    title: 'Error',
    text: message || 'Something went wrong.',
    icon: 'error',
  });
}

function showOk(message: string) {
  return swal({
    title: 'Done',
    text: message || 'Success',
    icon: 'success',
  });
}

function fmt(v: any) {
  const s = String(v ?? '').trim();
  return s ? s : DASH;
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

function statusBadge(status?: string | null) {
  const s = String(status || '').toLowerCase();
  if (s === 'accepted') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (s === 'rejected') return 'bg-rose-50 border-rose-200 text-rose-700';
  if (s === 'sent') return 'bg-blue-50 border-blue-200 text-blue-700';
  if (s === 'created') return 'bg-slate-50 border-slate-200 text-slate-700';
  return 'bg-slate-50 border-slate-200 text-slate-700';
}

export default function Page() {
  const ENDPOINT = '/admin-invitations/list';

  // pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  // data
  const [items, setItems] = useState<InvitationItem[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // loading
  const [loading, setLoading] = useState(false);

  // filters/search
  const [q, setQ] = useState('');
  const [platform, setPlatform] = useState<'all' | 'youtube' | 'instagram' | 'tiktok'>('all');
  const [status, setStatus] = useState<'all' | string>('all');
  const [onlyWithCampaign, setOnlyWithCampaign] = useState(false);

  // selection
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const hasNext = page < pages;
  const hasPrev = page > 1;

  const visibleItems = useMemo(() => {
    let list = Array.isArray(items) ? [...items] : [];

    const qq = q.trim().toLowerCase();
    if (qq) {
      list = list.filter((it) => {
        const hay = [
          it.brandName,
          it.influencerName,
          it.productOrServiceName,
          it.platform,
          it.handle,
          it.status,
        ]
          .map((x) => String(x ?? '').toLowerCase())
          .join(' ');
        return hay.includes(qq);
      });
    }

    if (platform !== 'all') {
      list = list.filter((it) => String(it.platform || '').toLowerCase() === platform);
    }

    if (status !== 'all') {
      list = list.filter((it) => String(it.status || '').toLowerCase() === String(status).toLowerCase());
    }

    if (onlyWithCampaign) {
      list = list.filter((it) => !!(it.productOrServiceName && String(it.productOrServiceName).trim()));
    }

    return list;
  }, [items, q, platform, status, onlyWithCampaign]);

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  const allOnPageSelected = useMemo(() => {
    if (!visibleItems.length) return false;
    return visibleItems.every((it) => !!selected[it.invitationId || '']);
  }, [visibleItems, selected]);

  const someOnPageSelected = useMemo(() => {
    if (!visibleItems.length) return false;
    return visibleItems.some((it) => !!selected[it.invitationId || '']);
  }, [visibleItems, selected]);

  const headerCheckState = useMemo(() => {
    if (allOnPageSelected) return true;
    if (someOnPageSelected) return 'indeterminate';
    return false;
  }, [allOnPageSelected, someOnPageSelected]);

  async function load(p = 1) {
    setLoading(true);
    try {
      const resp = await get<InvitationsResponse>(ENDPOINT, {
        page: p,
        limit,
        includeNames: 1,
        includeCampaign: 1,
      });

      const list = Array.isArray(resp?.invitations) ? resp.invitations : [];

      setItems(list);
      setTotal(Number(resp?.total ?? list.length ?? 0));
      setPages(Number(resp?.pages ?? 1));
      setPage(Number(resp?.page ?? p));

      setExpanded({});
      setSelected({});
    } catch (e: any) {
      await showErr(e?.message || 'Failed to load invitations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleExpand(invId: string) {
    setExpanded((prev) => ({ ...prev, [invId]: !prev[invId] }));
  }

  function toggleSelect(invId: string, checked: boolean) {
    setSelected((prev) => ({ ...prev, [invId]: checked }));
  }

  function selectAllOnPage() {
    const next: Record<string, boolean> = {};
    for (const it of visibleItems) {
      const id = it.invitationId;
      if (id) next[id] = true;
    }
    setSelected((prev) => ({ ...prev, ...next }));
  }

  function clearSelectionOnPage() {
    setSelected((prev) => {
      const next = { ...prev };
      for (const it of visibleItems) {
        const id = it.invitationId;
        if (id) delete next[id];
      }
      return next;
    });
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      await showOk('Copied!');
    } catch {
      await showErr('Copy failed.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-1">Admin Invitations</h1>
            <p className="text-slate-600 text-sm">
              Showing <b className="text-slate-900">{total || 0}</b> invitations • Page{' '}
              <b className="text-slate-900">{page}</b> / <b className="text-slate-900">{pages}</b>
            </p>
          </div>

          <button
            type="button"
            className="h-[44px] px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            onClick={() => load(page)}
            disabled={loading}
            title="Reload"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-600" />
            <div className="text-sm font-semibold text-slate-900">Filters</div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Search */}
            <div className="md:col-span-6">
              <label className="text-xs font-medium text-slate-600 mb-2 block">Search (brand / influencer / handle / campaign / status)</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  className="w-full pl-12 pr-4 py-3.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="e.g. Trakin Tech, @codewithharry, created"
                />
              </div>
            </div>

            {/* Platform */}
            <div className="md:col-span-3">
              <label className="text-xs font-medium text-slate-600 mb-2 block">Platform</label>
              <select
                className="w-full px-3 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                value={platform}
                onChange={(e) => setPlatform(e.target.value as any)}
              >
                <option value="all">All</option>
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>

            {/* Status */}
            <div className="md:col-span-3">
              <label className="text-xs font-medium text-slate-600 mb-2 block">Status</label>
              <select
                className="w-full px-3 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">All</option>
                <option value="created">created</option>
                <option value="sent">sent</option>
                <option value="accepted">accepted</option>
                <option value="rejected">rejected</option>
              </select>
            </div>

            {/* Toggle */}
            <div className="md:col-span-12 flex items-center justify-between gap-3 flex-wrap mt-2">
              <label className="flex items-center gap-2 select-none cursor-pointer">
                <Checkbox checked={onlyWithCampaign} onCheckedChange={(v: any) => setOnlyWithCampaign(!!v)} />
                <span className="text-sm text-slate-700">Only show rows with Campaign Name</span>
              </label>

              <div className="text-xs text-slate-500">
                Showing <b className="text-slate-900">{visibleItems.length}</b> of <b className="text-slate-900">{items.length}</b> loaded
              </div>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* table header */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
            <div className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-1 flex items-center">
                <Checkbox
                  checked={headerCheckState as any}
                  onCheckedChange={(v: any) => {
                    const checked = !!v;
                    checked ? selectAllOnPage() : clearSelectionOnPage();
                  }}
                />
              </div>

              <div className="col-span-9">
                <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Invitation</div>
              </div>

              <div className="col-span-2 text-right">
                <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Actions</div>
              </div>
            </div>
          </div>

          {loading && items.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              Loading invitations...
            </div>
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">No invitations found.</div>
          ) : null}

          <div className="divide-y divide-slate-200">
            {visibleItems.map((it) => {
              const invId = it.invitationId || '';
              const isOpen = !!expanded[invId];
              const checked = !!selected[invId];

              return (
                <div key={invId || Math.random().toString(36).slice(2)} className="hover:bg-slate-50 transition-colors">
                  <div className="px-6 py-4">
                    <div className="grid grid-cols-12 items-start gap-3">
                      {/* checkbox */}
                      <div className="col-span-1 pt-2">
                        <Checkbox checked={checked} onCheckedChange={(v: any) => toggleSelect(invId, !!v)} />
                      </div>

                      {/* main column */}
                      <div className="col-span-9 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <div className="text-lg font-semibold text-slate-900 truncate">
                            {fmt(it.influencerName)}{' '}
                            <span className="text-slate-400 font-normal">•</span>{' '}
                            <span className="text-slate-700 font-medium">{fmt(it.handle)}</span>
                          </div>

                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadge(it.status)}`}>
                            {fmt(it.status)}
                          </span>

                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-300 text-slate-600">
                            {fmt(it.platform)}
                          </span>
                        </div>

                        <div className="text-sm text-slate-600 truncate">
                          Brand: <b className="text-slate-900">{fmt(it.brandName)}</b>
                          {it.productOrServiceName ? (
                            <>
                              {' '}
                              • Campaign: <b className="text-slate-900">{fmt(it.productOrServiceName)}</b>
                            </>
                          ) : (
                            <>
                              {' '}
                              • Campaign: <b className="text-slate-900">{DASH}</b>
                            </>
                          )}
                        </div>

                        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                          <span>Created: {formatDate(it.createdAt)}</span>
                          <span>Updated: {formatDate(it.updatedAt)}</span>
                          <span className="inline-flex items-center gap-1">
                            Modash User: <b className="text-slate-700">{fmt(it.modashUserId)}</b>
                            {it.modashUserId ? (
                              <button
                                type="button"
                                className="ml-1 p-1 rounded hover:bg-slate-200"
                                title="Copy Modash User ID"
                                onClick={() => copyText(String(it.modashUserId))}
                              >
                                <Copy className="w-3.5 h-3.5 text-slate-600" />
                              </button>
                            ) : null}
                          </span>
                        </div>

                        {/* expanded details (NO IDs shown) */}
                        {isOpen ? (
                          <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-50 rounded-xl p-4">
                              <div className="text-sm font-semibold text-slate-900 mb-2">Brand</div>
                              <div className="text-sm text-slate-700">Name: {fmt(it.brandName)}</div>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4">
                              <div className="text-sm font-semibold text-slate-900 mb-2">Influencer</div>
                              <div className="text-sm text-slate-700">Name: {fmt(it.influencerName)}</div>
                              <div className="text-sm text-slate-700">Handle: {fmt(it.handle)}</div>
                              <div className="text-sm text-slate-700">Platform: {fmt(it.platform)}</div>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-4 md:col-span-2">
                              <div className="text-sm font-semibold text-slate-900 mb-2">Campaign</div>
                              <div className="text-sm text-slate-700">Product/Service: {fmt(it.productOrServiceName)}</div>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {/* actions */}
                      <div className="col-span-2 flex flex-col items-end gap-2">
                        <button
                          type="button"
                          className="w-full px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                          onClick={() => toggleExpand(invId)}
                          aria-expanded={isOpen}
                          aria-label="Expand"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          {isOpen ? 'Hide' : 'Details'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer pagination */}
          <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between gap-4 flex-wrap">
            <div className="text-sm text-slate-600">
              Page <span className="font-semibold text-slate-900">{page}</span> /{' '}
              <span className="font-semibold text-slate-900">{pages}</span>
              {selectedCount ? (
                <>
                  {' '}
                  • Selected <span className="font-semibold text-slate-900">{selectedCount}</span>
                </>
              ) : null}
            </div>

            <div className="flex gap-2">
              <button
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => load(Math.max(1, page - 1))}
                disabled={loading || !hasPrev}
              >
                Previous
              </button>
              <button
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => load(page + 1)}
                disabled={loading || !hasNext}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* tiny note */}
        <div className="mt-3 text-xs text-slate-500">
          Note: IDs are intentionally hidden as requested.
        </div>
      </div>
    </div>
  );
}