'use client';

import React, { useEffect, useState } from 'react';
import { Users, Loader2, AlertCircle } from 'lucide-react';
import { post } from '@/lib/api';

// Types aligned with your Invitation model / backend
type InvitationStatus = 'invited' | 'available';

type Invitation = {
  invitationId: string;
  brandId: string;
  handle: string;
  platform: string;
  status: InvitationStatus;
  campaignId?: string | null;
  campaignName?: string | null;
  createdAt: string;
  updatedAt: string;
};

// Matches Node controller response:
// { page, limit, total, hasNext, data: docs }
type InvitationListResponse = {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  data: Invitation[];
};

type ListInvitationsRequest = {
  brandId?: string;
  handle?: string;
  platform?: string;
  status?: InvitationStatus | 'all';
  page?: number;
  limit?: number;
};

// Wrapper for backend: exports.listInvitations → /newinvitations/list
async function listInvitations(
  body: ListInvitationsRequest
): Promise<InvitationListResponse> {
  return await post<InvitationListResponse>('/newinvitations/list', body);
}

const prettyDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';

const truncateText = (value: string, max = 60) =>
  value.length > max ? `${value.slice(0, max)}…` : value;

export default function InvitedInfluencersPage() {
  const [brandId, setBrandId] = useState<string | null>(null);
  const [items, setItems] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAnyCampaign = items.some((inv) => !!inv.campaignName);

  // Read brandId once
  useEffect(() => {
    try {
      const stored =
        window.localStorage.getItem('brandId') ||
        window.localStorage.getItem('brand_id');
      if (!stored) {
        setError('Missing brandId in localStorage');
      }
      setBrandId(stored || null);
    } catch {
      setBrandId(null);
      setError('Unable to read brandId from localStorage');
    }
  }, []);

  // Fetch only "invited" records
  useEffect(() => {
    if (!brandId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await listInvitations({
          brandId: brandId || undefined, // backend treats missing brandId as "no filter"
          page: 1,
          limit: 100, // simple: first 100 invited
          status: 'all',
        });
        setItems(res.data || []);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.response?.data?.message ||
            err?.message ||
            'Failed to load All handles'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [brandId]);

  const invitedCount = items.length;

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <Users className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Invited Handles
              </h1>
              <p className="text-sm text-gray-600">
                Creators you&apos;ve reached out to, with their current invite
                status and campaign (if any).
              </p>
            </div>
          </div>

          {/* Tiny stats row */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-3 py-1">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
              {invitedCount} invited handle{invitedCount === 1 ? '' : 's'}
            </span>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Invited Influencers
            </span>
            {invitedCount > 0 && (
              <span className="text-xs text-gray-500">
                Showing first {invitedCount} invite
                {invitedCount === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="p-8 flex items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="text-gray-600 text-sm">
                Loading invited handles...
              </span>
            </div>
          )}

          {/* Empty state */}
          {!loading && items.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No invited handles yet</p>
              <p className="text-xs mt-1">
                Invite creators from the Browse Influencers page to see them
                here.
              </p>
            </div>
          )}

          {/* Table */}
          {!loading && items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <Th>Handle</Th>
                    {hasAnyCampaign && <Th>Campaign</Th>}
                    <Th>Status</Th>
                    <Th className="hidden sm:table-cell">Platform</Th>
                    <Th className="hidden md:table-cell">Invited At</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((inv) => {
                    const isInvited = inv.status === 'invited';
                    return (
                      <tr
                        key={inv.invitationId}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        {/* Handle */}
                        <Td>
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">
                              {inv.handle}
                            </span>
                            {inv.campaignName && (
                              <span className="mt-0.5 text-[11px] text-gray-400 sm:hidden">
                                {/* small hint on mobile */}
                                via campaign
                              </span>
                            )}
                          </div>
                        </Td>

                        {/* Campaign (only if any campaign exists across list) */}
                        {hasAnyCampaign && (
                          <Td>
                            {inv.campaignName ? (
                              <span
                                className="inline-flex max-w-xs items-center rounded-full bg-slate-50 border border-slate-200 px-3 py-0.5 text-xs font-medium text-slate-800 truncate"
                                title={inv.campaignName}
                              >
                                {truncateText(inv.campaignName, 65)}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs italic">
                                –  
                              </span>
                            )}
                          </Td>
                        )}

                        {/* Status */}
                        <Td>
                          <span
                            className={[
                              'inline-flex items-center rounded-full px-3 py-0.5 text-xs font-medium',
                              isInvited
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                              'border',
                            ].join(' ')}
                          >
                            {inv.status === 'invited' ? 'Pending' : inv.status}
                          </span>
                        </Td>

                        {/* Platform */}
                        <Td className="hidden sm:table-cell">
                          <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-700">
                            {inv.platform}
                          </span>
                        </Td>

                        {/* Invited At */}
                        <Td className="hidden md:table-cell">
                          <span className="text-gray-500 text-xs">
                            {prettyDate(inv.createdAt)}
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tiny hint */}
        <p className="mt-4 text-[11px] text-gray-500">
          This view is intentionally minimal: it only shows handles that are
          currently in
          <span className="font-semibold mx-1">invited</span> status.
        </p>
      </div>
    </div>
  );
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 whitespace-nowrap align-middle ${className}`}>
      {children}
    </td>
  );
}
