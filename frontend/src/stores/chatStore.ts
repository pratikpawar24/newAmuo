import { create } from 'zustand';
import api from '@/lib/api';
import type { ChatRoom, ChatMessage } from '@/types/chat';

interface ChatState {
  rooms: ChatRoom[];
  messages: ChatMessage[];
  activeRoom: string | null;
  hasMore: boolean;
  cursor: string | null;
  isLoading: boolean;
  typingUsers: Record<string, { userName: string; isTyping: boolean }>;
  fetchRooms: () => Promise<void>;
  fetchMessages: (chatRoomId: string, cursor?: string) => Promise<void>;
  setActiveRoom: (roomId: string | null) => void;
  addMessage: (message: ChatMessage) => void;
  setTyping: (chatRoomId: string, userId: string, userName: string, isTyping: boolean) => void;
  updatePriceOffer: (message: ChatMessage) => void;
  markRoomRead: (chatRoomId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  rooms: [],
  messages: [],
  activeRoom: null,
  hasMore: false,
  cursor: null,
  isLoading: false,
  typingUsers: {},

  fetchRooms: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/chat/rooms');
      set({ rooms: data.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchMessages: async (chatRoomId, cursor) => {
    set({ isLoading: true });
    try {
      const params: Record<string, string> = { limit: '30' };
      if (cursor) params.cursor = cursor;
      const { data } = await api.get(`/chat/rooms/${chatRoomId}/messages`, { params });
      const existing = cursor ? get().messages : [];
      set({
        messages: [...data.data.messages.reverse(), ...existing],
        hasMore: data.data.hasMore,
        cursor: data.data.nextCursor,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setActiveRoom: (roomId) => {
    set({ activeRoom: roomId, messages: [], hasMore: false, cursor: null });
  },

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
      rooms: state.rooms.map((r) =>
        r.chatRoomId === message.chatRoomId
          ? { ...r, lastMessage: message, unreadCount: r.chatRoomId === state.activeRoom ? 0 : r.unreadCount + 1 }
          : r
      ),
    }));
  },

  setTyping: (chatRoomId, userId, userName, isTyping) => {
    set((state) => ({
      typingUsers: { ...state.typingUsers, [userId]: { userName, isTyping } },
    }));
  },

  updatePriceOffer: (message) => {
    set((state) => ({
      messages: state.messages.map((m) => (m._id === message._id ? message : m)),
    }));
  },

  markRoomRead: (chatRoomId) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.chatRoomId === chatRoomId ? { ...r, unreadCount: 0 } : r
      ),
    }));
  },
}));
