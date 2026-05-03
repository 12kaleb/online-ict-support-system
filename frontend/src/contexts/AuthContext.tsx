'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { handleResponse } from '@/utils/apiUtils';

type AuthContextValue = {
  user: any;
  loading: boolean;
  setUser: (user: any) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          setUser(await handleResponse(res));
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      setUser,
      logout: async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } finally {
          setUser(null);
        }
      },
    }),
    [loading, user],
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
