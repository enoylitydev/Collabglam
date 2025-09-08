import React from 'react';
import { Platform } from './platform';

interface AudienceFiltersProps {
  platforms: Platform[];
  filters: any;
  updateFilter: (path: string, value: any) => void;
}

export function AudienceFilters({ platforms, filters, updateFilter }: AudienceFiltersProps) {

  const hasInstagram = platforms.includes('instagram');

  return (
    <div className="space-y-4">
      {/* Audience Language */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Audience Language
        </label>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          value={filters.language?.id || 'en'}
          onChange={(e) => updateFilter('language', { id: e.target.value, weight: 0.2 })}
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

      {/* Audience Gender */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Audience Gender Distribution
        </label>
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">Male</span>
              <span className="text-xs text-gray-500">
                {((filters.gender?.weight || 0.5) * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              value={filters.gender?.weight || 0.5}
              onChange={(e) => updateFilter('gender', { 
                id: 'MALE', 
                weight: parseFloat(e.target.value) 
              })}
            />
          </div>
        </div>
      </div>

      {/* Age Demographics */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Primary Age Group
        </label>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          value={filters.primaryAge || '18-24'}
          onChange={(e) => updateFilter('primaryAge', e.target.value)}
        >
          <option value="13-17">13-17</option>
          <option value="18-24">18-24</option>
          <option value="25-34">25-34</option>
          <option value="35-44">35-44</option>
          <option value="45-54">45-54</option>
          <option value="55-64">55-64</option>
          <option value="65+">65+</option>
        </select>
      </div>

      {/* Credibility Score (Instagram only) */}
      {hasInstagram && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Min Audience Credibility
          </label>
          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              value={filters.credibility || 0.75}
              onChange={(e) => updateFilter('credibility', parseFloat(e.target.value))}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0%</span>
              <span className="font-medium">
                {((filters.credibility || 0.75) * 100).toFixed(0)}%
              </span>
              <span>100%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}