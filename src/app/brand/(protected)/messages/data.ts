// File: app/brand/(protected)/messages/data.ts
import { get } from "@/lib/api";

export interface Influencer {
  id: string;
  name: string;
}

interface RawInfluencer {
  influencerId: string;
  name: string;
}