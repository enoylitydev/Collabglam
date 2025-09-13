import React from 'react';
import { Search, Loader2, Code } from 'lucide-react';
import { Platform } from './platform';
import { platformTheme } from './utils/platform';

interface SearchHeaderProps {
  platform: Platform;
  queryText: string;
  setQueryText: (text: string) => void;
  loading: boolean;
  onSearch: (query: string) => void;
  showDebug: boolean;
  setShowDebug: (show: boolean) => void;
}

export function SearchHeader({
  platform,
  queryText,
  setQueryText,
  loading,
  onSearch,
  showDebug,
  setShowDebug
}: SearchHeaderProps) {
  const theme = platformTheme[platform];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(queryText);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder={`Search ${theme.label} creators by keywords, hashtags, or topics...`}
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className={`inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white ${theme.color} hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 ${theme.ring} disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px] justify-center`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}