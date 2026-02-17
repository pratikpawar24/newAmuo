import { create } from 'zustand';
import api from '@/lib/api';
import Cookies from 'js-cookie';
import { connectSocket, disconnectSocket, resetSocket } from '@/lib/socket';
import type { User, LoginPayload, RegisterPayload } from '@/types/user';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (payload) => {
    const { data } = await api.post('/auth/login', payload);
    if (data.data?.accessToken) {
      Cookies.set('accessToken', data.data.accessToken, { expires: 1 / 96 });
    }
    const u = data.data.user;
    const user = { ...u, name: u.name || u.fullName, avatar: u.avatar || u.avatarUrl };
    set({ user, isAuthenticated: true, isLoading: false });
    resetSocket();
    connectSocket();
  },

  register: async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    if (data.data?.accessToken) {
      Cookies.set('accessToken', data.data.accessToken, { expires: 1 / 96 });
    }
    const u = data.data.user;
    const user = { ...u, name: u.name || u.fullName, avatar: u.avatar || u.avatarUrl };
    set({ user, isAuthenticated: true, isLoading: false });
    resetSocket();
    connectSocket();
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    Cookies.remove('accessToken');
    disconnectSocket();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/me');
      const u = data.data;
      const user = { ...u, name: u.name || u.fullName, avatar: u.avatar || u.avatarUrl };
      set({ user, isAuthenticated: true, isLoading: false });
      connectSocket();
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateUser: (data) => {
    const current = get().user;
    if (current) set({ user: { ...current, ...data } });
  },
}));
