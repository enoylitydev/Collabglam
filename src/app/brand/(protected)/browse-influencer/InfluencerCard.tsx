// src/app/brand/(protected)/browse-influencer/InfluencerCard.tsx
import React from "react";
import { MapPin, Users, CheckCircle, ExternalLink, Lock } from "lucide-react";
import type { Platform } from "./filters";
import { platformTheme } from "./utils/platform";

interface InfluencerCardProps {
  platform: Platform;
  influencer: any;
  onViewProfile?: (influencer: any) => void;
}

export function InfluencerCard({ platform, influencer, onViewProfile }: InfluencerCardProps) {
  const platformKey: Platform = (influencer?.platform as Platform) || platform;
  const theme = platformTheme[platformKey];

  const username =
    influencer?.username || influencer?.handle || influencer?.name || "unknown";
  const handle = username.startsWith("@") ? username : `@${username}`;
  const displayName =
    influencer?.fullname ||
    influencer?.fullName ||
    influencer?.name ||
    username ||
    "Unknown Creator";

  const followers =
    influencer?.followers ??
    influencer?.followerCount ??
    influencer?.stats?.followers ??
    0;

  const engagementRate =
    influencer?.engagementRate ?? influencer?.stats?.engagementRate ?? 0;

  const engagements =
    influencer?.engagements ??
    influencer?.stats?.avgEngagements ??
    influencer?.stats?.avgLikes;

  const averageViews = influencer?.averageViews ?? influencer?.stats?.avgViews;
  const location = influencer?.location || influencer?.country || influencer?.city;
  const avatar =
    influencer?.picture ||
    influencer?.avatar ||
    influencer?.profilePicUrl ||
    influencer?.thumbnail;

  const isVerified = Boolean(influencer?.isVerified || influencer?.verified);
  const isPrivate = Boolean(influencer?.isPrivate);
  const profileUrl = influencer?.url || "#";
  const bio = influencer?.bio || influencer?.description || "";

  const formatNumber = (num?: number) => {
    if (num == null) return "—";
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatRate = (rate?: number) =>
    rate == null ? "—" : `${(rate * 100).toFixed(2)}%`;

  return (
    <div className="w-full h-full bg-white rounded-2xl border border-gray-200 hover:shadow-lg transition-all duration-200 overflow-hidden group flex flex-col">
      {/* Header */}
      <a
        href={profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${theme.color} px-4 py-3 sm:px-5 sm:py-3 text-white relative block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white/70`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 bg-white/20 rounded-md flex items-center justify-center">
              {theme.icon}
            </div>
            {/* smaller, lighter */}
            <span className="font-medium text-[13px] sm:text-sm truncate">
              {theme.label}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {isPrivate && (
              <span
                className="flex items-center bg-white/20 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium"
                aria-label="Private account"
                title="Private account"
              >
                <Lock className="w-3 h-3 mr-1" />
                Private
              </span>
            )}
            {isVerified && (
              <span
                className="flex items-center bg-white/20 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium"
                aria-label="Verified account"
                title="Verified account"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Verified
              </span>
            )}
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </a>

      {/* Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        {/* Avatar + name */}
        <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
          {avatar ? (
            <img
              src={avatar}
              loading="lazy"
              alt={`${displayName} avatar`}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-gray-200"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIyMCIgZmlsbD0iI0YzRjRGNiIvPjwvc3ZnPg==';
              }}
            />
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-200 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-gray-400" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* smaller + lighter */}
            <h3 className="font-semibold text-gray-900 text-sm sm:text-[15px] md:text-base truncate">
              {displayName}
            </h3>
            <p className="text-gray-600 text-[11px] sm:text-xs md:text-sm truncate">
              {handle}
            </p>

            {location && (
              <div className="flex items-center mt-1 text-[10px] sm:text-xs md:text-[13px] text-gray-500 min-w-0">
                <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            )}

            {bio && (
              <p className="text-[11px] sm:text-xs text-gray-600 mt-2 line-clamp-2">
                {bio}
              </p>
            )}
          </div>
        </div>

        {/* Metrics (smaller numbers + normal labels) */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center mb-4 sm:mb-5">
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 leading-none whitespace-nowrap tracking-tight text-sm sm:text-base md:text-lg">
              {formatNumber(followers)}
            </div>
            <div className="mt-1 text-[10px] sm:text-xs text-gray-500">Followers</div>
          </div>

          <div className="min-w-0">
            <div
              className="font-semibold text-gray-900 leading-none whitespace-nowrap tracking-tight text-sm sm:text-base md:text-lg"
              title={`${formatNumber(engagements)} engagements`}
            >
              {formatRate(engagementRate)}
            </div>
            <div className="mt-1 text-[10px] sm:text-xs text-gray-500">Engagement</div>
          </div>

          <div className="min-w-0">
            <div className="font-semibold text-gray-900 leading-none whitespace-nowrap tracking-tight text-sm sm:text-base md:text-lg">
              {averageViews == null ? "—" : formatNumber(averageViews)}
            </div>
            <div className="mt-1 text-[10px] sm:text-xs text-gray-500">Avg. Views</div>
          </div>
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={() => onViewProfile ? onViewProfile(influencer) : window.open(profileUrl, '_blank', 'noopener,noreferrer')}
          className="mt-auto w-full inline-flex items-center justify-center px-4 py-2 sm:py-2.5 bg-gray-900 text-white text-sm sm:text-[15px] font-medium rounded-lg hover:bg-gray-800 transition-colors group"
        >
          View Profile
          <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}
