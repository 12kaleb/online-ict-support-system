'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import DatabaseError from '@/components/DatabaseError';

const healthCheckEnabled = process.env.NEXT_PUBLIC_ENABLE_HEALTH_CHECK === 'true';

export default function AppBootstrap({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );
  const [dbError, setDbError] = useState<{ error: string; code?: string } | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Back online!', { id: 'offline-toast' });
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.error('Network connection lost. Please check your internet connection.', {
        id: 'offline-toast',
        duration: Infinity,
        icon: <WifiOff size={18} />,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (isOffline) {
      handleOffline();
    }

    const initApp = async () => {
      if (!healthCheckEnabled) {
        setLoading(false);
        return;
      }

      try {
        const healthRes = await fetch('/api/health');

        if (!healthRes.ok) {
          console.warn(`Backend health check skipped: /api/health returned ${healthRes.status}.`);
          return;
        }

        const healthData = await healthRes.json();

        if (healthData?.status === 'error') {
          setDbError({
            error: healthData.error || healthData.message || 'Failed to connect to the database.',
            code: healthData.code,
          });
        }
      } catch (error: any) {
        console.warn('Backend health check skipped:', error);
      } finally {
        setLoading(false);
      }
    };

    initApp();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (loading) {
    return null;
  }

  if (dbError) {
    const retry = () => window.location.reload();
    const errorProps = dbError.code
      ? { error: dbError.error, code: dbError.code, onRetry: retry }
      : { error: dbError.error, onRetry: retry };

    return (
      <DatabaseError {...errorProps} />
    );
  }

  return <>{children}</>;
}
