'use client';

import '@/i18n';
import { Toaster } from 'sonner';
import { ThemeContextProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import AppBootstrap from '@/components/AppBootstrap';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeContextProvider>
      <AppBootstrap>
        <AuthProvider>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </AppBootstrap>
    </ThemeContextProvider>
  );
}
