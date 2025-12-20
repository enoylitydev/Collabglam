'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
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
  missingEmailId?: string | null; // ✅ IMPORTANT (exists in your API response)
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

type AttachmentPayload = {
  filename: string;
  contentType: string;
  contentBase64: string;
  size: number;
};

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20MB

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

// ✅ Eligibility response from backend
type EligibilityState = 'allowed' | 'cooldown' | 'blocked' | 'missing_email';

type InvitationEligibility = {
  canSend: boolean;
  state: EligibilityState;
  reason: string;
  nextAllowedAt?: string | null;
  threadId?: string | null;
  outgoingCount?: number;
};

function formatWaitUntil(iso?: string | null) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  const ms = t - Date.now();
  if (ms <= 0) return 'now';

  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);

  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function InvitedInfluencersPage() {
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandAliasEmail, setBrandAliasEmail] = useState<string>('');
  const [items, setItems] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAnyCampaign = items.some((inv) => !!inv.campaignName);

  // ✅ eligibility cache
  const [eligibilityByInvitationId, setEligibilityByInvitationId] = useState<
    Record<string, InvitationEligibility>
  >({});

  // Compose modal state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] =
    useState<Invitation | null>(null);
  const [selectedEligibility, setSelectedEligibility] =
    useState<InvitationEligibility | null>(null);

  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeError, setComposeError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Attachments
  const [composeAttachments, setComposeAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const composeToDisplay = selectedInvitation?.handle ?? '';

  // Read brandId once
  useEffect(() => {
    try {
      const storedBrandId = window.localStorage.getItem('brandId');
      const storedAliasEmail = window.localStorage.getItem('brandAliasEmail');

      if (!storedBrandId) {
        setError('Missing brandId in localStorage');
      }

      setBrandId(storedBrandId || null);
      setBrandAliasEmail(storedAliasEmail || '');
    } catch {
      setBrandId(null);
      setError('Unable to read brandId from localStorage');
    }
  }, []);

  // Fetch invitations (status: 'all')
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
            'Failed to load invited handles'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [brandId]);

  const invitedCount = items.length;

  const resetComposeState = () => {
    setComposeSubject('');
    setComposeBody('');
    setComposeAttachments([]);
    setComposeError(null);
    setSelectedEligibility(null);
  };

  // ✅ Call backend eligibility endpoint & cache result
  const fetchEligibility = async (
    invitationId: string
  ): Promise<InvitationEligibility | null> => {
    if (!brandId || !invitationId) return null;

    try {
      const res = await post<InvitationEligibility>(
        '/newinvitations/eligibility',
        { brandId, invitationId }
      );

      setEligibilityByInvitationId((prev) => ({
        ...prev,
        [invitationId]: res,
      }));

      return res;
    } catch (err: any) {
      console.error('eligibility check failed', err);
      // don’t hard-block UI on eligibility API failure; show a soft error
      return null;
    }
  };

  // optional: prefetch eligibility for sendable invites
  useEffect(() => {
    if (!brandId) return;
    if (!items.length) return;

    const sendable = items.filter((i) => i.missingEmailId);
    const unseen = sendable.filter((i) => !eligibilityByInvitationId[i.invitationId]);

    if (!unseen.length) return;

    let cancelled = false;

    (async () => {
      // small sequential to avoid blasting server
      for (const inv of unseen.slice(0, 25)) {
        if (cancelled) return;
        await fetchEligibility(inv.invitationId);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, items]);

  const openComposeForInvitation = async (inv: Invitation) => {
    if (!brandId) {
      setError('Missing brandId');
      return;
    }

    // ✅ If there’s no MissingEmail/email linked, you can’t send anything yet
    if (!inv.missingEmailId) {
      setError(
        `No email found yet for ${inv.handle}. Wait until the system resolves the email (MissingEmailId).`
      );
      return;
    }

    // ✅ enforce rule BEFORE opening compose
    const eligibility =
      eligibilityByInvitationId[inv.invitationId] ||
      (await fetchEligibility(inv.invitationId));

    if (eligibility) {
      setSelectedEligibility(eligibility);

      if (!eligibility.canSend) {
        setError(eligibility.reason);
        return;
      }
    }

    setSelectedInvitation(inv);
    resetComposeState();
    setIsComposeOpen(true);

    // If there's no campaign, fall back to simple template
    if (!inv.campaignId) {
      const subjectBase = 'Collaboration opportunity';
      const subject = inv.campaignName
        ? `${subjectBase} – ${inv.campaignName}`
        : subjectBase;

      setComposeSubject(subject);

      const bodyTemplate = `Hi ${inv.handle},

We’re excited about your content and would love to collaborate${
        inv.campaignName ? ` on our "${inv.campaignName}" campaign` : ''
      }.

[Add your brief, deliverables, timelines, and budget details here]

Looking forward to hearing from you,
CollabGlam Brand Team
`;
      setComposeBody(bodyTemplate);
      return;
    }

    try {
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
      setComposeBody(res.textBody || '');
    } catch (err: any) {
      console.error('Failed to fetch invitation template:', err);
      const subjectBase = 'Collaboration opportunity';
      const subject = inv.campaignName
        ? `${subjectBase} – ${inv.campaignName}`
        : subjectBase;

      setComposeSubject(subject);

      const bodyTemplate = `Hi ${inv.handle},

We’re excited about your content and would love to collaborate${
        inv.campaignName ? ` on our "${inv.campaignName}" campaign` : ''
      }.

[Add your brief, deliverables, timelines, and budget details here]

Looking forward to hearing from you,
CollabGlam Brand Team
`;
      setComposeBody(bodyTemplate);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    let tooLargeCount = 0;
    const accepted: File[] = [];

    files.forEach((file) => {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        tooLargeCount += 1;
      } else {
        accepted.push(file);
      }
    });

    if (tooLargeCount > 0) {
      setComposeError(
        'Some files were too large and skipped (max size: 20MB per file).'
      );
    } else {
      setComposeError(null);
    }

    if (accepted.length) {
      setComposeAttachments((prev) => [...prev, ...accepted]);
    }

    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setComposeAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const buildAttachmentPayload = async (): Promise<AttachmentPayload[]> => {
    if (!composeAttachments.length) return [];

    const results = await Promise.all(
      composeAttachments.map(
        (file) =>
          new Promise<AttachmentPayload>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.includes(',') ? result.split(',')[1] : result;

              resolve({
                filename: file.name,
                contentType: file.type || 'application/octet-stream',
                contentBase64: base64,
                size: file.size,
              });
            };

            reader.onerror = () =>
              reject(new Error(`Failed to read attachment: ${file.name}`));

            reader.readAsDataURL(file);
          })
      )
    );

    return results;
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
    if (!selectedInvitation.missingEmailId) {
      setComposeError('No email available for this invitation yet.');
      return;
    }

    // ✅ Re-check eligibility right before sending (fresh)
    const eligibility = await fetchEligibility(selectedInvitation.invitationId);
    if (eligibility && !eligibility.canSend) {
      setComposeError(eligibility.reason);
      setSelectedEligibility(eligibility);
      return;
    }

    setIsSending(true);
    setComposeError(null);

    let attachmentsPayload: AttachmentPayload[] = [];
    try {
      attachmentsPayload = await buildAttachmentPayload();
    } catch (err: any) {
      console.error('Error preparing attachments:', err);
      setComposeError(
        err instanceof Error
          ? err.message
          : 'Failed to read attachment(s). Please try again.'
      );
      setIsSending(false);
      return;
    }

    try {
      await post('/emails/campaign-invitation', {
        brandId,
        invitationId: selectedInvitation.invitationId,
        campaignId: selectedInvitation.campaignId || undefined,
        handle: selectedInvitation.handle,
        platform: selectedInvitation.platform,
        subject: composeSubject.trim(),
        body: composeBody.trim(),
        attachments: attachmentsPayload,
      });

      setIsComposeOpen(false);
      setSelectedInvitation(null);
      setComposeAttachments([]);

      // ✅ refresh eligibility cache after sending
      await fetchEligibility(selectedInvitation.invitationId);
    } catch (err: any) {
      console.error(err);
      setComposeError(
        err?.response?.data?.message || err?.message || 'Failed to send email'
      );
    } finally {
      setIsSending(false);
    }
  };

  // small memo: show per-row status
  const rowEligibility = useMemo(() => eligibilityByInvitationId, [eligibilityByInvitationId]);

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
                Creators you&apos;ve reached out to, with invite status and campaign (if any).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-3 py-1">
              <span className="mr-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
              {invitedCount} handle{invitedCount === 1 ? '' : 's'}
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
                Showing {invitedCount} item{invitedCount === 1 ? '' : 's'}
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

          {/* Empty */}
          {!loading && items.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No invited handles yet</p>
              <p className="text-xs mt-1">
                Invite creators from the Browse Influencers page to see them here.
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
                    const elig = rowEligibility[inv.invitationId];

                    const missingEmail = !inv.missingEmailId;
                    const ruleBlocks = elig ? !elig.canSend : false;

                    const disabled = isSending || missingEmail || ruleBlocks;

                    let btnLabel = 'Send Email';
                    if (missingEmail) btnLabel = 'No Email Yet';
                    else if (elig?.state === 'cooldown') btnLabel = `Wait ${formatWaitUntil(elig.nextAllowedAt)}`;
                    else if (elig?.state === 'blocked') btnLabel = 'Blocked';

                    return (
                      <tr
                        key={inv.invitationId}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <Td>
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">
                              {inv.handle}
                            </span>

                            {/* ✅ eligibility hint */}
                            {inv.missingEmailId ? (
                              elig ? (
                                <span
                                  className={`mt-0.5 text-[11px] ${
                                    elig.state === 'allowed'
                                      ? 'text-emerald-600'
                                      : elig.state === 'cooldown'
                                        ? 'text-amber-600'
                                        : 'text-rose-600'
                                  }`}
                                  title={elig.reason}
                                >
                                  {elig.state === 'allowed'
                                    ? 'Allowed'
                                    : elig.state === 'cooldown'
                                      ? `Cooldown: ${formatWaitUntil(elig.nextAllowedAt)}`
                                      : 'Blocked until reply'}
                                </span>
                              ) : (
                                <span className="mt-0.5 text-[11px] text-gray-400">
                                  Checking rules…
                                </span>
                              )
                            ) : (
                              <span className="mt-0.5 text-[11px] text-gray-400">
                                Email not resolved yet
                              </span>
                            )}
                          </div>
                        </Td>

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
                              <span className="text-gray-400 text-xs italic">–</span>
                            )}
                          </Td>
                        )}

                        <Td>
                          <span
                            className={[
                              'inline-flex items-center rounded-full px-3 py-0.5 text-xs font-medium',
                              inv.status === 'invited'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                              'border',
                            ].join(' ')}
                          >
                            {inv.status === 'invited' ? 'Pending' : inv.status}
                          </span>
                        </Td>

                        <Td className="hidden sm:table-cell">
                          <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-700">
                            {inv.platform}
                          </span>
                        </Td>

                        <Td className="hidden md:table-cell">
                          <span className="text-gray-500 text-xs">
                            {prettyDate(inv.createdAt)}
                          </span>
                        </Td>

                        <Td className="text-right">
                          <button
                            type="button"
                            onClick={() => {
                              if (!disabled) openComposeForInvitation(inv);
                            }}
                            disabled={disabled}
                            title={
                              missingEmail
                                ? 'No email found yet for this handle'
                                : elig?.reason || undefined
                            }
                            className={`
                              inline-flex items-center gap-1.5 rounded-full border border-orange-200 px-3 py-1 
                              text-xs font-medium transition-colors
                              ${
                                disabled
                                  ? 'bg-orange-50 text-orange-300 cursor-not-allowed opacity-60'
                                  : 'bg-orange-50 text-orange-700 hover:bg-orange-100 cursor-pointer'
                              }
                            `}
                          >
                            <Mail className="w-3 h-3" />
                            {btnLabel}
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

        <p className="mt-4 text-[11px] text-gray-500">
          Rule: if a creator has never replied, you can send 1 email anytime, the 2nd only after 48 hours,
          and after 2 emails you are blocked until they reply.
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
                    Send collaboration offers to this creator via the relay.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsComposeOpen(false);
                  setComposeAttachments([]);
                }}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-3 overflow-y-auto">
              {/* Rule banner */}
              {selectedEligibility && (
                <div
                  className={[
                    'rounded-lg border px-3 py-2 text-[11px]',
                    selectedEligibility.state === 'allowed'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : selectedEligibility.state === 'cooldown'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800',
                  ].join(' ')}
                >
                  {selectedEligibility.state === 'cooldown' && selectedEligibility.nextAllowedAt ? (
                    <p>
                      {selectedEligibility.reason} (next allowed in{' '}
                      <b>{formatWaitUntil(selectedEligibility.nextAllowedAt)}</b>)
                    </p>
                  ) : (
                    <p>{selectedEligibility.reason}</p>
                  )}
                </div>
              )}

              {/* From */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-500">
                  From
                </label>
                <input
                  type="text"
                  value={brandAliasEmail}
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
                  value={selectedInvitation.handle}
                  readOnly
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700"
                />
                <p className="text-[10px] text-gray-400">
                  Backend uses invitationId to resolve the recipient email.
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
                  rows={8}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FFA135] focus:border-[#FFA135] resize-none"
                />

                {composeAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {composeAttachments.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-100 text-[11px] text-gray-700"
                      >
                        <Paperclip className="w-3 h-3" />
                        <span className="max-w-[140px] truncate">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {Math.round(file.size / 1024)} KB
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="ml-1 rounded-full hover:bg-gray-200 p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-100 text-gray-600"
                >
                  <Paperclip className="w-3 h-3" />
                  Attach
                </button>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                />
                <span className="text-[10px] text-gray-400">
                  Max 20MB per file.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsComposeOpen(false);
                    setComposeAttachments([]);
                  }}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-100 text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending || (selectedEligibility ? !selectedEligibility.canSend : false)}
                  className="inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  title={selectedEligibility?.reason}
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
