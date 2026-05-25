'use client';

import Dashboard from '@/screens/Dashboard';
import { GuardedRoute } from '@/components/RouteGuards';

export default function DashboardPage() {
  return <GuardedRoute>{(user) => <Dashboard user={user} />}</GuardedRoute>;
}
