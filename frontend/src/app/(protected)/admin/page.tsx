'use client';

import Admin from '@/screens/Admin';
import { GuardedRoute } from '@/components/RouteGuards';
import { isAdmin } from '@/lib/permissions';

export default function AdminPage() {
  return (
    <GuardedRoute allow={isAdmin}>
      {() => <Admin />}
    </GuardedRoute>
  );
}
