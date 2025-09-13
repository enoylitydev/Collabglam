import React from 'react';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { InfluencerRow } from '../types';
import { Platform } from '../types';
import { guessPlatformFromName } from '../utils';

interface InfluencersTableProps {
  influencers: InfluencerRow[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onViewInfluencer: (id: string, platform: Platform) => void;
  onMessageInfluencer: (id: string) => void;
}

export const InfluencersTable = React.memo<InfluencersTableProps>(({
  influencers,
  loading,
  error,
  currentPage,
  totalPages,
  onPageChange,
  onViewInfluencer,
  onMessageInfluencer,
}) => {
  const handlePrevPage = () => {
    onPageChange(Math.max(1, currentPage - 1));
  };

  const handleNextPage = () => {
    onPageChange(Math.min(totalPages, currentPage + 1));
  };

  return (
    <div className="flex-1 overflow-x-auto overflow-y-auto px-6 pb-6 mt-6">
      <Table className="min-w-full border rounded-lg bg-white">
        <TableHeader className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white sticky top-0 z-[5]">
          <TableRow>
            <TableHead className="text-white">Influencer Name</TableHead>
            <TableHead className="text-white">Category</TableHead>
            <TableHead className="text-white">Audience Size</TableHead>
            <TableHead className="text-white">Country</TableHead>
            <TableHead className="text-white">Platform</TableHead>
            <TableHead className="text-white">Gender (M%/F%)</TableHead>
            <TableHead className="text-white">Age Group</TableHead>
            <TableHead className="text-white">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {error ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-6 text-red-600">
                {error}
              </TableCell>
            </TableRow>
          ) : loading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-6">
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-600"></div>
                  Loading influencers…
                </div>
              </TableCell>
            </TableRow>
          ) : influencers.length > 0 ? (
            influencers.map((influencer) => (
              <InfluencerRow
                key={influencer._id}
                influencer={influencer}
                onView={() => onViewInfluencer(
                  influencer.influencerId, 
                  guessPlatformFromName(influencer.platformName)
                )}
                onMessage={() => onMessageInfluencer(influencer.influencerId)}
              />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-6 text-gray-600">
                No influencers found. Try adjusting your filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Pagination */}
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
      />
    </div>
  );
});

InfluencersTable.displayName = 'InfluencersTable';

// Sub-components
interface InfluencerRowProps {
  influencer: InfluencerRow;
  onView: () => void;
  onMessage: () => void;
}

const InfluencerRow: React.FC<InfluencerRowProps> = ({ 
  influencer, 
  onView, 
  onMessage 
}) => (
  <TableRow className="hover:bg-orange-50 transition-colors">
    <TableCell className="font-medium">{influencer.name}</TableCell>
    <TableCell>
      <div className="flex flex-wrap gap-1">
        {influencer.categoryName.map((name) => (
          <Badge key={name} className="text-xs">
            {name}
          </Badge>
        ))}
      </div>
    </TableCell>
    <TableCell>{influencer.audienceRange}</TableCell>
    <TableCell>{influencer.county}</TableCell>
    <TableCell>{influencer.platformName}</TableCell>
    <TableCell>
      {influencer.audienceBifurcation?.malePercentage}% / {" "}
      {influencer.audienceBifurcation?.femalePercentage}%
    </TableCell>
    <TableCell>{influencer.audienceAgeRange}</TableCell>
    <TableCell className="space-x-2">
      <Button
        size="sm"
        onClick={onView}
        className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:opacity-90"
      >
        View
      </Button>
      <Button
        size="sm"
        onClick={onMessage}
        variant="outline"
        className="border-orange-300 text-orange-600 hover:bg-orange-50"
      >
        Message
      </Button>
    </TableCell>
  </TableRow>
);

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
}) => (
  <div className="flex justify-end items-center p-4 space-x-2">
    <button
      onClick={onPrevPage}
      disabled={currentPage === 1}
      className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      aria-label="Previous page"
    >
      ‹
    </button>
    <span className="text-gray-700 px-3">
      Page {currentPage} of {totalPages}
    </span>
    <button
      onClick={onNextPage}
      disabled={currentPage === totalPages}
      className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      aria-label="Next page"
    >
      ›
    </button>
  </div>
);