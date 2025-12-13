'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { HiInboxIn, HiMail, HiSearch } from 'react-icons/hi';
import { X, CornerUpLeft, Send } from 'lucide-react';
import { get, post } from '@/lib/api';

type MailDirection = 'incoming' | 'outgoing';

interface Mail {
  id: string;
  direction: MailDirection;
  from: string;
  to: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  time: string;
  tags?: string[];
  isRead?: boolean;
  threadId: string;
  influencerId: string;
  brandId: string;
  createdAt: string;
  campaignLink?: string | null;
}


type FilterType = 'all' | 'incoming' | 'outgoing';

const InfluencerEmailPage: React.FC = () => {
  const [influencerId, setInfluencerId] = useState<string>('');
  const [mails, setMails] = useState<Mail[]>([]);
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const [composeFrom, setComposeFrom] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeThreadId, setComposeThreadId] = useState<string | null>(null);
  const [composeBrandId, setComposeBrandId] = useState<string | null>(null);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const stripHtml = (html: string): string => {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, '');
  };

  // 1) Determine influencerId (from localStorage or env)
  useEffect(() => {
    let resolved = '';

    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('influencerId');
      resolved = stored || process.env.NEXT_PUBLIC_INFLUENCER_ID || '';
    } else {
      resolved = process.env.NEXT_PUBLIC_INFLUENCER_ID || '';
    }

    setInfluencerId(resolved);
  }, []);

  // 2) Load threads + messages for this influencer
  useEffect(() => {
    if (!influencerId) return;

    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        const threadsJson = await get<any>(
          `/emails/threads/influencer/${influencerId}`
        );
        const threads: any[] =
          threadsJson?.threads || threadsJson?.data || threadsJson || [];

        const allMails: Mail[] = [];

        for (const thread of threads) {
          const threadId: string = thread._id;

          const brandId: string =
            thread.brand?._id ||
            thread.brandId ||
            (thread.brand && thread.brand.brandId) ||
            '';

          const influencerIdForMail: string =
            thread.influencer?._id || influencerId;

          // Aliases (display only – no real emails)
          const brandAliasForDisplay: string =
            thread.brandDisplayAlias || thread.brandAliasEmail;

          const influencerAliasForDisplay: string =
            thread.influencerDisplayAlias ||
            thread.influencerAliasEmail ||
            `influencer@${
              process.env.NEXT_PUBLIC_EMAIL_RELAY_DOMAIN || 'collabglam.cloud'
            }`;

          let messages: any[] = [];
          try {
            const msgsJson = await get<any>(`/emails/messages/${threadId}`);
            messages =
              msgsJson?.messages || msgsJson?.data || msgsJson || [];
          } catch (err) {
            console.error(
              'Failed to fetch messages for thread (influencer view)',
              threadId,
              err
            );
            continue;
          }

          for (const msg of messages) {
            const created = new Date(msg.createdAt);
            const date = created.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const time = created.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            });

            const rawBody: string =
              msg.textBody || stripHtml(msg.htmlBody || '');
            const body = rawBody.trim();
            const preview =
              body.slice(0, 120) + (body.length > 120 ? '…' : '');

            // From influencer perspective:
            // brand_to_influencer -> incoming
            // influencer_to_brand -> outgoing
            const direction: MailDirection =
              msg.direction === 'brand_to_influencer'
                ? 'incoming'
                : 'outgoing';

            const from =
              direction === 'incoming'
                ? brandAliasForDisplay
                : influencerAliasForDisplay;

            const to =
              direction === 'incoming'
                ? influencerAliasForDisplay
                : brandAliasForDisplay;

            const mail: Mail = {
              id: msg._id,
              direction,
              from,
              to,
              subject: msg.subject,
              preview,
              body,
              date,
              time,
              tags:
                direction === 'incoming'
                  ? ['From brand']
                  : ['Sent by you'],
              isRead: true,
              threadId,
              influencerId: influencerIdForMail,
              brandId,
              createdAt: msg.createdAt,
              campaignLink: msg.campaignLink || null,
            };

            allMails.push(mail);
          }
        }

        allMails.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime()
        );

        setMails(allMails);
        if (allMails.length > 0 && !selectedMailId) {
          setSelectedMailId(allMails[0].id);
        }
      } catch (err: any) {
        console.error('Error loading influencer mails:', err);
        setLoadError(err?.message || 'Failed to load emails');
      } finally {
        setIsLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [influencerId]);

  const filteredMails = useMemo(() => {
    let result = [...mails];

    if (filter !== 'all') {
      result = result.filter((m) => m.direction === filter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (m) =>
          m.subject.toLowerCase().includes(q) ||
          m.from.toLowerCase().includes(q) ||
          m.to.toLowerCase().includes(q) ||
          m.preview.toLowerCase().includes(q)
      );
    }

    return result;
  }, [mails, filter, searchTerm]);

  const selectedMail =
    mails.find((m) => m.id === selectedMailId) || filteredMails[0] || null;

  useEffect(() => {
    if (!selectedMail && filteredMails.length > 0) {
      setSelectedMailId(filteredMails[0].id);
    }
  }, [filteredMails, selectedMail]);

  const openReplyCompose = (mail: Mail) => {
    // from influencer perspective:
    // incoming: from=brand alias, to=influencer alias
    // outgoing: from=influencer alias, to=brand alias
    const influencerAlias =
      mail.direction === 'incoming' ? mail.to : mail.from;
    const brandAlias =
      mail.direction === 'incoming' ? mail.from : mail.to;

    const subject = mail.subject.startsWith('Re:')
      ? mail.subject
      : `Re: ${mail.subject}`;

    const quoted = `\n\n---\nOn ${mail.date} at ${mail.time}, ${mail.from} wrote:\n${mail.body}`;

    setComposeFrom(influencerAlias);
    setComposeTo(brandAlias);
    setComposeSubject(subject);
    setComposeBody(quoted);
    setComposeThreadId(mail.threadId);
    setComposeBrandId(mail.brandId);
    setComposeError(null);
    setIsComposeOpen(true);
  };

  const handleReply = () => {
    if (!selectedMail) return;
    openReplyCompose(selectedMail);
  };

  const handleSend = async () => {
    if (!composeSubject.trim() || !composeBody.trim()) {
      setComposeError('Please fill Subject and Message before sending.');
      return;
    }

    if (!influencerId) {
      setComposeError(
        'Missing influencerId. Please ensure you are logged in as an influencer.'
      );
      return;
    }

    if (!composeBrandId || !composeThreadId) {
      setComposeError(
        'Missing thread/brand context. Please reply from an existing email.'
      );
      return;
    }

    try {
      setIsSending(true);
      setComposeError(null);

      const payload = {
        brandId: composeBrandId,
        influencerId,
        subject: composeSubject.trim(),
        body: composeBody.trim(),
      };

      const data = await post<any>('/emails/influencer-to-brand', payload);

      const now = new Date();
      const date = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const time = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });

      const body = composeBody.trim();
      const preview =
        body.slice(0, 120) + (body.length > 120 ? '…' : '');

      // From/to aliases (UI only)
      const fromAlias =
        data.influencerDisplayAlias ||
        data.influencerAliasEmail ||
        composeFrom ||
        'influencer@collabglam.cloud';

      const toAlias =
        data.brandDisplayAlias ||
        data.brandAliasEmail ||
        composeTo ||
        'brand@collabglam.cloud';

      const newMail: Mail = {
        id: data.messageId || `${composeThreadId}-${Date.now()}`,
        direction: 'outgoing',
        from: fromAlias,
        to: toAlias,
        subject: composeSubject.trim(),
        preview,
        body,
        date,
        time,
        tags: ['Sent by you'],
        isRead: true,
        threadId: data.threadId || composeThreadId || '',
        influencerId,
        brandId: composeBrandId,
        createdAt: now.toISOString(),
      };

      setMails((prev) => [newMail, ...prev]);
      setSelectedMailId(newMail.id);
      setFilter('all');
      setIsComposeOpen(false);
    } catch (err: any) {
      console.error('Error sending reply:', err);
      setComposeError(err?.message || 'Failed to send reply');
    } finally {
      setIsSending(false);
    }
  };

  const totalIncoming = mails.filter((m) => m.direction === 'incoming').length;
  const totalOutgoing = mails.filter((m) => m.direction === 'outgoing').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF6EB] via-white to-[#FFE7DB]">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 border border-orange-100 shadow-sm">
              <span className="inline-flex h-2 w-2 rounded-full bg-[#FF7236] animate-pulse" />
              <span className="text-xs font-medium text-gray-700">
                Influencer Inbox — reply to brand outreach
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
              Email Center
            </h1>
            <p className="text-sm text-gray-600 max-w-xl">
              View emails brands have sent you via CollabGlam and reply directly
              from your influencer portal.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                From brands • {totalIncoming}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                Your replies • {totalOutgoing}
              </span>
            </div>
          </div>

          {/* ❌ No "Compose" button here – influencers cannot start new emails */}
          <div className="text-xs text-gray-500 md:text-right">
            <p className="font-medium">Reply-only mode</p>
            <p>Brands initiate the conversation. You can respond here.</p>
          </div>
        </div>

        {/* Main email panel */}
        <div className="bg-white/90 border border-orange-100/70 shadow-[0_18px_45px_rgba(255,163,53,0.18)] rounded-3xl overflow-hidden flex flex-col md:flex-row">
          {/* Left: list */}
          <div className="md:w-[38%] border-b md:border-b-0 md:border-r border-gray-100 bg-gradient-to-b from-white to-[#FFF9F2] flex flex-col">
            {/* Search + Filters */}
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="flex items-center gap-2 bg-white rounded-full px-3 py-2 border border-gray-100 shadow-sm">
                <HiSearch className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by subject, brand, or text..."
                  className="w-full bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400"
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">Filter:</span>
                <div className="inline-flex bg-gray-50 rounded-full p-1 border border-gray-100">
                  {(['all', 'incoming', 'outgoing'] as FilterType[]).map((f) => {
                    const isActive = filter === f;
                    const labels: Record<FilterType, string> = {
                      all: 'All',
                      incoming: 'From brands',
                      outgoing: 'Your replies',
                    };
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white shadow-sm'
                            : 'text-gray-600 hover:bg-white'
                        }`}
                      >
                        {labels[f]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mail list */}
            <div className="flex-1 overflow-y-auto max-h-[60vh] md:max-h-[70vh]">
              {!influencerId ? (
                <div className="h-full flex flex-col items-center justify-center px-6 py-10 text-center text-gray-500 text-sm">
                  <HiInboxIn className="w-8 h-8 mb-2 text-gray-300" />
                  <p>Influencer context missing.</p>
                  <p className="text-xs mt-1">
                    Set{' '}
                    <code className="font-mono">
                      NEXT_PUBLIC_INFLUENCER_ID
                    </code>{' '}
                    or store{' '}
                    <code className="font-mono">influencerId</code> in{' '}
                    <code className="font-mono">localStorage</code>.
                  </p>
                </div>
              ) : isLoading ? (
                <div className="h-full flex flex-col items-center justify-center px-6 py-10 text-center text-gray-500 text-sm">
                  <HiInboxIn className="w-8 h-8 mb-2 text-gray-300 animate-pulse" />
                  <p>Loading your emails…</p>
                </div>
              ) : loadError ? (
                <div className="h-full flex flex-col items-center justify-center px-6 py-10 text-center text-red-500 text-sm">
                  <p>{loadError}</p>
                </div>
              ) : filteredMails.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center px-6 py-10 text-center text-gray-500 text-sm">
                  <HiInboxIn className="w-8 h-8 mb-2 text-gray-300" />
                  <p>No emails yet from brands.</p>
                  <p className="text-xs mt-1">
                    Once a brand contacts you via CollabGlam, the conversation
                    will appear here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredMails.map((mail) => {
                    const isActive = mail.id === selectedMailId;
                    const isIncoming = mail.direction === 'incoming';
                    return (
                      <li key={mail.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedMailId(mail.id)}
                          className={`w-full text-left px-4 py-3 flex flex-col gap-1 transition-all ${
                            isActive
                              ? 'bg-gradient-to-r from-[#FFF1DF] to-[#FFE0D0]'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {!mail.isRead && (
                                <span className="h-1.5 w-1.5 rounded-full bg-[#FF7236]" />
                              )}
                              <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                                {mail.subject}
                              </p>
                            </div>
                            <span className="text-[11px] text-gray-500">
                              {mail.time}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-gray-600 line-clamp-1">
                              {isIncoming ? mail.from : mail.to}
                            </p>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                isIncoming
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              }`}
                            >
                              {isIncoming ? 'From brand' : 'You replied'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {mail.preview}
                          </p>
                          {mail.tags && mail.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {mail.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/90 border border-gray-100 text-gray-500"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right: detail */}
          <div className="flex-1 flex flex-col bg-white">
            {selectedMail ? (
              <>
                <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-gray-50 px-2.5 py-1 border border-gray-100 mb-2">
                        <HiMail className="w-4 h-4 text-[#FF7236]" />
                        <span className="text-[11px] font-medium text-gray-700">
                          {selectedMail.direction === 'incoming'
                            ? 'From brand via CollabGlam'
                            : 'Your reply via CollabGlam'}
                        </span>
                      </div>
                      <h2 className="text-lg md:text-xl font-semibold text-gray-900">
                        {selectedMail.subject}
                      </h2>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>{selectedMail.date}</p>
                      <p>{selectedMail.time}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 pt-1">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">From:</span>
                      <span className="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100">
                        {selectedMail.from}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">To:</span>
                      <span className="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100">
                        {selectedMail.to}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3">
                    <button
                      type="button"
                      onClick={handleReply}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-[#FF7236] hover:text-[#FF7236] transition-colors"
                    >
                      <CornerUpLeft className="w-3 h-3" />
                      Reply
                    </button>
                    {/* No Forward / Compose on influencer side */}
                  </div>
                </div>

                {selectedMail?.campaignLink && (
  <div className="px-5 pt-4">
    <a
      href={selectedMail.campaignLink}
      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold
                 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 shadow-sm hover:shadow-md"
    >
      View Campaign
    </a>
  </div>
)}


                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <div className="bg-gray-50/70 border border-gray-100 rounded-2xl px-4 py-4 text-sm text-gray-800 whitespace-pre-line leading-relaxed shadow-sm">
                    {selectedMail.body}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 text-gray-500">
                <HiInboxIn className="w-10 h-10 mb-2 text-gray-300" />
                <p className="text-sm font-medium">
                  No email selected yet.
                </p>
                <p className="text-xs mt-1">
                  Choose an email from the left to read it or reply.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reply-only compose modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-orange-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#FFA135] to-[#FF7236] flex items-center justify-center text-white shadow-md">
                  <HiMail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    Reply to brand
                  </h2>
                  <p className="text-xs text-gray-500">
                    Your reply will be sent via CollabGlam’s email relay. Brands
                    see your reply from a protected address.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-3 overflow-y-auto">
              {/* From */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-500">
                  From
                </label>
                <input
                  type="email"
                  value={composeFrom || 'influencer@collabglam.cloud'}
                  readOnly
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700"
                />
              </div>

              {/* To */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-500">
                  To
                </label>
                <input
                  type="email"
                  value={composeTo}
                  readOnly
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700"
                />
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
              </div>

              {composeError && (
                <p className="text-[11px] text-red-500">{composeError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/80">
              <div className="text-[10px] text-gray-400">
                Replies are linked to the same thread with the brand.
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
                  onClick={handleSend}
                  disabled={isSending}
                  className="inline-flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Send className="w-3 h-3" />
                  {isSending ? 'Sending…' : 'Send reply'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InfluencerEmailPage;
