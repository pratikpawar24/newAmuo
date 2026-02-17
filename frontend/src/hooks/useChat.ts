'use client';

import { useEffect, useCallback } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { useSocket } from './useSocket';
import type { ChatMessage } from '@/types/chat';

export function useChat(chatRoomId?: string) {
  const {
    rooms, messages, activeRoom, hasMore, cursor, isLoading, typingUsers,
    fetchRooms, fetchMessages, setActiveRoom, addMessage,
    setTyping, updatePriceOffer, markRoomRead,
  } = useChatStore();
  const { on, emit } = useSocket();

  // Join / leave room
  useEffect(() => {
    if (!chatRoomId) return;
    setActiveRoom(chatRoomId);
    fetchMessages(chatRoomId);
    emit('chat:join', chatRoomId);

    return () => {
      emit('chat:leave', chatRoomId);
      setActiveRoom(null);
    };
  }, [chatRoomId, emit, setActiveRoom, fetchMessages]);

  // Listen for new messages
  useEffect(() => {
    const unsub1 = on('chat:new_message', (msg: unknown) => {
      addMessage(msg as ChatMessage);
    });
    const unsub2 = on('chat:typing', (data: unknown) => {
      const d = data as { userId: string; userName: string; isTyping: boolean; chatRoomId: string };
      setTyping(d.chatRoomId, d.userId, d.userName, d.isTyping);
    });
    const unsub3 = on('chat:price_update', (msg: unknown) => {
      updatePriceOffer(msg as ChatMessage);
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [on, addMessage, setTyping, updatePriceOffer]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!chatRoomId) return;
      emit('chat:message', { chatRoomId, content });
    },
    [chatRoomId, emit]
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!chatRoomId) return;
      emit('chat:typing', { chatRoomId, isTyping });
    },
    [chatRoomId, emit]
  );

  const sendPriceOffer = useCallback(
    (amount: number) => {
      if (!chatRoomId) return;
      emit('chat:price_offer', { chatRoomId, amount });
    },
    [chatRoomId, emit]
  );

  const loadMore = useCallback(() => {
    if (chatRoomId && hasMore && cursor) {
      fetchMessages(chatRoomId, cursor);
    }
  }, [chatRoomId, hasMore, cursor, fetchMessages]);

  return {
    rooms, messages, activeRoom, hasMore, isLoading, typingUsers,
    fetchRooms, sendMessage, sendTyping, sendPriceOffer, loadMore, markRoomRead,
  };
}
