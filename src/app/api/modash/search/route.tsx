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
    Vary: 'Origin',
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

/** ---------- Normalization / Dedupe ---------- */

function normalizeItem(item: AnyItem, platform: Platform) {
  const src = item?.profile ?? item;

  const username =
    src?.username ?? src?.handle ?? src?.channelHandle ?? src?.slug ?? '';

  const userId =
    String(
      item?.userId ?? src?.userId ?? src?.id ?? src?.channelId ?? src?.profileId,
    ).trim() || undefined;

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
    engagements: toNum(
      src?.engagements ?? src?.stats?.avgEngagements ?? src?.stats?.avgLikes,
    ),
    averageViews: toNum(
      src?.averageViews ?? src?.stats?.avgViews ?? src?.avgViews,
    ),
    picture:
      src?.picture ??
      src?.avatar ??
      src?.profilePicUrl ??
      src?.thumbnail ??
      src?.channelThumbnailUrl,
    url: src?.url ?? src?.channelUrl ?? src?.profileUrl,
    isVerified: Boolean(src?.isVerified ?? src?.verified),
    isPrivate: Boolean(src?.isPrivate),
    platform,
  };
}

function better(a: AnyItem, b: AnyItem) {
  if (a.isVerified !== b.isVerified) return a.isVerified ? a : b;
  if ((a.followers ?? 0) !== (b.followers ?? 0))
    return (a.followers ?? 0) > (b.followers ?? 0) ? a : b;
  if ((a.engagementRate ?? 0) !== (b.engagementRate ?? 0))
    return (a.engagementRate ?? 0) > (b.engagementRate ?? 0) ? a : b;
  if ((a.engagements ?? 0) !== (b.engagements ?? 0))
    return (a.engagements ?? 0) > (b.engagements ?? 0) ? a : b;
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

/** ---------- YouTube body helpers ---------- */

const DEFAULT_YT_SORT = { field: 'followers', direction: 'desc' as const };

const YT_ALLOWED_AGE = new Set([18, 25, 35, 45, 65]);

function deepClone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

/**
 * Sanitize YouTube body so the API won't silently return empty results.
 * - ensure sort.field
 * - clamp/strip lastposted (<30 → 30)
 * - drop filterOperations (can conflict with sorting)
 * - drop audience.ageRange if audience.age also present
 * - coerce influencer.age min/max to allowed set (else remove)
 */
function sanitizeYouTubeBody(original: any, opts?: { relax?: boolean }) {
  const b = deepClone(original) || {};
  b.page = b?.page ?? 0;

  // Ensure sort
  if (!b?.sort?.field) {
    b.sort = { ...(b.sort || {}), ...DEFAULT_YT_SORT };
  }

  // Only operate if filter object exists
  if (!b.filter) b.filter = {};
  if (!b.filter.influencer) b.filter.influencer = {};
  if (!b.filter.audience) b.filter.audience = {};

  const infl = b.filter.influencer;
  const aud = b.filter.audience;

  // lastposted must be >= 30 (days)
  if (typeof infl.lastposted === 'number' && infl.lastposted < 30) {
    infl.lastposted = 30;
  }

  // influencer.age min/max must be one of [18,25,35,45,65]
  if (infl.age) {
    const min = infl.age.min;
    const max = infl.age.max;
    if ((min && !YT_ALLOWED_AGE.has(min)) || (max && !YT_ALLOWED_AGE.has(max))) {
      delete infl.age;
    }
  }

  // Can't send both audience.age and audience.ageRange together
  if (aud.age && aud.ageRange) {
    delete aud.ageRange;
  }

  // Drop filterOperations entirely for YouTube
  if (Array.isArray(infl.filterOperations)) {
    delete infl.filterOperations;
  }

  // Optional fallback relaxation: remove the toughest filters if first call returns 0
  if (opts?.relax) {
    // Audience filters are the most restrictive → drop them
    delete b.filter.audience;

    // Remove growth & strict numeric caps to broaden results
    delete infl.followersGrowthRate;
    delete infl.views;
    delete infl.engagements;

    // Keep keywords/relevance/bio if present, otherwise keep the query fairly open
    if (typeof infl.lastposted === 'number') delete infl.lastposted;

    // Make sure we sort by followers to get something meaningful
    b.sort = { field: 'followers', direction: 'desc' };
  }

  return b;
}

function buildPlatformBody(p: Platform, body: any, opts?: { relax?: boolean }) {
  if (p !== 'youtube') {
    // Non-YT: just add page default without mutation
    return { page: body?.page ?? 0, ...body };
  }
  return sanitizeYouTubeBody(body, { relax: opts?.relax });
}

/** ---------- Route ---------- */

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

  const responses: Array<{ platform: Platform; data: any }> = [];

  try {
    // Run platforms sequentially so we can conditionally retry YouTube
    for (const p of platforms) {
      const url = ENDPOINT[p];
      if (!url) throw new Error(`Unsupported platform: ${p}`);

      // Initial call
      const firstBody = buildPlatformBody(p, body);
      const firstResp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(firstBody),
        cache: 'no-store',
      });

      let data = await firstResp.json().catch(() => ({}));
      if (!firstResp.ok) {
        const msg =
          data?.message || data?.error || `Modash ${p} failed (${firstResp.status})`;
        throw new Error(msg);
      }

      // If YouTube came back empty, try ONE relaxed retry (optional)
      const enableFallback = (process.env.MODASH_YT_FALLBACK ?? '1') !== '0';
      if (
        p === 'youtube' &&
        enableFallback &&
        Number(data?.total || 0) === 0
      ) {
        const retryBody = buildPlatformBody(p, body, { relax: true });
        const retryResp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(retryBody),
          cache: 'no-store',
        });
        const retryData = await retryResp.json().catch(() => ({}));

        if (retryResp.ok && Number(retryData?.total || 0) > 0) {
          data = retryData;
        }
      }

      responses.push({ platform: p, data });
    }

    // Aggregate possible arrays
    const collected: AnyItem[] = [];
    for (const { platform, data } of responses) {
      const bag = [
        ...(Array.isArray(data?.results) ? data.results : []),       // some endpoints
        ...(Array.isArray(data?.items) ? data.items : []),
        ...(Array.isArray(data?.influencers) ? data.influencers : []),
        ...(Array.isArray(data?.directs) ? data.directs : []),       // YouTube
        ...(Array.isArray(data?.lookalikes) ? data.lookalikes : []), // YouTube
        ...(Array.isArray(data?.users) ? data.users : []),
        ...(Array.isArray(data?.channels) ? data.channels : []),
      ];
      for (const item of bag) {
        collected.push(normalizeItem(item, platform));
      }
    }

    const merged = dedupe(collected);
    const total = responses.reduce((sum, r) => sum + Number(r.data?.total || 0), 0);

    return NextResponse.json(
      { results: merged, total, unique: merged.length },
      { status: 200, headers: corsHeaders() },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Search failed' },
      { status: 400, headers: corsHeaders() },
    );
  }
}

export const dynamic = 'force-dynamic';
