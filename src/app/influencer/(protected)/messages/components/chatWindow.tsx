'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { HiPaperAirplane, HiPaperClip, HiArrowDown, HiReply, HiX, HiDownload, HiOutlineEye } from 'react-icons/hi';
import { post } from '@/lib/api';
import { fileUrl, isPdfMime, isImageMime, isVideoMime, withDownload, downloadByHref, getWsUrl } from '@/lib/files';

/* =========================
   Types & small utilities
========================= */

type ReplySnapshot = {
  messageId: string;
  senderId: string;
  text: string;
  hasAttachment?: boolean;
  attachment?: { originalName?: string; mimeType?: string };
};

type Attachment = {
  attachmentId?: string;
  url: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  thumbnailUrl?: string | null;
  storage?: 'remote' | 'local' | 'gridfs';
  path?: string | null;
};

type Message = {
  messageId: string;
  clientId?: string;
  senderId: string;
  text: string;
  timestamp: string;
  replyTo?: string | null;
  reply?: ReplySnapshot | null;
  attachments?: Attachment[];
};

const CHAR_LIMIT = 2000;
const asString = (v: any, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const asISO = (v: any): string => {
  const s = asString(v, '');
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? new Date().toISOString() : s;
};

const sanitizeAttachments = (list: any): Attachment[] =>
  Array.isArray(list)
    ? list.map((a) => ({
      attachmentId: asString(a?.attachmentId || a?.id || ''),
      url: fileUrl(asString(a?.url, '')),
      originalName: asString(a?.originalName, ''),
      mimeType: asString(a?.mimeType, ''),
      size: typeof a?.size === 'number' ? a.size : undefined,
      width: typeof a?.width === 'number' ? a.width : null,
      height: typeof a?.height === 'number' ? a.height : null,
      duration: typeof a?.duration === 'number' ? a.duration : null,
      thumbnailUrl: a?.thumbnailUrl ? fileUrl(asString(a.thumbnailUrl, '')) : null,
      storage: a?.storage === 'local' ? 'local' : a?.storage === 'gridfs' ? 'gridfs' : 'remote',
      path: a?.path ? asString(a.path, '') : null,
    }))
    : [];

const sanitizeReply = (r: any): ReplySnapshot | null =>
  r && typeof r === 'object'
    ? {
      messageId: asString(r.messageId, ''),
      senderId: asString(r.senderId, ''),
      text: asString(r.text, ''),
      hasAttachment: !!r.hasAttachment,
      attachment: r.attachment
        ? { originalName: asString(r.attachment.originalName, ''), mimeType: asString(r.attachment.mimeType, '') }
        : undefined,
    }
    : null;

const sanitizeMessage = (m: Partial<Message>): Message => ({
  messageId: asString(m.messageId, ''),
  clientId: m.clientId ? asString(m.clientId) : undefined,
  senderId: asString(m.senderId, ''),
  text: asString(m.text, ''),
  timestamp: asISO(m.timestamp),
  replyTo: m.replyTo ? asString(m.replyTo) : null,
  reply: sanitizeReply(m.reply),
  attachments: sanitizeAttachments(m.attachments),
});

/* =========================
   Component
========================= */

export default function ChatWindow({ params }: { params: { roomId: string } }) {
  const { roomId } = params;
  const router = useRouter();

  // Actor resolution (supports either influencerId or brandId)
  const [actorId, setActorId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const inf = localStorage.getItem('influencerId');
    setActorId(inf || null);
  }, []);

  const [partnerName, setPartnerName] = useState('Chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<{ messageId: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const scrollWrapRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Inline PDF open state (per-message+index) and blob URLs for safe preview
  const [openPdf, setOpenPdf] = useState<Record<string, boolean>>({});
  const [pdfSrc, setPdfSrc] = useState<Record<string, string>>({});
  const keyFor = (mid: string, idx: number) => `${mid}_${idx}`;

  // Partner initial
  const partnerInitial = (partnerName?.charAt(0) || '?').toUpperCase();

  const jumpToBottom = useCallback(() => {
    const el = scrollWrapRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setShowScrollDown(false);
  }, []);

  const scrollToMessageId = useCallback((mid: string) => {
    const target = messageRefs.current[mid];
    if (!scrollWrapRef.current || !target) {
      setError('Original message is not in view.');
      return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(mid);
    setTimeout(() => setHighlightId((id) => (id === mid ? null : id)), 1200);
  }, []);

  const upsertMessage = useCallback((incomingRaw: Message) => {
    const incoming = sanitizeMessage(incomingRaw);
    setMessages((prev) => (prev.some((m) => m.messageId === incoming.messageId) ? prev : [...prev, incoming]));
  }, []);

  /* Join/announce room on existing ws */
  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'joinChat', roomId }));
    }
  }, [roomId]);

  /* Header meta (get partner name) */
  useEffect(() => {
    if (!actorId) return;
    post<{ rooms: any[] }>('/chat/rooms', { userId: actorId })
      .then(({ rooms }) => {
        const room = rooms?.find((r) => r.roomId === roomId);
        const other = room?.participants?.find((p: any) => p.userId !== actorId);
        if (other?.name) setPartnerName(asString(other.name, 'Chat'));
      })
      .catch(() => setError('Unable to load conversation info.'));
  }, [roomId, actorId]);

  /* History + mark seen */
  useEffect(() => {
    post<{ messages: Partial<Message>[] }>('/chat/messages', { roomId, limit: 100 })
      .then(({ messages: msgs }) => setMessages((msgs || []).map(sanitizeMessage)))
      .catch(() => setError('Failed to load messages.'))
      .finally(() => {
        setLoading(false);
        requestAnimationFrame(() => jumpToBottom());
      });

    if (actorId) post('/chat/mark-seen', { roomId, userId: actorId }).catch(() => { });
  }, [roomId, actorId, jumpToBottom]);

  /* WebSocket connect/reconnect */
  useEffect(() => {
    let cancelled = false;
    let retryMs = 1000;

    const connect = () => {
      if (cancelled) return;

      const url = getWsUrl();
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        retryMs = 1000;
        ws.send(JSON.stringify({ type: 'joinChat', roomId }));
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data.type === 'chatMessage' && data.roomId === roomId) {
            upsertMessage(data.message);
            requestAnimationFrame(() => jumpToBottom());
          }
        } catch {
          /* ignore parse errors */
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch { }
      };

      ws.onclose = () => {
        if (cancelled) return;
        const delay = Math.min(retryMs, 10000);
        setTimeout(connect, delay);
        retryMs *= 2;
      };
    };

    connect();

    // If roomId changes while socket is open, (re)join it.
    const maybeJoin = () => {
      const s = wsRef.current;
      if (s && s.readyState === WebSocket.OPEN) {
        s.send(JSON.stringify({ type: 'joinChat', roomId }));
      }
    };
    maybeJoin();

    return () => {
      cancelled = true;
      const s = wsRef.current;
      wsRef.current = null;
      if (s && (s.readyState === WebSocket.OPEN || s.readyState === WebSocket.CONNECTING)) {
        try {
          s.close(1000, 'route change');
        } catch { }
      }
    };
  }, [roomId, upsertMessage, jumpToBottom]);

  /* Back-to-bottom visibility via IntersectionObserver */
  useEffect(() => {
    const root = scrollWrapRef.current;
    const sentinel = bottomSentinelRef.current;
    if (!root || !sentinel) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        setShowScrollDown(!entry.isIntersecting);
      },
      { root, threshold: 1.0 }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [messages.length]);

  /* Revoke any created PDF object URLs on unmount */
  useEffect(() => {
    return () => {
      Object.values(pdfSrc).forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch { }
      });
    };
  }, [pdfSrc]);

  const ensurePdfSrc = useCallback(
    async (id: string, href: string) => {
      if (pdfSrc[id]) return pdfSrc[id];
      try {
        const res = await fetch(href, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.blob();
        // Force correct MIME so Chrome treats it as a PDF
        const pdfBlob = raw.type === 'application/pdf' ? raw : new Blob([raw], { type: 'application/pdf' });
        const obj = URL.createObjectURL(pdfBlob);
        setPdfSrc((s) => ({ ...s, [id]: obj }));
        return obj;
      } catch (e) {
        setError('Unable to preview this PDF. Try opening it in a new tab or download it.');
        return undefined;
      }
    },
    [pdfSrc]
  );


  const sendMessage = async () => {
    if (!input.trim() || !actorId) return;
    try {
      const resp = await post('/chat/send', {
        roomId,
        senderId: actorId,
        text: input.trim(),
        replyTo: replyTo?.messageId ?? null,
      });
      const serverMsg = sanitizeMessage(resp?.messageData || resp?.message || {});
      if (serverMsg.messageId) {
        upsertMessage(serverMsg);
        requestAnimationFrame(() => jumpToBottom());
      }
      setInput('');
      setReplyTo(null);
    } catch {
      setError('Failed to send message');
    }
  };

  const onAttachClick = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await sendFiles(files);
  };

  const sendFiles = async (files: FileList) => {
    if (!files || files.length === 0 || !actorId) return;
    const form = new FormData();
    form.append('roomId', roomId);
    form.append('senderId', actorId);
    if (input.trim()) form.append('text', input.trim());
    if (replyTo?.messageId) form.append('replyTo', replyTo.messageId);
    Array.from(files).forEach((f) => form.append('files', f));

    try {
      setUploading(true);
      const resp = await post('/chat/send-file', form);
      const serverMsg = sanitizeMessage(resp?.messageData || resp?.message || {});
      if (serverMsg.messageId) {
        upsertMessage(serverMsg);
        requestAnimationFrame(() => jumpToBottom());
      }
      setInput('');
      setReplyTo(null);
    } catch (err) {
      console.error(err);
      setError('Failed to upload file(s).');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleExpand = (idx: number) => setExpanded((e) => ({ ...e, [idx]: !e[idx] }));

  return (
    <Card className="relative flex h-screen flex-col min-h-0">
      {/* Header */}
      <CardHeader className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800">
        <Button variant="ghost" className="text-black hover:opacity-90" onClick={() => router.back()}>
          ← Back
        </Button>
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10 border-2 border-black">
            <AvatarFallback className="text-gray-800">{partnerInitial}</AvatarFallback>
          </Avatar>
          <h3 className="text-lg sm:text-xl font-semibold">{partnerName || 'Chat'}</h3>
        </div>
        <div className="w-[64px]" />
      </CardHeader>

      {/* Body */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#FFF7EE]">
        <div className="relative flex-1 min-h-0">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-600">Loading chat…</div>
          ) : (
            <div
              ref={scrollWrapRef}
              className="h-full overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4"
            >
              {messages.map((raw, idx) => {
                const msg = sanitizeMessage(raw);
                const isMe = msg.senderId === actorId;
                const time = new Date(asISO(msg.timestamp)).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const fullText = asString(msg.text, '');
                const tooLong = fullText.length > CHAR_LIMIT;
                const shown = !tooLong || expanded[idx] ? fullText : fullText.slice(0, CHAR_LIMIT) + '…';
                const ringHighlight =
                  highlightId === msg.messageId
                    ? 'ring-2 ring-[#FF9F3A] ring-offset-2 ring-offset-[#FFF7EE]'
                    : '';

                return (
                  <div
                    key={msg.messageId || idx}
                    className={`group flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    ref={(el) => {
                      if (el) messageRefs.current[msg.messageId] = el;
                    }}
                  >
                    {!isMe && (
                      <Avatar className="h-7 w-7 mr-2 self-end hidden sm:inline-flex">
                        <AvatarFallback>{partnerInitial}</AvatarFallback>
                      </Avatar>
                    )}

                    <div className="flex flex-col items-stretch max-w-[90%] sm:max-w-[70%]">
                      {msg.reply && (msg.reply.text || msg.reply.hasAttachment) && (
                        <button
                          type="button"
                          onClick={() => scrollToMessageId(msg.reply!.messageId)}
                          className="text-left mb-1 border-l-4 border-[#FF9F3A] bg-white/70 px-3 py-2 rounded-md hover:bg-white transition-colors"
                          title="Go to original"
                        >
                          <div className="text-[11px] font-semibold text-[#FF7F2A]">Replying to</div>
                          <div className="text-[12px] text-gray-800 line-clamp-2">
                            {msg.reply.text || (msg.reply.hasAttachment ? '[Attachment]' : '')}
                            {msg.reply.attachment?.originalName ? ` • ${msg.reply.attachment.originalName}` : ''}
                          </div>
                        </button>
                      )}

                      <div
                        className={`${isMe ? 'bg-[#FFE8CC]' : 'bg-white'} text-gray-900 rounded-2xl ${isMe ? 'rounded-br-none' : 'rounded-bl-none'
                          } shadow ${ringHighlight} px-3 py-2`}
                      >
                        {shown && (
                          <>
                            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{shown}</p>
                            {tooLong && (
                              <button
                                onClick={() => toggleExpand(idx)}
                                className="mt-1 text-xs font-medium text-[#FF7F2A] hover:underline"
                              >
                                {expanded[idx] ? 'Show less' : 'Read more'}
                              </button>
                            )}
                          </>
                        )}

                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {msg.attachments.map((att, aidx) => {
                              const key = att.attachmentId || `${msg.messageId}_${aidx}`;
                              const href = fileUrl(att.url);
                              const fname = att.originalName || href.split('/').pop() || 'file';

                              // Images
                              if (isImageMime(att.mimeType)) {
                                return (
                                  <a
                                    key={key}
                                    href={href}
                                    target="_blank"
                                    rel="noopener"
                                    className="block overflow-hidden rounded-lg border border-black/5"
                                    title={fname}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={att.thumbnailUrl || href}
                                      alt={fname}
                                      className="w-full h-32 object-cover"
                                    />
                                  </a>
                                );
                              }

                              // Videos
                              if (isVideoMime(att.mimeType)) {
                                return (
                                  <video
                                    key={key}
                                    controls
                                    className="w-full h-32 rounded-lg border border-black/5 bg-black/5"
                                    src={href}
                                  />
                                );
                              }

                              // PDFs — show PREVIEW (no auto-download) using blob URL
                              if (isPdfMime(att.mimeType)) {
                                const id = keyFor(msg.messageId, aidx);
                                const open = !!openPdf[id];
                                const objectUrl = pdfSrc[id]; // may be undefined until fetched
                                return (
                                  <div key={key} className="col-span-2 rounded-lg border border-black/10 bg-white">
                                    <div className="flex items-center justify-between p-2 gap-2">
                                      <div className="truncate text-sm font-medium">{fname}</div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={async () => {
                                            if (!open) await ensurePdfSrc(id, href); // make sure URL exists before toggling
                                            setOpenPdf((s) => ({ ...s, [id]: !open }));
                                          }}
                                        >
                                          <HiOutlineEye className="h-4 w-4 mr-1" /> {open ? 'Hide' : 'Preview'}
                                        </Button>

                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={async () => {
                                            const url = await ensurePdfSrc(id, href);
                                            if (url) window.open(url, '_blank', 'noopener,noreferrer');
                                          }}
                                        >
                                          Open in new tab
                                        </Button>

                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => downloadByHref(withDownload(href), fname)}
                                        >
                                          <HiDownload className="h-4 w-4 mr-1" /> Download
                                        </Button>
                                      </div>

                                    </div>
                                    {open && (
                                      <div className="border-t">
                                        <div className="h-[60vh] w-full overflow-hidden">
                                          {objectUrl ? (
                                            <object
                                              data={objectUrl}
                                              type="application/pdf"
                                              className="h-full w-full"
                                              aria-label={`Preview: ${fname}`}
                                            >
                                              <div className="h-full w-full flex items-center justify-center text-sm text-gray-600 p-4">
                                                Preview unavailable in this browser. Use “Open in new tab” or Download.
                                              </div>
                                            </object>
                                          ) : (
                                            <div className="h-full w-full flex items-center justify-center text-sm text-gray-600">
                                              Preparing preview…
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}

                                  </div>
                                );
                              }

                              // Other files
                              return (
                                <div
                                  key={key}
                                  className="col-span-2 flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-black/10 bg-white text-sm"
                                >
                                  <a href={href} target="_blank" rel="noopener" className="truncate underline">
                                    {fname}
                                  </a>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => downloadByHref(withDownload(href), fname)}
                                  >
                                    <HiDownload className="h-4 w-4 mr-1" /> Download
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="mt-1 text-[11px] text-gray-600 text-right">{time}</div>
                      </div>

                      <div className={`mt-1 ${msg.senderId === actorId ? 'text-right' : 'text-left'}`}>
                        <button
                          onClick={() => setReplyTo({ messageId: msg.messageId, text: asString(msg.text, '') })}
                          className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[12px] text-gray-600 hover:text-gray-800 transition-opacity"
                          title="Reply"
                        >
                          <HiReply className="h-4 w-4" /> Reply
                        </button>
                      </div>
                    </div>

                    {msg.senderId === actorId && (
                      <Avatar className="h-7 w-7 ml-2 self-end hidden sm:inline-flex border-2 border-[#FFC074]">
                        <AvatarFallback className="text-[10px]">Me</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}
              <div ref={bottomSentinelRef} className="h-0 w-full" />
            </div>
          )}

          {/* Back-to-bottom chip */}
          {showScrollDown && (
            <Button
              variant="outline"
              size="icon"
              className="absolute bottom-4 right-6 bg-white/95 hover:bg-white text-gray-800 shadow"
              onClick={() => jumpToBottom()}
              title="Back to bottom"
            >
              <HiArrowDown className="h-6 w-6" />
            </Button>
          )}
        </div>

        {/* Footer / Composer */}
        <CardFooter className="bg-[#F2EDE8] border-t px-3 sm:px-6 py-3 sm:py-4">
          <div className="w-full">
            {replyTo && (
              <div className="mb-2 flex justify-between items-center bg-white px-3 sm:px-4 py-2 rounded-lg shadow-sm border-l-4 border-[#FF9F3A]">
                <span className="text-sm italic text-gray-700 line-clamp-1">
                  Replying to: {asString(replyTo.text, '').slice(0, 160)}
                </span>
                <button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-gray-700" title="Cancel reply">
                  <HiX className="h-5 w-5" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 sm:gap-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                className="hidden"
                onChange={onFilesSelected}
              />
              <button
                type="button"
                onClick={onAttachClick}
                className="p-2 rounded-full text-[#FF7F2A] hover:bg-white"
                title={uploading ? 'Uploading…' : 'Attach'}
                disabled={uploading}
              >
                <HiPaperClip className={`h-5 w-5 ${uploading ? 'opacity-50' : ''}`} />
              </button>
              <Textarea
                placeholder={uploading ? 'Uploading files…' : 'Type a message'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (!uploading && e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={1}
                disabled={uploading}
                className="flex-1 resize-none bg-white focus:ring-2 focus:ring-[#FF9F3A] rounded-full px-4 py-2"
              />
              <Button
                size="icon"
                className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white hover:opacity-90 rounded-full disabled:opacity-60"
                disabled={!input.trim() || uploading}
                onClick={sendMessage}
                title="Send"
              >
                <HiPaperAirplane className="h-5 w-5 rotate-90" />
              </Button>
            </div>

            {uploading && <div className="mt-2 text-xs text-gray-600">Uploading…</div>}
          </div>
        </CardFooter>
      </div>

      {error && <p className="absolute bottom-0 w-full text-center text-xs text-red-600 pb-2">{error}</p>}
    </Card>
  );
}
