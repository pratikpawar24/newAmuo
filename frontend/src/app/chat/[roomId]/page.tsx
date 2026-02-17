'use client';

import { useParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import ChatWindow from '@/components/chat/ChatWindow';
import { useAuth } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <LoadingSpinner className="min-h-screen" size="lg" />;

  return (
    <div className="flex h-screen flex-col">
      <Navbar />
      <main className="flex-1 overflow-hidden">
        <ChatWindow chatRoomId={roomId} />
      </main>
    </div>
  );
}
