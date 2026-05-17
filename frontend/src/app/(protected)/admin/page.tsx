'use client';

import Admin from '@/screens/Admin';
import { GuardedRoute } from '@/components/RouteGuards';
import { canInviteStaff } from '@/lib/permissions';

export default function AdminPage() {
  return (
    <GuardedRoute allow={canInviteStaff}>
      {() => <Admin />}
    </GuardedRoute>
  );
}
