'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import 'sweetalert2/dist/sweetalert2.min.css'
import { useVirtualizer } from '@tanstack/react-virtual'

import { post2 } from '@/lib/api'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'

import {
  Loader2,
  RefreshCcw,
  Users2,
  ListChecks,
  Filter,
  ExternalLink,
  Copy,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react'

// -----------------------------------------------------------------------------
// CONFIG
// -----------------------------------------------------------------------------
const COLLAB_GLAM_ALL_ENDPOINT = 'email/collabglam/all'
const brandGradient = 'bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white'

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
  }}

// -----------------------------------------------------------------------------
// UTILS
// -----------------------------------------------------------------------------
const toast = (
  icon: 'success' | 'error' | 'info' | 'warning',
  title: string,
  text?: string
) =>
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title,
    text,
    timer: 2200,
    showConfirmButton: false,
    timerProgressBar: true,
  })

const fmtDateTime = (s?: string) => (s ? new Date(s).toLocaleString() : '-')
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString() : '-')
const n = (x?: number) => (typeof x === 'number' ? x.toLocaleString() : '-')
const compact = (x?: number) =>
  typeof x === 'number'
    ? Intl.NumberFormat(undefined, { notation: 'compact' }).format(x)
    : '-'

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
    toast('success', 'Copied')
  } catch {
    toast('error', 'Copy failed')
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
// MAIN
// -----------------------------------------------------------------------------
export default function AdminCollabGlamAllPage() {
  // fetch
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // data
  const [rows, setRows] = useState<CgRow[]>([])

  // query state
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState<Platform | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all')

  // sort
  const [sortKey, setSortKey] = useState<
    'title' | 'subs' | 'videos' | 'views' | 'email' | 'country' | 'created'
  >('subs')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // virtualization
  const parentRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const out = await post2<any>(COLLAB_GLAM_ALL_ENDPOINT)
      const list: CgRaw[] = Array.isArray(out) ? out : out?.data || []
      setRows(normalize(list))
    } catch (e: any) {
      const msg = e?.message || 'Failed to load data'
      setError(msg)
      toast('error', 'API error', msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // search + filters
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

  // category counts (respect platform filter like the reference UI)
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
    const total = rows.length
    const visible = sorted.length
    const uniqueEmails = new Set(sorted.map((r) => r.email).filter(Boolean)).size
    const uniqueChannels = new Set(sorted.map((r) => r.youtube?.channelId).filter(Boolean)).size
    const cats = new Set(
      sorted.flatMap((r) => r.youtube?.topicCategoryLabels || [])
    ).size
    const dates = sorted.map((r) => new Date(r.createdAt).getTime()).filter((x) => !isNaN(x))
    const min = dates.length ? new Date(Math.min(...dates)).toISOString() : ''
    const max = dates.length ? new Date(Math.max(...dates)).toISOString() : ''
    return { total, visible, uniqueEmails, uniqueChannels, cats, min, max }
  }, [rows, sorted])

  // virtualization
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  })

  const copyAllVisibleEmails = () => {
    const text = Array.from(new Set(sorted.map((r) => r.email).filter(Boolean))).join(', ')
    copyToClipboard(text)
  }

  const gridCols =
    'grid-cols-[minmax(220px,1.6fr)_minmax(160px,1fr)_minmax(110px,.8fr)_minmax(160px,1fr)_minmax(120px,1fr)]'

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Top Bar */}
      <header className="bg-white border-b">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-neutral-100 grid place-items-center">
              <Users2 className="h-6 w-6 text-neutral-700" />
            </div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">CollabGlam — Admin (All)</h1>
              <p className="text-neutral-500 text-sm">YouTube & other platforms • detailed & virtualized</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={load} className={`${brandGradient} hover:opacity-95 shadow rounded-xl`}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <StatCard label="Total Rows" value={n(stats.total)} />
          <StatCard label="Visible Rows" value={n(stats.visible)} />
          <StatCard label="Unique Emails (visible)" value={n(stats.uniqueEmails)} />
          <StatCard label="Unique Channels (visible)" value={n(stats.uniqueChannels)} />
          <StatCard label="Categories (visible)" value={n(stats.cats)} />
          <StatCard label="Date Range" value={stats.min ? `${fmtDate(stats.min)} – ${fmtDate(stats.max)}` : '-'} />
        </div>

        {/* Controls */}
        <Card className="border bg-white shadow-sm">
          <CardHeader className="p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">Search & Filters</CardTitle>
            <div className="text-xs text-muted-foreground">Showing {n(stats.visible)} of {n(stats.total)}</div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="md:col-span-2">
                <div className="text-xs text-muted-foreground mb-1">Search</div>
                <div className="flex items-center gap-2">
                  <div className="relative w-full">
                    <Input
                      className="pl-3"
                      placeholder="Search email, handle, title, country, categories"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  {search && (
                    <Button variant="ghost" size="icon" onClick={() => setSearch('')}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">Sort</div>
                <div className="flex gap-2">
                  <select
                    className="w-[160px] h-10 rounded-md border px-2 text-sm"
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as any)}
                  >
                    <option value="subs">Subscribers</option>
                    <option value="views">Views</option>
                    <option value="videos">Videos</option>
                    <option value="title">Channel</option>
                    <option value="email">Email</option>
                    <option value="country">Country</option>
                    <option value="created">Saved Date</option>
                  </select>
                  <Button variant="outline" onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}>
                    {sortDir === 'asc' ? (
                      <span className="inline-flex items-center gap-1"><ChevronUp className="h-4 w-4" /> Asc</span>
                    ) : (
                      <span className="inline-flex items-center gap-1"><ChevronDown className="h-4 w-4" /> Desc</span>
                    )}
                  </Button>
                </div>
              </div>

              <div className="md:col-span-2 flex flex-wrap gap-2">
                <Button onClick={copyAllVisibleEmails} variant="outline">
                  <Copy className="h-4 w-4 mr-2" /> Copy emails (visible)
                </Button>
                <Button onClick={() => exportCSV('collabglam-visible.csv', sorted)}>
                  Export CSV (visible)
                </Button>
                <Button variant="outline" onClick={() => { setSearch(''); setPlatformFilter('all'); setCategoryFilter('all') }}>
                  Reset
                </Button>
              </div>

              {/* Platform filter chips */}
              <div className="md:col-span-5 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground mr-1">Platform</span>
                {(['all', 'youtube', 'instagram', 'tiktok'] as const).map((p) => (
                  <Badge
                    key={p}
                    variant={platformFilter === p ? 'default' : 'outline'}
                    className="capitalize cursor-pointer"
                    onClick={() => setPlatformFilter(p as any)}
                  >
                    {p}
                  </Badge>
                ))}
              </div>

              {/* Category chips */}
              {categoryCounts.size > 0 && (
                <div className="md:col-span-5 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground mr-1">Category</span>
                  <Badge
                    variant={categoryFilter === 'all' ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setCategoryFilter('all')}
                  >
                    All
                  </Badge>
                  {Array.from(categoryCounts.entries()).map(([label, count]) => (
                    <Badge
                      key={label}
                      variant={categoryFilter === label ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setCategoryFilter(label)}
                      title={`${count} row${count === 1 ? '' : 's'}`}
                    >
                      {label} ({count})
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="border bg-white shadow-sm">
          <CardHeader className="p-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Collaborators (Virtualized)</CardTitle>
              <div className="text-sm text-muted-foreground">Rows: {n(stats.visible)}</div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div ref={parentRef} className="h-[640px] overflow-auto border-t">
              {/* Sticky header */}
              <div className={`sticky top-0 z-10 hidden md:grid ${gridCols} bg-gray-50 border-b px-4 py-2 text-xs text-muted-foreground`}>
                <div>Channel / Email</div>
                <div>Handle / Country</div>
                <div>Platform</div>
                <div>Saved</div>
                <div className="text-right">Info</div>
              </div>

              {/* Mobile header */}
              <div className="md:hidden px-4 py-2 text-xs text-muted-foreground border-b bg-gray-50">Rows — scroll</div>

              {loading ? (
                <div className="py-10 text-center text-muted-foreground">
                  <div className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                </div>
              ) : error ? (
                <div className="py-10 text-center text-red-600 text-sm">{error}</div>
              ) : sorted.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">No results</div>
              ) : (
                <div className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
                  {rowVirtualizer.getVirtualItems().map((vr) => {
                    const r = sorted[vr.index]
                    return (
                      <div
                        key={`${r.email}-${vr.index}`}
                        data-index={vr.index}
                        ref={(node) => rowVirtualizer.measureElement(node as Element)}
                        className="absolute inset-x-0"
                        style={{ transform: `translateY(${vr.start}px)` }}
                      >
                        {/* Desktop row */}
                        <div className={`${gridCols} items-center px-4 py-3 hover:bg-gray-50 hidden md:grid`}>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{r.youtube?.title || '—'}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{r.email || '—'}</div>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate">{r.youtube?.handle || r.handle || '—'}</div>
                            <div className="text-[11px] text-muted-foreground">{r.youtube?.country || '—'}</div>
                          </div>
                          <div><Badge variant="outline" className="capitalize">{r.platform || '—'}</Badge></div>
                          <div>{fmtDateTime(r.createdAt)}</div>
                          <div className="text-right">
                            {r.youtube ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button size="sm" variant="outline">Details</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-96 max-w-full">
                                  <div className="space-y-2 text-sm">
                                    <div className="font-medium break-words">{r.youtube.title}</div>
                                    <div className="text-xs text-muted-foreground break-all">{r.youtube.handle}</div>
                                    <Separator />
                                    <div className="grid grid-cols-3 gap-2">
                                      <MiniStat icon={<Users2 className="h-4 w-4" />} label="Subs" value={r.youtube.subscriberCount ? compact(r.youtube.subscriberCount) : '-'} />
                                      <MiniStat icon={<ListChecks className="h-4 w-4" />} label="Videos" value={r.youtube.videoCount ? compact(r.youtube.videoCount) : '-'} />
                                      <MiniStat icon={<Filter className="h-4 w-4" />} label="Views" value={r.youtube.viewCount ? compact(r.youtube.viewCount) : '-'} />
                                    </div>
                                    <div className="text-xs text-muted-foreground">Country: {r.youtube.country || '-'}</div>
                                    {r.youtube.description && (
                                      <div className="text-xs text-muted-foreground whitespace-pre-wrap max-h-28 overflow-auto border rounded-md p-2 bg-neutral-50">
                                        {r.youtube.description}
                                      </div>
                                    )}
                                    {r.youtube.topicCategoryLabels?.length ? (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {r.youtube.topicCategoryLabels.map((t, idx) => (
                                          <Badge key={`${t}-${idx}`} variant="outline" className="text-[10px]">{t}</Badge>
                                        ))}
                                      </div>
                                    ) : null}
                                    <div className="flex gap-2">
                                      {r.youtube.urlByHandle && (
                                        <a className="underline text-sm inline-flex items-center gap-1" href={r.youtube.urlByHandle} target="_blank" rel="noreferrer">
                                          <ExternalLink className="h-4 w-4" /> Open channel
                                        </a>
                                      )}
                                      {r.youtube.urlById && (
                                        <a className="underline text-sm inline-flex items-center gap-1" href={r.youtube.urlById} target="_blank" rel="noreferrer">
                                          <ExternalLink className="h-4 w-4" /> Open by ID
                                        </a>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">Fetched: {fmtDateTime(r.youtube.fetchedAt)}</div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>

                        {/* Mobile row */}
                        <div className="md:hidden px-4 py-3 border-b">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{r.youtube?.title || r.handle || r.email || '—'}</div>
                              <div className="text-[11px] text-muted-foreground truncate">{r.email || '—'}</div>
                            </div>
                            <Badge variant="outline" className="capitalize">{r.platform || '—'}</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{r.youtube?.handle || '—'}</div>
                          <div className="mt-1 text-xs text-muted-foreground">Saved: {fmtDateTime(r.createdAt)}</div>
                          {r.youtube && (
                            <div className="mt-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button size="sm" variant="outline">Details</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 max-w-full">
                                  <div className="space-y-2 text-sm">
                                    <div className="font-medium break-words">{r.youtube.title}</div>
                                    <div className="text-xs text-muted-foreground break-all">{r.youtube.handle}</div>
                                    <Separator />
                                    <div className="grid grid-cols-3 gap-2">
                                      <MiniStat icon={<Users2 className="h-4 w-4" />} label="Subs" value={r.youtube.subscriberCount ? compact(r.youtube.subscriberCount) : '-'} />
                                      <MiniStat icon={<ListChecks className="h-4 w-4" />} label="Videos" value={r.youtube.videoCount ? compact(r.youtube.videoCount) : '-'} />
                                      <MiniStat icon={<Filter className="h-4 w-4" />} label="Views" value={r.youtube.viewCount ? compact(r.youtube.viewCount) : '-'} />
                                    </div>
                                    <div className="text-xs text-muted-foreground">Country: {r.youtube.country || '-'}</div>
                                    {r.youtube.description && (
                                      <div className="text-xs text-muted-foreground whitespace-pre-wrap max-h-28 overflow-auto border rounded-md p-2 bg-neutral-50">
                                        {r.youtube.description}
                                      </div>
                                    )}
                                    {r.youtube.topicCategoryLabels?.length ? (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {r.youtube.topicCategoryLabels.map((t, idx) => (
                                          <Badge key={`${t}-${idx}`} variant="outline" className="text-[10px]">{t}</Badge>
                                        ))}
                                      </div>
                                    ) : null}
                                    <div className="flex gap-2">
                                      {r.youtube.urlByHandle && (
                                        <a className="underline text-sm inline-flex items-center gap-1" href={r.youtube.urlByHandle} target="_blank" rel="noreferrer">
                                          <ExternalLink className="h-4 w-4" /> Open channel
                                        </a>
                                      )}
                                      {r.youtube.urlById && (
                                        <a className="underline text-sm inline-flex items-center gap-1" href={r.youtube.urlById} target="_blank" rel="noreferrer">
                                          <ExternalLink className="h-4 w-4" /> Open by ID
                                        </a>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">Fetched: {fmtDateTime(r.youtube.fetchedAt)}</div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          )}
                          <div className="mt-2">
                            {r.email && (
                              <Button size="sm" variant="ghost" className="px-2" onClick={() => copyToClipboard(r.email)}>
                                <Copy className="h-4 w-4 mr-1" /> Copy email
                              </Button>
                            )}
                            {r.youtube?.urlByHandle && (
                              <a href={r.youtube.urlByHandle} target="_blank" rel="noreferrer">
                                <Button size="sm" variant="secondary" className="ml-2">
                                  <ExternalLink className="h-4 w-4 mr-1" /> Open
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {error && <div className="text-sm text-red-600">{error}</div>}
      </main>
    </div>
  )
}

// -----------------------------------------------------------------------------
// SUBCOMPONENTS
// -----------------------------------------------------------------------------
function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="p-2 rounded-xl border bg-white shadow-sm">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <div className="font-medium">{value}</div>
      </div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}
