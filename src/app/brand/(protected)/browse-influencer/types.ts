// types.ts

// ============ BASIC PLATFORM & SEARCH LIST ============

export type Platform = 'instagram' | 'tiktok' | 'youtube';

/** Normalized result used by the UI */
export interface InfluencerResult {
  id: string;
  name: string;
  username: string;
  platform: Platform;
  followers: number;
  engagementRate: number; // 0..1
  avatar?: string;
  verifiedStatus?: boolean;
  location?: string;
  categories?: string[];
  link?: string;
}

/** UI sort options */
export type UiSortOption = 'relevance' | 'followers' | 'engagement' | 'recent';

/** Internal safe sort used for Modash */
export type SortField = 'followers' | 'engagementRate' | 'avgViews' | 'avgLikes';
export type SortDirection = 'asc' | 'desc';
export type SortOption = { field: SortField; direction: SortDirection };

export type Operator = 'gt' | 'lt' | 'eq';
export type GrowthInterval = 'i1month' | 'i3months' | 'i6months' | 'i12months';

export interface Weighted<T = string | number> {
  id: T;
  weight: number;
}

export interface TextTag {
  type: 'hashtag' | 'mention';
  value: string;
}

// ============ FULL UI FILTERS ============

export interface SearchFilters {
  // COMMON
  minFollowers?: number;
  maxFollowers?: number;
  minEngagement?: number; // UI percent 0..100 → 0..1
  maxEngagement?: number;
  verifiedOnly?: boolean;
  modashGeoIds?: number[];
  location?: string;
  languageCode?: string;
  lastPostedDays?: number;
  relevanceTags?: string[];
  audienceRelevanceTags?: string[];
  influencerGender?: 'MALE' | 'FEMALE';
  ageMin?: number;
  ageMax?: number;
  followersGrowthRate?: {
    interval: GrowthInterval;
    value: number;
    operator: Operator;
  };
  bioQuery?: string;
  viewsMin?: number;
  viewsMax?: number;
  hasEmail?: boolean;
  keywords?: string[];

  // YOUTUBE-ONLY
  isOfficialArtist?: boolean;
  viewsGrowthRate?: { interval: GrowthInterval; value: number; operator: Operator };

  // TIKTOK-ONLY
  likesGrowthRate?: { interval: GrowthInterval; value: number; operator: Operator };
  sharesMin?: number;
  sharesMax?: number;
  savesMin?: number;
  savesMax?: number;

  // INSTAGRAM-ONLY
  reelsPlaysMin?: number;
  reelsPlaysMax?: number;
  hasSponsoredPosts?: boolean;
  accountTypes?: number[];
  brands?: number[];
  interests?: number[];

  // Audience (weighted)
  audienceWeightedLocations?: Array<Weighted<number>>; // geo IDs w/ weight
  audienceLanguage?: Weighted<string>;
  audienceGender?: Weighted<'MALE' | 'FEMALE'>;
  audienceAges?: Array<Weighted<string>>;
  audienceAgeRange?: { min: string; max: string; weight: number };
}

export interface SearchState {
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
  noResults: boolean;
  results: InfluencerResult[];
  total: number;
  selectedPlatforms: Platform[];
  sortBy: UiSortOption;
  filters: SearchFilters;
  page: number;
  lastQuery: string;
  lastPlatforms: Platform[];
  lastRaw: any;
}

// ============ DETAIL PANEL / REPORT TYPES ============

export interface Contact {
  value: string;
  type?: string;
}

export interface Language {
  code?: string;
  name?: string;
}

/** Lightweight weighted item used by audience/affinity lists */
export interface WeightedItem {
  name?: string;
  code?: string;
  weight?: number;
}

export interface Audience {
  genders?: WeightedItem[];
  ages?: WeightedItem[];
  geoCountries?: WeightedItem[];
  languages?: WeightedItem[];
  ethnicities?: WeightedItem[];
  audienceTypes?: WeightedItem[];
  audienceReachability?: WeightedItem[];
}

// summary stuff you show in AboutSection
export interface AudienceSummary {
  notable?: number;
  credibility?: number;
}

export interface InfluencerHeader {
  picture?: string;
  fullname?: string;
  username?: string;
  handle?: string;
  url?: string;
  followers?: number;
  engagementRate?: number;
}

export interface MiniUser {
  userId: string | number;
  url?: string;
  picture?: string;
  fullname?: string;
  username?: string;
  followers?: number;
}

export interface RecentPost {
  id: string | number;
  url?: string;
  thumbnail?: string;
  image?: string;
  video?: boolean;
  title?: string;
  text?: string;
  type?: string;
  likes?: number;
  comments?: number;
  views?: number;
  hashtags?: string[];
  created?: string | number | Date;
}

export interface StatHistoryEntry {
  month: string; // e.g. "2025-01"
  avgEngagements: number;
}

/** The normalized profile object we render in the DetailPanel */
export interface InfluencerProfile {
  userId?: string | number;

  // Top "header" block
  profile?: InfluencerHeader;

  isVerified?: boolean;
  isPrivate?: boolean;

  // About
  country?: string;
  city?: string;
  state?: string;
  description?: string;
  interests?: Array<string | { name?: string; code?: string }>;
  contacts?: Contact[];
  language?: Language;
  ageGroup?: string; // used by AboutSection
  gender?: string; // used by AboutSection

  // Audience summary + breakdown
  audience?: Audience & AudienceSummary;

  // Common metrics
  avgLikes?: number;
  avgComments?: number;
  averageViews?: number;
  avgReelsPlays?: number;
  postsCount?: number;
  totalViews?: number; // YouTube
  totalLikes?: number; // TikTok

  // Affinity
  brandAffinity?: WeightedItem[];

  // Collections used in UI
  statsByContentType?: any;
  popularPosts?: RecentPost[];
  notableUsers?: MiniUser[];
  lookalikes?: MiniUser[];
  lookalikesByTopics?: MiniUser[];
  audienceLookalikes?: MiniUser[];
}

/** The normalized report object used by the UI */
export interface ReportResponse {
  profile: InfluencerProfile;
}

// ============ RAW MODASH API TYPES (FOR NORMALIZATION ONLY) ============

export interface ModashWeightedItemRaw {
  name?: string;
  code?: string;
  weight?: number;
}

export interface ModashMiniUserRaw {
  userId?: string | number;
  url?: string;
  picture?: string;
  fullname?: string;
  username?: string;
  handle?: string;
  followers?: number;
}

export interface ModashPostRaw {
  id?: string | number;
  url?: string;
  thumbnail?: string;
  image?: string;
  video?: string | boolean;
  title?: string;
  text?: string;
  type?: string;
  likes?: number;
  comments?: number;
  views?: number;
  hashtags?: string[];
  created?: string | number | Date;
}

export interface ModashStatHistoryRaw {
  month: string;
  avgLikes?: number;
  avgComments?: number;
  avgViews?: number;
  followers?: number;
  totalViews?: number;
}

export interface ModashAudienceRaw {
  genders?: ModashWeightedItemRaw[];
  ages?: ModashWeightedItemRaw[];
  geoCountries?: ModashWeightedItemRaw[];
  languages?: ModashWeightedItemRaw[];
  ethnicities?: ModashWeightedItemRaw[];
  audienceTypes?: ModashWeightedItemRaw[];
  audienceReachability?: ModashWeightedItemRaw[];

  // these sometimes live under audience
  brandAffinity?: ModashWeightedItemRaw[];
  notable?: number;
  credibility?: number;

  notableUsers?: ModashMiniUserRaw[];
  audienceLookalikes?: ModashMiniUserRaw[];
}

export interface ModashHeaderRaw {
  picture?: string;
  fullname?: string;
  username?: string;
  handle?: string;
  url?: string;
  followers?: number;
  engagementRate?: number;
  averageViews?: number;
  postsCount?: number;
  totalViews?: number;
}

export interface ModashProfileRaw {
  userId?: string | number;
  profile?: ModashHeaderRaw;

  isVerified?: boolean;
  isPrivate?: boolean;

  country?: string;
  city?: string;
  state?: string;
  description?: string;
  interests?: Array<string | { name?: string; code?: string }>;
  contacts?: Contact[];
  language?: Language;
  ageGroup?: string;
  gender?: string;

  audience?: ModashAudienceRaw;

  avgLikes?: number;
  avgComments?: number;
  averageViews?: number;
  avgReelsPlays?: number;
  postsCount?: number;
  totalViews?: number;
  totalLikes?: number;

  brandAffinity?: ModashWeightedItemRaw[];

  statsByContentType?: any;
  statHistory?: ModashStatHistoryRaw[];

  popularPosts?: ModashPostRaw[];
  recentPosts?: ModashPostRaw[];
  sponsoredPosts?: ModashPostRaw[];

  lookalikes?: ModashMiniUserRaw[];
  lookalikesByTopics?: ModashMiniUserRaw[];
}

export interface ModashReportRaw {
  error?: boolean | string;
  message?: string;
  profile?: ModashProfileRaw;
  _lastFetchedAt?: string;
}
