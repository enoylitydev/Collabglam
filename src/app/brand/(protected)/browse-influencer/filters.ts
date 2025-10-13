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

  // Optional extras (IG-specific noted below)
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
  country?: string;                                    // ISO code or name
  ageRange?: { min: number; max: number };
  credibility?: number;                                // 0..1
}

export interface FilterState {
  influencer: InfluencerFilters;
  audience: AudienceFilters;
}

export function createDefaultFilters(): FilterState {
  // No implicit defaults — everything is opt-in
  return {
    influencer: {},
    audience: {},
  };
}
