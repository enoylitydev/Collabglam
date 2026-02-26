// InfluencerDetailFullPage.tsx
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, AlertCircle, BarChart3, Send, Copy, Check } from 'lucide-react';
import Swal from 'sweetalert2';

import { ProfileHeader } from '../brand/(protected)/browse-influencer/detail-panel/ProfileHeader';
import { StatsChart } from '../brand/(protected)/browse-influencer/detail-panel/StatsChart';
import { ContentBreakdown } from '../brand/(protected)/browse-influencer/detail-panel/ContentBreakdown';
import { PopularPosts } from '../brand/(protected)/browse-influencer/detail-panel/PopularPosts';
import { AboutSection } from '../brand/(protected)/browse-influencer/detail-panel/AboutSection';
import { AudienceDistribution } from '../brand/(protected)/browse-influencer/detail-panel/AudienceDistribution';
import { BrandAffinity } from '../brand/(protected)/browse-influencer/detail-panel/BrandAffinity';
import { MiniUserSection } from '../brand/(protected)/browse-influencer/detail-panel/MiniUserSection';

import type { ReportResponse, StatHistoryEntry, Platform } from '../brand/(protected)/browse-influencer/types';
import { post } from '@/lib/api';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

type Props = {
  loading: boolean;
  error: string | null;
  data: ReportResponse | null;
  raw: any;
  platform: Platform;
  emailExists?: boolean | null;
  handle: string | null;
  lastFetchedAt?: string | null;
  onRefreshReport?: () => Promise<void> | void;
  onChangeCalc: (calc: 'median' | 'average') => void;

  // ✅ who is viewing the mediakit
  viewerRole?: 'brand' | 'admin' | '';
};

/** ✅ /admin-invitations/send response shape */
type StoreInvitationResponse =
  | {
      status: 'success';
      message?: string;
      requested?: number;
      stored?: number;
      missingCampaigns?: string[];
      invitations?: any[];
    }
  | { status: 'error'; message?: string };

export default function InfluencerDetailFullPage({
  loading,
  error,
  data,
  raw,
  platform,
  handle,
  lastFetchedAt,
  onRefreshReport,
  onChangeCalc,
  viewerRole,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams?.get('campaignId') || '';

  // ✅ Read auth from localStorage
  const [brandId, setBrandId] = useState('');
  const [adminId, setAdminId] = useState('');

  useEffect(() => {
    const b = (localStorage.getItem('brandId') || '').trim();
    const a = (localStorage.getItem('adminId') || '').trim();
    setBrandId(b);
    setAdminId(a);
  }, []);

  const [sendingInvite, setSendingInvite] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(lastFetchedAt || null);
  useEffect(() => setLastUpdatedAt(lastFetchedAt || null), [lastFetchedAt]);

  const formattedLastUpdated = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : 'Not fetched yet';

  const statHistory = useMemo<StatHistoryEntry[]>(() => {
    const hist = data?.profile?.statsByContentType?.all?.statHistory || [];
    return hist?.slice(-12);
  }, [data]);

  const hasUserId = Boolean(data?.profile?.userId);
  const canAct = hasUserId && !loading && !sendingInvite && !refreshing;

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [campaigns, setCampaigns] = useState<{ campaignsId: string; productOrServiceName?: string }[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>(campaignId ? [campaignId] : []);

  const toggleCampaign = (id: string, checked: boolean) => {
    setSelectedCampaignIds((prev) => (checked ? Array.from(new Set([...prev, id])) : prev.filter((p) => p !== id)));
  };

  // ✅ Fetch campaigns (admin preferred; fallback to brand)
  useEffect(() => {
    const bId = (brandId || '').trim();
    const aId = (adminId || '').trim();
    if (!aId && !bId) return;

    let cancelled = false;

    (async () => {
      try {
        setCampaignsLoading(true);

        const payload: any = aId ? { adminId: aId } : { brandId: bId };
        const resp: any = await post('/admin/campaign/lite', payload);

        if (cancelled) return;

        const items = resp?.campaigns || resp?.data?.campaigns || [];
        setCampaigns(
          items.map((c: any) => ({
            campaignsId: c.campaignId || c.campaignsId || String(c._id || ''),
            productOrServiceName: c.productOrServiceName,
          }))
        );
      } catch {
        // optional
      } finally {
        if (!cancelled) setCampaignsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brandId, adminId]);

  const handleSendFromDropdown = async () => {
    setDropdownOpen(false);
    await sendInvitationsForCampaigns(selectedCampaignIds);
  };

  /** ✅ Send invite (stores invitations) */
  const sendInvitationsForCampaigns = async (campaignIds: string[]) => {
    if (!canAct || sendingInvite) return;

    const normalizedPlatform = (platform ?? '').toLowerCase() as Platform;
    if (!['youtube', 'instagram', 'tiktok'].includes(normalizedPlatform)) {
      await Swal.fire('Invalid platform', 'Platform must be youtube/instagram/tiktok', 'warning');
      return;
    }

    const modashUserId = String(data?.profile?.userId || '').trim();
    if (!modashUserId) {
      await Swal.fire('Missing userId', 'Modash userId not found in report.', 'warning');
      return;
    }

    const ids = (campaignIds || []).map((x) => String(x || '').trim()).filter(Boolean);
    if (!ids.length) {
      await Swal.fire('Select campaign', 'Please select at least one campaign.', 'info');
      return;
    }

    // ✅ require brandId OR adminId
    const bId = (brandId || '').trim();
    const aId = (adminId || '').trim();
    if (!bId && !aId) {
      await Swal.fire('Login required', 'brandId or adminId missing. Please login again.', 'warning');
      return;
    }

    try {
      setSendingInvite(true);

      const payload: any = {
        userId: modashUserId,
        platform: normalizedPlatform,
        campaignsIds: ids,
      };

      if (aId) payload.adminId = aId;
      else payload.brandId = bId;

      const resp = await post<StoreInvitationResponse>('/admin-invitations/send', payload);

      if (!resp) {
        await Swal.fire('Error', 'No response from server.', 'error');
        return;
      }

      if (resp.status === 'error') {
        await Swal.fire('Error', resp.message || 'Failed to store invitations.', 'error');
        return;
      }

      const stored = Number(resp.stored ?? 0);
      const missing = Array.isArray(resp.missingCampaigns) ? resp.missingCampaigns : [];

      if (stored > 0) {
        let msg = `Stored ${stored} invitation(s).`;
        if (missing.length) msg += ` Missing campaigns: ${missing.join(', ')}`;
        await Swal.fire('Invite stored', msg, 'success');
      } else {
        const msg = missing.length
          ? `No invites stored. Missing campaigns: ${missing.join(', ')}`
          : 'No invites stored.';
        await Swal.fire('Nothing stored', msg, 'info');
      }

      router.push('/brand/invited');
    } catch (err: any) {
      await Swal.fire('Error', err?.message || 'Failed to store invitations', 'error');
    } finally {
      setSendingInvite(false);
    }
  };

  const headerProfile = data?.profile?.profile;
  const displayName =
    headerProfile?.fullname || headerProfile?.username || headerProfile?.handle || handle || 'Creator profile';

  const displayHandle =
    headerProfile?.handle ||
    headerProfile?.username ||
    (handle && (handle.startsWith('@') ? handle : `@${handle}`)) ||
    '';

  const handleRefreshData = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!onRefreshReport || refreshing) return;

    try {
      setRefreshing(true);
      await onRefreshReport();
    } catch (err: any) {
      await Swal.fire('Refresh failed', err?.message || 'Failed to refresh data', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleMediaKit = async () => {
    const url = window.location.href;

    try {
      await navigator.clipboard.writeText(url);
      Swal.fire({
        icon: 'success',
        title: 'Link copied!',
        text: 'Media kit link copied to clipboard.',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);

        Swal.fire({
          icon: 'success',
          title: 'Link copied!',
          text: 'Media kit link copied to clipboard.',
          timer: 1500,
          showConfirmButton: false,
        });
      } catch {
        Swal.fire({
          icon: 'error',
          title: 'Copy failed',
          text: 'Could not copy the link. Please copy it manually from the address bar.',
        });
      }
    }
  };

  const showRefreshButton = Boolean(onRefreshReport);
  const profile = data?.profile;

  const popularPosts = profile?.popularPosts ?? [];
  const notableUsers = profile?.notableUsers ?? [];
  const lookalikes = profile?.lookalikes ?? [];
  const lookalikesByTopics = profile?.lookalikesByTopics ?? [];
  const audienceLookalikes = profile?.audienceLookalikes ?? [];
  const brandAffinity = profile?.brandAffinity ?? [];

  // ✅ ONLY admin can see About section
  const isAdminViewer = viewerRole === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full">
        <div className="bg-white overflow-hidden">
          {/* Top Bar */}
          <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b flex items-center gap-3 px-4 py-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" /> Close
            </button>

            <div className="min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold text-gray-900 truncate">{displayName}</span>
                {displayHandle && <span className="text-xs text-gray-500 truncate">{displayHandle}</span>}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {platform && (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-700">
                    {platform}
                  </span>
                )}
              </div>
            </div>

            <div className="ml-auto flex flex-col items-end gap-1 sm:flex-row sm:items-center">
              <div className="flex flex-col items-end gap-1 sm:items-end sm:ml-3">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">Latest data</span>
                    <span className="text-xs text-gray-700">{formattedLastUpdated}</span>
                  </div>

                  {showRefreshButton && (
                    <button
                      type="button"
                      onClick={handleRefreshData}
                      disabled={refreshing || loading}
                      className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      <BarChart3 className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
                      {refreshing ? 'Refreshing…' : 'Refresh data'}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMediaKit}
                    className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:opacity-90 inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-white transition-opacity shadow-sm"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Share media kit</span>
                  </button>

                  {/* ✅ Always show Campaign dropdown + Send Invite (no Send Invitation button anymore) */}
                  <DropdownMenu open={dropdownOpen} onOpenChange={(v) => setDropdownOpen(v)}>
                    <DropdownMenuTrigger asChild>
                      <button
                        disabled={!canAct}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-white transition-opacity shadow-sm
                          ${
                            canAct
                              ? 'bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:opacity-90'
                              : 'bg-gray-300 cursor-not-allowed opacity-70'
                          }`}
                      >
                        <Send className="h-4 w-4" />
                        Add to Favourite
                      </button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-72 bg-white ring-1 ring-gray-200 shadow-lg">
                      <DropdownMenuLabel>Campaigns</DropdownMenuLabel>

                      <div className="space-y-1 max-h-56 overflow-auto py-1">
                        {campaigns.length === 0 && !campaignsLoading && (
                          <div className="px-2 text-xs text-gray-500">No campaigns</div>
                        )}
                        {campaignsLoading && <div className="px-2 text-xs text-gray-500">Loading campaigns…</div>}

                        {campaigns.map((c) => {
                          const checked = selectedCampaignIds.includes(c.campaignsId);
                          return (
                            <div
                              key={c.campaignsId}
                              role="menuitem"
                              className="relative pl-10 text-sm cursor-pointer select-none flex items-center gap-2 py-1"
                              onClick={() => toggleCampaign(c.campaignsId, !checked)}
                            >
                              <span
                                className={`absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded ${
                                  checked
                                    ? 'border border-orange-400 bg-orange-50 text-orange-500'
                                    : 'border border-gray-200 bg-white text-transparent'
                                }`}
                              >
                                {checked ? <Check className="h-3 w-3" /> : null}
                              </span>

                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleCampaign(c.campaignsId, e.target.checked)}
                                className="sr-only"
                              />

                              <span>{c.productOrServiceName || c.campaignsId}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3 flex justify-end gap-2 px-1">
                        <button
                          type="button"
                          onClick={() => setDropdownOpen(false)}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={handleSendFromDropdown}
                          disabled={!canAct}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-white transition-opacity shadow-sm
                            ${
                              canAct
                                ? 'bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:opacity-90'
                                : 'bg-gray-300 cursor-not-allowed opacity-70'
                            }`}
                        >
                          {sendingInvite ? 'Sending…' : 'Send Invite'}
                        </button>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-5">
            {loading && <LoadingState />}
            {error && <ErrorState error={error} />}

            {!loading && !error && !data && (
              <div className="mb-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
                No report data yet. Try refreshing data or selecting another creator.
              </div>
            )}

            {data && (
              <div className="space-y-6">
                <ProfileHeader profile={data.profile} platform={platform} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left */}
                  <div className="lg:col-span-2 space-y-6">
                    <StatsChart statHistory={statHistory} />
                    <ContentBreakdown data={data} platform={platform} />

                    {popularPosts.length > 0 && <PopularPosts posts={popularPosts.slice(0, 12)} />}
                    {notableUsers.length > 0 && <MiniUserSection title="Notable followers" users={notableUsers} />}
                    {lookalikes.length > 0 && <MiniUserSection title="Lookalikes" users={lookalikes} />}
                    {lookalikesByTopics.length > 0 && (
                      <MiniUserSection title="Lookalikes by topic" users={lookalikesByTopics} />
                    )}
                    {audienceLookalikes.length > 0 && (
                      <MiniUserSection title="Audience lookalikes" users={audienceLookalikes} />
                    )}
                  </div>

                  {/* Right */}
                  <div className="space-y-6">
                    {/* ✅ Only admin can see AboutSection */}
                    {isAdminViewer && <AboutSection profile={data.profile} />}

                    <AudienceDistribution audience={data.profile.audience} />
                    {brandAffinity.length > 0 && <BrandAffinity items={brandAffinity} />}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const LoadingState: React.FC = () => (
  <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
      <BarChart3 className="h-8 w-8 text-orange-600 animate-pulse" />
    </div>
    <div className="text-lg font-semibold">Fetching report…</div>
  </div>
);

const ErrorState: React.FC<{ error: string }> = ({ error }) => (
  <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm flex items-start gap-2">
    <AlertCircle className="h-5 w-5 mt-0.5" />
    <div>
      <div className="font-semibold">Limit Reached</div>
      <div>{error}</div>
    </div>
  </div>
);