'use client';

import AllTickets from '@/screens/AllTickets';
import { GuardedRoute } from '@/components/RouteGuards';
import { isPrivileged } from '@/lib/permissions';

export default function AllTicketsPage() {
  return (
    <GuardedRoute allow={isPrivileged}>
      {(user) => <AllTickets user={user} />}
    </GuardedRoute>
  );
}
