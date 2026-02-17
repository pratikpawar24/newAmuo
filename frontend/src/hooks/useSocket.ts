'use client';

import { useEffect, useCallback, useRef } from 'react';
import { getSocket, connectSocket, disconnectSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import type { Socket } from 'socket.io-client';

export function useSocket() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      connectSocket();
      socketRef.current = getSocket();
    }
    return () => {
      // Don't disconnect on unmount—shared connection
    };
  }, [isAuthenticated]);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    const s = getSocket();
    s.on(event, handler);
    return () => { s.off(event, handler); };
  }, []);

  const emit = useCallback((event: string, ...args: unknown[]) => {
    const s = getSocket();
    s.emit(event, ...args);
  }, []);

  return { socket: socketRef.current, on, emit };
}
