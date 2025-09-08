import React from 'react';
import { SlidersHorizontal, AlertCircle } from 'lucide-react';
import { InfluencerCard } from './InfluencerCard';
import { Platform } from './platform';

interface ResultsGridProps {
  platform: Platform;
  results: any[];
  loading: boolean;
  error?: string;
}

export function ResultsGrid({ platform, results, loading, error }: ResultsGridProps) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
          <p className="text-red-800 font-medium">Search Error</p>
        </div>
        <p className="text-red-700 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 animate-pulse">
            <div className="h-24 bg-gradient-to-r from-gray-200 to-gray-300 rounded-t-xl"></div>
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-6 bg-gray-200 rounded w-24"></div>
                <div className="h-6 bg-gray-200 rounded w-16"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <SlidersHorizontal className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
        <p className="text-gray-500 max-w-sm mx-auto">
          Try adjusting your filters or search terms to find more creators.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Search Results ({results.length.toLocaleString()})
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Showing influencers matching your criteria
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {results.map((influencer, index) => (
          <InfluencerCard
            key={index}
            platform={influencer.platform || platform}
            influencer={influencer}
          />
        ))}
      </div>
    </div>
  );
}