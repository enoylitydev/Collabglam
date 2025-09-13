import { Platform, SearchFilters, SortOption, UiSortOption } from '../types';
import { DEFAULT_LIMIT } from '../constants';

/** Helpers */
const defined = <T>(v: T | undefined | null): v is T => v !== undefined && v !== null;
const pctToRatio = (p?: number) => (defined(p) ? Math.max(0, Math.min(100, p)) / 100 : undefined);

/** Map UI sort to a safe Modash sort per platform */
export function mapUiSortToPlatformSort(ui: UiSortOption, platform: Platform): SortOption {
  // Relevance/Recent are not accepted as raw numeric sorts by Modash; map safely
  if (ui === 'followers') return { field: 'followers', direction: 'desc' };
  if (ui === 'engagement') return { field: 'engagementRate', direction: 'desc' };
  if (ui === 'recent') return { field: 'avgViews', direction: 'desc' };
  if (ui === 'relevance') return { field: 'avgLikes', direction: 'desc' };

  // Platform-specific better guesses (uncomment if you know Modash supports them in your plan):

  // Fallback
  return { field: 'followers', direction: 'desc' };
}

/** Build Modash Discovery Search `filter` from our UI `SearchFilters` */
export function buildPlatformFilter(platform: Platform, f: SearchFilters = {}) {
  const influencer: Record<string, any> = {};
  const audience: Record<string, any> = {};

  // COMMON → influencer.*
  if (defined(f.minFollowers) || defined(f.maxFollowers)) {
    influencer.followers = {};
    if (defined(f.minFollowers)) influencer.followers.min = f.minFollowers;
    if (defined(f.maxFollowers)) influencer.followers.max = f.maxFollowers;
  }

  const erMin = pctToRatio(f.minEngagement);
  if (defined(erMin)) influencer.engagementRate = { min: erMin };
  if (defined(f.verifiedOnly)) influencer.verified = !!f.verifiedOnly;

  if (f.modashGeoIds?.length) influencer.locationGeoIds = f.modashGeoIds;
  if (defined(f.location) && f.location.trim()) influencer.locationQuery = f.location.trim();
  if (defined(f.languageCode)) influencer.languageCode = f.languageCode;
  if (defined(f.lastPostedDays)) influencer.lastPostAgeDaysMax = f.lastPostedDays;
  if (f.relevanceTags?.length) influencer.relevanceTags = f.relevanceTags;
  if (defined(f.influencerGender)) influencer.gender = f.influencerGender;
  if (defined(f.ageMin) || defined(f.ageMax)) {
    influencer.ageRange = {};
    if (defined(f.ageMin)) influencer.ageRange.min = f.ageMin;
    if (defined(f.ageMax)) influencer.ageRange.max = f.ageMax;
  }
  if (defined(f.followersGrowthRate)) {
    const g = f.followersGrowthRate;
    influencer.growth = influencer.growth || {};
    influencer.growth.followers = { interval: g.interval, operator: g.operator, value: g.value };
  }
  if (defined(f.bioQuery) && f.bioQuery.trim()) influencer.bioQuery = f.bioQuery.trim();

  if (defined(f.viewsMin) || defined(f.viewsMax)) {
    influencer.avgViews = {};
    if (defined(f.viewsMin)) influencer.avgViews.min = f.viewsMin;
    if (defined(f.viewsMax)) influencer.avgViews.max = f.viewsMax;
  }

  if (defined(f.hasEmail)) influencer.hasEmail = !!f.hasEmail;
  if (f.keywords?.length) influencer.keywords = f.keywords.join(','); // Modash often expects comma-joined

  // PLATFORM-SPECIFIC
  if (platform === 'youtube') {
    if (defined(f.isOfficialArtist)) influencer.isOfficialArtist = !!f.isOfficialArtist;
    if (defined(f.viewsGrowthRate)) {
      const g = f.viewsGrowthRate;
      influencer.growth = influencer.growth || {};
      influencer.growth.views = { interval: g.interval, operator: g.operator, value: g.value };
    }
  }

  if (platform === 'tiktok') {
    if (defined(f.likesGrowthRate)) {
      const g = f.likesGrowthRate;
      influencer.growth = influencer.growth || {};
      influencer.growth.likes = { interval: g.interval, operator: g.operator, value: g.value };
    }
    if (defined(f.sharesMin) || defined(f.sharesMax)) {
      influencer.avgShares = {};
      if (defined(f.sharesMin)) influencer.avgShares.min = f.sharesMin;
      if (defined(f.sharesMax)) influencer.avgShares.max = f.sharesMax;
    }
    if (defined(f.savesMin) || defined(f.savesMax)) {
      influencer.avgSaves = {};
      if (defined(f.savesMin)) influencer.avgSaves.min = f.savesMin;
      if (defined(f.savesMax)) influencer.avgSaves.max = f.savesMax;
    }
  }

  if (platform === 'instagram') {
    if (defined(f.reelsPlaysMin) || defined(f.reelsPlaysMax)) {
      influencer.avgReelsPlays = {};
      if (defined(f.reelsPlaysMin)) influencer.avgReelsPlays.min = f.reelsPlaysMin;
      if (defined(f.reelsPlaysMax)) influencer.avgReelsPlays.max = f.reelsPlaysMax;
    }
    if (defined(f.hasSponsoredPosts)) influencer.hasSponsoredPosts = !!f.hasSponsoredPosts;
    if (f.accountTypes?.length) influencer.accountTypes = f.accountTypes;
    if (f.brands?.length) influencer.brandIds = f.brands;
    if (f.interests?.length) influencer.interestIds = f.interests;
  }

  // Audience
  if (f.audienceRelevanceTags?.length) audience.relevanceTags = f.audienceRelevanceTags;
  if (f.audienceWeightedLocations?.length) audience.locationsWeighted = f.audienceWeightedLocations;
  if (defined(f.audienceLanguage)) audience.languageWeighted = f.audienceLanguage;
  if (defined(f.audienceGender)) audience.genderWeighted = f.audienceGender;
  if (f.audienceAges?.length) audience.agesWeighted = f.audienceAges;
  if (defined(f.audienceAgeRange)) audience.ageRangeWeighted = f.audienceAgeRange;

  const filter: Record<string, any> = {};
  if (Object.keys(influencer).length) filter.influencer = influencer;
  if (Object.keys(audience).length) filter.audience = audience;

  return filter;
}

/** Build the final Modash request body */
export function buildModashRequestBody(
  platform: Platform,
  page: number,
  uiSort: UiSortOption,
  filters: SearchFilters,
) {
  const sort = mapUiSortToPlatformSort(uiSort, platform);
  const filter = buildPlatformFilter(platform, filters);

  return {
    page,
    limit: DEFAULT_LIMIT,
    calculationMethod: 'median',
    sort,   // { field, direction } — no .value for simple numeric sorts
    filter, // built above
  };
}
