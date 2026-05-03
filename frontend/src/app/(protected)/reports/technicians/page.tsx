'use client';

import TechnicianReports from '@/screens/TechnicianReports';
import { GuardedRoute } from '@/components/RouteGuards';
import { isManager } from '@/lib/permissions';

export default function TechnicianReportsPage() {
  return (
    <GuardedRoute allow={isManager}>
      {() => <TechnicianReports />}
    </GuardedRoute>
  );
}
