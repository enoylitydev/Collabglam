// InfluencerCard.tsx
import React from 'react';
import { MapPin, Users, TrendingUp, CheckCircle, ExternalLink, Eye, Lock } from 'lucide-react';
import type { Platform } from './filters';
import { platformTheme } from './utils/platform';

interface InfluencerCardProps {
  platform: Platform;
  influencer: any;
}

export function InfluencerCard({ platform, influencer }: InfluencerCardProps) {
  const platformKey: Platform = (influencer?.platform as Platform) || platform;
  const theme = platformTheme[platformKey];

  const username = influencer?.username || influencer?.handle || influencer?.name || 'unknown';
  const handle = username.startsWith('@') ? username : `@${username}`;
  const displayName =
    influencer?.fullname || influencer?.fullName || influencer?.name || username || 'Unknown Creator';
  const followers =
    influencer?.followers ?? influencer?.followerCount ?? influencer?.stats?.followers ?? 0;
  const engagementRate =
    influencer?.engagementRate ?? influencer?.stats?.engagementRate ?? 0; // 0..1
  const engagements =
    influencer?.engagements ?? influencer?.stats?.avgEngagements ?? influencer?.stats?.avgLikes;
  const averageViews = influencer?.averageViews ?? influencer?.stats?.avgViews;
  const reelsPlaysAvg =
    influencer?.reelsPlaysAvg ?? influencer?.stats?.reelsPlaysAvg; // IG-only (optional)
  const location = influencer?.location || influencer?.country || influencer?.city;
  const avatar =
    influencer?.picture || influencer?.avatar || influencer?.profilePicUrl || influencer?.thumbnail;
  const isVerified = Boolean(influencer?.isVerified || influencer?.verified);
  const isPrivate = Boolean(influencer?.isPrivate);
  const profileUrl = influencer?.url || '#';
  const bio = influencer?.bio || influencer?.description || '';

  const formatNumber = (num?: number) => {
    if (num == null) return '—';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatRate = (rate?: number) => {
    if (rate == null) return '—';
    return `${(rate * 100).toFixed(2)}%`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-200 overflow-hidden group">
      {/* Platform/Header */}
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${theme.color} p-4 text-white relative block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/70`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-white/20 rounded-md flex items-center justify-center">
              {theme.icon}
            </div>
            <span className="font-medium text-sm">{theme.label}</span>
          </div>

          <div className="flex items-center space-x-1">
            {isPrivate && (
              <span className="flex items-center bg-white/20 px-2 py-1 rounded-full text-xs font-medium">
                <Lock className="w-3 h-3 mr-1" />
                Private
              </span>
            )}
            {isVerified && (
              <span className="flex items-center bg-white/20 px-2 py-1 rounded-full text-xs font-medium">
                <CheckCircle className="w-3 h-3 mr-1" />
                Verified
              </span>
            )}
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </a>

      {/* Body */}
      <div className="p-6">
        {/* Top row: avatar + name/handle + location */}
        <div className="flex items-start space-x-3 mb-4">
          <div className="flex-shrink-0">
            {avatar ? (
              <img
                src={avatar}
                alt={`${displayName} avatar`}
                className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iI0YzRjRGNiIvPjxzdmcgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Qm94PSIwIDAgMTYgMTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTggOEMxMC4yMDkxIDggMTIgNi4yMDkxNCAxMiA0QzEyIDEuNzkwODYgMTAuMjA5MSAwIDggMEM1Ljc5MDg2IDAgNCAxLjc5MDg2IDQgNEM0IDYuMjA5MTQgNS43OTA4NiA4IDggOFoiIGZpbGw9IiM5Q0EzQUYiLz48cGF0aCBkPSJNOCAxMEM1LjIzOTM1IDEwIDIuOTY0NjQgMTAuOTUwNyAxLjQ2ODgzIDEyLjYxOTJDMCAxMy42ODk3IDEuMjc2NzcgMTUgMi42MTEwNyAxNUgxMy4zODg5QzE0LjcyMzIgMTUgMTUuNDYzIDEzLjY4OTcgMTQuNTMxMiAxMi42MTkyQzEzLjAzNTQgMTAuOTUwNyAxMC43NjA2IDEwIDggMTBaIiBmaWxsPSIjOUNBM0FGIi8+PC9zdmc+PC9zdmc+';
                }}
              />
            ) : (
              <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-gray-400" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <h3 className="font-semibold text-gray-900 truncate text-sm">{displayName}</h3>
            </div>
            <p className="text-xs text-gray-500 truncate">{handle}</p>
            {location && (
              <div className="flex items-center mt-1 text-xs text-gray-500">
                <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            )}
            {bio && <p className="text-xs text-gray-600 mt-2 line-clamp-2">{bio}</p>}
          </div>
        </div>

        {/* Stats */}
        <div className={`grid ${averageViews != null || (platformKey === 'instagram' && reelsPlaysAvg != null) ? 'grid-cols-3' : 'grid-cols-2'} gap-3 mb-4`}>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Followers</p>
                <p className="text-lg font-bold text-gray-900">{formatNumber(followers)}</p>
              </div>
              <Users className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium">Engagement</p>
                <p className="text-lg font-bold text-gray-900" title={`${formatNumber(engagements)} engagements`}>
                  {formatRate(engagementRate)}
                </p>
              </div>
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          {averageViews != null && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Avg. Views</p>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(averageViews)}</p>
                </div>
                <Eye className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          )}

          {/* IG-only: show Reels Plays stat if present */}
          {platformKey === 'instagram' && reelsPlaysAvg != null && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Reels Plays</p>
                  <p className="text-lg font-bold text-gray-900">{formatNumber(reelsPlaysAvg)}</p>
                </div>
                <Eye className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors group"
        >
          View Profile
          <ExternalLink className="w-3 h-3 ml-2 group-hover:translate-x-0.5 transition-transform" />
        </a>
      </div>
    </div>
  );
}
