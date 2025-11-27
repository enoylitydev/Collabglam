'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  HiInboxIn,
  HiPaperAirplane,
  HiPlus,
  HiMail,
  HiSearch,
} from 'react-icons/hi';
import { X, Paperclip, Send, CornerUpLeft, CornerUpRight } from 'lucide-react';
import { get, post } from '@/lib/api';

type MailDirection = 'incoming' | 'outgoing';

interface Mail {
  id: string;
  direction: MailDirection;
  from: string; // display-only label: "You" or creator name
  to: string; // display-only label: "You" or creator name
  subject: string;
  preview: string;
  body: string;
  date: string; // formatted, e.g. "Nov 20, 2025"
  time: string; // formatted, e.g. "10:32 AM"
  tags?: string[];
  isRead?: boolean;
  threadId: string;
  influencerId: string;
  influencerName?: string;
  createdAt: string; // ISO from backend
}

interface InfluencerOption {
  id: string;
  name: string;
  handle?: string;
  platform?: string;
}

type FilterType = 'all' | 'incoming' | 'outgoing';

const EmailPage: React.FC = () => {
  const [brandId, setBrandId] = useState<string>('');

  const [mails, setMails] = useState<Mail[]>([]);
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeThreadId, setComposeThreadId] = useState<string | null>(null);
  const [composeInfluencerIds, setComposeInfluencerIds] = useState<string[]>(
    []
  );
  const [composeToDisplay, setComposeToDisplay] = useState(''); // reply-only label

  const [composeError, setComposeError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Influencer list for multi-select (used only for IDs + display labels)
  const [influencers, setInfluencers] = useState<InfluencerOption[]>([]);
  const [isLoadingInfluencers, setIsLoadingInfluencers] = useState(false);
  const [influencerError, setInfluencerError] = useState<string | null>(null);
  const [influencerSearch, setInfluencerSearch] = useState('');

  const stripHtml = (html: string): string => {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, '');
  };

  // 1) Determine brandId (from env or localStorage)
  useEffect(() => {
    let resolved = '';

    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('brandId');
      resolved = stored || process.env.NEXT_PUBLIC_BRAND_ID || '';
    } else {
      resolved = process.env.NEXT_PUBLIC_BRAND_ID || '';
    }

    setBrandId(resolved);
  }, []);

  // Helper: get influencer display name by id
  const getInfluencerNameById = (id: string): string => {
    const fromList = influencers.find((inf) => inf.id === id)?.name;
    if (fromList) return fromList;

    const fromMail = mails.find((m) => m.influencerId === id)?.influencerName;
    if (fromMail) return fromMail;

    return 'Creator';
  };

  // 2) Load threads + messages → flatten into Mail[]
  useEffect(() => {
    if (!brandId) return;

    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        const threadsJson = await get<any>(`/emails/threads/brand/${brandId}`);
        const threads: any[] =
          threadsJson?.threads || threadsJson?.data || threadsJson || [];

        const allMails: Mail[] = [];

        for (const thread of threads) {
          const threadId: string = thread._id;
          const influencerId: string =
            thread.influencer?._id || thread.influencer || '';

          const influencerName: string =
            thread.influencer?.name ||
            thread.influencerSnapshot?.name ||
            'Creator';

          let messages: any[] = [];
          try {
            const msgsJson = await get<any>(`/emails/messages/${threadId}`);
            messages =
              msgsJson?.messages || msgsJson?.data || msgsJson || [];
          } catch (err) {
            console.error(
              'Failed to fetch messages for thread',
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

            const direction: MailDirection =
              msg.direction === 'brand_to_influencer'
                ? 'outgoing'
                : 'incoming';

            // Display-only labels (no emails / aliases)
            const fromLabel =
              direction === 'outgoing' ? 'You' : influencerName;
            const toLabel =
              direction === 'outgoing' ? influencerName : 'You';

            const mail: Mail = {
              id: msg._id,
              direction,
              from: fromLabel,
              to: toLabel,
              subject: msg.subject,
              preview,
              body,
              date,
              time,
              tags: direction === 'outgoing' ? ['Sent'] : ['Inbox'],
              isRead: true,
              threadId,
              influencerId,
              influencerName,
              createdAt: msg.createdAt,
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
        console.error('Error loading mails:', err);
        setLoadError(err?.message || 'Failed to load emails');
      } finally {
        setIsLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  // 3) Load influencers for compose (brandId → list of influencer IDs & labels)
  useEffect(() => {
    if (!brandId) return;

    const loadInfluencers = async () => {
      try {
        setIsLoadingInfluencers(true);
        setInfluencerError(null);

        const json = await get<any>('emails/influencer/list', {
          brandId,
        });
        const listRaw: any[] =
          json?.influencers || json?.data || json?.results || [];

        const list: InfluencerOption[] = listRaw.map((inf) => ({
          id: inf._id || inf.influencerId,
          name:
            inf.name ||
            inf.handle ||
            (inf.email ? inf.email.split('@')[0] : 'Creator'),
          handle: inf.handle,
          platform: inf.platform,
        }));

        setInfluencers(list);
      } catch (err: any) {
        console.error('Error loading influencers:', err);
        setInfluencerError(
          err?.message || 'Failed to load influencers for compose'
        );
      } finally {
        setIsLoadingInfluencers(false);
      }
    };

    loadInfluencers();
  }, [brandId]);

  const filteredMails = useMemo(() => {
    let result = [...mails];

    if (filter !== 'all') {
      result = result.filter((m) => m.direction === filter);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter((m) => {
        const name = m.influencerName?.toLowerCase() || '';
        const fromLabel = m.from.toLowerCase();
        const toLabel = m.to.toLowerCase();
        return (
          m.subject.toLowerCase().includes(q) ||
          m.preview.toLowerCase().includes(q) ||
          name.includes(q) ||
          fromLabel.includes(q) ||
          toLabel.includes(q)
        );
      });
    }

    return result;
  }, [mails, filter, searchTerm]);

  const filteredInfluencersForPicker = useMemo(() => {
    const q = influencerSearch.toLowerCase().trim();
    if (!q) return influencers;
    return influencers.filter((inf) => {
      const name = inf.name?.toLowerCase() || '';
      const handle = inf.handle?.toLowerCase() || '';
      const platform = inf.platform?.toLowerCase() || '';
      return name.includes(q) || handle.includes(q) || platform.includes(q);
    });
  }, [influencers, influencerSearch]);

  const selectedMail =
    mails.find((m) => m.id === selectedMailId) || filteredMails[0] || null;

  useEffect(() => {
    if (!selectedMail && filteredMails.length > 0) {
      setSelectedMailId(filteredMails[0].id);
    }
  }, [filteredMails, selectedMail]);

  // --- Compose ---

  const openCompose = (opts?: {
    subject?: string;
    body?: string;
    influencerId?: string;
    threadId?: string;
    toDisplay?: string;
  }) => {
    setComposeSubject(opts?.subject ?? '');
    setComposeBody(opts?.body ?? '');
    setComposeThreadId(opts?.threadId ?? null);
    setComposeError(null);

    if (opts?.threadId && opts.influencerId) {
      // Reply mode – single influencer
      setComposeInfluencerIds([opts.influencerId]);
      setComposeToDisplay(opts?.toDisplay ?? '');
    } else {
      // New / forward – multi allowed
      setComposeInfluencerIds([]);
      setComposeToDisplay('');
    }

    setIsComposeOpen(true);
  };

  const handleSend = async () => {
    if (!composeSubject.trim() || !composeBody.trim()) {
      setComposeError('Please fill Subject and Message before sending.');
      return;
    }

    if (!brandId) {
      setComposeError('Missing brandId. Please ensure brand is logged in.');
      return;
    }

    if (!composeInfluencerIds.length) {
      setComposeError(
        'Please select at least one influencer to send this email to.'
      );
      return;
    }

    try {
      setIsSending(true);
      setComposeError(null);

      const sentMails: Mail[] = [];
      const failures: string[] = [];

      for (const influencerId of composeInfluencerIds) {
        try {
          const data = await post<any>('/emails/brand-to-influencer', {
            brandId,
            influencerId,
            subject: composeSubject.trim(),
            body: composeBody.trim(),
          });

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

          const influencerName = getInfluencerNameById(influencerId);

          const newMail: Mail = {
            id: data.messageId || `${influencerId}-${Date.now()}`,
            direction: 'outgoing',
            from: 'You',
            to: influencerName,
            subject: composeSubject.trim(),
            preview,
            body,
            date,
            time,
            tags: ['Sent'],
            isRead: true,
            threadId: data.threadId || '',
            influencerId,
            influencerName,
            createdAt: now.toISOString(),
          };

          sentMails.push(newMail);
        } catch (err) {
          console.error('Error sending to influencer', influencerId, err);
          failures.push(influencerId);
        }
      }

      if (sentMails.length > 0) {
        setMails((prev) => [...sentMails, ...prev]);
        setSelectedMailId(sentMails[0].id);
        setFilter('outgoing');
      }

      if (failures.length > 0) {
        setComposeError(
          `Some emails failed to send (${failures.length} recipient${
            failures.length > 1 ? 's' : ''
          }). Check logs / API and try again if needed.`
        );
      } else {
        setIsComposeOpen(false);
      }
    } catch (err: any) {
      console.error('Error sending emails:', err);
      setComposeError(err?.message || 'Failed to send email(s)');
    } finally {
      setIsSending(false);
    }
  };

  const handleReply = () => {
    if (!selectedMail) return;

    const senderLabel =
      selectedMail.direction === 'incoming'
        ? selectedMail.influencerName || 'Creator'
        : 'You';

    const replyToLabel = selectedMail.influencerName || 'Creator';

    openCompose({
      subject: selectedMail.subject.startsWith('Re:')
        ? selectedMail.subject
        : `Re: ${selectedMail.subject}`,
      body: `\n\n---\nOn ${selectedMail.date} at ${selectedMail.time}, ${senderLabel} wrote:\n${selectedMail.body}`,
      influencerId: selectedMail.influencerId,
      threadId: selectedMail.threadId,
      toDisplay: replyToLabel,
    });
  };

  const handleForward = () => {
    if (!selectedMail) return;

    const fromLabel =
      selectedMail.direction === 'incoming'
        ? selectedMail.influencerName || 'Creator'
        : 'You';
    const toLabel =
      selectedMail.direction === 'incoming'
        ? 'You'
        : selectedMail.influencerName || 'Creator';

    openCompose({
      subject: selectedMail.subject.startsWith('Fwd:')
        ? selectedMail.subject
        : `Fwd: ${selectedMail.subject}`,
      body: `\n\n--- Forwarded message ---\nFrom: ${fromLabel}\nDate: ${selectedMail.date} ${selectedMail.time}\nTo: ${toLabel}\nSubject: ${selectedMail.subject}\n\n${selectedMail.body}`,
    });
  };

  const handleHeaderCompose = () => {
    openCompose();
  };

  const toggleInfluencerSelection = (id: string) => {
    setComposeInfluencerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const totalIncoming = mails.filter((m) => m.direction === 'incoming').length;
  const totalOutgoing = mails.filter((m) => m.direction === 'outgoing').length;

  const selectedFromLabel =
    selectedMail?.direction === 'incoming'
      ? selectedMail?.influencerName || 'Creator'
      : 'You';
  const selectedToLabel =
    selectedMail?.direction === 'incoming'
      ? 'You'
      : selectedMail?.influencerName || 'Creator';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FFF9F2] via-white to-[#FFE7CF]">
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-7">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 border border-orange-100 shadow-sm backdrop-blur">
              <span className="inline-flex h-2 w-2 rounded-full bg-[#FF7236] animate-pulse" />
              <span className="text-xs font-medium text-gray-700">
                Brand Inbox • Influencer conversations
              </span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
                Email Center
              </h1>
            </div>
            <p className="text-sm text-gray-600 max-w-xl leading-relaxed">
              Monitor every incoming & outgoing message for your campaigns, and
              send new collaboration emails from a single, focused workspace.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                Inbox • {totalIncoming}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                Sent • {totalOutgoing}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleHeaderCompose}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white px-5 py-2.5 text-sm font-semibold shadow-[0_12px_35px_rgba(255,114,54,0.35)] hover:shadow-[0_16px_40px_rgba(255,114,54,0.45)] transition-all"
          >
            <HiPlus className="w-5 h-5" />
            <span>Compose Email</span>
          </button>
        </div>

        {/* Main email panel */}
        <div className="bg-white/95 border border-orange-100/70 shadow-[0_20px_55px_rgba(255,163,53,0.16)] rounded-3xl overflow-hidden flex flex-col md:flex-row backdrop-blur-sm">
          {/* Left: list */}
          <div className="md:w-[38%] border-b md:border-b-0 md:border-r border-gray-100 bg-gradient-to-b from-white to-[#FFF6EB] flex flex-col">
            {/* Search + Filters */}
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="flex items-center gap-2 bg-white rounded-full px-3 py-2 border border-gray-100 shadow-sm">
                <HiSearch className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by subject, creator, or message…"
                  className="w-full bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400"
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-gray-500">Filter</span>
                <div className="inline-flex bg-gray-50 rounded-full p-1 border border-gray-100">
                  {(['all', 'incoming', 'outgoing'] as FilterType[]).map(
                    (f) => {
                      const isActive = filter === f;
                      const labels: Record<FilterType, string> = {
                        all: 'All',
                        incoming: 'Inbox',
                        outgoing: 'Sent',
                      };
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFilter(f)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                            isActive
                              ? 'bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white shadow-sm'
                              : 'text-gray-600 hover:bg-white hover:text-gray-900'
                          }`}
                        >
                          {labels[f]}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            </div>

            {/* Mail list */}
            <div className="flex-1 overflow-y-auto max-h-[60vh] md:max-h-[70vh]">
              {!brandId ? (
                <div className="h-full flex flex-col items-center justify-center px-6 py-10 text-center text-gray-500 text-sm">
                  <HiInboxIn className="w-8 h-8 mb-2 text-gray-300" />
                  <p className="font-medium">Brand context missing.</p>
                  <p className="text-xs mt-1 text-gray-400">
                    Set{' '}
                    <code className="font-mono text-[11px] bg-gray-100 px-1 py-0.5 rounded">
                      NEXT_PUBLIC_BRAND_ID
                    </code>{' '}
                    or store{' '}
                    <code className="font-mono text-[11px] bg-gray-100 px-1 py-0.5 rounded">
                      brandId
                    </code>{' '}
                    in localStorage.
                  </p>
                </div>
              ) : isLoading ? (
                <div className="h-full flex flex-col items-center justify-center px-6 py-10 text-center text-gray-500 text-sm">
                  <HiInboxIn className="w-8 h-8 mb-2 text-gray-300 animate-pulse" />
                  <p>Loading emails…</p>
                </div>
              ) : loadError ? (
                <div className="h-full flex flex-col items-center justify-center px-6 py-10 text-center text-red-500 text-sm">
                  <p>{loadError}</p>
                </div>
              ) : filteredMails.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center px-6 py-10 text-center text-gray-500 text-sm">
                  <HiInboxIn className="w-8 h-8 mb-2 text-gray-300" />
                  <p className="font-medium">No emails for this view.</p>
                  <p className="text-xs mt-1 text-gray-400">
                    Try another filter or start a fresh conversation.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredMails.map((mail) => {
                    const isActive = mail.id === selectedMailId;
                    const isIncoming = mail.direction === 'incoming';
                    const creatorLabel = mail.influencerName || 'Creator';
                    return (
                      <li key={mail.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedMailId(mail.id)}
                          className={`relative w-full text-left px-4 py-3 flex flex-col gap-1 transition-all group ${
                            isActive
                              ? 'bg-gradient-to-r from-[#FFF1DF] to-[#FFE0D0]'
                              : 'hover:bg:white'
                          }`.replace('hover:bg:white', 'hover:bg-white')}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-0 h-full w-1 rounded-r-full bg-gradient-to-b from-[#FFA135] to-[#FF7236]" />
                          )}
                          <div className="flex items-center justify-between gap-2 pl-1">
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
                          <div className="flex items-center justify-between gap-2 pl-1">
                            <p className="text-xs text-gray-600 line-clamp-1">
                              {isIncoming ? creatorLabel : 'You'}
                            </p>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                isIncoming
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              }`}
                            >
                              {isIncoming ? 'Incoming' : 'Outgoing'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 pl-1">
                            {mail.preview}
                          </p>
                          {mail.tags && mail.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1 pl-1">
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
                <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-2 rounded-full bg-gray-50 px-2.5 py-1 border border-gray-100">
                        <HiMail className="w-4 h-4 text-[#FF7236]" />
                        <span className="text-[11px] font-medium text-gray-700">
                          {selectedMail.direction === 'incoming'
                            ? 'Inbox message'
                            : 'Sent from CollabGlam'}
                        </span>
                      </div>
                      <h2 className="text-lg md:text-xl font-semibold text-slate-900 leading-snug">
                        {selectedMail.subject}
                      </h2>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p className="font-medium text-gray-700">
                        {selectedMail.date}
                      </p>
                      <p>{selectedMail.time}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-700">
                        From
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100 text-[11px]">
                        {selectedFromLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-700">To</span>
                      <span className="px-2 py-0.5 rounded-full bg-gray-50 border border-gray-100 text-[11px]">
                        {selectedToLabel}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleReply}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-[#FF7236] hover:text-[#FF7236] transition-colors"
                    >
                      <CornerUpLeft className="w-3 h-3" />
                      Reply
                    </button>
                    <button
                      type="button"
                      onClick={handleForward}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-[#FF7236] hover:text-[#FF7236] transition-colors"
                    >
                      <CornerUpRight className="w-3 h-3" />
                      Forward
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <div className="bg-gray-50/80 border border-gray-100 rounded-2xl px-4 py-4 text-sm text-gray-800 whitespace-pre-line leading-relaxed shadow-sm">
                    {selectedMail.body}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 text-gray-500">
                <HiInboxIn className="w-10 h-10 mb-3 text-gray-300" />
                <p className="text-sm font-medium text-gray-700">
                  No email selected yet.
                </p>
                <p className="text-xs mt-1 text-gray-400">
                  Choose an email on the left, or start a new creator
                  conversation.
                </p>
                <button
                  type="button"
                  onClick={handleHeaderCompose}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-orange-200 px-4 py-2 text-xs font-medium text-[#FF7236] bg-orange-50/60 hover:bg-orange-100/80 transition-colors"
                >
                  <HiPaperAirplane className="w-4 h-4" />
                  Compose new email
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compose modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm px-4">
          <div className="bg-white/95 w-full max-w-2xl rounded-2xl shadow-2xl border border-orange-100 flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-white via-white to-[#FFF3E1]">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#FFA135] to-[#FF7236] flex items-center justify-center text-white shadow-md">
                  <HiMail className="w-5 h-5" />
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
              {/* From */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-500">
                  From
                </label>
                <input
                  type="text"
                  value="Your brand email alias is used automatically. Influencers never see your real email."
                  readOnly
                  className="w-full text-[11px] px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700"
                />
              </div>

              {/* Recipients: single (reply) vs multi (new/forward) */}
              {composeThreadId ? (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-500">
                    To (reply)
                  </label>
                  <input
                    type="text"
                    value={composeToDisplay || 'Creator'}
                    readOnly
                    className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700"
                  />
                  <p className="text-[10px] text-gray-400">
                    This reply continues the same thread with this creator via
                    the email relay.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-500">
                    Recipients (select one or many)
                  </label>
                  <input
                    type="text"
                    value={influencerSearch}
                    onChange={(e) => setInfluencerSearch(e.target.value)}
                    placeholder="Search creators by name or handle…"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FFA135] focus:border-[#FFA135]"
                  />
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                    {isLoadingInfluencers ? (
                      <div className="px-3 py-2 text-[11px] text-gray-500">
                        Loading influencers…
                      </div>
                    ) : influencerError ? (
                      <div className="px-3 py-2 text-[11px] text-red-500">
                        {influencerError}
                      </div>
                    ) : filteredInfluencersForPicker.length === 0 ? (
                      <div className="px-3 py-2 text-[11px] text-gray-500">
                        No influencers found. Adjust your search or set up the
                        email-list endpoint.
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-100 text-xs">
                        {filteredInfluencersForPicker.map((inf) => {
                          const checked = composeInfluencerIds.includes(inf.id);
                          const secondaryLine = inf.handle
                            ? `${inf.handle}${
                                inf.platform ? ` • ${inf.platform}` : ''
                              }`
                            : inf.platform || 'Creator';
                          return (
                            <li key={inf.id}>
                              <button
                                type="button"
                                onClick={() =>
                                  toggleInfluencerSelection(inf.id)
                                }
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-gray-50"
                              >
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      toggleInfluencerSelection(inf.id)
                                    }
                                    className="h-3 w-3"
                                  />
                                  <div className="flex flex-col items-start">
                                    <span className="font-medium text-gray-800">
                                      {inf.name}
                                    </span>
                                    <span className="text-[11px] text-gray-500">
                                      {secondaryLine}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400">
                    The same email will be sent separately to each selected
                    influencer. Replies appear in individual threads via the
                    relay.
                  </p>
                </div>
              )}

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
                  placeholder={`Hi [Creator Name],

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
};

export default EmailPage;
