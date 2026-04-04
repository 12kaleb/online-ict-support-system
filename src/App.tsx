import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate 
} from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CreateTicket from './pages/CreateTicket';
import TicketDetail from './pages/TicketDetail';
import FAQ from './pages/FAQ';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Reports from './pages/Reports';
import AllTickets from './pages/AllTickets';
import Assets from './pages/Assets';
import Maintenance from './pages/Maintenance';
import Layout from './components/Layout';
import DatabaseError from './components/DatabaseError';
import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { isAdmin, isManager, isPrivileged } from './lib/permissions';

import { NotificationProvider } from './contexts/NotificationContext';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [dbError, setDbError] = useState<{ error: string, code?: string } | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Back online!', { id: 'offline-toast' });
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error('Network connection lost. Please check your internet connection.', { 
        id: 'offline-toast',
        duration: Infinity,
        icon: <WifiOff size={18} />
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (isOffline) {
      handleOffline();
    }

    const initApp = async () => {
      try {
        // First check database health
        const healthRes = await fetch('/api/health');
        const healthData = await healthRes.json();
        
        if (!healthRes.ok || healthData.status === 'error') {
          setDbError({ 
            error: healthData.error || healthData.message || 'Failed to connect to the database.', 
            code: healthData.code 
          });
          setLoading(false);
          return;
        }

        // Then check auth
        const authRes = await fetch('/api/auth/me');
        if (authRes.ok) {
          const userData = await authRes.json();
          setUser(userData);
        }
      } catch (err: any) {
        console.error('App initialization failed:', err);
        // If /api/health fails completely (e.g. server down), it might be a connection issue
        if (err.message.includes('Failed to fetch')) {
           // This is likely a network error or server down, not necessarily a DB error
        }
      } finally {
        setLoading(false);
      }
    };

    initApp();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (loading) return null;

  if (dbError) {
    return (
      <DatabaseError 
        error={dbError.error} 
        code={dbError.code} 
        onRetry={() => window.location.reload()} 
      />
    );
  }

  const isAdminUser = isAdmin(user);
  const isManagerLevel = isManager(user);
  const isPrivilegedUser = isPrivileged(user);

  return (
    <>
      <NotificationProvider user={user}>
        <Router>
          <Routes>
            <Route path="/login" element={!user ? <Login onLogin={setUser} /> : <Navigate to="/" />} />
            
            <Route element={user ? <Layout user={user} onLogout={() => setUser(null)} /> : <Navigate to="/login" />}>
              <Route path="/" element={<Dashboard user={user} />} />
              <Route path="/tickets/all" element={isPrivilegedUser ? <AllTickets user={user} /> : <Navigate to="/" />} />
              <Route path="/tickets/new" element={<CreateTicket />} />
              <Route path="/tickets/:id" element={<TicketDetail user={user} />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/reports" element={isManagerLevel ? <Reports /> : <Navigate to="/" />} />
              <Route path="/assets" element={<Assets user={user} />} />
              <Route path="/maintenance" element={<Maintenance user={user} />} />
              <Route path="/admin" element={isAdminUser ? <Admin /> : <Navigate to="/" />} />
            </Route>
          </Routes>
        </Router>
      </NotificationProvider>

      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
