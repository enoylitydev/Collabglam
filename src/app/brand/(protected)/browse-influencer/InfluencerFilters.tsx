// InfluencerFilters.tsx
import React from 'react';
import type { Platform, InfluencerFilters as IF } from './filters';

interface Props {
  platforms: Platform[];                         // for conditional fields (IG)
  filters: IF;
  updateFilter: (path: string, value: any) => void;
}

export function InfluencerFilters({ platforms, filters, updateFilter }: Props) {
  const hasInstagram = platforms.includes('instagram');

  return (
    <div className="space-y-4">
      {/* Followers Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Followers Range</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Min</label>
            <input
              type="number"
              className="w-full px-3 py-2 border rounded-md text-sm"
              placeholder="0"
              value={filters.followersMin ?? ''}
              onChange={(e) => updateFilter('followersMin', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Max</label>
            <input
              type="number"
              className="w-full px-3 py-2 border rounded-md text-sm"
              placeholder="∞"
              value={filters.followersMax ?? ''}
              onChange={(e) => updateFilter('followersMax', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        </div>
      </div>

      {/* Engagement Rate (0..1) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Min Engagement Rate</label>
        <input
          type="number"
          step="0.01"
          min="0"
          max="1"
          className="w-full px-3 py-2 border rounded-md text-sm"
          placeholder="0.02"
          value={filters.engagementRate ?? ''}
          onChange={(e) => updateFilter('engagementRate', e.target.value ? Number(e.target.value) : undefined)}
        />
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

      {/* Age Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Age Range</label>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number" min={13} max={100}
            className="w-full px-3 py-2 border rounded-md text-sm"
            placeholder="Min"
            value={filters.ageMin ?? ''}
            onChange={(e) => updateFilter('ageMin', e.target.value ? Number(e.target.value) : undefined)}
          />
          <input
            type="number" min={13} max={100}
            className="w-full px-3 py-2 border rounded-md text-sm"
            placeholder="Max"
            value={filters.ageMax ?? ''}
            onChange={(e) => updateFilter('ageMax', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      {/* Verified */}
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

      {/* Last Posted within 90 days */}
      <div className="flex items-center">
        <input
          id="last90"
          type="checkbox"
          className="h-4 w-4"
          checked={!!filters.lastPostedWithinDays}
          onChange={(e) => updateFilter('lastPostedWithinDays', e.target.checked ? 90 : undefined)}
        />
        <label htmlFor="last90" className="ml-2 text-sm">Last posted within 90 days</label>
      </div>

      {/* Follower Growth Rate (%) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Follower Growth Rate (%)</label>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number" placeholder="Min"
            className="w-full px-3 py-2 border rounded-md text-sm"
            value={filters.followerGrowthMin ?? ''}
            onChange={(e) => updateFilter('followerGrowthMin', e.target.value ? Number(e.target.value) : undefined)}
          />
          <input
            type="number" placeholder="Max"
            className="w-full px-3 py-2 border rounded-md text-sm"
            value={filters.followerGrowthMax ?? ''}
            onChange={(e) => updateFilter('followerGrowthMax', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      {/* Has contact detail */}
      <div className="flex items-center">
        <input
          id="has-contact"
          type="checkbox"
          className="h-4 w-4"
          checked={!!filters.hasContactDetails}
          onChange={(e) => updateFilter('hasContactDetails', e.target.checked)}
        />
        <label htmlFor="has-contact" className="ml-2 text-sm">Has contact detail</label>
      </div>

      {/* IG-only: Reels Plays */}
      {hasInstagram && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Reels Plays (Instagram)</label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number" min={0} placeholder="Min"
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={filters.reelsPlaysMin ?? ''}
              onChange={(e) => updateFilter('reelsPlaysMin', e.target.value ? Number(e.target.value) : undefined)}
            />
            <input
              type="number" min={0} placeholder="Max"
              className="w-full px-3 py-2 border rounded-md text-sm"
              value={filters.reelsPlaysMax ?? ''}
              onChange={(e) => updateFilter('reelsPlaysMax', e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        </div>
      )}

      {/* IG-only: Has Sponsored Post */}
      {hasInstagram && (
        <div className="flex items-center">
          <input
            id="has-spons"
            type="checkbox"
            className="h-4 w-4"
            checked={!!filters.hasSponsoredPosts}
            onChange={(e) => updateFilter('hasSponsoredPosts', e.target.checked)}
          />
          <label htmlFor="has-spons" className="ml-2 text-sm">Has sponsored post (Instagram)</label>
        </div>
      )}

      {/* Engagements (counts) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Engagements</label>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number" placeholder="Min"
            className="w-full px-3 py-2 border rounded-md text-sm"
            value={filters.engagementsMin ?? 5000}
            onChange={(e) => updateFilter('engagementsMin', e.target.value ? Number(e.target.value) : undefined)}
          />
          <input
            type="number" placeholder="Max"
            className="w-full px-3 py-2 border rounded-md text-sm"
            value={filters.engagementsMax ?? 10000}
            onChange={(e) => updateFilter('engagementsMax', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">Default: 5,000 – 10,000</p>
      </div>
    </div>
  );
}
