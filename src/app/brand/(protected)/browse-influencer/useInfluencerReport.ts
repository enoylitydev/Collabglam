import { useState, useCallback } from 'react';
import { Platform, ReportResponse, ModashReportRaw } from './types';
import { normalizeReport } from './utils';

interface UseInfluencerReportReturn {
  report: ReportResponse | null;
  rawReport: ModashReportRaw | null;
  loading: boolean;
  error: string | null;
  lastFetchedAt: string | null;
  fetchReport: (
    id: string,
    platform: Platform,
    calc: 'median' | 'average',
    influencerId?: string,
    forceRefresh?: boolean
  ) => Promise<void>;
}

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const API_REPORT_ENDPOINT = `${BACKEND_BASE_URL}modash/report`;

// Safely read brandId from localStorage (browser only)
const getBrandIdFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const id = window.localStorage.getItem('brandId');
    return id && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
};

export function useInfluencerReport(): UseInfluencerReportReturn {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [rawReport, setRawReport] = useState<ModashReportRaw | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  const fetchReport = useCallback(
    async (
      id: string,
      platform: Platform,
      calc: 'median' | 'average',
      influencerId?: string,
      forceRefresh: boolean = false
    ) => {
      try {
        setLoading(true);
        setError(null);

        const params: Record<string, string> = {
          platform,
          userId: id,
          calculationMethod: calc,
        };

        const brandId = getBrandIdFromStorage();
        if (brandId) params.brandId = brandId;
        if (influencerId) params.influencerId = influencerId;
        if (forceRefresh) params.force = '1';

        const q = new URLSearchParams(params);
        const res = await fetch(`${API_REPORT_ENDPOINT}?${q.toString()}`);
        const raw: ModashReportRaw = await res.json();

        if (!res.ok || raw?.error) {
          const msg =
            raw?.message ||
            (typeof raw?.error === 'string'
              ? raw.error
              : `Failed to fetch report (${res.status})`);
          throw new Error(msg);
        }

        const normalized: ReportResponse = normalizeReport(raw, platform);

        setReport(normalized);
        setRawReport(raw);

        const fetchedAt =
          typeof raw?._lastFetchedAt === 'string' ? raw._lastFetchedAt : null;
        setLastFetchedAt(fetchedAt);
      } catch (e: any) {
        setError(e?.message || 'Something went wrong');
        setReport(null);
        setRawReport(null);
        setLastFetchedAt(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    report,
    rawReport,
    loading,
    error,
    lastFetchedAt,
    fetchReport,
  };
}
