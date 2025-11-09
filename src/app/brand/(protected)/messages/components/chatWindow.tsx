"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  HiPaperAirplane,
  HiPaperClip,
  HiArrowDown,
  HiReply,
  HiX,
} from "react-icons/hi";
import { post } from "@/lib/api";
import { resolveFileUrl } from "@/lib/files";

/** ==== Types aligned to server ==== */
type ReplySnapshot = {
  messageId: string;
  senderId: string;
  text: string;
  hasAttachment?: boolean;
  attachment?: {
    originalName?: string;
    mimeType?: string;
  };
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
  storage?: "remote" | "local";
  path?: string | null;
};

type Message = {
  messageId: string;        // from server
  clientId?: string;
  senderId: string;
  text: string;
  timestamp: string;        // ISO
  replyTo?: string | null;  // messageId being replied to
  reply?: ReplySnapshot | null; // server-provided snapshot
  attachments?: Attachment[];
};

const CHAR_LIMIT = 2000;

/** ==== safety helpers ==== */
const asString = (v: any, d = ""): string =>
  typeof v === "string" ? v : v == null ? d : String(v);

const asISOTime = (v: any): string => {
  const s = asString(v, "");
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? new Date().toISOString() : s;
};

const sanitizeReply = (r: any | undefined | null): ReplySnapshot | null => {
  if (!r || typeof r !== "object") return null;
  return {
    messageId: asString(r.messageId, ""),
    senderId: asString(r.senderId, ""),
    text: asString(r.text, ""),
    hasAttachment: !!r.hasAttachment,
    attachment: r.attachment
      ? {
        originalName: asString(r.attachment.originalName, ""),
        mimeType: asString(r.attachment.mimeType, ""),
      }
      : undefined,
  };
};

const sanitizeAttachments = (list: any): Attachment[] => {
  if (!Array.isArray(list)) return [];
  return list.map((a) => ({
    attachmentId: asString(a?.attachmentId || a?.id || "", ""),
    url: resolveFileUrl(
      asString(a?.url, "") || asString(a?.path, "") || asString(a?.gridfsFilename, "")
    ),
    originalName: asString(a?.originalName, ""),
    mimeType: asString(a?.mimeType, ""),
    size: typeof a?.size === "number" ? a.size : undefined,
    width: typeof a?.width === "number" ? a.width : null,
    height: typeof a?.height === "number" ? a.height : null,
    duration: typeof a?.duration === "number" ? a.duration : null,
    thumbnailUrl: a?.thumbnailUrl
      ? resolveFileUrl(asString(a.thumbnailUrl, ""))
      : null,
    storage: a?.storage === "local" ? "local" : "remote",
    path: a?.path ? asString(a.path, "") : null,
  }));
};

const sanitizeMessage = (m: Partial<Message>): Message => ({
  messageId: asString(m.messageId, ""),
  clientId: m.clientId ? asString(m.clientId) : undefined,
  senderId: asString(m.senderId, ""),
  text: asString(m.text, ""),
  timestamp: asISOTime(m.timestamp),
  replyTo: m.replyTo ? asString(m.replyTo) : null,
  reply: sanitizeReply(m.reply),
  attachments: sanitizeAttachments(m.attachments),
});

const msgKey = (m: Pick<Message, "senderId" | "timestamp" | "text" | "messageId">) =>
  m.messageId || `${asString(m.senderId)}__${asString(m.timestamp)}__${asString(m.text)}`;

/** Simple attachment helpers */
const isImage = (mime?: string) => (mime || "").startsWith("image/");
const isVideo = (mime?: string) => (mime || "").startsWith("video/");

export default function ChatWindow({ params }: { params: { roomId: string } }) {
  const { roomId } = params;
  const router = useRouter();
  const brandId = typeof window !== "undefined" ? localStorage.getItem("brandId") : null;

  /** state */
  const [partnerName, setPartnerName] = useState("Chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<{ messageId: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  /** refs */
  const scrollWrapRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(false);
  const wsMadeRef = useRef(false);
  const historyLoadedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map messageId -> DOM element to allow precise scrolling
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /** scrolling */
  const jumpToBottom = useCallback(() => {
    const el = scrollWrapRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight; // instant jump avoids flicker
    setShowScrollDown(false);
  }, []);

  // Scroll to a specific messageId (used by clicking reply preview)
  const scrollToMessageId = useCallback((mid: string) => {
    const container = scrollWrapRef.current;
    const target = messageRefs.current[mid];
    if (!container || !target) {
      setError("Original message is not in view.");
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightId(mid);
    setTimeout(() => setHighlightId((id) => (id === mid ? null : id)), 1200);
  }, []);

  /** server-only upsert (prevent local+server duplicates) */
  const upsertMessage = useCallback((incomingRaw: Message) => {
    const incoming = sanitizeMessage(incomingRaw);
    setMessages((prev) => {
      const key = msgKey(incoming);
      if (prev.some((m) => msgKey(m) === key)) return prev;
      return [...prev, incoming];
    });
  }, []);

  /** sentinel controls the chip */
  useEffect(() => {
    const root = scrollWrapRef.current;
    const target = bottomSentinelRef.current;
    if (!root || !target) return;

    const io = new IntersectionObserver(
      ([entry]) => setShowScrollDown(!entry.isIntersecting),
      { root, threshold: 1.0 }
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  /** load convo meta (other participant) */
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    if (!brandId) return;
    post<{ rooms: any[] }>("/chat/rooms", { userId: brandId })
      .then(({ rooms }) => {
        const room = rooms?.find((r) => r.roomId === roomId);
        const other = room?.participants?.find((p: any) => p.userId !== brandId);
        if (other?.name) setPartnerName(asString(other.name, "Chat"));
      })
      .catch(() => setError("Unable to load conversation info."));
  }, [roomId, brandId]);

  /** history */
  const loadHistory = useCallback(() => {
    if (historyLoadedRef.current) return;
    historyLoadedRef.current = true;

    post<{ messages: Partial<Message>[] }>("/chat/history", { roomId, limit: 100 })
      .then(({ messages: msgs }) => setMessages((msgs || []).map(sanitizeMessage)))
      .catch(() => setError("Failed to load messages."))
      .finally(() => {
        setLoading(false);
        requestAnimationFrame(() => jumpToBottom());
      });
  }, [roomId, jumpToBottom]);

  useEffect(() => {
    loadHistory();
    // Mark all messages as seen when the chat window loads
    if (brandId && roomId) {
      post("/chat/mark-seen", { roomId, userId: brandId }).catch((err) =>
        console.error("Failed to mark messages as seen:", err)
      );
    }
  }, [loadHistory, brandId, roomId]);

  /** websocket */
  useEffect(() => {
    if (wsMadeRef.current) return;
    wsMadeRef.current = true;

    const url = process.env.NEXT_PUBLIC_WS_URL || "ws://infuencer.onrender.com/ws";
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: "joinChat", roomId }));

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === "chatMessage" && data.roomId === roomId) {
          upsertMessage(sanitizeMessage(data.message));
          requestAnimationFrame(() => jumpToBottom());
        }
        // Optionally handle chatMessageEdited / chatMessageDeleted here
      } catch {
        // ignore
      }
    };

    ws.onerror = (evt) => {
      console.error("WebSocket error", evt);
      setError("WebSocket error");
    };

    return () => ws.close();
  }, [roomId, upsertMessage, jumpToBottom]);

  /** send TEXT (no optimistic render) — replyTo = messageId */
  const sendMessage = async () => {
    if (!input.trim() || !brandId) return;

    const text = asString(input.trim(), "");
    const now = new Date().toISOString();
    const clientId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const packet = {
      type: "sendChatMessage",
      roomId,
      senderId: brandId,
      text,
      timestamp: now,
      replyTo: replyTo?.messageId ?? null, // IMPORTANT: send messageId
      clientId,
    };

    const sendViaRest = async () => {
      try {
        const resp = await post("/chat/message", {
          roomId,
          senderId: brandId,
          text,
          replyTo: replyTo?.messageId ?? null,
          clientId,
        });
        const serverMsg = sanitizeMessage(resp?.messageData || resp?.message || {});
        if (serverMsg.messageId) {
          upsertMessage(serverMsg);
          requestAnimationFrame(() => jumpToBottom());
        }
      } catch {
        setError("Failed to send message");
      }
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(packet));
      requestAnimationFrame(() => jumpToBottom());
    } else {
      await sendViaRest();
    }

    setInput("");
    setReplyTo(null);
  };
  
  const onAttachClick = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = ''; // allow selecting same file twice
    fileInputRef.current.click();
  };

  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await sendFiles(files);
  };

  const sendFiles = async (files: FileList) => {
    if (!files || files.length === 0 || !brandId) return;

    const form = new FormData();
    form.append('roomId', roomId);
    form.append('senderId', brandId);
    // optional message text alongside file
    if (input.trim()) form.append('text', input.trim());
    // reply target (messageId)
    if (replyTo?.messageId) form.append('replyTo', replyTo.messageId);

    Array.from(files).forEach((f) => form.append('files', f)); // <--- must be 'files'

    try {
      setUploading(true);

      // If your router is mounted at app.use('/chat', ...):
      const resp = await post('/chat/send-file', form);

      // Your controller returns { messageData: msg } — normalize both shapes
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

  const toggleExpand = (idx: number) =>
    setExpanded((e) => ({ ...e, [idx]: !e[idx] }));

  const partnerInitial = (partnerName?.charAt(0) || "?").toUpperCase();

  /** ====== UI ====== */
  // WhatsApp bubble vibe; brand colors for header + send action
  const sentBubble =
    "bg-[#FFE8CC] text-gray-900 rounded-2xl rounded-br-none shadow"; // light brand-tinted
  const recvBubble =
    "bg-white text-gray-900 rounded-2xl rounded-bl-none shadow"; // white bubble

  return (
    <Card className="relative flex h-screen flex-col min-h-0">
      {/* HEADER — brand gradient */}
      <CardHeader className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white">
        <Button variant="ghost" className="text-white hover:opacity-90" onClick={() => router.back()}>
          ← Back
        </Button>
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10 border-2 border-white">
            <AvatarFallback>{partnerInitial}</AvatarFallback>
          </Avatar>
          <h3 className="text-lg sm:text-xl font-semibold">{partnerName || "Chat"}</h3>
        </div>
        <div className="w-[64px]" />
      </CardHeader>

      {/* BODY — subtle paper-like bg (WhatsApp-ish) */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#FFF7EE]">
        <div className="relative flex-1 min-h-0">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-600">
              Loading chat…
            </div>
          ) : (
            <div
              ref={scrollWrapRef}
              className="h-full overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4"
            >
              {messages.map((raw, idx) => {
                const msg = sanitizeMessage(raw);
                const isMe = msg.senderId === brandId;

                const time = new Date(asISOTime(msg.timestamp)).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const fullText = asString(msg.text, "");
                const tooLong = fullText.length > CHAR_LIMIT;
                const shownText = !tooLong || expanded[idx] ? fullText : fullText.slice(0, CHAR_LIMIT) + "...";

                const ringHighlight =
                  highlightId === msg.messageId
                    ? "ring-2 ring-[#FF9F3A] ring-offset-2 ring-offset-[#FFF7EE]"
                    : "";

                return (
                  <div
                    key={msg.messageId || msg.clientId || `${idx}-${time}`}
                    className={`group flex ${isMe ? "justify-end" : "justify-start"}`}
                    ref={(el) => {
                      if (el) messageRefs.current[msg.messageId] = el;
                    }}
                    data-message-id={msg.messageId}
                  >
                    {/* Avatar (receive side, desktop-like) */}
                    {!isMe && (
                      <Avatar className="h-7 w-7 mr-2 self-end hidden sm:inline-flex">
                        <AvatarFallback>{partnerInitial}</AvatarFallback>
                      </Avatar>
                    )}

                    <div className="flex flex-col items-stretch max-w-[90%] sm:max-w-[70%]">
                      {/* Reply preview (click to jump) */}
                      {msg.reply && (msg.reply.text || msg.reply.hasAttachment) && (
                        <button
                          type="button"
                          onClick={() => scrollToMessageId(msg.reply!.messageId)}
                          className="text-left mb-1 border-l-4 border-[#FF9F3A] bg-white/70 px-3 py-2 rounded-md hover:bg-white transition-colors"
                          title="Go to original"
                        >
                          <div className="text-[11px] font-semibold text-[#FF7F2A]">Replying to</div>
                          <div className="text-[12px] text-gray-800 line-clamp-2">
                            {msg.reply.text || (msg.reply.hasAttachment ? "[Attachment]" : "")}
                            {msg.reply.attachment?.originalName ? ` • ${msg.reply.attachment.originalName}` : ""}
                          </div>
                        </button>
                      )}

                      {/* Bubble */}
                      <div className={`${isMe ? sentBubble : recvBubble} ${ringHighlight} px-3 py-2`}>
                        {/* Text */}
                        {shownText && (
                          <>
                            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                              {shownText}
                            </p>
                            {tooLong && (
                              <button
                                onClick={() => toggleExpand(idx)}
                                className="mt-1 text-xs font-medium text-[#FF7F2A] hover:underline"
                              >
                                {expanded[idx] ? "Show less" : "Read more"}
                              </button>
                            )}
                          </>
                        )}

                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {msg.attachments.map((att) => {
                              const key = att.attachmentId || att.url;
                              if (isImage(att.mimeType)) {
                                return (
                                  <a
                                    key={key}
                                    href={att.url}
                                    target="_blank"
                                    rel="noopener"
                                    className="block overflow-hidden rounded-lg border border-black/5"
                                    title={att.originalName || "image"}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={att.thumbnailUrl || att.url}
                                      alt={att.originalName || "image"}
                                      className="w-full h-32 object-cover"
                                    />
                                  </a>
                                );
                              }
                              if (isVideo(att.mimeType)) {
                                return (
                                  <video
                                    key={key}
                                    controls
                                    className="w-full h-32 rounded-lg border border-black/5 bg-black/5"
                                    src={att.url}
                                  />
                                );
                              }
                              // generic file
                              return (
                                <a
                                  key={key}
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener"
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-black/10 bg-white text-sm hover:bg-white/90"
                                  title={att.originalName || "file"}
                                >
                                  <span className="truncate">{att.originalName || "File"}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}

                        <div className="mt-1 text-[11px] text-gray-600 text-right">
                          {time}
                        </div>
                      </div>

                      {/* Tiny reply action under bubble (shows on hover) */}
                      <div className={`mt-1 ${isMe ? "text-right" : "text-left"}`}>
                        <button
                          onClick={() => setReplyTo({ messageId: msg.messageId, text: fullText })}
                          className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[12px] text-gray-600 hover:text-gray-800 transition-opacity"
                          title="Reply"
                        >
                          <HiReply className="h-4 w-4" />
                          Reply
                        </button>
                      </div>
                    </div>

                    {/* Avatar (sender side, desktop-like) */}
                    {isMe && (
                      <Avatar className="h-7 w-7 ml-2 self-end hidden sm:inline-flex border-2 border-[#FFC074]">
                        <AvatarFallback className="text-[10px]">Me</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}
              {/* bottom sentinel */}
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

        {/* INPUT — WhatsApp layout, brand gradient action */}
        <CardFooter className="bg-[#F2EDE8] border-t px-3 sm:px-6 py-3 sm:py-4">
          <div className="w-full">
            {replyTo && (
              <div className="mb-2 flex justify-between items-center bg-white px-3 sm:px-4 py-2 rounded-lg shadow-sm border-l-4 border-[#FF9F3A]">
                <span className="text-sm italic text-gray-700 line-clamp-1">
                  Replying to: {asString(replyTo.text, "").slice(0, 160)}
                </span>
                <button
                  onClick={() => setReplyTo(null)}
                  className="text-gray-500 hover:text-gray-700"
                  title="Cancel reply"
                >
                  <HiX className="h-5 w-5" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                className="hidden"
                onChange={onFilesSelected}
              />

              {/* Attach button (left of the textarea) */}
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
                placeholder={uploading ? "Uploading files…" : "Type a message"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (!uploading && e.key === "Enter" && !e.shiftKey) {
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

            {uploading && (
              <div className="mt-2 text-xs text-gray-600">Uploading…</div>
            )}
          </div>
        </CardFooter>
      </div>

      {error && (
        <p className="absolute bottom-0 w-full text-center text-xs text-red-600 pb-2">
          {error}
        </p>
      )}
    </Card>
  );
}
