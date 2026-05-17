'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { handleResponse } from '@/utils/apiUtils';

type AuthContextValue = {
  user: any;
  loading: boolean;
  setUser: (user: any) => void;
  refreshUser: () => Promise<any>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const res = await fetch('/api/auth/me');
    if (!res.ok) {
      setUser(null);
      return null;
    }

    const nextUser = await handleResponse(res);
    setUser(nextUser);
    return nextUser;
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await refreshUser();
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') {
        refreshUser().catch((error) => {
          console.error('Failed to refresh user:', error);
        });
      }
    };

    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    const intervalId = window.setInterval(refreshOnReturn, 30000);

    return () => {
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
      window.clearInterval(intervalId);
    };
  }, [refreshUser, user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      setUser,
      refreshUser,
      logout: async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } finally {
          setUser(null);
        }
      },
    }),
    [loading, refreshUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
