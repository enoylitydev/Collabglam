import { useState, useCallback } from 'react';
import { post } from '@/lib/api';
import { InfluencerRow } from '../types';
import { PAGE_SIZE } from '../constants';

interface UseInfluencersDataReturn {
  influencers: InfluencerRow[];
  loading: boolean;
  error: string | null;
  totalPages: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  fetchInfluencers: () => void;
}

interface FetchParams {
  directoryQuery: string;
  tempCategories: string[];
  tempCountries: Array<{ value: string }>;
  tempPlatform: string;
  tempAgeGroup: string;
  tempAudienceSize: string;
  tempMaleSplit: string;
  tempFemaleSplit: string;
}

export function useInfluencersData(params: FetchParams): UseInfluencersDataReturn {
  const [influencers, setInfluencers] = useState<InfluencerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchInfluencers = useCallback(() => {
    setLoading(true);
    setError(null);

    const body: Record<string, unknown> = { 
      page: currentPage, 
      limit: PAGE_SIZE 
    };

    if (params.directoryQuery.trim()) body.search = params.directoryQuery.trim();
    if (params.tempCategories.length) body.categories = params.tempCategories;
    if (params.tempCountries.length) body.countryId = params.tempCountries.map((c) => c.value);
    if (params.tempPlatform !== "all") body.platformId = params.tempPlatform;
    if (params.tempAgeGroup !== "all") body.ageGroup = params.tempAgeGroup;
    if (params.tempAudienceSize !== "all") body.audienceRange = params.tempAudienceSize;
    
    if (params.tempMaleSplit !== "all") {
      const [minM, maxM] = params.tempMaleSplit.split("-").map((v) => Number(v));
      body.malePercentageMin = minM;
      body.malePercentageMax = maxM;
    }
    
    if (params.tempFemaleSplit !== "all") {
      const [minF, maxF] = params.tempFemaleSplit.split("-").map((v) => Number(v));
      body.femalePercentageMin = minF;
      body.femalePercentageMax = maxF;
    }

    post<{ success: boolean; count: number; data: InfluencerRow[] }>("/filters/getlist", body)
      .then((res) => {
        setInfluencers(res.data);
        const pages = Math.ceil(res.count / PAGE_SIZE) || 1;
        setTotalPages(pages);
      })
      .catch(() => setError("Unable to load influencers."))
      .finally(() => setLoading(false));
  }, [
    currentPage, 
    params.directoryQuery, 
    params.tempCategories, 
    params.tempCountries, 
    params.tempPlatform, 
    params.tempAgeGroup, 
    params.tempAudienceSize, 
    params.tempMaleSplit, 
    params.tempFemaleSplit
  ]);

  return {
    influencers,
    loading,
    error,
    totalPages,
    currentPage,
    setCurrentPage,
    fetchInfluencers,
  };
}