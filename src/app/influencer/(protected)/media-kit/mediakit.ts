export interface AudienceBifurcation {
  malePercentage: number;
  femalePercentage: number;
}

export interface CountrySlice {
  _id: string;
  name: string;
  percentage: number;
}

export interface AgeSlice {
  _id: string;
  range: string;
  percentage: number;
}

export interface MediaKit {
  influencerId: string;
  name: string;
  profileImage: string;
  bio: string;
  followers: number;
  engagementRate: number;
  platformName: string;
  categories: string[];
  audienceBifurcation: AudienceBifurcation;
  topCountries: CountrySlice[];
  ageBreakdown: AgeSlice[];
  interests: string[];
  gallery: string[];
  rateCard?: string;
  notes?: string;
  mediaKitPdf?: string;
  email?: string;
  website?: string;
}

export interface ValidationError {
  field: keyof MediaKit;
  message: string;
}

export interface Country {
  _id: string;
  countryName: string;
  callingCode: string;
  countryCode: string;
  flag: string;
}

export interface CountryOption {
  value: string;
  label: string;
  country: Country;
}

export interface AgeOption {
  value: string;
  label: string;
  _id: string;
}