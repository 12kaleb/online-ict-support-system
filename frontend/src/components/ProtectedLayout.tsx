'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { useAuth } from '@/contexts/AuthContext';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return null;
  }

  return (
    <NotificationProvider user={user}>
      <Layout user={user} onLogout={logout}>
        {children}
      </Layout>
    </NotificationProvider>
  );
}
