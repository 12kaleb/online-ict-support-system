'use client';

import Login from '@/screens/Login';
import { PublicOnlyRoute } from '@/components/RouteGuards';

export default function LoginPage() {
  return (
    <PublicOnlyRoute>
      {(onLogin) => <Login onLogin={onLogin} />}
    </PublicOnlyRoute>
  );
}
