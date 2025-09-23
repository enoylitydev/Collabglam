'use client';

import { useCallback, useState } from 'react';
import type { Platform as ReportPlatform } from './types';
import { post2 } from '@/lib/api';

interface UseEmailStatus {
  exists: boolean | null;
  loading: boolean;
  error: string | null;
  checkStatus: (handle: string, platform: ReportPlatform) => Promise<void>;
}

type EmailStatusResponse =
  | { status: 0 | 1 }
  | { status: 'error'; message?: string };

export function useEmailStatus(): UseEmailStatus {
  const [exists, setExists] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async (handle: string, platform: ReportPlatform) => {
    try {
      setLoading(true);
      setError(null);

      // Server accepts raw handle or with '@'; we send normalized '@handle'
      const normalized = '@' + String(handle).replace(/^@/, '').trim().toLowerCase();

      // ✅ Call external backend via BASE_URL2
      const data = await post2<EmailStatusResponse>('/email/status', {
        handle: normalized,
        platform,
      });

      if (typeof (data as any)?.status === 'number') {
        setExists((data as { status: number }).status === 1);
      } else {
        // { status: 'error', message? }
        const msg = (data as any)?.message || 'Unknown error';
        throw new Error(msg);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to check email status');
      setExists(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { exists, loading, error, checkStatus };
}
