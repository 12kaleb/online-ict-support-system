'use client';

import { useEffect, useState } from 'react';
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
  const { user, loading, refreshUser } = useAuth();
  const [verifying, setVerifying] = useState(true);
  const canAccess = user && (allow ? allow(user) : true);

  useEffect(() => {
    let cancelled = false;

    const verifyAccess = async () => {
      if (loading) return;

      if (!user) {
        setVerifying(false);
        return;
      }

      try {
        const freshUser = await refreshUser();
        if (!cancelled && freshUser && allow && !allow(freshUser)) {
          router.replace(redirectTo);
        }
      } catch {
        if (!cancelled) {
          router.replace('/login');
        }
      } finally {
        if (!cancelled) {
          setVerifying(false);
        }
      }
    };

    setVerifying(true);
    verifyAccess();

    return () => {
      cancelled = true;
    };
  }, [allow, loading, redirectTo, refreshUser, router, user?.id]);

  useEffect(() => {
    if (!verifying && !loading && user && !canAccess) {
      router.replace(redirectTo);
    }
  }, [canAccess, loading, redirectTo, router, user, verifying]);

  if (loading || verifying || !user || !canAccess) {
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
