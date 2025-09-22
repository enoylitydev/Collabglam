import React, { useMemo } from 'react';
import Link from 'next/link';
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

export type Platform = 'instagram' | 'tiktok' | 'youtube';

interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  data: ReportResponse | null;
  raw: any;
  platform: Platform | null;
  /** Map your API’s {status: 0|1} to boolean in the parent: `emailExists = status === 1` */
  emailExists?: boolean | null;
  calc: 'median' | 'average';
  onChangeCalc: (calc: 'median' | 'average') => void;
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
  onChangeCalc
}) => {
  const statHistory = useMemo<StatHistoryEntry[]>(() => {
    const hist = data?.profile?.statsByContentType?.all?.statHistory || [];
    return hist?.slice(-12);
  }, [data]);

  if (!open) return null;

  const hasUserId = Boolean(data?.profile?.userId);
  const canAct = hasUserId && !loading;

  // Tri-state awareness: undefined/null means “unknown”
  const emailKnown = typeof emailExists === 'boolean';
  const actionMode = emailExists ? 'message' : 'invite';
  const ctaLabel = emailExists ? 'Message Now' : 'Send Invitation';
  const ctaTitle = hasUserId
    ? (emailExists ? 'Message this creator' : 'Send invitation to collect email')
    : 'Profile not ready';

  const inviteHref = canAct
    ? `/brand/messages/new?to=${encodeURIComponent(String(data?.profile?.userId))}&mode=${actionMode}`
    : '#';

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
            <label className="text-xs font-semibold text-gray-700">
              calculationMethod
            </label>
            <select
              value={calc}
              onChange={(e) => onChangeCalc(e.target.value as any)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="median">median</option>
              <option value="average">average</option>
            </select>

            {/* CTA: Invitation vs Message */}
            <Link
              href={inviteHref}
              onClick={(e) => {
                if (!canAct) e.preventDefault();
              }}
              aria-disabled={!canAct}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-white transition-opacity
                ${canAct
                  ? 'bg-gradient-to-r from-[#FFA135] to-[#FF7236] hover:opacity-90'
                  : 'bg-gray-300 cursor-not-allowed pointer-events-none opacity-70'
                }`}
              title={ctaTitle}
            >
              {emailExists ? (
                <MessageSquare className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {ctaLabel}
            </Link>
          </div>
        </div>

        <div className="p-5">
          {/* Loading State */}
          {loading && <LoadingState />}

          {/* Error State */}
          {error && <ErrorState error={error} />}

          {/* Content */}
          {data && (
            <div className="space-y-6">
              <ProfileHeader
                profile={data.profile}
                platform={platform}
              />

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

// Sub-components
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
