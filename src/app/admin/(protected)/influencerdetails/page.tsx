"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  RefreshCcw,
  Users2,
  ListChecks,
  ExternalLink,
  Copy,
  ChevronUp,
  ChevronDown,
  X,
  Search,
  Download,
  Eye,
  EyeOff,
  Calendar,
  Globe,
  Video
} from 'lucide-react'
import { post2 } from '@/lib/api';

// -----------------------------------------------------------------------------
// CONFIG
// -----------------------------------------------------------------------------
const FROM = "#FFA135";
const TO = "#FF7236";
const brandGradient = `bg-gradient-to-r from-[${FROM}] to-[${TO}] text-white`;
const DEFAULT_LIMIT = 50;
const API_URL = "/email/collabglam/all"; // ← back-end route as instructed

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------
export type Platform = 'youtube' | 'instagram' | 'tiktok' | string

export type CgRaw = {
  email?: string
  handle?: string
  platform?: Platform
  createdAt?: string
  userId?: string
  youtube?: {
    channelId?: string
    title?: string
    handle?: string
    urlByHandle?: string
    urlById?: string
    country?: string
    subscriberCount?: number
    videoCount?: number
    viewCount?: number
    description?: string
    topicCategories?: string[]
    topicCategoryLabels?: string[]
    fetchedAt?: string
  }
}

// API response (paginated)
type ApiResponse = {
  page: number
  limit: number
  total: number
  hasNext: boolean
  data: CgRaw[]
}

// Normalized row used by UI
export type CgRow = {
  email: string
  handle: string
  platform: Platform
  createdAt: string
  userId: string
  youtube?: {
    channelId: string
    title: string
    handle: string
    urlByHandle: string
    urlById: string
    country?: string
    subscriberCount?: number
    videoCount?: number
    viewCount?: number
    description?: string
    topicCategories?: string[]
    topicCategoryLabels?: string[]
    fetchedAt?: string
  }
}

// -----------------------------------------------------------------------------
// UTILS
// -----------------------------------------------------------------------------
const toast = (message: string, type: 'success' | 'error' = 'success') => {
  // Simple toast implementation
  const toastEl = document.createElement('div')
  toastEl.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white transition-all duration-300 ${
    type === 'success' ? 'bg-green-600' : 'bg-red-600'
  }`
  toastEl.textContent = message
  document.body.appendChild(toastEl)
  
  setTimeout(() => {
    toastEl.style.opacity = '0'
    setTimeout(() => document.body.removeChild(toastEl), 300)
  }, 2000)
}

const fmtDateTime = (s?: string) => (s ? new Date(s).toLocaleString() : '—')
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString() : '—')
const n = (x?: number) => (typeof x === 'number' ? x.toLocaleString() : '—')
const compact = (x?: number) =>
  typeof x === 'number'
    ? Intl.NumberFormat(undefined, { notation: 'compact' }).format(x)
    : '—'

const countryName = (code?: string) => {
  if (!code) return '—'
  try {
    const dn = new (Intl as any).DisplayNames(undefined, { type: 'region' })
    return dn.of(code) || code
  } catch {
    return code
  }
}

const exportCSV = (filename: string, rows: CgRow[]) => {
  const header = [
    'email',
    'handle',
    'platform',
    'createdAt',
    'userId',
    'channelTitle',
    'channelHandle',
    'subscriberCount',
    'videoCount',
    'viewCount',
    'country',
    'categories',
  ]
  const body = rows.map((r) => [
    r.email,
    r.handle,
    r.platform,
    r.createdAt ? new Date(r.createdAt).toISOString() : '',
    r.userId,
    r.youtube?.title || '',
    r.youtube?.handle || '',
    r.youtube?.subscriberCount ?? '',
    r.youtube?.videoCount ?? '',
    r.youtube?.viewCount ?? '',
    r.youtube?.country || '',
    (r.youtube?.topicCategoryLabels || []).join(' | '),
  ])
  const csv = [header, ...body]
    .map((r) => r.map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast('Copied to clipboard!')
  } catch {
    toast('Failed to copy', 'error')
  }
}

const normalize = (arr: CgRaw[] = []): CgRow[] =>
  (arr || []).map((r) => ({
    email: r.email || '',
    handle: r.handle || '',
    platform: r.platform || '',
    createdAt: r.createdAt || '',
    userId: r.userId || '',
    youtube: r.youtube
      ? {
          channelId: r.youtube.channelId || '',
          title: r.youtube.title || '',
          handle: r.youtube.handle || '',
          urlByHandle: r.youtube.urlByHandle || '',
          urlById: r.youtube.urlById || '',
          country: r.youtube.country,
          subscriberCount: r.youtube.subscriberCount,
          videoCount: r.youtube.videoCount,
          viewCount: r.youtube.viewCount,
          description: r.youtube.description,
          topicCategories: r.youtube.topicCategories,
          topicCategoryLabels: r.youtube.topicCategoryLabels,
          fetchedAt: r.youtube.fetchedAt,
        }
      : undefined,
  }))

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------
export default function AdminCollabGlamAllPage() {
  // fetch + pagination state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [rows, setRows] = useState<CgRow[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_LIMIT)
  const [hasNext, setHasNext] = useState(false)
  const [serverTotal, setServerTotal] = useState<number | null>(null)

  // query state
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all')

  // sort
  const [sortKey, setSortKey] = useState<
    'title' | 'subs' | 'videos' | 'views' | 'email' | 'country' | 'created'
  >('subs')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // UI state
  const [showDetails, setShowDetails] = useState<string | null>(null)

const loadPage = useCallback(
  async (nextPage = 1, append = false) => {
    setLoading(true);
    setError('');

    const controller = new AbortController();

    try {
      // post2 already returns the response data (res.data)
      const json: ApiResponse = await post2<ApiResponse>(
        API_URL,
        { page: nextPage, limit },
        { signal: controller.signal }
      );

      const normalized = normalize(json.data);

      setRows(prev => (append ? [...prev, ...normalized] : normalized));
      setPage(json.page);
      setHasNext(json.hasNext);
      setServerTotal(
        typeof json.total === 'number' ? json.total : normalized.length
      );
    } catch (e: any) {
      // axios-style error shape (post2 likely uses axios under the hood)
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        'Failed to load data';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }

    // keep the previous API: return a cleanup that aborts the request
    return () => controller.abort();
  },
  [limit]
);


  const reload = useCallback(() => loadPage(1, false), [loadPage])

  useEffect(() => {
    reload()
  }, [reload])

  // search + filters (client-side)
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const base = rows.filter((r) =>
      platformFilter === 'all' ? true : r.platform === platformFilter
    )
    const byCategory =
      categoryFilter === 'all'
        ? base
        : base.filter((r) => (r.youtube?.topicCategoryLabels || []).includes(categoryFilter))

    if (!needle) return byCategory

    return byCategory.filter((r) => {
      const hay = [
        r.email,
        r.handle,
        r.platform,
        r.youtube?.title || '',
        r.youtube?.handle || '',
        r.youtube?.country || '',
        (r.youtube?.topicCategoryLabels || []).join(' '),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(needle)
    })
  }, [rows, search, platformFilter, categoryFilter])

  // category counts
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>()
    const base = rows.filter((r) =>
      platformFilter === 'all' ? true : r.platform === platformFilter
    )
    base.forEach((r) => {
      ;(r.youtube?.topicCategoryLabels || []).forEach((label) => {
        map.set(label, (map.get(label) || 0) + 1)
      })
    })
    return map
  }, [rows, platformFilter])

  // sort current view
  const sorted = useMemo(() => {
    const arr = [...filtered]
    const dir = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      if (sortKey === 'title') return dir * (a.youtube?.title || '').localeCompare(b.youtube?.title || '')
      if (sortKey === 'subs') return dir * (((a.youtube?.subscriberCount as number) || 0) - ((b.youtube?.subscriberCount as number) || 0))
      if (sortKey === 'videos') return dir * (((a.youtube?.videoCount as number) || 0) - ((b.youtube?.videoCount as number) || 0))
      if (sortKey === 'views') return dir * (((a.youtube?.viewCount as number) || 0) - ((b.youtube?.viewCount as number) || 0))
      if (sortKey === 'email') return dir * a.email.localeCompare(b.email)
      if (sortKey === 'country') return dir * (a.youtube?.country || '').localeCompare(b.youtube?.country || '')
      return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    })
    return arr
  }, [filtered, sortKey, sortDir])

  // stats
  const stats = useMemo(() => {
    const totalLoaded = rows.length
    const visible = sorted.length
    const uniqueEmails = new Set(sorted.map((r) => r.email).filter(Boolean)).size
    const uniqueChannels = new Set(sorted.map((r) => r.youtube?.channelId).filter(Boolean)).size
    const cats = new Set(
      sorted.flatMap((r) => r.youtube?.topicCategoryLabels || [])
    ).size
    const dates = sorted.map((r) => new Date(r.createdAt).getTime()).filter((x) => !isNaN(x))
    const min = dates.length ? new Date(Math.min(...dates)).toISOString() : ''
    const max = dates.length ? new Date(Math.max(...dates)).toISOString() : ''
    return { totalLoaded, visible, uniqueEmails, uniqueChannels, cats, min, max }
  }, [rows, sorted])

  const copyAllVisibleEmails = () => {
    const text = Array.from(new Set(sorted.map((r) => r.email).filter(Boolean))).join(', ')
    copyToClipboard(text)
  }

  const onReset = () => {
    setSearch('')
    setPlatformFilter('all')
    setCategoryFilter('all')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <header className="bg-white border-b top-0 z-30 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`h-12 w-12 rounded-2xl ${brandGradient} grid place-items-center flex-shrink-0 shadow-lg`}>
                <Users2 className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold leading-tight truncate text-gray-900">
                  CollabGlam Admin
                </h1>
                <p className="text-gray-600 text-sm truncate">
                  YouTube & Platform Analytics Dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button 
                onClick={reload} 
                className={`${brandGradient} hover:opacity-95 shadow-lg rounded-xl px-4 py-2 font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50`}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <StatCard label="Server Total" value={typeof serverTotal === 'number' ? n(serverTotal) : '—'} icon={<Globe className="h-5 w-5" />} />
          <StatCard label="Loaded" value={n(stats.totalLoaded)} icon={<Download className="h-5 w-5" />} />
          <StatCard label="Visible" value={n(stats.visible)} icon={<Eye className="h-5 w-5" />} />
          <StatCard label="Unique Emails" value={n(stats.uniqueEmails)} icon={<Users2 className="h-5 w-5" />} />
          <StatCard label="Channels" value={n(stats.uniqueChannels)} icon={<Video className="h-5 w-5" />} />
          <StatCard label="Categories" value={n(stats.cats)} icon={<ListChecks className="h-5 w-5" />} />
          <StatCard label="Date Range" value={stats.min ? `${fmtDate(stats.min)} – ${fmtDate(stats.max)}` : '—'} icon={<Calendar className="h-5 w-5" />} />
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="p-6 border-b bg-gray-50 rounded-t-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Search & Filters</h2>
              <div className="text-sm text-gray-500">
                Showing {n(stats.visible)} of {typeof serverTotal === 'number' ? n(serverTotal) : n(stats.totalLoaded)}
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
              {/* Search */}
              <div className="lg:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Search email, handle, channel, country..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button 
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setSearch('')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Sort */}
              <div className="lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as any)}
                  >
                    <option value="subs">Subscribers</option>
                    <option value="views">Views</option>
                    <option value="videos">Videos</option>
                    <option value="title">Channel</option>
                    <option value="email">Email</option>
                    <option value="country">Country</option>
                    <option value="created">Date</option>
                  </select>
                  <button 
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
                    onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  >
                    {sortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="lg:col-span-5 flex flex-wrap gap-3">
                <button 
                  onClick={copyAllVisibleEmails}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" /> Copy Emails
                </button>
                <button 
                  onClick={() => exportCSV('collabglam-visible.csv', sorted)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <Download className="h-4 w-4" /> Export CSV
                </button>
                <button 
                  onClick={onReset}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Platform Filters */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Platform:</span>
              {(['all', 'youtube', 'instagram', 'tiktok'] as const).map((p) => (
                <button
                  key={p}
                  className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-colors ${
                    platformFilter === p
                      ? `${brandGradient} shadow-sm`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  onClick={() => setPlatformFilter(p as any)}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Category Filters */}
            {categoryCounts.size > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-gray-700">Category:</span>
                <button
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    'all' === categoryFilter
                      ? `${brandGradient} shadow-sm`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  onClick={() => setCategoryFilter('all')}
                >
                  All
                </button>
                {Array.from(categoryCounts.entries()).slice(0, 8).map(([label, count]) => (
                  <button
                    key={label}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      categoryFilter === label
                        ? `${brandGradient} shadow-sm`
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    onClick={() => setCategoryFilter(label)}
                    title={`${count} row${count === 1 ? '' : 's'}`}
                  >
                    {label} ({count})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="p-6 border-b bg-gray-50 rounded-t-xl">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-lg font-semibold text-gray-900">Collaborators</h2>
              <div className="text-sm text-gray-500">
                Page {page} • Limit {limit}{typeof serverTotal === 'number' ? ` • Total: ${n(serverTotal)}` : ''}
              </div>
            </div>
          </div>
          
          <div className="overflow-hidden">
            {loading && !rows.length ? (
              <div className="py-16 text-center">
                <div className="inline-flex items-center gap-3 text-gray-500">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-lg">Loading collaborators...</span>
                </div>
              </div>
            ) : error ? (
              <div className="py-16 text-center">
                <div className="text-red-600 font-medium">{error}</div>
                <button 
                  onClick={reload}
                  className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : sorted.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-gray-500 font-medium">No results found</div>
                <div className="text-sm text-gray-400 mt-1">Try adjusting your search or filters.</div>
                <button 
                  onClick={onReset}
                  className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="max-h-[600px] overflow-auto">
                {/* Desktop Header */}
                <div className="hidden md:grid grid-cols-[2fr_1.5fr_1fr_1.5fr_1fr] gap-4 bg-gray-50 px-6 py-3 text-sm font-medium text-gray-600 border-b sticky top-0">
                  <div>Channel / Email</div>
                  <div>Handle / Country</div>
                  <div>Platform</div>
                  <div>Date Added</div>
                  <div className="text-center">Actions</div>
                </div>

                {/* Rows */}
                {sorted.map((r, index) => (
                  <div key={`${r.email}-${index}`} className="border-b hover:bg-gray-50 transition-colors">
                    {/* Desktop Row */}
                    <div className="hidden md:grid grid-cols-[2fr_1.5fr_1fr_1.5fr_1fr] gap-4 items-center px-6 py-4">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {r.youtube?.title || r.handle || '—'}
                        </div>
                        <div className="text-sm text-gray-500 truncate">{r.email}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-gray-900 truncate">{r.youtube?.handle || r.handle || '—'}</div>
                        <div className="text-sm text-gray-500">
                          {r.youtube?.country ? `${countryName(r.youtube.country)} (${r.youtube.country})` : '—'}
                        </div>
                      </div>
                      <div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          r.platform === 'youtube' ? 'bg-red-100 text-red-800' :
                          r.platform === 'instagram' ? 'bg-pink-100 text-pink-800' :
                          r.platform === 'tiktok' ? 'bg-gray-900 text-white' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {r.platform}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">{fmtDateTime(r.createdAt)}</div>
                      <div className="flex justify-center gap-2">
                        {r.youtube && (
                          <button
                            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            onClick={() => setShowDetails(showDetails === r.email ? null : r.email)}
                          >
                            {showDetails === r.email ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </button>
                        )}
                        <button
                          className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                          onClick={() => copyToClipboard(r.email)}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        {r.youtube?.urlByHandle && (
                          <a
                            href={r.youtube.urlByHandle}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Mobile Row */}
                    <div className="md:hidden px-6 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 truncate">
                            {r.youtube?.title || r.handle || '—'}
                          </div>
                          <div className="text-sm text-gray-500 truncate">{r.email}</div>
                        </div>
                        <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          r.platform === 'youtube' ? 'bg-red-100 text-red-800' :
                          r.platform === 'instagram' ? 'bg-pink-100 text-pink-800' :
                          r.platform === 'tiktok' ? 'bg-gray-900 text-white' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {r.platform}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mb-3">{fmtDateTime(r.createdAt)}</div>
                      <div className="flex gap-2">
                        {r.youtube && (
                          <button
                            className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors flex items-center gap-1"
                            onClick={() => setShowDetails(showDetails === r.email ? null : r.email)}
                          >
                            {showDetails === r.email ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            Details
                          </button>
                        )}
                        <button
                          className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors flex items-center gap-1"
                          onClick={() => copyToClipboard(r.email)}
                        >
                          <Copy className="h-3 w-3" /> Copy
                        </button>
                        {r.youtube?.urlByHandle && (
                          <a
                            href={r.youtube.urlByHandle}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" /> Open
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Details Panel */}
                    {showDetails === r.email && r.youtube && (
                      <div className="px-6 pb-4 border-t bg-gray-50">
                        <div className="py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <MiniStat 
                              icon={<Users2 className="h-4 w-4 text-blue-600" />} 
                              label="Subscribers" 
                              value={r.youtube.subscriberCount ? compact(r.youtube.subscriberCount) : '—'} 
                            />
                            <MiniStat 
                              icon={<Video className="h-4 w-4 text-green-600" />} 
                              label="Videos" 
                              value={r.youtube.videoCount ? compact(r.youtube.videoCount) : '—'} 
                            />
                            <MiniStat 
                              icon={<Eye className="h-4 w-4 text-purple-600" />} 
                              label="Views" 
                              value={r.youtube.viewCount ? compact(r.youtube.viewCount) : '—'} 
                            />
                          </div>
                          
                          {r.youtube.description && (
                            <div className="mb-4">
                              <div className="text-sm font-medium text-gray-700 mb-2">Description</div>
                              <div className="text-sm text-gray-600 bg-white p-3 rounded-lg border max-h-24 overflow-auto">
                                {r.youtube.description}
                              </div>
                            </div>
                          )}
                          
                          {r.youtube.topicCategoryLabels?.length ? (
                            <div className="mb-4">
                              <div className="text-sm font-medium text-gray-700 mb-2">Categories</div>
                              <div className="flex flex-wrap gap-2">
                                {r.youtube.topicCategoryLabels.map((t, idx) => (
                                  <span 
                                    key={`${t}-${idx}`}
                                    className="px-2 py-1 bg-white border rounded-md text-xs text-gray-600"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          
                          <div className="text-xs text-gray-500">
                            Fetched: {fmtDateTime(r.youtube.fetchedAt)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Page <span className="font-medium">{page}</span> • Limit <span className="font-medium">{limit}</span>
                {typeof serverTotal === 'number' && (
                  <> • Showing <span className="font-medium">{n(rows.length)}</span> of <span className="font-medium">{n(serverTotal)}</span></>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button 
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => loadPage(1, false)} 
                  disabled={loading || page === 1}
                >
                  First
                </button>
                <button 
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => loadPage(Math.max(1, page - 1), false)} 
                  disabled={loading || page === 1}
                >
                  Prev
                </button>
                <button 
                  className={`px-4 py-2 ${brandGradient} rounded-lg font-medium transition-all hover:opacity-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                  onClick={() => loadPage(page + 1, false)} 
                  disabled={loading || !hasNext}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="text-red-800 font-medium">Error</div>
            <div className="text-red-700 text-sm mt-1">{error}</div>
          </div>
        )}
      </main>
    </div>
  )
}

// -----------------------------------------------------------------------------
// SUBCOMPONENTS
// -----------------------------------------------------------------------------
function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-600">{label}</div>
          <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
        </div>
        <div className="text-gray-400">{icon}</div>
      </div>
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <div className="font-semibold text-gray-900">{value}</div>
      </div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  )
}
