'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const { user, isAuthenticated, isLoading, login, register, logout, fetchMe, updateUser } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated && isLoading) {
      fetchMe();
    }
  }, [isAuthenticated, isLoading, fetchMe]);

  return { user, isAuthenticated, isLoading, login, register, logout, fetchMe, updateUser };
}
