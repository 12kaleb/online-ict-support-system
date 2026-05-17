'use client';

import Assets from '@/screens/Assets';
import { GuardedRoute } from '@/components/RouteGuards';
import { isPrivileged } from '@/lib/permissions';

export default function AssetsPage() {
  return <GuardedRoute allow={isPrivileged}>{(user) => <Assets user={user} />}</GuardedRoute>;
}
