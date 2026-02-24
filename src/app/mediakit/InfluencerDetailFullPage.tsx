'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, AlertCircle, BarChart3, Send, MessageSquare, Copy, Check } from 'lucide-react';
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
import { post, post2 } from '@/lib/api';
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
};

/** /email/status response shape */
type EmailStatusResponse =
  | { status: 0 | 1; email?: string; handle?: string; platform?: Platform }
  | { status: 'error'; message?: string };

/** /emails/invitation response shape */
type InvitationResponse =
  | {
      status: 'success';
      message: string;
      isExistingInfluencer: true;
      influencerId: string;
      influencerName: string;
      brandName: string;
      emailSent: boolean;
      emailMeta?: {
        recipientEmail: string;
        threadId: string;
        messageId: string;
        subject: string;
        campaignId: string | null;
      };
    }
  | {
      status: 'success';
      message: string;
      isExistingInfluencer: false;
      brandName: string;
      invitationId: string;
      emailSent: boolean;
      emailMeta?: {
        recipientEmail: string;
        threadId: string;
        messageId: string;
        subject: string;
        campaignId: string | null;
      };
      isNewInvitation?: boolean;
    }
  | { status: 'error'; message: string };

/** /admin/checkstatus response shape */
type AdminCheckStatusResponse = {
  status: 0 | 1;
  handle?: string;
  email?: string | null;
  platform?: Platform | string;
  message?: string;
};

/** ✅ NEW: /admin/invitations/store response shape */
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
  emailExists,
  handle,
  lastFetchedAt,
  onRefreshReport,
  onChangeCalc,
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

  const [hasAnyEmail, setHasAnyEmail] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const formattedLastUpdated = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : 'Not fetched yet';

  const statHistory = useMemo<StatHistoryEntry[]>(() => {
    const hist = data?.profile?.statsByContentType?.all?.statHistory || [];
    return hist?.slice(-12);
  }, [data]);

  const isEmailStatusSuccess = (
    resp: EmailStatusResponse
  ): resp is { status: 0 | 1; email?: string; handle?: string; platform?: Platform } =>
    typeof (resp as any)?.status === 'number';

  const resolveCreatorEmail = async (
    safeHandle: string,
    normalizedPlatform: Platform
  ): Promise<{ email: string | null; source: 'status' | 'admin' | 'both' | 'none' }> => {
    const [statusResult, adminResult] = await Promise.allSettled([
      post2<EmailStatusResponse>('/email/status', { handle: safeHandle, platform: normalizedPlatform }),
      post<AdminCheckStatusResponse>('/admin/checkstatus', { handle: safeHandle, platform: normalizedPlatform }),
    ]);

    let emailFromStatus: string | null = null;
    let emailFromAdmin: string | null = null;

    if (statusResult.status === 'fulfilled') {
      const statusResp = statusResult.value;
      if (isEmailStatusSuccess(statusResp) && statusResp.status === 1 && statusResp.email) {
        emailFromStatus = statusResp.email;
      }
    }

    if (adminResult.status === 'fulfilled') {
      const adminResp = adminResult.value;
      if (typeof adminResp.status === 'number' && adminResp.status === 1 && adminResp.email) {
        emailFromAdmin = adminResp.email;
      }
    }

    if (emailFromStatus && emailFromAdmin && emailFromStatus === emailFromAdmin) return { email: emailFromStatus, source: 'both' };
    if (emailFromStatus) return { email: emailFromStatus, source: 'status' };
    if (emailFromAdmin) return { email: emailFromAdmin, source: 'admin' };
    return { email: null, source: 'none' };
  };

  // Pre-check email when handle/platform exists
  useEffect(() => {
    const normalizedPlatform = (platform ?? '').toLowerCase() as Platform;
    if (!['youtube', 'instagram', 'tiktok'].includes(normalizedPlatform)) {
      setHasAnyEmail(null);
      return;
    }

    const rawHandle = handle ? String(handle).trim() : '';
    const safeHandle = rawHandle ? '@' + rawHandle.replace(/^@/, '').trim().toLowerCase() : '';

    if (!safeHandle || !/^[A-Za-z0-9._-]+$/.test(safeHandle.replace(/^@/, ''))) {
      setHasAnyEmail(null);
      return;
    }

    let cancelled = false;
    setCheckingEmail(true);

    (async () => {
      try {
        const { email } = await resolveCreatorEmail(safeHandle, normalizedPlatform);
        if (!cancelled) setHasAnyEmail(!!email);
      } catch {
        if (!cancelled) setHasAnyEmail(null);
      } finally {
        if (!cancelled) setCheckingEmail(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handle, platform]);

  const hasUserId = Boolean(data?.profile?.userId);
  const canAct = hasUserId && !loading && !sendingInvite && !refreshing;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [campaigns, setCampaigns] = useState<{ campaignsId: string; productOrServiceName?: string }[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>(campaignId ? [campaignId] : []);

  useEffect(() => {
    const onDown = (ev: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(ev.target as Node)) setDropdownOpen(false);
    };
    if (dropdownOpen) document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dropdownOpen]);

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

  /** ✅ UPDATED: send invitation uses backend /admin/invitations/store */
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

    // ✅ require brandId OR adminId (backend requires one)
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
        campaignsIds: ids, // backend supports campaignsIds/campaignsId/campaignId
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
        await Swal.fire('Invitation stored', msg, 'success');
      } else {
        const msg = missing.length
          ? `No invitations stored. Missing campaigns: ${missing.join(', ')}`
          : 'No invitations stored.';
        await Swal.fire('Nothing stored', msg, 'info');
      }

      // keep your existing redirect
      router.push('/brand/invited');
    } catch (err: any) {
      await Swal.fire('Error', err?.message || 'Failed to store invitations', 'error');
    } finally {
      setSendingInvite(false);
    }
  };

  const effectiveHasEmail = hasAnyEmail !== null ? hasAnyEmail : emailExists === true;

  const headerProfile = data?.profile?.profile;
  const displayName =
    headerProfile?.fullname ||
    headerProfile?.username ||
    headerProfile?.handle ||
    handle ||
    'Creator profile';

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

  // (unchanged) email send flow — still needs brandId (your existing backend)
  const handleMessageNow = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!canAct) return;

    if (!brandId) {
      await Swal.fire('Missing brand', 'Missing brandId.', 'warning');
      return;
    }

    const normalizedPlatform = (platform ?? '').toLowerCase() as Platform;

    const rawHandle = handle ? String(handle).trim() : '';
    const safeHandle = rawHandle ? '@' + rawHandle.replace(/^@/, '').trim().toLowerCase() : '';

    if (!safeHandle || !/^[A-Za-z0-9._-]+$/.test(safeHandle.replace(/^@/, ''))) {
      await Swal.fire('Invalid handle', 'Invalid or missing handle.', 'warning');
      return;
    }

    try {
      setSendingInvite(true);

      const { email: creatorEmail } = await resolveCreatorEmail(safeHandle, normalizedPlatform);
      if (!creatorEmail) {
        await Swal.fire(
          'No email found',
          'We could not find a contact email for this creator. Try sending an invitation.',
          'warning'
        );
        return;
      }

      const resp = await post<InvitationResponse>('/emails/invitation', {
        email: creatorEmail,
        brandId,
        campaignId: campaignId || undefined,
        handle: safeHandle,
        platform: normalizedPlatform,
      });

      if (!resp) {
        await Swal.fire('Error', 'No response from server.', 'error');
        return;
      }

      if (resp.status === 'error') {
        await Swal.fire('Error', resp.message || 'Failed to send email.', 'error');
        return;
      }

      const successTitle = resp.isExistingInfluencer ? 'Message sent' : 'Invitation sent';
      const successText = resp.isExistingInfluencer
        ? 'We’ve emailed this creator. They can reply directly.'
        : 'We’ve sent your invitation to this creator.';

      await Swal.fire(successTitle, successText, 'success');
    } catch (err: any) {
      await Swal.fire('Error', err?.message || 'Failed to send.', 'error');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleMediaKit = async () => {
    const url = window.location.href;

    try {
      await navigator.clipboard.writeText(url);
      Swal.fire({ icon: 'success', title: 'Link copied!', text: 'Media kit link copied to clipboard.', timer: 1500, showConfirmButton: false });
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

        Swal.fire({ icon: 'success', title: 'Link copied!', text: 'Media kit link copied to clipboard.', timer: 1500, showConfirmButton: false });
      } catch {
        Swal.fire({ icon: 'error', title: 'Copy failed', text: 'Could not copy the link. Please copy it manually from the address bar.' });
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

                  {effectiveHasEmail ? (
                    <button
                      onClick={handleMessageNow}
                      disabled={!canAct}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-white transition-opacity shadow-sm
                        ${canAct ? 'bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:opacity-90' : 'bg-gray-300 cursor-not-allowed opacity-70'}`}
                    >
                      {sendingInvite ? (
                        <>
                          <MessageSquare className="h-4 w-4 animate-pulse" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-4 w-4" />
                          Send Invitation
                        </>
                      )}
                    </button>
                  ) : (
                    <DropdownMenu open={dropdownOpen} onOpenChange={(v) => setDropdownOpen(v)}>
                      <DropdownMenuTrigger asChild>
                        <button
                          disabled={!canAct}
                          className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-white transition-opacity shadow-sm
                            ${canAct ? 'bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:opacity-90' : 'bg-gray-300 cursor-not-allowed opacity-70'}`}
                        >
                          <Send className="h-4 w-4" />
                          Invite
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
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            onClick={handleSendFromDropdown}
                            disabled={!canAct}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-white transition-opacity shadow-sm
                              ${canAct ? 'bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:opacity-90' : 'bg-gray-300 cursor-not-allowed opacity-70'}`}
                          >
                            {sendingInvite ? 'Sending…' : 'Send Invite'}
                          </button>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
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
                    <AboutSection profile={data.profile} />
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