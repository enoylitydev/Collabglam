export const API_ENDPOINTS = {
  MEDIA_KIT_GET: "/media-kit/influencer",
  MEDIA_KIT_UPDATE: "/media-kit/update",
  COUNTRIES_GET_ALL: "/country/getall",
  AUDIENCE_RANGES_GET_ALL: "/audienceRange/getall",
} as const;

export const VALIDATION_RULES = {
  MIN_FOLLOWERS: 0,
  MAX_FOLLOWERS: Number.MAX_SAFE_INTEGER,
  MIN_ENGAGEMENT_RATE: 0,
  MAX_ENGAGEMENT_RATE: 100,
  MAX_BIO_LENGTH: 1000,
  MAX_NAME_LENGTH: 100,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

export const COLORS = {
  PRIMARY_GRADIENT: "from-[#FFBF00] to-[#FFDB58]",
  PRIMARY_HOVER: "from-[#E6AC00] to-[#E6C247]",
  SUCCESS: "#10B981",
  ERROR: "#EF4444",
} as const;