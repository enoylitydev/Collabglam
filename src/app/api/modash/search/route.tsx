// /app/api/modash/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { Platform } from '@/app/brand/(protected)/browse-influencers/types';

const ENDPOINT: Record<Platform, string> = {
  instagram: 'https://api.modash.io/v1/instagram/search',
  tiktok: 'https://api.modash.io/v1/tiktok/search',
  youtube: 'https://api.modash.io/v1/youtube/search',
};

function corsHeaders() {
  const origin = process.env.CORS_ALLOW_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

type AnyItem = Record<string, any>;

function toNum(v: any): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeItem(item: AnyItem, platform: Platform) {
  const src = item?.profile ?? item;

  const username = src?.username ?? src?.handle ?? '';
  const userId =
    String(item?.userId ?? src?.userId ?? src?.id ?? '').trim() || undefined;

  return {
    userId,
    username,
    fullname:
      src?.fullName ??
      src?.fullname ??
      src?.display_name ??
      src?.title ??
      src?.name ??
      '',
    followers:
      toNum(src?.followers ?? src?.followerCount ?? src?.stats?.followers) ?? 0,
    engagementRate:
      toNum(src?.engagementRate ?? src?.stats?.engagementRate) ?? 0,
    engagements:
      toNum(src?.engagements ?? src?.stats?.avgEngagements ?? src?.stats?.avgLikes),
    averageViews: toNum(src?.averageViews ?? src?.stats?.avgViews),
    picture: src?.picture ?? src?.avatar ?? src?.profilePicUrl ?? src?.thumbnail,
    url: src?.url,
    isVerified: Boolean(src?.isVerified ?? src?.verified),
    isPrivate: Boolean(src?.isPrivate),
    platform,
  };
}

function better(a: AnyItem, b: AnyItem) {
  // Choose the "better" record if duplicates collide:
  if (a.isVerified !== b.isVerified) return a.isVerified ? a : b;
  if ((a.followers ?? 0) !== (b.followers ?? 0))
    return (a.followers ?? 0) > (b.followers ?? 0) ? a : b;
  if ((a.engagementRate ?? 0) !== (b.engagementRate ?? 0))
    return (a.engagementRate ?? 0) > (b.engagementRate ?? 0) ? a : b;
  if ((a.engagements ?? 0) !== (b.engagements ?? 0))
    return (a.engagements ?? 0) > (b.engagements ?? 0) ? a : b;
  // Prefer one that has a URL/picture
  if (!!a.url !== !!b.url) return a.url ? a : b;
  if (!!a.picture !== !!b.picture) return a.picture ? a : b;
  return a;
}

function dedupe(items: AnyItem[]) {
  const map = new Map<string, AnyItem>();
  for (const it of items) {
    const keyBase =
      (it.userId && String(it.userId).toLowerCase()) ||
      (it.username && String(it.username).toLowerCase()) ||
      (it.url && String(it.url).toLowerCase());
    if (!keyBase) continue;

    const key = `${it.platform}:${keyBase}`;
    const prev = map.get(key);
    map.set(key, prev ? better(prev, it) : it);
  }
  return Array.from(map.values());
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.MODASH_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing MODASH_API_KEY' },
      { status: 500, headers: corsHeaders() },
    );
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders() },
    );
  }

  const { platforms, body } = payload as { platforms?: Platform[]; body?: any };
  if (!Array.isArray(platforms) || platforms.length === 0 || !body) {
    return NextResponse.json(
      { error: 'Provide { platforms, body }' },
      { status: 400, headers: corsHeaders() },
    );
  }

  try {
    const responses = await Promise.all(
      platforms.map(async (p) => {
        const url = ENDPOINT[p];
        if (!url) throw new Error(`Unsupported platform: ${p}`);

        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          cache: 'no-store',
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          const msg = data?.message || data?.error || `Modash ${p} failed (${resp.status})`;
          throw new Error(msg);
        }
        return { platform: p, data };
      })
    );

    // Collect all potential arrays then normalize & dedupe
    const collected: AnyItem[] = [];
    for (const { platform, data } of responses) {
      const bag = [
        ...(Array.isArray(data?.results) ? data.results : []),
        ...(Array.isArray(data?.items) ? data.items : []),
        ...(Array.isArray(data?.influencers) ? data.influencers : []),
        ...(Array.isArray(data?.directs) ? data.directs : []),
        ...(Array.isArray(data?.lookalikes) ? data.lookalikes : []),
      ];

      for (const item of bag) {
        collected.push(normalizeItem(item, platform));
      }
    }

    const merged = dedupe(collected);

    // Keep provider totals for visibility; UI can show unique length separately if desired
    const total = responses.reduce((sum, r) => sum + Number(r.data?.total || 0), 0);

    return NextResponse.json(
      {
        results: merged,           // unique, normalized
        total,                     // sum of provider totals (may be > results.length)
        unique: merged.length,     // handy for UI
      },
      { status: 200, headers: corsHeaders() }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Search failed' },
      { status: 400, headers: corsHeaders() },
    );
  }
}

// Ensure no caching of responses in Next
export const dynamic = 'force-dynamic';
