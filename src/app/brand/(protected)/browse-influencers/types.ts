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

export interface Weighted<T = string | number> { id: T; weight: number }
export interface TextTag { type: 'hashtag' | 'mention'; value: string }

/** FULL UI FILTERS */
export interface SearchFilters {
  // COMMON
  minFollowers?: number;           // UI range → influencer.followers.min
  maxFollowers?: number;
  minEngagement?: number;          // UI percent 0..100 → influencer.engagementRate.min (0..1)
  maxEngagement?: number;          // (not used; keep for symmetry)
  verifiedOnly?: boolean;          // influencer.verified = true
  modashGeoIds?: number[];         // influencer.locationGeoIds
  location?: string;               // fallback text search
  languageCode?: string;           // influencer.languageCode
  lastPostedDays?: number;         // influencer.lastPostAgeDaysMax
  relevanceTags?: string[];        // influencer.relevanceTags
  audienceRelevanceTags?: string[];// audience.relevanceTags
  influencerGender?: 'MALE' | 'FEMALE';
  ageMin?: number;
  ageMax?: number;
  followersGrowthRate?: { interval: GrowthInterval; value: number; operator: Operator };
  bioQuery?: string;               // influencer.bioQuery (contains)
  viewsMin?: number;               // influencer.avgViews.min
  viewsMax?: number;
  hasEmail?: boolean;              // influencer.hasEmail
  keywords?: string[];             // influencer.keywords (comma joined)

  // YOUTUBE-ONLY
  isOfficialArtist?: boolean;      // influencer.isOfficialArtist
  viewsGrowthRate?: { interval: GrowthInterval; value: number; operator: Operator };

  // TIKTOK-ONLY
  likesGrowthRate?: { interval: GrowthInterval; value: number; operator: Operator };
  sharesMin?: number;              // influencer.avgShares.min
  sharesMax?: number;
  savesMin?: number;               // influencer.avgSaves.min
  savesMax?: number;

  // INSTAGRAM-ONLY
  reelsPlaysMin?: number;          // influencer.avgReelsPlays.min
  reelsPlaysMax?: number;
  hasSponsoredPosts?: boolean;
  accountTypes?: number[];         // ids
  brands?: number[];               // ids
  interests?: number[];            // ids

  // Audience (weighted)
  audienceWeightedLocations?: Array<Weighted<number>>; // geo IDs w/ weight
  audienceLanguage?: Weighted<string>;
  audienceGender?: Weighted<'MALE' | 'FEMALE'>;
  audienceAges?: Array<Weighted<string>>;             // e.g., {id:'18-24',weight:0.3}
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
