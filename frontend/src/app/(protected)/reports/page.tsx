'use client';

import Reports from '@/screens/Reports';
import { GuardedRoute } from '@/components/RouteGuards';
import { isManager } from '@/lib/permissions';

export default function ReportsPage() {
  return (
    <GuardedRoute allow={isManager}>
      {() => <Reports />}
    </GuardedRoute>
  );
}
