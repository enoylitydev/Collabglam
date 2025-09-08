export interface InfluencerFilters {
  followersMin?: number;
  followersMax?: number;
  engagementRate?: number;
  language?: string;
  gender?: string;
  ageMin?: number;
  ageMax?: number;
  isVerified?: boolean;
  hasEmailMust?: boolean;
  keywords?: string;
}

export interface AudienceFilters {
  language?: { id: string; weight: number };
  gender?: { id: string; weight: number };
  credibility?: number;
  primaryAge?: string;
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
      engagementRate: 0.02,
      language: 'en',
      gender: 'MALE',
      ageMin: 18,
      ageMax: 35,
      isVerified: false,
      hasEmailMust: false
    },
    audience: {
      language: { id: 'en', weight: 0.2 },
      gender: { id: 'MALE', weight: 0.5 },
      credibility: 0.75,
      primaryAge: '18-24'
    }
  };
}