'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  AlertCircle,
  BarChart3,
  Send,
  MessageSquare,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { ProfileHeader } from './detail-panel/ProfileHeader';
import { StatsChart } from './detail-panel/StatsChart';
import { ContentBreakdown } from './detail-panel/ContentBreakdown';
import { PopularPosts } from './detail-panel/PopularPosts';
import { AboutSection } from './detail-panel/AboutSection';
import { AudienceDistribution } from './detail-panel/AudienceDistribution';
import { BrandAffinity } from './detail-panel/BrandAffinity';
import { MiniUserSection } from './detail-panel/MiniUserSection';
import type { ReportResponse, StatHistoryEntry, Platform } from './types';
import { post, post2 } from '@/lib/api';

interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  data: ReportResponse | null;
  raw: any;
  platform: Platform | null;
  emailExists?: boolean | null;
  onChangeCalc: (calc: 'median' | 'average') => void;
  brandId: string;
  handle: string | null;
  lastFetchedAt?: string | null;
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

/** /admin/checkstatus response shape */
type AdminCheckStatusResponse = {
  status: 0 | 1;
  handle?: string;
  email?: string | null;
  platform?: Platform | string;
  message?: string;
};

/** /invitation/create response shape */
type InvitationCreateResp = {
  status: 'saved' | 'exists';
  data?: {
    invitationId: string;
    handle: string;
    platform: 'youtube' | 'instagram' | 'tiktok';
    brandId: string;
    campaignId?: string | null;
    status: 'invited' | 'available';
    createdAt: string;
    updatedAt: string;
  };
  message?: string;
};

/** /missing/create response shape */
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
    onChangeCalc,
    brandId,
    handle,
    lastFetchedAt,
    onRefreshReport,
  }) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const campaignId = searchParams?.get('campaignId') || '';
    // used for both "Message Now" + "Send Invitation" actions
    const [sendingInvite, setSendingInvite] = useState(false);

    // refresh state
    const [refreshing, setRefreshing] = useState(false);

    // local copy of last updated time (ISO string)
    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(
      lastFetchedAt || null
    );

    // NEW: combined email presence from /email/status + /admin/checkstatus
    const [hasAnyEmail, setHasAnyEmail] = useState<boolean | null>(null);
    const [checkingEmail, setCheckingEmail] = useState(false);

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

    /* ------------------------------------------------------------------ */
    /*                    Helpers for email resolution                    */
    /* ------------------------------------------------------------------ */

    // type guard for /email/status success branch
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

    /**
     * resolveCreatorEmail
     * - Calls BOTH /email/status (post2) and /admin/checkstatus (post) in parallel
     * - Returns the best email we can find + info where it came from
     */
    const resolveCreatorEmail = async (
      safeHandle: string,
      normalizedPlatform: Platform
    ): Promise<{ email: string | null; source: 'status' | 'admin' | 'both' | 'none' }> => {
      const [statusResult, adminResult] = await Promise.allSettled([
        post2<EmailStatusResponse>('/email/status', {
          handle: safeHandle,
          platform: normalizedPlatform,
        }),
        post<AdminCheckStatusResponse>('/admin/checkstatus', {
          handle: safeHandle,
          platform: normalizedPlatform,
        }),
      ]);

      let emailFromStatus: string | null = null;
      let emailFromAdmin: string | null = null;

      // /email/status result
      if (statusResult.status === 'fulfilled') {
        const statusResp = statusResult.value;
        if (isEmailStatusSuccess(statusResp) && statusResp.status === 1 && statusResp.email) {
          emailFromStatus = statusResp.email;
        }
      } else {
        console.error('Error calling /email/status:', statusResult.reason);
      }

      // /admin/checkstatus result
      if (adminResult.status === 'fulfilled') {
        const adminResp = adminResult.value;
        if (typeof adminResp.status === 'number' && adminResp.status === 1 && adminResp.email) {
          emailFromAdmin = adminResp.email;
        }
      } else {
        console.error('Error calling /admin/checkstatus:', adminResult.reason);
      }

      if (emailFromStatus && emailFromAdmin && emailFromStatus === emailFromAdmin) {
        return { email: emailFromStatus, source: 'both' };
      }

      if (emailFromStatus) {
        return { email: emailFromStatus, source: 'status' };
      }

      if (emailFromAdmin) {
        return { email: emailFromAdmin, source: 'admin' };
      }

      return { email: null, source: 'none' };
    };

    /* ------------------------------------------------------------------ */
    /*           Pre-check: is this handle present in ANY email DB?       */
    /* ------------------------------------------------------------------ */
    useEffect(() => {
      // don't run when panel closed
      if (!open) {
        setHasAnyEmail(null);
        return;
      }

      const normalizedPlatform = (platform ?? '').toLowerCase() as Platform;
      if (
        !normalizedPlatform ||
        !['youtube', 'instagram', 'tiktok'].includes(normalizedPlatform)
      ) {
        setHasAnyEmail(null);
        return;
      }

      const rawHandle = handle ? String(handle).trim() : '';
      const safeHandle = rawHandle
        ? '@' + rawHandle.replace(/^@/, '').trim().toLowerCase()
        : '';

      if (!safeHandle || !/^[A-Za-z0-9._-]+$/.test(safeHandle.replace(/^@/, ''))) {
        setHasAnyEmail(null);
        return;
      }

      let cancelled = false;
      setCheckingEmail(true);

      (async () => {
        try {
          const { email } = await resolveCreatorEmail(safeHandle, normalizedPlatform);
          if (!cancelled) {
            setHasAnyEmail(!!email); // true if ANY status api returns email
          }
        } catch (err) {
          console.error('Failed to pre-check email status', err);
          if (!cancelled) {
            setHasAnyEmail(null);
          }
        } finally {
          if (!cancelled) {
            setCheckingEmail(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, handle, platform]); // we intentionally don't include resolveCreatorEmail to avoid re-creating loop

    if (!open) return null;

    const hasUserId = Boolean(data?.profile?.userId);
    const canAct = hasUserId && !loading && !sendingInvite && !refreshing;

    // ✅ use merged knowledge: if ANY status api says email present, treat as "has email"
    const effectiveHasEmail =
      hasAnyEmail !== null ? hasAnyEmail : emailExists === true;

    const ctaTitle = hasUserId
      ? effectiveHasEmail
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

    /* ------------------------------------------------------------------ */
    /*                          Refresh Modash data                       */
    /* ------------------------------------------------------------------ */
    const handleRefreshData = async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!onRefreshReport || refreshing) return;

      try {
        setRefreshing(true);
        await onRefreshReport();
      } catch (err: any) {
        console.error(err);
        await Swal.fire(
          'Refresh failed',
          err?.message || 'Failed to refresh data',
          'error'
        );
      } finally {
        setRefreshing(false);
      }
    };

    /* ------------------------------------------------------------------ */
    /*                     Message Now (has email)                        */
    /* ------------------------------------------------------------------ */
    const handleMessageNow = async (e: React.MouseEvent) => {
      e.preventDefault();
      if (!canAct) return;

      if (!brandId) {
        await Swal.fire(
          'Missing brand',
          'Missing brandId. Please provide brandId to DetailPanel.',
          'warning'
        );
        return;
      }

      const normalizedPlatform = (platform ?? '').toLowerCase() as Platform;
      if (
        !normalizedPlatform ||
        !['youtube', 'instagram', 'tiktok'].includes(normalizedPlatform)
      ) {
        await Swal.fire(
          'Unsupported platform',
          'Unsupported or missing platform.',
          'warning'
        );
        return;
      }

      const rawHandle = handle ? String(handle).trim() : '';
      const safeHandle = rawHandle
        ? '@' + rawHandle.replace(/^@/, '').trim().toLowerCase()
        : '';

      if (!safeHandle || !/^[A-Za-z0-9._-]+$/.test(safeHandle.replace(/^@/, ''))) {
        await Swal.fire(
          'Invalid handle',
          'Invalid or missing handle to lookup contact email.',
          'warning'
        );
        return;
      }

      try {
        setSendingInvite(true);

        // Resolve email using BOTH sources in parallel (again, at click time)
        const { email: creatorEmail } = await resolveCreatorEmail(
          safeHandle,
          normalizedPlatform
        );

        if (!creatorEmail) {
          await Swal.fire(
            'No email found',
            'We could not find a contact email for this creator. Try sending an invitation or adding the email manually.',
            'warning'
          );
          return;
        }

        // // Call /emails/invitation with the resolved email
        // await post<InvitationResponse>('/emails/invitation', {
        //   email: creatorEmail,
        //   brandId,
        // });

        // ✅ Always redirect to /brand/invited
        router.push('/brand/invited');
      } catch (err: any) {
        console.error(err);
        // ✅ Do NOT surface any backend message that might contain the email
        await Swal.fire(
          'Error',
          'Failed to start conversation. Please try again.',
          'error'
        );
      } finally {
        setSendingInvite(false);
      }
    };

    /* ------------------------------------------------------------------ */
    /*                Send Invitation (no email anywhere)                 */
    /*      → NOW also writes to /invitation/create (status=invited)      */
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
        await Swal.fire(
          'Missing brand',
          'Missing brandId. Please provide brandId to DetailPanel.',
          'warning'
        );
        return;
      }
      const normalizedPlatform = (platform ?? '').toLowerCase() as Platform;
      if (
        !normalizedPlatform ||
        !['youtube', 'instagram', 'tiktok'].includes(normalizedPlatform)
      ) {
        await Swal.fire(
          'Unsupported platform',
          'Unsupported or missing platform.',
          'warning'
        );
        return;
      }
      if (!safeHandle || !/^[A-Za-z0-9._-]+$/.test(safeHandle.replace(/^@/, ''))) {
        await Swal.fire(
          'Invalid handle',
          'Invalid or missing handle to send invitation.',
          'warning'
        );
        return;
      }

      try {
        setSendingInvite(true);

        const invitationPayload: {
          handle: string;
          platform: Platform;
          brandId: string;
          status: 'invited' | 'available';
          campaignId?: string;
        } = {
          handle: safeHandle,
          platform: normalizedPlatform,
          brandId,
          status: 'invited',
        };

        if (campaignId) {
          invitationPayload.campaignId = campaignId; // ⬅️ only send if present
        }

        const [missingResult, invitationResult] = await Promise.allSettled([
          post2<CreateMissingResp>('/missing/create', {
            handle: safeHandle,
            platform: normalizedPlatform,
            brandId,
          }),
          post<InvitationCreateResp>('/newinvitations/create', invitationPayload),
        ]);

        let missingMessage: string | null = null;
        let invitationMessage: string | null = null;
        let hasError = false;

        // Handle /missing/create outcome
        if (missingResult.status === 'fulfilled') {
          const resp = missingResult.value;
          if (resp?.status === 'exists') {
            missingMessage =
              resp.message || 'Missing request already present for this handle.';
          } else if (resp?.status === 'saved') {
            missingMessage =
              resp.message || 'Missing request recorded for this creator.';
          } else {
            missingMessage = 'Missing/create call completed.';
          }
        } else {
          hasError = true;
          const err = missingResult.reason as any;
          missingMessage = `Missing/create failed: ${err?.response?.data?.message || err?.message || 'Unknown error'
            }`;
        }

        // Handle /invitation/create outcome
        if (invitationResult.status === 'fulfilled') {
          const resp = invitationResult.value;
          if (resp?.status === 'exists') {
            invitationMessage =
              resp.message ||
              'Invitation already exists for this brand + handle + platform.';
          } else if (resp?.status === 'saved') {
            invitationMessage =
              resp.message || 'Invitation created for this creator.';
          } else {
            invitationMessage = 'Invitation/create call completed.';
          }
        } else {
          hasError = true;
          const err = invitationResult.reason as any;
          invitationMessage = `Invitation/create failed: ${err?.response?.data?.message || err?.message || 'Unknown error'
            }`;
        }

        const title = hasError ? 'Saved with issues' : 'Invitation recorded';
        const text = [missingMessage, invitationMessage]
          .filter(Boolean)
          .join('\n');

        await Swal.fire(title, text, hasError ? 'warning' : 'success');
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to send invitation';
        console.error(err);
        await Swal.fire('Error', msg, 'error');
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
              </div>
            </div>

            {/* Right: controls */}
            <div className="ml-auto flex flex-col items-end gap-1 sm:flex-row sm:items-center">
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
                        className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''
                          }`}
                      />
                      {refreshing ? 'Refreshing…' : 'Refresh data'}
                    </button>
                  )}
                </div>

                {/* CTA row */}
                <div className="flex items-center gap-2">
                  {effectiveHasEmail ? (
                    <button
                      onClick={handleMessageNow}
                      disabled={!canAct}
                      title={ctaTitle}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-white transition-opacity shadow-sm
                        ${canAct
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
                          Send Message
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleSendInvitation}
                      disabled={!canAct}
                      title={ctaTitle}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-white transition-opacity shadow-sm
                        ${canAct
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
                          Send Collaboration Request
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
