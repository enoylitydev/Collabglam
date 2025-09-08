// ============================================================================
// DirectorySearch.tsx (unchanged but with className polish)
// ============================================================================

import React from "react";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface DirectorySearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
}

export const DirectorySearch = React.memo<DirectorySearchProps>(({ query, onQueryChange, onSearch }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch();
  };

  return (
    <div className="px-6 mb-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Directory Search</h3>
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search internal directory by name or category..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-10 rounded-lg"
            />
          </div>
          <Button onClick={onSearch} size="sm" variant="outline" className="px-4 h-10 border-orange-200 text-orange-600 hover:bg-orange-50 rounded-lg">
            <SearchIcon className="w-4 h-4 mr-2" />
            Search Directory
          </Button>
        </div>
      </div>
    </div>
  );
});

DirectorySearch.displayName = "DirectorySearch";
