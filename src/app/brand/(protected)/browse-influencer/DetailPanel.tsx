import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, BarChart3, Send, MessageSquare } from 'lucide-react';
import { ProfileHeader } from './detail-panel/ProfileHeader';
import { StatsChart } from './detail-panel/StatsChart';
import { ContentBreakdown } from './detail-panel/ContentBreakdown';
import { PopularPosts } from './detail-panel/PopularPosts';
import { AboutSection } from './detail-panel/AboutSection';
import { AudienceDistribution } from './detail-panel/AudienceDistribution';
import { BrandAffinity } from './detail-panel/BrandAffinity';
import { MiniUserSection } from './detail-panel/MiniUserSection';
import type { ReportResponse, StatHistoryEntry } from './types';
import { post2 } from '@/lib/api';

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
  /** 👇 new: passed from parent; use as-is */
  handle: string | null;
}

export const DetailPanel = React.memo<DetailPanelProps>(({
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
}) => {
  const router = useRouter();
  const [sendingInvite, setSendingInvite] = useState(false);

  const statHistory = useMemo<StatHistoryEntry[]>(() => {
    const hist = data?.profile?.statsByContentType?.all?.statHistory || [];
    return hist?.slice(-12);
  }, [data]);

  if (!open) return null;

  const hasUserId = Boolean(data?.profile?.userId);
  const canAct = hasUserId && !loading;

  const ctaTitle = hasUserId
    ? (emailExists ? 'Message this creator' : 'Send invitation to collect email')
    : 'Profile not ready';

  const handleMessageNow = (e: React.MouseEvent) => {
    if (!canAct) {
      e.preventDefault();
      return;
    }
    router.push('/brand/messages');
  };

  const handleSendInvitation = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!canAct || sendingInvite) return;

    // use the handle prop directly (no extractor)
    const rawHandle = handle ? String(handle).trim() : '';
    const safeHandle = rawHandle
      ? (rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`)
      : '';

    if (!brandId) {
      alert('Missing brandId. Please provide brandId to DetailPanel.');
      return;
    }
    const normalizedPlatform = (platform ?? '').toLowerCase() as Platform;
    if (!normalizedPlatform || !['youtube', 'instagram', 'tiktok'].includes(normalizedPlatform)) {
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
        brandId
      });

      if (resp?.status === 'exists') alert('Already recorded.');
      else if (resp?.status === 'saved') alert('Invitation recorded.');
      else alert('Saved.');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to send invitation';
      console.error(err);
      alert(msg);
    } finally {
      setSendingInvite(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute top-0 right-0 h-full w-full md:w-[50vw] bg-white shadow-2xl border-l rounded-none md:rounded-l-3xl overflow-y-auto">
        {/* Top Bar */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b flex items-center gap-2 p-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Close
          </button>

          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-700">calculationMethod</label>
            <select
              value={calc}
              onChange={(e) => onChangeCalc(e.target.value as any)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="median">median</option>
              <option value="average">average</option>
            </select>

            {emailExists ? (
              <button
                onClick={handleMessageNow}
                disabled={!canAct}
                title={ctaTitle}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-white transition-opacity
                  ${canAct ? 'bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:opacity-90'
                    : 'bg-gray-300 cursor-not-allowed opacity-70'}`}
              >
                <MessageSquare className="h-4 w-4" />
                Message Now
              </button>
            ) : (
              <button
                onClick={handleSendInvitation}
                disabled={!canAct || sendingInvite}
                title={ctaTitle}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-white transition-opacity
                  ${canAct && !sendingInvite ? 'bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:opacity-90'
                    : 'bg-gray-300 cursor-not-allowed opacity-70'}`}
              >
                <Send className="h-4 w-4" />
                {sendingInvite ? 'Sending…' : 'Send Invitation'}
              </button>
            )}
          </div>
        </div>

        <div className="p-5">
          {loading && <LoadingState />}
          {error && <ErrorState error={error} />}

          {data && (
            <div className="space-y-6">
              <ProfileHeader profile={data.profile} platform={platform} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                  <StatsChart statHistory={statHistory} />
                  <ContentBreakdown data={data} platform={platform} />
                  {data.profile.popularPosts && data.profile.popularPosts.length > 0 && (
                    <PopularPosts posts={data.profile.popularPosts.slice(0, 12)} />
                  )}
                  {data.profile.notableUsers && data.profile.notableUsers.length > 0 && (
                    <MiniUserSection title="Notable followers" users={data.profile.notableUsers} />
                  )}

                  {data.profile.lookalikes && data.profile.lookalikes.length > 0 && (
                    <MiniUserSection title="Lookalikes" users={data.profile.lookalikes} />
                  )}

                  {data.profile.lookalikesByTopics && data.profile.lookalikesByTopics.length > 0 && (
                    <MiniUserSection title="Lookalikes by topic" users={data.profile.lookalikesByTopics} />
                  )}

                  {data.profile.audienceLookalikes && data.profile.audienceLookalikes.length > 0 && (
                    <MiniUserSection title="Audience lookalikes" users={data.profile.audienceLookalikes} />
                  )}
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <AboutSection profile={data.profile} />
                  <AudienceDistribution audience={data.profile.audience} />
                  {data.profile.brandAffinity && data.profile.brandAffinity.length > 0 && (
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
});

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
