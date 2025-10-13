export type Tab = 'login' | 'signup';
export type Role = 'brand' | 'influencer';

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

export interface Option {
  value: string;
  label: string;
}
