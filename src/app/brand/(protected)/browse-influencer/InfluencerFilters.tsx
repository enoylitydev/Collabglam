import React from 'react';
import { Platform } from './platform';

interface InfluencerFiltersProps {
  platform: Platform;
  filters: any;
  updateFilter: (path: string, value: any) => void;
}

export function InfluencerFilters({ platform, filters, updateFilter }: InfluencerFiltersProps) {
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0"
              value={filters.followersMin || ''}
              onChange={(e) => updateFilter('followersMin', parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Max</label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="∞"
              value={filters.followersMax || ''}
              onChange={(e) => updateFilter('followersMax', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* Engagement Rate */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Min Engagement Rate
        </label>
        <div className="relative">
          <input
            type="number"
            step="0.01"
            max="1"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="0.02"
            value={filters.engagementRate || ''}
            onChange={(e) => updateFilter('engagementRate', parseFloat(e.target.value) || 0)}
          />
          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
            %
          </span>
        </div>
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          value={filters.language || 'en'}
          onChange={(e) => updateFilter('language', e.target.value)}
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="it">Italian</option>
          <option value="pt">Portuguese</option>
          <option value="ru">Russian</option>
          <option value="ja">Japanese</option>
          <option value="ko">Korean</option>
          <option value="zh">Chinese</option>
        </select>
      </div>

      {/* Gender */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          value={filters.gender || ''}
          onChange={(e) => updateFilter('gender', e.target.value)}
        >
          <option value="">Any</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {/* Age Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Age Range</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Min</label>
            <input
              type="number"
              min="13"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              value={filters.ageMin || ''}
              onChange={(e) => updateFilter('ageMin', parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Max</label>
            <input
              type="number"
              min="13"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              value={filters.ageMax || ''}
              onChange={(e) => updateFilter('ageMax', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* Verification Status */}
      <div className="flex items-center">
        <input
          id="verified-only"
          type="checkbox"
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          checked={filters.isVerified || false}
          onChange={(e) => updateFilter('isVerified', e.target.checked)}
        />
        <label htmlFor="verified-only" className="ml-2 text-sm text-gray-700">
          Verified accounts only
        </label>
      </div>

      {/* Contact Details */}
      <div className="flex items-center">
        <input
          id="has-email"
          type="checkbox"
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          checked={filters.hasEmailMust || false}
          onChange={(e) => updateFilter('hasEmailMust', e.target.checked)}
        />
        <label htmlFor="has-email" className="ml-2 text-sm text-gray-700">
          Must have email contact
        </label>
      </div>
    </div>
  );
}