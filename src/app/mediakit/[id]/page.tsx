'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';

import InfluencerDetailFullPage from '../InfluencerDetailFullPage';
import { useInfluencerReport } from '@/app/brand/(protected)/browse-influencer/useInfluencerReport';
import { useEmailStatus } from '@/app/brand/(protected)/browse-influencer/useEmailStatus';
import type { Platform } from '@/app/brand/(protected)/browse-influencer/types';

export default function InfluencerDetailPage() {
  const router = useRouter();
  const pathname = usePathname();

  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const id = params?.id ? String(params.id) : '';

  const qpPlatform = (searchParams?.get('platform') || '').toLowerCase() as Platform;
  const platform: Platform =
    (['youtube', 'instagram', 'tiktok'].includes(qpPlatform) ? qpPlatform : 'youtube');

  const handleParam = searchParams?.get('handle') || '';
  const handle = handleParam ? String(handleParam) : null;

  const [brandId, setBrandId] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

  // ✅ Auth gate (localStorage)
  useEffect(() => {
    const storedBrandId = localStorage.getItem('brandId') || '';

    if (!storedBrandId) {
      // keep "next" so you can send them back after login
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    setBrandId(storedBrandId);
    setAuthChecked(true);
  }, [router, pathname]);

  const [calculationMethod, setCalculationMethod] = useState<'median' | 'average'>('average');

  const { report, rawReport, loading, error, lastFetchedAt, fetchReport } = useInfluencerReport();
  const { exists: emailExists, checkStatus } = useEmailStatus();

  useEffect(() => {
    // ✅ don’t call APIs until auth is verified
    if (!authChecked) return;
    if (!id) return;

    fetchReport(id, platform, calculationMethod);

    if (handle) {
      const safeHandle = handle.startsWith('@') ? handle : `@${handle}`;
      checkStatus(safeHandle, platform);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, id, platform, calculationMethod, handle]);

  const onRefreshReport = useCallback(async () => {
    if (!id) return;
    await fetchReport(id, platform, calculationMethod, undefined, true);
  }, [id, platform, calculationMethod, fetchReport]);

  // ✅ While checking auth, render nothing (or a loader)
  if (!authChecked) return null;

  if (!id) return null;

  return (
    <InfluencerDetailFullPage
      loading={loading}
      error={error}
      data={report}
      raw={rawReport}
      platform={platform}
      onChangeCalc={(calc) => setCalculationMethod(calc)}
      emailExists={emailExists}
      brandId={brandId}
      handle={handle}
      lastFetchedAt={lastFetchedAt}
      onRefreshReport={onRefreshReport}
    />
  );
}