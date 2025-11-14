// AudienceFilters.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { AudienceFilters as AF, Platform } from './filters';

type PlanName = 'free' | 'growth' | 'pro' | 'premium';

const PLAN_RANK: Record<PlanName, number> = {
  free: 0,
  growth: 1,
  pro: 2,
  premium: 3,
};

interface Props {
  filters: AF;
  updateFilter: (path: string, value: any) => void;
  platforms?: Platform[];
  plan?: PlanName;
}

type ApiCountry = {
  _id: string;
  countryName: string;
  callingCode: string;
  countryCode: string; // e.g. "AD"
  flag?: string;
};

type Country = {
  id: string; // from _id
  code: string; // ISO (uppercased)
  name: string; // human name
  label: string; // e.g. "🇦🇩 Andorra (AD)"
};

const API_URL = 'http://localhost:5000/country/getAll';

export function AudienceFilters({
  filters,
  updateFilter,
  platforms,
  plan = 'free',
}: Props) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [countriesError, setCountriesError] = useState<string | null>(null);

  const hasInstagram = (platforms ?? []).includes('instagram');

  const rank = PLAN_RANK[plan] ?? PLAN_RANK.free;
  const isProPlus = rank >= PLAN_RANK.pro; // Pro / Enterprise only

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoadingCountries(true);
        setCountriesError(null);

        const res = await fetch(API_URL, {
          method: 'GET',
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const raw = (await res.json()) as unknown;
        const arr = Array.isArray(raw) ? (raw as ApiCountry[]) : [];

        // Normalize
        const normalized = arr.map((c): Country => {
          const code = (c.countryCode || '').trim().toUpperCase();
          const name = (c.countryName || code || 'Unknown').trim();
          const flag = (c.flag || '').trim();
          return {
            id: c._id || `${code}-${name}`, // stable unique key
            code,
            name,
            label: `${flag ? flag + ' ' : ''}${name}${
              code ? ` (${code})` : ''
            }`,
          };
        });

        // De-duplicate by ISO code (keep the first occurrence)
        const dedupMap = new Map<string, Country>();
        for (const c of normalized) {
          if (!dedupMap.has(c.code)) dedupMap.set(c.code, c);
        }

        const sorted = Array.from(dedupMap.values()).sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        setCountries(sorted);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.error('Countries fetch failed:', err);
        setCountriesError(err?.message || 'Failed to load countries');
        setCountries([]);
      } finally {
        setLoadingCountries(false);
      }
    })();
    return () => controller.abort();
  }, []);

  // Current select value as an ISO code (uppercase)
  const selectedCountryCode = useMemo(() => {
    const v = (filters as any).location;
    // allow legacy shapes: string | number | string[] | number[]
    const pick = Array.isArray(v) ? v[0] : v;
    if (pick == null || pick === '') return '';
    return String(pick).toUpperCase();
  }, [filters]);

  // ------- age helpers -------
  const parseNum = (s: string) => (s === '' ? undefined : Number(s));
  const handleAgeMinChange = (raw: string) => {
    const min = parseNum(raw);
    const current = (filters as any).ageRange ?? {};
    const max = current.max;
    if (min == null && max == null) updateFilter('ageRange', undefined);
    else updateFilter('ageRange', { min, max });
  };
  const handleAgeMaxChange = (raw: string) => {
    const max = parseNum(raw);
    const current = (filters as any).ageRange ?? {};
    const min = current.min;
    if (max == null && min == null) updateFilter('ageRange', undefined);
    else updateFilter('ageRange', { min, max });
  };

  const credibilityValue = (filters as any).credibility as
    | number
    | undefined;
  const shownCredibility =
    credibilityValue != null && !Number.isNaN(credibilityValue)
      ? Math.floor(credibilityValue * 100)
      : null;

  // ❌ Free / Growth → show upgrade prompt instead of filters
  if (!isProPlus) {
    return (
      <div className="space-y-4 mb-4">
        <p className="text-xs text-gray-500">
          Audience filters (language, location, age & gender) are available on
          Pro and Premium plans.
        </p>
      </div>
    );
  }

  // ✅ Pro / Enterprise – full audience filters
  return (
    <div className="space-y-4 mb-4">
      {/* Audience Language – ✅ Pro+ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Audience Language
        </label>
        <select
          className="w-full px-3 py-2 border rounded-md text-sm"
          value={(filters as any).language?.id ?? ''}
          onChange={(e) =>
            updateFilter(
              'language',
              e.target.value ? { id: e.target.value, weight: 0.2 } : undefined,
            )
          }
        >
          <option value="">Any</option>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="it">Italian</option>
          <option value="pt">Portuguese</option>
          <option value="ru">Russian</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="zh">Chinese</option>
        </select>
      </div>

      {/* Audience Location — ISO code – ✅ Pro+ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Audience Location (country)
        </label>
        <select
          className="w-full px-3 py-2 border rounded-md text-sm"
          value={selectedCountryCode}
          onChange={(e) =>
            updateFilter('location', e.target.value || undefined)
          }
          disabled={loadingCountries}
        >
          {loadingCountries && <option value="">Loading countries…</option>}
          {countriesError && (
            <option value="">Failed to load countries</option>
          )}
          {!loadingCountries && !countriesError && (
            <option value="">Any</option>
          )}

          {!loadingCountries &&
            !countriesError &&
            countries.map((c, idx) => (
              <option key={c.id || `${c.code}-${idx}`} value={c.code}>
                {c.label}
              </option>
            ))}
        </select>
        {countriesError && (
          <p className="text-xs text-red-600 mt-1">
            {countriesError} — the list may be empty.
          </p>
        )}
      </div>

      {/* Audience Age Range – ✅ Pro+ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Audience Age Range
        </label>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            min={13}
            max={100}
            className="w-full px-3 py-2 border rounded-md text-sm"
            placeholder="Min"
            value={(filters as any).ageRange?.min ?? ''}
            onChange={(e) => handleAgeMinChange(e.target.value)}
          />
          <input
            type="number"
            min={13}
            max={100}
            className="w-full px-3 py-2 border rounded-md text-sm"
            placeholder="Max"
            value={(filters as any).ageRange?.max ?? ''}
            onChange={(e) => handleAgeMaxChange(e.target.value)}
          />
        </div>
      </div>

      {/* Audience Gender – ✅ Pro+ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Audience Gender
        </label>
        <select
          className="w-full px-3 py-2 border rounded-md text-sm"
          value={(filters as any).gender?.id ?? ''}
          onChange={(e) =>
            updateFilter(
              'gender',
              e.target.value ? { id: e.target.value, weight: 0.5 } : undefined,
            )
          }
        >
          <option value="">Any</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="NON_BINARY">Non-binary</option>
        </select>
      </div>

      {/* Audience Credibility — IG only, also treat as Pro+ */}
      {hasInstagram && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Min Audience Credibility
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            className="w-full"
            value={credibilityValue ?? 0}
            onChange={(e) =>
              updateFilter('credibility', Number(e.target.value))
            }
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>0%</span>
            <span className="font-medium">
              {shownCredibility != null ? `${shownCredibility}%` : '—'}
            </span>
            <span>100%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default AudienceFilters;
