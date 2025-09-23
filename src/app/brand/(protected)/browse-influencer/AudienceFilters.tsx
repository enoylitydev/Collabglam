// AudienceFilters.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { AudienceFilters as AF, Platform } from './filters';

interface Props {
  filters: AF;
  updateFilter: (path: string, value: any) => void;
  platforms?: Platform[];
}

type Country = {
  countryId: number;
  name: string;
  title: string;
};

const API_URL = 'https://api.collabglam.com/modash/getAll';

export function AudienceFilters({ filters, updateFilter, platforms }: Props) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [countriesError, setCountriesError] = useState<string | null>(null);

  // 🔑 Show credibility only if Instagram is among the selected platforms
  const hasInstagram = (platforms ?? []).includes('instagram');

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoadingCountries(true);
        setCountriesError(null);

        const res = await fetch(API_URL, { method: 'GET', signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Country[] = await res.json();

        const sorted = Array.isArray(data)
          ? [...data].sort((a, b) => a.name.localeCompare(b.name))
          : [];
        setCountries(sorted);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setCountriesError(err?.message || 'Failed to load countries');
        setCountries([]);
        console.error('Countries fetch failed:', err);
      } finally {
        setLoadingCountries(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const selectedCountryId = useMemo(() => {
    const v = (filters as any).location;
    if (v == null || v === '') return '';
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : '';
  }, [filters]);

  // helpers for age range with no defaults
  const parseNum = (s: string) => (s === '' ? undefined : Number(s));

  const handleAgeMinChange = (raw: string) => {
    const min = parseNum(raw);
    const current = (filters as any).ageRange ?? {};
    const max = current.max;
    if (min == null && (max == null || max === '')) {
      updateFilter('ageRange', undefined); // remove filter entirely
    } else {
      updateFilter('ageRange', { min, max });
    }
  };

  const handleAgeMaxChange = (raw: string) => {
    const max = parseNum(raw);
    const current = (filters as any).ageRange ?? {};
    const min = current.min;
    if (max == null && (min == null || min === '')) {
      updateFilter('ageRange', undefined); // remove filter entirely
    } else {
      updateFilter('ageRange', { min, max });
    }
  };

  const credibilityValue = filters.credibility ?? undefined;
  const shownCredibility = credibilityValue != null ? Math.floor(credibilityValue * 100) : null;

  return (
    <div className="space-y-4 mb-4">
      {/* Audience Language (weighted) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Audience Language</label>
        <select
          className="w-full px-3 py-2 border rounded-md text-sm"
          value={filters.language?.id ?? ''}
          onChange={(e) =>
            updateFilter('language', e.target.value ? { id: e.target.value, weight: 0.2 } : undefined)
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

      {/* Audience Location — from backend */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Audience Location (country)
        </label>
        <select
          className="w-full px-3 py-2 border rounded-md text-sm"
          value={selectedCountryId}
          onChange={(e) => updateFilter('location', e.target.value ? Number(e.target.value) : '')}
          disabled={loadingCountries}
        >
          {loadingCountries && <option value="">Loading countries…</option>}
          {countriesError && <option value="">Failed to load countries</option>}
          {!loadingCountries && !countriesError && <option value="">Any</option>}

          {!loadingCountries &&
            !countriesError &&
            countries.map((c) => (
              <option key={c.countryId} value={String(c.countryId)}>
                {c.title || c.name}
              </option>
            ))}
        </select>
        {countriesError && (
          <p className="text-xs text-red-600 mt-1">
            {countriesError} — the list may be empty.
          </p>
        )}
      </div>

      {/* Audience Age Range (no defaults) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Audience Age Range</label>
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

      {/* Audience Gender (weighted) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Audience Gender</label>
        <select
          className="w-full px-3 py-2 border rounded-md text-sm"
          value={filters.gender?.id ?? ''}
          onChange={(e) =>
            updateFilter('gender', e.target.value ? { id: e.target.value, weight: 0.5 } : undefined)
          }
        >
          <option value="">Any</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="NON_BINARY">Non-binary</option>
        </select>
      </div>

      {/* Audience Credibility — IG only; no default */}
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
            onChange={(e) => updateFilter('credibility', Number(e.target.value))}
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
