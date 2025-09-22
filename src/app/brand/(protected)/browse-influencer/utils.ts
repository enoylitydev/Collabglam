export function pruneEmpty<T>(obj: T): T {
    if (obj && typeof obj === 'object') {
        for (const key of Object.keys(obj as any)) {
            const v = (obj as any)[key];
            if (v == null) { delete (obj as any)[key]; continue; }
            if (Array.isArray(v)) {
                if (v.length === 0) { delete (obj as any)[key]; continue; }
            } else if (typeof v === 'object') {
                (obj as any)[key] = pruneEmpty(v);
                if (Object.keys((obj as any)[key]).length === 0) delete (obj as any)[key];
            }
            if (typeof v === 'number' && Number.isNaN(v)) delete (obj as any)[key];
        }
    }
    return obj;
}

// Minimal passthrough normalizer to prevent runtime import errors.
// If needed, enhance to mirror the richer normalization used in `influencers/view/page.tsx`.
export function normalizeReport(resp: any, _platform: any) {
    return resp;
}

export function nfmt(n?: number) {
    if (n == null || Number.isNaN(n)) return '—';
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(Math.round(n));
}

export function pfmt(x?: number, digits = 2) {
    if (x == null || Number.isNaN(x)) return '—';
    return `${(x * 100).toFixed(digits)}%`;
}

export function titleCase(x?: string) {
    if (!x) return '—';
    const s = x.toString();
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function prettyPlace(country?: string, city?: string, state?: string) {
    const cityPretty = city
        ? city
            .split(' ')
            .filter(Boolean)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ')
        : '';
    const statePretty = state ? `, ${state}` : '';
    return `${country || '—'}${cityPretty ? ` · ${cityPretty}${statePretty}` : ''}`;
}

export function pct(x?: number) {
    if (x == null || Number.isNaN(x)) return '—';
    return `${Math.round(x * 100)}%`;
}

export function topN<T>(arr: T[] | undefined | null, n = 5): T[] {
    return Array.isArray(arr) ? arr.filter(Boolean).slice(0, n) : [];
}


// Returns the median for likes/comments/views from various possible aggregate shapes.
export function getMedian(
  agg: any,
  field: 'likes' | 'comments' | 'views'
): number | undefined {
  if (!agg) return undefined;

  // 1) common aggregate shapes
  const known =
    typeof agg[`median_${field}`] === 'number' ? agg[`median_${field}`] :
    typeof agg[`p50_${field}`] === 'number' ? agg[`p50_${field}`] :
    typeof agg?.medians?.[field] === 'number' ? agg.medians[field] :
    typeof agg?.percentiles?.[field]?.p50 === 'number' ? agg.percentiles[field].p50 :
    typeof agg?.p50?.[field] === 'number' ? agg.p50[field] :
    undefined;
  if (typeof known === 'number') return known;

  // 2) derive from arrays (fallback)
  const arr =
    Array.isArray(agg?.items) ? agg.items.map((x: any) => x?.[field]) :
    Array.isArray(agg?.values) ? agg.values :
    Array.isArray(agg?.[field]) ? agg[field] :
    [];

  const nums = (arr as any[])
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  if (!nums.length) return undefined;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}
