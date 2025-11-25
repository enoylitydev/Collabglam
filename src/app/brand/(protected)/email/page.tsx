'use client';

import React, {
  useState,
  useEffect,
  useMemo,
} from 'react';
import {
  HiInboxIn,
  HiPaperAirplane,
  HiPlus,
  HiMail,
  HiSearch,
} from 'react-icons/hi';
import { X, Paperclip, Send, CornerUpLeft, CornerUpRight } from 'lucide-react';

type MailDirection = 'incoming' | 'outgoing';

interface Mail {
  id: string;
  direction: MailDirection;
  from: string;
  to: string;
  subject: string;
  preview: string;
  body: string;
  date: string; // formatted, e.g. "Nov 20, 2025"
  time: string; // formatted, e.g. "10:32 AM"
  tags?: string[];
  isRead?: boolean;
  threadId: string;
  influencerId: string;
  createdAt: string; // ISO from backend
}

interface InfluencerOption {
  id: string;
  name: string;
  email: string;
}

type FilterType = 'all' | 'incoming' | 'outgoing';

// 🔧 How you get brandId is up to you.
// Option 1: build-time env (NEXT_PUBLIC_BRAND_ID).
// Option 2: override via localStorage / auth context.
const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '') || '';

const buildApiUrl = (path: string) =>
  API_BASE ? `${API_BASE}${path}` : path;

const EmailPage: React.FC = () => {
  
  const [brandId, setBrandId] = useState<string>('');
  const [mails, setMails] = useState<Mail[]>([]);
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const [composeFrom, setComposeFrom] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeThreadId, setComposeThreadId] =
    useState<string | null>(null);

  // ❗ NEW: multi-recipient support
  const [composeInfluencerIds, setComposeInfluencerIds] = useState<string[]>(
    []
  );
  const [composeToDisplay, setComposeToDisplay] = useState(''); // only used in reply mode

  const [composeError, setComposeError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Influencer list for multi-select
  const [influencers, setInfluencers] = useState<InfluencerOption[]>([]);
  const [isLoadingInfluencers, setIsLoadingInfluencers] = useState(false);
  const [influencerError, setInfluencerError] = useState<string | null>(
    null
  );
  const [influencerSearch, setInfluencerSearch] = useState('');

  const stripHtml = (html: string): string => {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, '');
  };
// 1) Determine brandId (from env or localStorage)
useEffect(() => {
  let id:string;
  if (typeof window !== 'undefined') {
    id = window.localStorage.getItem('brandId');
  }

  setBrandId(id);
}, []);


  // 2) Load threads + messages → flatten into Mail[]
  useEffect(() => {
    if (!brandId) return;

    const load = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        const threadsRes = await fetch(
          buildApiUrl(`/emails/threads/brand/${brandId}`)
        );
        if (!threadsRes.ok) {
          throw new Error('Failed to fetch threads');
        }
        const threadsJson = await threadsRes.json();
        const threads: any[] = threadsJson.threads || [];

        const allMails: Mail[] = [];

        for (const thread of threads) {
          const threadId: string = thread._id;
          const influencerId: string =
            thread.influencer?._id || thread.influencer || '';

          // Alias to show in UI – no real emails
          const brandAliasForDisplay: string =
            thread.brandDisplayAlias || thread.brandAliasEmail;
          const influencerAliasForDisplay: string =
            thread.influencerDisplayAlias ||
            thread.influencerAliasEmail ||
            `influencer@${process.env.NEXT_PUBLIC_EMAIL_RELAY_DOMAIN || 'collabglam.com'}`;

          const msgsRes = await fetch(
            buildApiUrl(`/emails/messages/${threadId}`)
          );
          if (!msgsRes.ok) continue;
          const msgsJson = await msgsRes.json();
          const messages: any[] = msgsJson.messages || [];

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
              msg.direction === 'brand_to_influencer' ? 'outgoing' : 'incoming';

            // 👇 DISPLAY-ONLY EMAILS (aliases)
            const from =
              direction === 'outgoing'
                ? brandAliasForDisplay
                : influencerAliasForDisplay;
            const to =
              direction === 'outgoing'
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
              tags: direction === 'outgoing' ? ['Sent'] : ['Inbox'],
              isRead: true,
              threadId,
              influencerId,
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

  // 3) Load influencers for compose (for new / forwarded emails)
  useEffect(() => {
    if (!brandId) return;

    const loadInfluencers = async () => {
      try {
        setIsLoadingInfluencers(true);
        setInfluencerError(null);

        // ⚠️ Adjust this endpoint to match your actual influencer API.
        // Expecting something like: { influencers: [{ _id, name, email }, ...] }
        const res = await fetch(
          buildApiUrl(`/influencer/email-list?brandId=${encodeURIComponent(brandId)}`)
        );

        if (!res.ok) {
          throw new Error('Failed to load influencers');
        }

        const json = await res.json();
        const listRaw: any[] =
          json.influencers || json.data || json.results || [];

        const list: InfluencerOption[] = listRaw
          .filter((inf) => inf.email)
          .map((inf) => ({
            id: inf._id || inf.influencerId,
            name:
              inf.name ||
              inf.handle ||
              (inf.email ? inf.email.split('@')[0] : 'Creator'),
            email: inf.email,
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

  const filteredInfluencersForPicker = useMemo(() => {
    const q = influencerSearch.toLowerCase().trim();
    if (!q) return influencers;
    return influencers.filter(
      (inf) =>
        inf.name.toLowerCase().includes(q) ||
        inf.email.toLowerCase().includes(q)
    );
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
    from?: string;
    // for replies: single influencer + thread
    influencerId?: string;
    threadId?: string;
    toDisplay?: string;
  }) => {
    setComposeFrom(opts?.from ?? '');
    setComposeSubject(opts?.subject ?? '');
    setComposeBody(opts?.body ?? '');
    setComposeThreadId(opts?.threadId ?? null);
    setComposeError(null);

    if (opts?.threadId && opts.influencerId) {
      // Reply mode – single influencer
      setComposeInfluencerIds([opts.influencerId]);
    } else {
      // New / forward – multi allowed
      setComposeInfluencerIds([]);
    }

    setComposeToDisplay(opts?.toDisplay ?? '');
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
          const res = await fetch(buildApiUrl('/emails/brand-to-influencer'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              brandId,
              influencerId,
              subject: composeSubject.trim(),
              body: composeBody.trim(),
            }),
          });

          if (!res.ok) {
            const errJson = await res.json().catch(() => null);
            throw new Error(
              errJson?.error || `Failed (status ${res.status})`
            );
          }

          const data = await res.json();

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

          // 👇 Use alias only for UI
          const fromAlias =
            data.brandDisplayAlias ||
            data.brandAliasEmail ||
            composeFrom ||
            'brand@collabglam.com';

          const toAlias =
            data.influencerDisplayAlias ||
            data.influencerAliasEmail ||
            `influencer@${process.env.NEXT_PUBLIC_EMAIL_RELAY_DOMAIN || 'collabglam.com'}`;

          const newMail: Mail = {
            id: data.messageId || `${influencerId}-${Date.now()}`,
            direction: 'outgoing',
            from: fromAlias,
            to: toAlias,
            subject: composeSubject.trim(),
            preview,
            body,
            date,
            time,
            tags: ['Sent'],
            isRead: true,
            threadId: data.threadId || '',
            influencerId,
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
          `Some emails failed to send (${failures.length} recipient${failures.length > 1 ? 's' : ''
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

    openCompose({
      from:
        selectedMail.direction === 'outgoing'
          ? selectedMail.from
          : selectedMail.to,
      toDisplay:
        selectedMail.direction === 'incoming'
          ? selectedMail.from
          : selectedMail.to,
      subject: selectedMail.subject.startsWith('Re:')
        ? selectedMail.subject
        : `Re: ${selectedMail.subject}`,
      body: `\n\n---\nOn ${selectedMail.date} at ${selectedMail.time}, ${selectedMail.from} wrote:\n${selectedMail.body}`,
      influencerId: selectedMail.influencerId,
      threadId: selectedMail.threadId,
    });
  };

  const handleForward = () => {
    if (!selectedMail) return;

    // Forward = new email → multi-recipient mode
    openCompose({
      from:
        selectedMail.direction === 'outgoing'
          ? selectedMail.from
          : selectedMail.to,
      subject: selectedMail.subject.startsWith('Fwd:')
        ? selectedMail.subject
        : `Fwd: ${selectedMail.subject}`,
      body: `\n\n--- Forwarded message ---\nFrom: ${selectedMail.from}\nDate: ${selectedMail.date} ${selectedMail.time}\nTo: ${selectedMail.to}\nSubject: ${selectedMail.subject}\n\n${selectedMail.body}`,
    });
  };

  const handleHeaderCompose = () => {
    // Always open as NEW multi-recipient compose
    openCompose({
      from: 'brand@collabglam.com',
    });
  };

  const toggleInfluencerSelection = (id: string) => {
    setComposeInfluencerIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
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
                Brand Inbox — manage influencer conversations
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
              Email Center
            </h1>
            <p className="text-sm text-gray-600 max-w-xl">
              View all incoming & outgoing emails linked to your brand campaigns,
              and compose new outreach in one place.
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
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white px-5 py-3 shadow-md shadow-orange-300/50 hover:shadow-lg hover:shadow-orange-300/70 transition-all"
          >
            <HiPlus className="w-5 h-5" />
            <span className="text-sm font-medium">Compose Email</span>
          </button>
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
                  placeholder="Search by subject, creator, email..."
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
                      incoming: 'Inbox',
                      outgoing: 'Sent',
                    };
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${isActive
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
              {!brandId ? (
                <div className="h-full flex flex-col items-center justify-center px-6 py-10 text-center text-gray-500 text-sm">
                  <HiInboxIn className="w-8 h-8 mb-2 text-gray-300" />
                  <p>Brand context missing.</p>
                  <p className="text-xs mt-1">
                    Set <code className="font-mono">NEXT_PUBLIC_BRAND_ID</code>{' '}
                    or inject brandId from your auth context.
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
                  <p>No emails found for this filter.</p>
                  <p className="text-xs mt-1">
                    Try changing the filter or writing a fresh email.
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
                          className={`w-full text-left px-4 py-3 flex flex-col gap-1 transition-all ${isActive
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
                              className={`text-[10px] px-2 py-0.5 rounded-full border ${isIncoming
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                }`}
                            >
                              {isIncoming ? 'Incoming' : 'Outgoing'}
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
                            ? 'Inbox message'
                            : 'Sent from CollabGlam'}
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
                  <div className="bg-gray-50/70 border border-gray-100 rounded-2xl px-4 py-4 text-sm text-gray-800 whitespace-pre-line leading-relaxed shadow-sm">
                    {selectedMail.body}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 text-gray-500">
                <HiInboxIn className="w-10 h-10 mb-2 text-gray-300" />
                <p className="text-sm font-medium">No email selected yet.</p>
                <p className="text-xs mt-1">
                  Choose an email from the left, or start a fresh conversation.
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
                    Compose Email
                  </h2>
                  <p className="text-xs text-gray-500">
                    Reach out to influencers directly from your CollabGlam brand
                    portal.
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
                  value={composeFrom || 'brand@collabglam.com'}
                  readOnly
                  className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700"
                />
              </div>

              {/* Recipients: single (reply) vs multi (new/forward) */}
              {composeThreadId ? (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-gray-500">
                    To
                  </label>
                  <input
                    type="email"
                    value={composeToDisplay}
                    readOnly
                    className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700"
                  />
                  <p className="text-[10px] text-gray-400">
                    This reply will continue in the same thread with this
                    creator via the email relay.
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
                    placeholder="Search creators by name or email..."
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
                                      {inf.email}
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
                    influencer. Replies from creators will appear in their own
                    threads via the relay.
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
