
export type Provider = 'youtube' | 'tiktok' | 'instagram';

export interface LanguageLite { code: string; name: string }

export interface WeightItem { code?: string; name?: string; percentage: number }
export interface SimpleNamedWeight { name: string; percentage: number }

export interface GenderSplit { male: number; female: number }

export interface AudienceSnapshot {
genderSplit: GenderSplit;
genders: WeightItem[];
ages: WeightItem[]; // code/name + percentage
topCountries: { code?: string; name?: string; percentage: number }[];
languages: WeightItem[];
interests: SimpleNamedWeight[];
credibility?: number;
audienceReachability?: WeightItem[];
audienceTypes?: WeightItem[];
ethnicities?: WeightItem[];
}

export interface CategoryLink {
categoryId: number;
categoryName: string;
subcategoryId: string; // UUID v4
subcategoryName: string;
}

export interface TagWeight { tag: string; weight: number }
export interface BrandAffinity { id: number; name: string }

export interface ProfileKit {
provider: Provider;
userId?: string;
username?: string;
fullname?: string;
handle?: string;
url?: string;
picture?: string;

followers?: number;
engagements?: number;
engagementRate?: number;
averageViews?: number;

postsCount?: number;
avgLikes?: number;
avgComments?: number;
avgViews?: number;

categories: CategoryLink[];

audience: AudienceSnapshot;
gallery: string[];

hashtags?: TagWeight[];
mentions?: TagWeight[];
brandAffinity?: BrandAffinity[];
}

export interface MediaKit {
influencerId: string;
name?: string;
email?: string;
country?: string;
city?: string;
gender?: 'Female' | 'Male' | 'Non-binary' | 'Prefer not to say' | '';
languages: LanguageLite[];
primaryPlatform?: Provider | 'other' | null;

profiles: ProfileKit[];

// Manual/collateral
mediaKitPdf?: string;
website?: string;
notes?: string;
rateCard?: string;
}

export interface ValidationError {
field: keyof MediaKit | string;
message: string;
}

// Optional: shape of the backend response for /api/media-kit/influencer (v2 controller)
export interface GetInfluencerDetailsResponse {
meta: { seeded: boolean; seededAt?: string; mediaKitUpdatedAt?: string; influencerUpdatedAt?: string };
influencer: any; // full influencer minus secrets (not strictly typed here)
mediaKit: MediaKit;
}

// Helpers
export const toNum = (v: any, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function normalizeMediaKit(input: any, fallbackInfluencerId = ''): MediaKit {
if (!input) return { influencerId: fallbackInfluencerId, profiles: [], languages: [] } as MediaKit;

// handle either direct MediaKit or the { meta, influencer, mediaKit } envelope
const kit: any = input.mediaKit ? input.mediaKit : input;

return {
influencerId: kit.influencerId ?? fallbackInfluencerId,
name: kit.name ?? input?.influencer?.name ?? '',
email: kit.email ?? input?.influencer?.email ?? '',
country: kit.country ?? input?.influencer?.country ?? '',
city: kit.city ?? input?.influencer?.city ?? '',
gender: kit.gender ?? input?.influencer?.gender ?? '',
languages: Array.isArray(kit.languages) ? kit.languages : [],
primaryPlatform: kit.primaryPlatform ?? input?.influencer?.primaryPlatform ?? null,
profiles: Array.isArray(kit.profiles) ? kit.profiles : [],
mediaKitPdf: kit.mediaKitPdf ?? '',
website: kit.website ?? '',
notes: kit.notes ?? '',
rateCard: kit.rateCard ?? ''
} as MediaKit;
}
