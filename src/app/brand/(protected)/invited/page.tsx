'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  Loader2,
  AlertCircle,
  X,
  Send,
  Paperclip,
  Mail,
} from 'lucide-react';
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

  // Compose modal state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] =
    useState<Invitation | null>(null);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeError, setComposeError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const composeToDisplay = selectedInvitation?.handle ?? '';

  // Read brandId once (alias/relay handled by backend now)
  useEffect(() => {
    try {
      const storedBrandId =
        window.localStorage.getItem('brandId') ||
        window.localStorage.getItem('brand_id');

      if (!storedBrandId) {
        setError('Missing brandId in localStorage');
      }

      setBrandId(storedBrandId || null);
    } catch {
      setBrandId(null);
      setError('Unable to read brandId from localStorage');
    }
  }, []);

  // Fetch invitations (currently using status: 'all')
  useEffect(() => {
    if (!brandId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await listInvitations({
          brandId: brandId || undefined,
          page: 1,
          limit: 100,
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

  const openComposeForInvitation = async (inv: Invitation) => {
    setSelectedInvitation(inv);
    setComposeError(null);
    setIsComposeOpen(true);

    // If there's no campaign, fall back to simple template
    if (!inv.campaignId) {
      const subjectBase = 'Collaboration opportunity';
      const subject = inv.campaignName
        ? `${subjectBase} – ${inv.campaignName}`
        : subjectBase;

      setComposeSubject(subject);

      const bodyTemplate = `Hi ${inv.handle},

We’re excited about your content and would love to collaborate${inv.campaignName ? ` on our "${inv.campaignName}" campaign` : ''
        }.

[Add your brief, deliverables, timelines, and budget details here]

Looking forward to hearing from you,
CollabGlam Brand Team
`;
      setComposeBody(bodyTemplate);
      return;
    }

    try {
      // You can show a small "loading template..." state if you want
      const res = await post<{
        success: boolean;
        subject: string;
        textBody: string;
      }>('/emails/campaign-invitation/preview', {
        brandId,
        campaignId: inv.campaignId,
        invitationId: inv.invitationId,
      });

      setComposeSubject(res.subject || '');
      // Use text version in the textarea by default
      setComposeBody(res.textBody || '');
    } catch (err: any) {
      console.error('Failed to fetch invitation template:', err);
      // Fallback to your old minimal template if preview fails
      const subjectBase = 'Collaboration opportunity';
      const subject = inv.campaignName
        ? `${subjectBase} – ${inv.campaignName}`
        : subjectBase;

      setComposeSubject(subject);

      const bodyTemplate = `Hi ${inv.handle},

We’re excited about your content and would love to collaborate${inv.campaignName ? ` on our "${inv.campaignName}" campaign` : ''
        }.

[Add your brief, deliverables, timelines, and budget details here]

Looking forward to hearing from you,
CollabGlam Brand Team
`;
      setComposeBody(bodyTemplate);
    }
  };

  const handleSend = async () => {
    if (!selectedInvitation) {
      setComposeError('No creator selected.');
      return;
    }
    if (!composeSubject.trim() || !composeBody.trim()) {
      setComposeError('Please add both subject and message.');
      return;
    }
    if (!brandId) {
      setComposeError('Missing brandId. Please ensure a brand is selected.');
      return;
    }

    setIsSending(true);
    setComposeError(null);

    try {
      // New architecture: let backend resolve emails using IDs & metadata
      await post('/emails/campaign-invitation', {
        brandId,
        invitationId: selectedInvitation.invitationId,
        campaignId: selectedInvitation.campaignId || undefined,
        handle: selectedInvitation.handle, // optional, for logging/template
        platform: selectedInvitation.platform, // optional
        subject: composeSubject.trim(),
        body: composeBody.trim(),
      });

      setIsComposeOpen(false);
      setSelectedInvitation(null);
    } catch (err: any) {
      console.error(err);
      setComposeError(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to send email'
      );
    } finally {
      setIsSending(false);
    }
  };

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
                    <Th className="text-right pr-6">Action</Th>
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

                        {/* Action */}
                        <Td className="text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (!isInvited && !isSending) {
                                openComposeForInvitation(inv);
                              }
                            }}
                            disabled={isInvited || isSending}
                            className={`
                              inline-flex items-center gap-1.5 rounded-full border border-orange-200 px-3 py-1 
                              text-xs font-medium transition-colors
                              ${isInvited || isSending
                                ? 'bg-orange-50 text-orange-300 cursor-not-allowed opacity-60'
                                : 'bg-orange-50 text-orange-700 hover:bg-orange-100 cursor-pointer'
                              }
                            `}
                          >
                            <Mail className="w-3 h-3" />
                            Send Email
                          </button>
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

      {/* Compose Email Modal */}
      {isComposeOpen && selectedInvitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm px-4">
          <div className="bg-white/95 w-full max-w-2xl rounded-2xl shadow-2xl border border-orange-100 flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-white via-white to-[#FFF3E1]">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#FFA135] to-[#FF7236] flex items-center justify-center text-white shadow-md">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Compose Email
                  </h2>
                  <p className="text-xs text-gray-500">
                    Send collaboration offers directly to your creator pipeline.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-3 overflow-y-auto">
              {/* From (no real email shown / sent) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-500">
                  From
                </label>
                <input
                  type="text"
                  value="Your brand email alias is applied automatically via the relay. Creators never see your real email."
                  readOnly
                  className="w-full text-[11px] px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700"
                />
              </div>

              {/* To */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-500">
                  To
                </label>
                <input
                  type="text"
                  value={composeToDisplay}
                  readOnly
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700"
                />
                <p className="text-[10px] text-gray-400">
                  This message will be sent to this creator via your email
                  relay. The backend uses the invitation ID to resolve the
                  contact.
                </p>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-500">
                  Subject
                </label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Collaboration for your upcoming content"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FFA135] focus:border-[#FFA135]"
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-500">
                  Message
                </label>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  placeholder={`Hi ${selectedInvitation.handle},

We’re excited about your content and would love to collaborate on an upcoming campaign.

[Add your brief, deliverables, timelines, and budget details here]

Looking forward to hearing from you,
CollabGlam Brand Team`}
                  rows={8}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FFA135] focus:border-[#FFA135] resize-none"
                />
              </div>

              {composeError && (
                <p className="text-[11px] text-red-500">{composeError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/80">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-100 text-gray-600"
                >
                  <Paperclip className="w-3 h-3" />
                  Attach
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-100 text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-full border border-orange-200 bg-white hover:bg-orange-50 text-[#FF7236]"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending}
                  className="inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Send className="w-3 h-3" />
                  {isSending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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