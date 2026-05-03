'use client';

import Dashboard from '@/screens/Dashboard';
import { GuardedRoute } from '@/components/RouteGuards';

export default function HomePage() {
  return <GuardedRoute>{(user) => <Dashboard user={user} />}</GuardedRoute>;
}
