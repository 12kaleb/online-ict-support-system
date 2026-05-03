'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

type User = any;

export function GuardedRoute({
  allow,
  redirectTo = '/',
  children,
}: {
  allow?: (user: User) => boolean;
  redirectTo?: string;
  children: (user: User) => React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const canAccess = user && (allow ? allow(user) : true);

  useEffect(() => {
    if (!loading && user && !canAccess) {
      router.replace(redirectTo);
    }
  }, [canAccess, loading, redirectTo, router, user]);

  if (loading || !user || !canAccess) {
    return null;
  }

  return <>{children(user)}</>;
}

export function PublicOnlyRoute({
  children,
}: {
  children: (onLogin: (user: User) => void) => React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading, setUser } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [loading, router, user]);

  if (loading || user) {
    return null;
  }

  return (
    <>
      {children((nextUser) => {
        setUser(nextUser);
        router.replace('/');
      })}
    </>
  );
}
