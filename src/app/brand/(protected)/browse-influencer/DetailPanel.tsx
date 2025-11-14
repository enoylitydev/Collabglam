'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  AlertCircle,
  BarChart3,
  Send,
  MessageSquare,
} from 'lucide-react';
import { ProfileHeader } from './detail-panel/ProfileHeader';
import { StatsChart } from './detail-panel/StatsChart';
import { ContentBreakdown } from './detail-panel/ContentBreakdown';
import { PopularPosts } from './detail-panel/PopularPosts';
import { AboutSection } from './detail-panel/AboutSection';
import { AudienceDistribution } from './detail-panel/AudienceDistribution';
import { BrandAffinity } from './detail-panel/BrandAffinity';
import { MiniUserSection } from './detail-panel/MiniUserSection';
import type { ReportResponse, StatHistoryEntry } from './types';
import { post, post2 } from '@/lib/api';

export type Platform = 'instagram' | 'tiktok' | 'youtube';

interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  data: ReportResponse | null;
  raw: any;
  platform: Platform | null;
  emailExists?: boolean | null;
  calc: 'median' | 'average';
  onChangeCalc: (calc: 'median' | 'average') => void;
  brandId: string;
  /** passed from parent; the creator's handle */
  handle: string | null;

  /** last time the Modash report was fetched (ISO string) */
  lastFetchedAt?: string | null;

  /** parent-supplied refresher: forces /modash/report refresh + DB update */
  onRefreshReport?: () => Promise<void> | void;
}

/** /email/status response shape */
type EmailStatusResponse =
  | {
      status: 0 | 1;
      email?: string;
      handle?: string;
      platform?: Platform;
    }
  | { status: 'error'; message?: string };

/** /emails/invitation response shape */
type InvitationResponse =
  | {
      message: string;
      isExistingInfluencer: true;
      influencerId: string;
      influencerName: string;
      brandName: string;
      roomId?: string;
    }
  | {
      message: string;
      isExistingInfluencer: false;
      brandName: string;
      signupUrl: string;
    };

export const DetailPanel = React.memo<DetailPanelProps>(
  ({
    open,
    onClose,
    loading,
    error,
    data,
    raw,
    platform,
    emailExists,
    calc,
    onChangeCalc,
    brandId,
    handle,
    lastFetchedAt,
    onRefreshReport,
  }) => {
    const router = useRouter();

    // used for both "Message Now" + "Send Invitation" actions
    const [sendingInvite, setSendingInvite] = useState(false);

    // refresh state
    const [refreshing, setRefreshing] = useState(false);

    // local copy of last updated time (ISO string)
    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(
      lastFetchedAt || null
    );

    // keep in sync with parent when prop changes
    useEffect(() => {
      setLastUpdatedAt(lastFetchedAt || null);
    }, [lastFetchedAt]);

    const formattedLastUpdated = lastUpdatedAt
      ? new Date(lastUpdatedAt).toLocaleString()
      : 'Not fetched yet';

    const statHistory = useMemo<StatHistoryEntry[]>(() => {
      const hist = data?.profile?.statsByContentType?.all?.statHistory || [];
      return hist?.slice(-12);
    }, [data]);

    if (!open) return null;

    const hasUserId = Boolean(data?.profile?.userId);
    const canAct = hasUserId && !loading && !sendingInvite && !refreshing;

    const ctaTitle = hasUserId
      ? emailExists
        ? 'Message this creator'
        : 'Send invitation to collect email'
      : 'Profile not ready';

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

    const hasEmail = emailExists === true;
    const emailBadgeText = hasEmail ? 'Email on file' : 'No email yet';
    const emailBadgeTone = hasEmail
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-gray-50 text-gray-600 border-gray-200';

    /* ------------------------------------------------------------------ */
    /*                          Refresh Modash data                       */
    /* ------------------------------------------------------------------ */
    const handleRefreshData = async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!onRefreshReport || refreshing) return;

      try {
        setRefreshing(true);
        await onRefreshReport();
        // parent refreshes + updates lastFetchedAt
      } catch (err: any) {
        console.error(err);
        alert(err?.message || 'Failed to refresh data');
      } finally {
        setRefreshing(false);
      }
    };

    /* ------------------------------------------------------------------ */
    /*                     Message Now (emailExists === true)             */
    /* ------------------------------------------------------------------ */
    const handleMessageNow = async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!canAct) return;

      if (!brandId) {
        alert('Missing brandId. Please provide brandId to DetailPanel.');
        return;
      }

      const normalizedPlatform = (platform ?? '').toLowerCase() as Platform;
      if (
        !normalizedPlatform ||
        !['youtube', 'instagram', 'tiktok'].includes(normalizedPlatform)
      ) {
        alert('Unsupported or missing platform.');
        return;
      }

      const rawHandle = handle ? String(handle).trim() : '';
      const safeHandle = rawHandle
        ? '@' + rawHandle.replace(/^@/, '').trim().toLowerCase()
        : '';

      if (!safeHandle || !/^[A-Za-z0-9._-]+$/.test(safeHandle.replace(/^@/, ''))) {
        alert('Invalid or missing handle to lookup contact email.');
        return;
      }

      try {
        setSendingInvite(true);

        // 1️⃣ Get email from /email/status
        const statusResp = await post2<EmailStatusResponse>('/email/status', {
          handle: safeHandle,
          platform: normalizedPlatform,
        });

        // Narrow the union type so TypeScript knows this branch has numeric status and optional email.
        const isEmailStatusSuccess = (
          resp: EmailStatusResponse
        ): resp is {
          status: 0 | 1;
          email?: string;
          handle?: string;
          platform?: Platform;
        } => {
          return typeof (resp as any)?.status === 'number';
        };

        if (!isEmailStatusSuccess(statusResp)) {
          const msg =
            (statusResp as any)?.message || 'Failed to resolve email status';
          throw new Error(msg);
        }

        if (statusResp.status === 0 || !statusResp.email) {
          alert(
            'No email found for this creator. Try sending a generic invitation instead.'
          );
          setSendingInvite(false);
          return;
        }

        const creatorEmail = statusResp.email;

        // 2️⃣ Call /emails/invitation
        const inviteResp = await post<InvitationResponse>(
          '/emails/invitation',
          {
            email: creatorEmail,
            brandId,
          }
        );

        if (inviteResp.isExistingInfluencer) {
          // Influencer is signed up → go to messages
          if (inviteResp.roomId) {
            router.push(`/brand/messages/${inviteResp.roomId}`);
          } else {
            router.push('/brand/messages');
          }
        } else {
          // Not in DB → email invitation sent
          alert(`Invitation email sent to ${creatorEmail}`);
        }
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to start conversation';
        console.error(err);
        alert(msg);
      } finally {
        setSendingInvite(false);
      }
    };

    /* ------------------------------------------------------------------ */
    /*                Send Invitation (no email in Modash)                */
    /* ------------------------------------------------------------------ */
    const handleSendInvitation = async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!canAct || sendingInvite) return;

      const rawHandle = handle ? String(handle).trim() : '';
      const safeHandle = rawHandle
        ? rawHandle.startsWith('@')
          ? rawHandle
          : `@${rawHandle}`
        : '';

      if (!brandId) {
        alert('Missing brandId. Please provide brandId to DetailPanel.');
        return;
      }
      const normalizedPlatform = (platform ?? '').toLowerCase() as Platform;
      if (
        !normalizedPlatform ||
        !['youtube', 'instagram', 'tiktok'].includes(normalizedPlatform)
      ) {
        alert('Unsupported or missing platform.');
        return;
      }
      if (!safeHandle || !/^[A-Za-z0-9._-]+$/.test(safeHandle.replace(/^@/, ''))) {
        alert('Invalid or missing handle to send invitation.');
        return;
      }

      try {
        setSendingInvite(true);

        type CreateMissingResp = {
          status: 'saved' | 'exists';
          data: {
            missingId: string;
            handle: string;
            platform: 'youtube' | 'instagram' | 'tiktok';
            brandId: string;
            note: string | null;
            createdAt: string;
          };
          message?: string;
        };

        const resp = await post2<CreateMissingResp>('/missing/create', {
          handle: safeHandle,
          platform: normalizedPlatform,
          brandId,
        });

        if (resp?.status === 'exists') alert('Already recorded.');
        else if (resp?.status === 'saved') alert('Invitation recorded.');
        else alert('Saved.');
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to send invitation';
        console.error(err);
        alert(msg);
      } finally {
        setSendingInvite(false);
      }
    };

    const showRefreshButton = Boolean(onRefreshReport);

    return (
      <div className="fixed inset-0 z-[90]">
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        <div className="absolute top-0 right-0 h-full w-full md:w-[50vw] bg-white shadow-2xl border-l rounded-none md:rounded-l-3xl overflow-y-auto">
          {/* Top Bar */}
          <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b flex items-center gap-3 px-4 py-3">
            {/* Left: Close + creator summary */}
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" /> Close
            </button>

            <div className="min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {displayName}
                </span>
                {displayHandle && (
                  <span className="text-xs text-gray-500 truncate">
                    {displayHandle}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {platform && (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-700">
                    {platform}
                  </span>
                )}
                {hasUserId && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${emailBadgeTone}`}
                  >
                    <span
                      className={`mr-1 h-1.5 w-1.5 rounded-full ${
                        hasEmail ? 'bg-emerald-500' : 'bg-gray-400'
                      }`}
                    />
                    {emailBadgeText}
                  </span>
                )}
              </div>
            </div>

            {/* Right: controls */}
            <div className="ml-auto flex flex-col items-end gap-1 sm:flex-row sm:items-center">
              {/* calc method toggle */}
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] uppercase tracking-wide text-gray-500">
                  Metrics based on
                </span>
                <div className="inline-flex rounded-xl bg-gray-100 p-0.5 text-xs shadow-inner">
                  <button
                    type="button"
                    onClick={() => onChangeCalc('median')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      calc === 'median'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Median
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeCalc('average')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                      calc === 'average'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Average
                  </button>
                </div>
              </div>

              {/* last updated + refresh + CTA */}
              <div className="flex flex-col items-end gap-1 sm:items-end sm:ml-3">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] uppercase tracking-wide text-gray-500">
                      Latest data
                    </span>
                    <span className="text-xs text-gray-700">
                      {formattedLastUpdated}
                    </span>
                  </div>

                  {showRefreshButton && (
                    <button
                      type="button"
                      onClick={handleRefreshData}
                      disabled={refreshing || loading}
                      className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      <BarChart3
                        className={`h-3 w-3 ${
                          refreshing ? 'animate-spin' : ''
                        }`}
                      />
                      {refreshing ? 'Refreshing…' : 'Refresh data'}
                    </button>
                  )}
                </div>

                {/* CTA row */}
                <div className="flex items-center gap-2">
                  {emailExists ? (
                    <button
                      onClick={handleMessageNow}
                      disabled={!canAct}
                      title={ctaTitle}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-white transition-opacity shadow-sm
                        ${
                          canAct
                            ? 'bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:opacity-90'
                            : 'bg-gray-300 cursor-not-allowed opacity-70'
                        }`}
                    >
                      {sendingInvite ? (
                        <>
                          <MessageSquare className="h-4 w-4 animate-pulse" />
                          Please wait…
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-4 w-4" />
                          Message Now
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleSendInvitation}
                      disabled={!canAct}
                      title={ctaTitle}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-white transition-opacity shadow-sm
                        ${
                          canAct
                            ? 'bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:opacity-90'
                            : 'bg-gray-300 cursor-not-allowed opacity-70'
                        }`}
                    >
                      {sendingInvite ? (
                        <>
                          <Send className="h-4 w-4 animate-pulse" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Send Invitation
                        </>
                      )}
                    </button>
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
                No report data yet. Try refreshing data or selecting another
                creator.
              </div>
            )}

            {data && (
              <div className="space-y-6">
                <ProfileHeader profile={data.profile} platform={platform} />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column */}
                  <div className="lg:col-span-2 space-y-6">
                    <StatsChart statHistory={statHistory} />
                    <ContentBreakdown data={data} platform={platform} />
                    {data.profile.popularPosts &&
                      data.profile.popularPosts.length > 0 && (
                        <PopularPosts
                          posts={data.profile.popularPosts.slice(0, 12)}
                        />
                      )}
                    {data.profile.notableUsers &&
                      data.profile.notableUsers.length > 0 && (
                        <MiniUserSection
                          title="Notable followers"
                          users={data.profile.notableUsers}
                        />
                      )}

                    {data.profile.lookalikes &&
                      data.profile.lookalikes.length > 0 && (
                        <MiniUserSection
                          title="Lookalikes"
                          users={data.profile.lookalikes}
                        />
                      )}

                    {data.profile.lookalikesByTopics &&
                      data.profile.lookalikesByTopics.length > 0 && (
                        <MiniUserSection
                          title="Lookalikes by topic"
                          users={data.profile.lookalikesByTopics}
                        />
                      )}

                    {data.profile.audienceLookalikes &&
                      data.profile.audienceLookalikes.length > 0 && (
                        <MiniUserSection
                          title="Audience lookalikes"
                          users={data.profile.audienceLookalikes}
                        />
                      )}
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <AboutSection profile={data.profile} />
                    <AudienceDistribution audience={data.profile.audience} />
                    {data.profile.brandAffinity &&
                      data.profile.brandAffinity.length > 0 && (
                        <BrandAffinity items={data.profile.brandAffinity} />
                      )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

DetailPanel.displayName = 'DetailPanel';

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
      <div className="font-semibold">Request failed</div>
      <div>{error}</div>
    </div>
  </div>
);
