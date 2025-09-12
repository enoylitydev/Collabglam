"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
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

type Message = {
  messageId?: string;
  senderId: string;
  text: string;
  timestamp: string;
  replyTo?: { text: string; idx: number } | null;
};

const CHAR_LIMIT = 200;

export default function ChatWindow({ params }: { params: { roomId: string } }) {
  const { roomId } = params;
  const router = useRouter();

  const influencerId =
    typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;

  const [partnerName, setPartnerName] = useState("Chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<{ text: string; idx: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [showScrollDown, setShowScrollDown] = useState(false);

  const scrollWrapRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Load partner name
  useEffect(() => {
    if (!influencerId) return;
    post<{ rooms: any[] }>("/chat/rooms", { userId: influencerId })
      .then(({ rooms }) => {
        const room = rooms.find((r) => r.roomId === roomId);
        type Participant = { userId: string; name: string };
        const other = room?.participants.find((p: Participant) => p.userId !== influencerId);
        if (other) setPartnerName(other.name);
      })
      .catch(() => setError("Unable to load conversation info."));
  }, [roomId, influencerId]);

  // Load history
  useEffect(() => {
    post<{ messages: Message[] }>("/chat/history", { roomId, limit: 100 })
      .then(({ messages: msgs }) => setMessages(msgs || []))
      .catch(() => setError("Failed to load messages."))
      .finally(() => {
        setLoading(false);
        setTimeout(scrollToBottom, 0);
      });
  }, [roomId]);

  // WebSocket join
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5000/ws";
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => ws.send(JSON.stringify({ type: "joinChat", roomId }));

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === "chatMessage" && data.roomId === roomId) {
          setMessages((prev) => [...prev, data.message as Message]);
          scrollToBottom();
        }
      } catch {}
    };

    ws.onerror = () => setError("WebSocket error");

    return () => ws.close();
  }, [roomId]);

  const scrollToBottom = () => {
    const el = scrollWrapRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setShowScrollDown(false);
  };

  const onScroll = () => {
    const el = scrollWrapRef.current;
    if (!el) return;
    setShowScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 50);
  };

  const sendMessage = async () => {
    if (!input.trim() || !influencerId) return;
    const text = input.trim();
    const now = new Date().toISOString();

    const msg: Message = {
      senderId: influencerId,
      text,
      timestamp: now,
      replyTo,
    };

    const packet = {
      type: "sendChatMessage",
      roomId,
      senderId: influencerId,
      text,
      timestamp: now,
      replyTo: replyTo ? replyTo.text : null,
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(packet));
    } else {
      try {
        await post("/chat/message", {
          roomId,
          senderId: influencerId,
          text,
          replyTo: replyTo?.text,
        });
      } catch {
        setError("Failed to send message");
        return;
      }
    }

    setMessages((prev) => [...prev, msg]);
    setInput("");
    setReplyTo(null);
    scrollToBottom();
  };

  const toggleExpand = (idx: number) =>
    setExpanded((e) => ({ ...e, [idx]: !e[idx] }));

  return (
    <Card className="relative flex h-screen flex-col min-h-0">
      {/* HEADER */}
      <CardHeader className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800">
        <Button variant="ghost" className="text-gray-800" onClick={() => router.back()}>
          ← Back
        </Button>
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10 border-2 border-gray-800">
            <AvatarFallback>{partnerName.charAt(0)}</AvatarFallback>
          </Avatar>
          <h3 className="text-xl font-semibold">{partnerName}</h3>
        </div>
        <div style={{ width: 64 }} />
      </CardHeader>

      {/* BODY */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* MESSAGES */}
        <div className="relative flex-1 min-h-0">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              Loading chat…
            </div>
          ) : (
            <div
              ref={scrollWrapRef}
              onScroll={onScroll}
              className="h-full overflow-y-auto px-6 py-4 pr-2 space-y-4 pb-4"
            >
              {messages.map((msg, idx) => {
                const isMe = msg.senderId === influencerId;
                const time = new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const long = msg.text.length > CHAR_LIMIT;
                const text = !long || expanded[idx]
                  ? msg.text
                  : msg.text.slice(0, CHAR_LIMIT) + "...";

                return (
                  <div
                    key={msg.messageId || idx}
                    className={`group flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    {!isMe && (
                      <Avatar className="h-8 w-8 mr-2">
                        <AvatarFallback>{partnerName.charAt(0)}</AvatarFallback>
                      </Avatar>
                    )}

                    <div className="max-w-lg">
                      {msg.replyTo && (
                        <div className="border-l-2 border-gray-300 pl-3 mb-1 text-xs italic text-gray-600">
                          {msg.replyTo.text}
                        </div>
                      )}

                      <CardContent
                        className={`p-3 rounded-xl break-words ${
                          isMe
                            ? "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{text}</p>
                        {long && (
                          <button
                            onClick={() => toggleExpand(idx)}
                            className="mt-1 text-sm font-medium text-gray-800 hover:underline"
                          >
                            {expanded[idx] ? "Show less" : "Read more"}
                          </button>
                        )}
                      </CardContent>

                      <p
                        className={`text-xs mt-1 ${
                          isMe ? "text-right" : "text-left"
                        } text-gray-600`}
                      >
                        {time}
                      </p>
                    </div>

                    <button
                      onClick={() => setReplyTo({ text: msg.text, idx })}
                      className="opacity-0 group-hover:opacity-100 ml-2 self-start text-gray-500 hover:text-gray-700"
                      title="Reply"
                    >
                      <HiReply className="h-5 w-5" />
                    </button>

                    {isMe && (
                      <Avatar className="h-8 w-8 ml-2 border-2 border-[#FFBF00]">
                        <AvatarFallback className="text-xs">
                          {"Me"}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {showScrollDown && (
            <Button
              variant="outline"
              size="icon"
              className="absolute bottom-4 right-6 bg-white hover:bg-gray-100 text-gray-800"
              onClick={scrollToBottom}
            >
              <HiArrowDown className="h-6 w-6" />
            </Button>
          )}
        </div>

        {/* INPUT */}
        <CardFooter className="bg-gray-50 border-t px-6 py-4">
          <div className="w-full">
            {replyTo && (
              <div className="mb-2 flex justify-between items-center bg-white px-4 py-2 rounded-lg shadow-sm">
                <span className="text-sm italic text-gray-600">
                  Replying to: {replyTo.text.slice(0, 100)}
                </span>
                <button
                  onClick={() => setReplyTo(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <HiX className="h-5 w-5" />
                </button>
              </div>
            )}

            <div className="flex items-center space-x-3">
              <HiPaperClip className="h-6 w-6 text-gray-800 cursor-pointer hover:text-gray-600" />
              <Textarea
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={1}
                className="flex-1 resize-none bg-white focus:ring-2 focus:ring-[#FFBF00] rounded-lg p-2"
              />
              <Button
                size="icon"
                className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 hover:opacity-90"
                disabled={!input.trim()}
                onClick={sendMessage}
              >
                <HiPaperAirplane className="h-5 w-5 rotate-90" />
              </Button>
            </div>
          </div>
        </CardFooter>
      </div>

      {error && (
        <p className="absolute bottom-0 w-full text-center text-xs text-red-500 pb-2">
          {error}
        </p>
      )}
    </Card>
  );
}
