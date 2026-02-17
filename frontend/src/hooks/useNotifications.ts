'use client';

import { useEffect } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { useSocket } from './useSocket';
import type { Notification } from '@/stores/notificationStore';

export function useNotifications() {
  const store = useNotificationStore();
  const { on } = useSocket();

  useEffect(() => {
    store.fetchNotifications();
    store.fetchUnreadCount();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unsub = on('notification', (data: unknown) => {
      store.addNotification(data as Notification);
    });
    return unsub;
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps

  return store;
}
