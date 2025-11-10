
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { post } from '@/lib/api';

type RoomSummary = { roomId: string; participants: { userId: string; name: string }[]; lastMessage: { senderId: string; text: string; timestamp: string } | null; unseenCount: number; };

export default function MessagesList() {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();
  const brandId = typeof window !== 'undefined' ? localStorage.getItem('brandId') : null;

  useEffect(() => {
    if (!brandId) { setError('No brandId in localStorage'); setLoading(false); return; }
    (async () => {
      try { const data = await post<{ rooms: RoomSummary[] }>('/chat/rooms', { userId: brandId }); setRooms(data.rooms); }
      catch (err) { console.error('Error loading rooms:', err); setError('Failed to load chat rooms.'); }
      finally { setLoading(false); }
    })();
  }, [brandId]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 flex items-center justify-between border-b">
        <h2 className="text-lg font-semibold">Messages</h2>
      </div>

      {loading ? (
        <div className="p-4 text-center text-sm text-gray-500">Loading…</div>
      ) : error ? (
        <div className="p-4 text-center text-sm text-red-500">{error}</div>
      ) : (
        <div className="overflow-y-auto flex-1 divide-y divide-border">
          {rooms.map((room) => {
            const other = room.participants.find((p) => p.userId !== brandId)!;
            const isActive = pathname?.endsWith(room.roomId);
            return (
              <Link key={room.roomId} href={`/brand/messages/${room.roomId}`} className={`block px-4 py-3 hover:bg-gray-100 transition-colors ${isActive ? 'bg-white border-l-4 border-primary' : ''}`}>
                <div className="flex items-center space-x-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={`/avatars/${other.name.split(' ')[0].toLowerCase()}.jpg`} alt={other.name} />
                    <AvatarFallback>{other.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{other.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{room.lastMessage?.text || 'No messages yet'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {room.unseenCount > 0 && (<span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">{room.unseenCount}</span>)}
                    <span className="text-xs text-muted-foreground">{room.lastMessage ? new Date(room.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
