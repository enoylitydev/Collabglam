import { Platform, SearchFilters, UiSortOption } from './types';

export const PLATFORMS: Record<Platform, { label: string; gradient: string }> = {
  youtube: { label: "YouTube", gradient: "from-red-500 to-red-600" },
  tiktok: { label: "TikTok", gradient: "from-gray-800 to-black" },
  instagram: { label: "Instagram", gradient: "from-pink-500 to-purple-600" },
};

export const PAGE_SIZE = 10;

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  minFollowers: 0,
  maxFollowers: 10_000_000,
};

export const DEFAULT_UI_SORT: UiSortOption = 'followers';

export const DEFAULT_LIMIT = 5;