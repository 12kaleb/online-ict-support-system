'use client';

import Maintenance from '@/screens/Maintenance';
import { GuardedRoute } from '@/components/RouteGuards';

export default function MaintenancePage() {
  return <GuardedRoute>{(user) => <Maintenance user={user} />}</GuardedRoute>;
}
