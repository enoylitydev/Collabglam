// filters.ts
export type Platform = 'youtube' | 'instagram' | 'tiktok';
export type GenderId = 'MALE' | 'FEMALE' | 'NON_BINARY';

export interface InfluencerFilters {
  followersMin?: number;
  followersMax?: number;

  engagementRate?: number;         // 0..1
  language?: string;
  gender?: GenderId;

  ageMin?: number;
  ageMax?: number;

  isVerified?: boolean;

  // New
  lastPostedWithinDays?: number;   // e.g., 90
  followerGrowthMin?: number;      // %
  followerGrowthMax?: number;      // %
  hasContactDetails?: boolean;     // email presence
  reelsPlaysMin?: number;          // IG-only
  reelsPlaysMax?: number;          // IG-only
  hasSponsoredPosts?: boolean;     // IG-only
  engagementsMin?: number;         // absolute count
  engagementsMax?: number;         // absolute count
}

export interface AudienceFilters {
  language?: { id: string; weight: number };           // weighted
  gender?: { id: GenderId; weight: number };           // weighted
  location?: string;                                   // free text city/region
  country?: string;                                    // ISO code or name (important)
  ageRange?: { min: number; max: number };
  credibility?: number;                                // 0..1
}

export interface FilterState {
  influencer: InfluencerFilters;
  audience: AudienceFilters;
}

export function createDefaultFilters(): FilterState {
  return {
    influencer: {
      followersMin: 10000,
      followersMax: 100000,
      // engagementRate: 0.02,      // optional
      language: undefined,
      gender: undefined,
      ageMin: 18,
      ageMax: 65,
      isVerified: false,

      lastPostedWithinDays: 90,     // requested default
      followerGrowthMin: undefined,
      followerGrowthMax: undefined,
      hasContactDetails: false,
      reelsPlaysMin: undefined,
      reelsPlaysMax: undefined,
      hasSponsoredPosts: false,

      engagementsMin: 5000,         // requested default
      engagementsMax: 10000,
    },
    audience: {
      language: undefined,
      gender: undefined,
      location: '',
      country: '',
      ageRange: { min: 18, max: 34 },
      credibility: 0.75,
    },
  };
}
