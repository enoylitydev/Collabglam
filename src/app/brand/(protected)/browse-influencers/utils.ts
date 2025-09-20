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