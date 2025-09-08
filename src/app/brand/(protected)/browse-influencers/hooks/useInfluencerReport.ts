import { useState, useCallback } from 'react';
import { Platform, ReportResponse } from '../types';
import { normalizeReport } from '../utils';

interface UseInfluencerReportReturn {
  report: ReportResponse | null;
  rawReport: any;
  loading: boolean;
  error: string | null;
  fetchReport: (id: string, platform: Platform, calc: "median" | "average") => Promise<void>;
}

export function useInfluencerReport(): UseInfluencerReportReturn {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [rawReport, setRawReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async (id: string, platform: Platform, calc: "median" | "average") => {
    try {
      setLoading(true);
      setError(null);
      
      const q = new URLSearchParams({ platform, userId: id, calculationMethod: calc });
      const res = await fetch(`/api/modash/report?${q.toString()}`);
      const raw = await res.json();
      
      if (!res.ok || raw?.error) {
        throw new Error(raw?.message || raw?.error || `Failed to fetch report (${res.status})`);
      }
      
      const normalized = normalizeReport(raw as ReportResponse, platform);
      setReport(normalized);
      setRawReport(raw);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
      setReport(null);
      setRawReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    report,
    rawReport,
    loading,
    error,
    fetchReport,
  };
}