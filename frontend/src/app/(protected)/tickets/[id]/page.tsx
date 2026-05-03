'use client';

import TicketDetail from '@/screens/TicketDetail';
import { GuardedRoute } from '@/components/RouteGuards';

export default function TicketDetailPage() {
  return <GuardedRoute>{(user) => <TicketDetail user={user} />}</GuardedRoute>;
}
