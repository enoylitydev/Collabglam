// InfluencerFilters.tsx
import React from 'react'; // ← removed unused useMemo
import type { Platform } from './filters';
import type { InfluencerFilters as IF } from './filters';

interface Props {
  platforms: Platform[];
  filters: IF;
  updateFilter: (path: string, value: any) => void;
}

const Num = (p: {
  value?: number;
  onChange: (n?: number) => void;
  placeholder?: string;
  min?: number; max?: number;
}) => (
  <input
    type="number"
    className="w-full px-3 py-2 border rounded-md text-sm"
    value={p.value ?? ''}
    placeholder={p.placeholder}
    min={p.min} max={p.max}
    onChange={(e) => p.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
  />
);

export function InfluencerFilters({ platforms, filters, updateFilter }: Props) {
  const selected = platforms.length ? platforms : (['youtube'] as Platform[]);
  const hasIG = selected.includes('instagram');
  const hasTT = selected.includes('tiktok');
  const hasYT = selected.includes('youtube');
  const allThree = hasIG && hasTT && hasYT;

  return (
    <div className="space-y-6 lg:space-y-7 xl:space-y-8">
      {/* Followers */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Followers Range</label>
        <div className="grid grid-cols-2 gap-3 lg:gap-4 xl:gap-5">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Min</label>
            <Num value={filters.followersMin} onChange={(v) => updateFilter('followersMin', v)} placeholder="e.g. 20000" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Max</label>
            <Num value={filters.followersMax} onChange={(v) => updateFilter('followersMax', v)} placeholder="e.g. 70000" />
          </div>
        </div>
      </div>

      {/* Engagement rate */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Min Engagement Rate</label>
        <Num value={filters.engagementRate as any} onChange={(v) => updateFilter('engagementRate', v)} placeholder="0.02" min={0} max={1} />
        <p className="text-xs text-gray-500 mt-1">Enter 0.02 for 2%</p>
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
        <select
          className="w-full px-3 py-2 border rounded-md text-sm"
          value={filters.language ?? ''}
          onChange={(e) => updateFilter('language', e.target.value || undefined)}
        >
          <option value="">Any</option>
          <option value="en">English</option><option value="es">Spanish</option>
          <option value="fr">French</option><option value="de">German</option>
          <option value="it">Italian</option><option value="pt">Portuguese</option>
          <option value="ru">Russian</option><option value="ja">Japanese</option>
          <option value="ko">Korean</option><option value="zh">Chinese</option>
        </select>
      </div>

      {/* Influencer Gender */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Influencer Gender</label>
        <select
          className="w-full px-3 py-2 border rounded-md text-sm"
          value={filters.gender ?? ''}
          onChange={(e) => updateFilter('gender', e.target.value || undefined)}
        >
          <option value="">Any</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="NON_BINARY">Non-binary</option>
        </select>
      </div>

      {/* Age */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Age Range</label>
        <div className="grid grid-cols-2 gap-3 lg:gap-4 xl:gap-5">
          <Num value={filters.ageMin} onChange={(v) => updateFilter('ageMin', v)} placeholder="Min" />
          <Num value={filters.ageMax} onChange={(v) => updateFilter('ageMax', v)} placeholder="Max" />
        </div>
      </div>

      {/* Verified */}
      <div className="flex items-center justify-between lg:justify-start lg:gap-4">
        <div className="flex items-center">
          <input
            id="verified-only"
            type="checkbox"
            className="h-4 w-4"
            checked={!!filters.isVerified}
            onChange={(e) => updateFilter('isVerified', e.target.checked)}
          />
          <label htmlFor="verified-only" className="ml-2 text-sm">Verified accounts only</label>
        </div>
      </div>

      {/* Last posted within 90 days */}
      <div className="flex items-center justify-between lg:justify-start lg:gap-4">
        <div className="flex items-center">
          <input
            id="last90"
            type="checkbox"
            className="h-4 w-4"
            checked={!!(filters as any).lastPostedWithinDays}
            onChange={(e) => updateFilter('lastPostedWithinDays', e.target.checked ? 90 : undefined)}
          />
          <label htmlFor="last90" className="ml-2 text-sm">Last posted within 90 days</label>
        </div>
      </div>

      {/* Followers growth rate (%) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Follower Growth Rate (%)</label>
        <div className="grid grid-cols-2 gap-3 lg:gap-4 xl:gap-5">
          <Num value={(filters as any).followerGrowthMin} onChange={(v) => updateFilter('followerGrowthMin', v)} placeholder="Min %" />
          <Num value={(filters as any).followerGrowthMax} onChange={(v) => updateFilter('followerGrowthMax', v)} placeholder="Max %" />
        </div>
      </div>

      {/* Has contact detail */}
      <div className="flex items-center justify-between lg:justify-start lg:gap-4">
        <div className="flex items-center">
          <input
            id="has-contact"
            type="checkbox"
            className="h-4 w-4"
            checked={!!(filters as any).hasContactDetails}
            onChange={(e) => updateFilter('hasContactDetails', e.target.checked)}
          />
          <label htmlFor="has-contact" className="ml-2 text-sm">Has contact detail</label>
        </div>
      </div>

      {/* Video Plays / Views (Common) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Video Plays / Views (Common)</label>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 xl:gap-5">
          <Num value={(filters as any).videoPlaysMin} onChange={(v) => updateFilter('videoPlaysMin', v)} placeholder="Min" />
          <Num value={(filters as any).videoPlaysMax} onChange={(v) => updateFilter('videoPlaysMax', v)} placeholder="Max" />
        </div>
        <p className="text-xs text-gray-500 mt-1">Works across short-video & long-form.</p>
      </div>

      {/* IG extras */}
      {hasIG && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Reels Plays (Additional)</label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 xl:gap-5">
            <Num value={(filters as any).reelsPlaysMin} onChange={(v) => updateFilter('reelsPlaysMin', v)} placeholder="Min" />
            <Num value={(filters as any).reelsPlaysMax} onChange={(v) => updateFilter('reelsPlaysMax', v)} placeholder="Max" />
          </div>
        </div>
      )}

      {/* TT/YT extras */}
      {(hasTT || hasYT) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Views (Additional)</label>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 xl:gap-5">
            <Num value={(filters as any).ttViewsMin} onChange={(v) => updateFilter('ttViewsMin', v)} placeholder="Min (extra A)" />
            <Num value={(filters as any).ttViewsMax} onChange={(v) => updateFilter('ttViewsMax', v)} placeholder="Max (extra A)" />
            <Num value={(filters as any).ytViewsMin} onChange={(v) => updateFilter('ytViewsMin', v)} placeholder="Min (extra B)" />
            <Num value={(filters as any).ytViewsMax} onChange={(v) => updateFilter('ytViewsMax', v)} placeholder="Max (extra B)" />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            If both ranges are filled, we’ll use their intersection.
          </p>
        </div>
      )}

      {/* TikTok extras */}
      {hasTT && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Likes Growth Rate (%)</label>
            <Num value={(filters as any).likesGrowthRatePct} onChange={(v) => updateFilter('likesGrowthRatePct', v)} placeholder="e.g. 0.2 = 0.2%" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shares</label>
            <div className="grid grid-cols-2 gap-3 lg:gap-4 xl:gap-5">
              <Num value={(filters as any).sharesMin} onChange={(v) => updateFilter('sharesMin', v)} placeholder="Min" />
              <Num value={(filters as any).sharesMax} onChange={(v) => updateFilter('sharesMax', v)} placeholder="Max" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Saves</label>
            <div className="grid grid-cols-2 gap-3 lg:gap-4 xl:gap-5">
              <Num value={(filters as any).savesMin} onChange={(v) => updateFilter('savesMin', v)} placeholder="Min" />
              <Num value={(filters as any).savesMax} onChange={(v) => updateFilter('savesMax', v)} placeholder="Max" />
            </div>
          </div>
        </>
      )}

      {/* YouTube extras */}
      {hasYT && (
        <>
          <div className="flex items-center">
            <input
              id="official-artist"
              type="checkbox"
              className="h-4 w-4"
              checked={!!(filters as any).isOfficialArtist}
              onChange={(e) => updateFilter('isOfficialArtist', e.target.checked)}
            />
            <label htmlFor="official-artist" className="ml-2 text-sm">Official Artist</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Views Growth Rate (%)</label>
            <Num value={(filters as any).viewsGrowthRatePct} onChange={(v) => updateFilter('viewsGrowthRatePct', v)} placeholder="e.g. 0.2 = 0.2%" />
          </div>
        </>
      )}

      {/* Sponsored posts (IG) */}
      {hasIG && (
        <div className="flex items-center">
          <input
            id="has-spons"
            type="checkbox"
            className="h-4 w-4"
            checked={!!(filters as any).hasSponsoredPosts}
            onChange={(e) => updateFilter('hasSponsoredPosts', e.target.checked)}
          />
          <label htmlFor="has-spons" className="ml-2 text-sm">Has Sponsored Posts</label>
        </div>
      )}

      {/* Engagements */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Engagements</label>
        <div className="grid grid-cols-2 gap-3 lg:gap-4 xl:gap-5">
          <Num value={(filters as any).engagementsMin} onChange={(v) => updateFilter('engagementsMin', v)} placeholder="Min e.g. 5000" />
          <Num value={(filters as any).engagementsMax} onChange={(v) => updateFilter('engagementsMax', v)} placeholder="Max e.g. 10000" />
        </div>
      </div>
    </div>
  );
}
