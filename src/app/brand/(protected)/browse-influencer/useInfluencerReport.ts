import { useState, useCallback } from 'react';
import { Platform, ReportResponse } from './types';
import { normalizeReport } from './utils';

interface UseInfluencerReportReturn {
  report: ReportResponse | null;
  rawReport: any;
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

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL
const API_REPORT_ENDPOINT = `${BACKEND_BASE_URL}modash/report`;

export function useInfluencerReport(): UseInfluencerReportReturn {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [rawReport, setRawReport] = useState<any>(null);
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

        if (influencerId) params.influencerId = influencerId;
        if (forceRefresh) params.force = '1'; // 👈 tells backend to bypass cache

        const q = new URLSearchParams(params);
        const res = await fetch(`${API_REPORT_ENDPOINT}?${q.toString()}`);
        const raw = await res.json();

        if (!res.ok || raw?.error) {
          throw new Error(
            raw?.message || raw?.error || `Failed to fetch report (${res.status})`
          );
        }

        const normalized = normalizeReport(raw as ReportResponse, platform);
        setReport(normalized);
        setRawReport(raw);

        // ⬇️ pick up timestamp from backend (_lastFetchedAt)
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