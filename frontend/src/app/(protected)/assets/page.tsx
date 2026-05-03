'use client';

import Assets from '@/screens/Assets';
import { GuardedRoute } from '@/components/RouteGuards';

export default function AssetsPage() {
  return <GuardedRoute>{(user) => <Assets user={user} />}</GuardedRoute>;
}
