'use client';

import Link from 'next/link';
import { formatDate, getInitials } from '@/lib/utils';
import type { ChatRoom } from '@/types/chat';
import { cn } from '@/lib/utils';

interface ChatRoomListProps {
  rooms: ChatRoom[];
  activeRoomId?: string;
}

export default function ChatRoomList({ rooms, activeRoomId }: ChatRoomListProps) {
  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="text-4xl">💬</span>
        <p className="mt-3 text-sm text-slate-500">No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {rooms.map((room) => (
        <Link key={room.roomId} href={`/chat/${room.roomId}`}>
          <div
            className={cn(
              'flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700',
              activeRoomId === room.roomId && 'bg-primary-50 dark:bg-primary-900/20'
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
              💬
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{room.rideName}</p>
                {room.lastMessage && (
                  <span className="text-[10px] text-slate-400">{formatDate(room.lastMessage.createdAt)}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 truncate">
                  {room.lastMessage?.content || 'No messages yet'}
                </p>
                {room.unreadCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500 text-[10px] font-bold text-white">
                    {room.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
