'use client';

import { useNavigate, Link, useLocation } from '../lib/router';
import { useState, useEffect, useRef } from 'react';
import { LogOut, User as UserIcon, LayoutDashboard, Ticket, HelpCircle, UserCircle, Bell, Sun, Moon, Shield, BarChart3, Laptop, Calendar, Check, Languages, History, ChevronDown, Users } from 'lucide-react';
import { useThemeContext } from '../contexts/ThemeContext';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { safeDate } from '../utils/dateUtils';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { isAdmin, isManager, isPrivileged } from '../lib/permissions';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { useNotifications } from '../contexts/NotificationContext';

export default function Layout({ user, onLogout, children }: { user: any, onLogout: () => void, children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname ?? '';
  const { mode, toggleTheme } = useThemeContext();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false);
  const [isRecentMenuOpen, setIsRecentMenuOpen] = useState(false);
  
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([]);
  const isAdminUser = isAdmin(user);
  const isManagerLevel = isManager(user);
  const isPrivilegedUser = isPrivileged(user);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const recentMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setIsUserMenuOpen(false);
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) setIsLangMenuOpen(false);
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) setIsNotifMenuOpen(false);
      if (recentMenuRef.current && !recentMenuRef.current.contains(event.target as Node)) setIsRecentMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const loadRecent = () => {
      const recent = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
      setRecentlyViewed(recent);
    };
    loadRecent();
    window.addEventListener('recentlyViewedUpdated', loadRecent);
    return () => window.removeEventListener('recentlyViewedUpdated', loadRecent);
  }, []);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setIsLangMenuOpen(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    onLogout();
    navigate('/login');
  };

  const navItems = [
    { label: t('Dashboard'), path: '/', icon: <LayoutDashboard size={18} /> },
    { label: t('Assets'), path: '/assets', icon: <Laptop size={18} /> },
    { label: t('Maintenance'), path: '/maintenance', icon: <Calendar size={18} /> },
    { label: t('FAQ'), path: '/faq', icon: <HelpCircle size={18} /> },
  ];

  if (isPrivilegedUser) {
    navItems.splice(1, 0, { label: t('All Tickets'), path: '/tickets/all', icon: <Ticket size={18} /> });
  }
  
  if (isManagerLevel) {
    navItems.splice(2, 0, { label: t('Reports'), path: '/reports', icon: <BarChart3 size={18} /> });
    navItems.splice(3, 0, { label: t('Technicians'), path: '/reports/technicians', icon: <Users size={18} /> });
    if (isAdminUser) {
      navItems.push({ label: t('Admin'), path: '/admin', icon: <Shield size={18} /> });
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 group-hover:scale-105 transition-transform">
                  <Ticket size={20} />
                </div>
                <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {t('ICT Support')}
                </span>
              </Link>

              {/* Desktop Nav */}
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
                      pathname === item.path || (item.path === '/reports' && pathname.startsWith('/reports'))
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Language */}
              <div className="relative" ref={langMenuRef}>
                <button 
                  onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Languages size={20} />
                </button>
                <AnimatePresence>
                  {isLangMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-40 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-xl"
                    >
                      <button 
                        onClick={() => changeLanguage('en')}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          i18n.language === 'en' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                      >
                        English
                      </button>
                      <button 
                        onClick={() => changeLanguage('am')}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          i18n.language === 'am' ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                      >
                        Amharic
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* History */}
              <div className="relative" ref={recentMenuRef}>
                <button 
                  onClick={() => setIsRecentMenuOpen(!isRecentMenuOpen)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <History size={20} />
                </button>
                <AnimatePresence>
                  {isRecentMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
                    >
                      <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                        <h3 className="font-bold text-sm">{t('Recently Viewed')}</h3>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {recentlyViewed.length === 0 ? (
                          <div className="p-6 text-center text-slate-500 text-sm">
                            {t('No recently viewed tickets')}
                          </div>
                        ) : (
                          recentlyViewed.map((ticket) => (
                            <button
                              key={ticket.id}
                              onClick={() => {
                                navigate(`/tickets/${ticket.id}`);
                                setIsRecentMenuOpen(false);
                              }}
                              className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0"
                            >
                              <p className="font-bold text-sm truncate">{ticket.title}</p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">
                                  {ticket.status}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {format(safeDate(ticket.viewedAt), 'HH:mm')}
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {mode === 'light' ? <Moon size={20} /> : <Sun size={20} />}
              </button>

              {/* Notifications */}
              <div className="relative" ref={notifMenuRef}>
                <button 
                  onClick={() => setIsNotifMenuOpen(!isNotifMenuOpen)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {isNotifMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden"
                    >
                      <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="font-bold text-sm">{t('Notifications')}</h3>
                        <div className="flex items-center gap-2">
                          {unreadCount > 0 && <span className="text-[10px] font-bold text-blue-600 uppercase">{unreadCount} new</span>}
                          <button 
                            onClick={() => markAllAsRead()}
                            className="text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase transition-colors"
                          >
                            Mark all read
                          </button>
                        </div>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-slate-500 text-sm">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => {
                                if (n.link) navigate(n.link);
                                markAsRead(n.id);
                                setIsNotifMenuOpen(false);
                              }}
                              className={cn(
                                "w-full text-left p-4 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0",
                                n.read ? "opacity-60" : "bg-blue-50/30 dark:bg-blue-900/10 border-l-4 border-l-blue-600"
                              )}
                            >
                              <p className={cn("text-sm", !n.read && "font-bold")}>{n.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {format(safeDate(n.createdAt), 'MMM dd, HH:mm')}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

              {/* User Profile */}
              <div className="relative" ref={userMenuRef}>
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-3 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="hidden sm:block text-right">
                    <p className="text-xs font-bold leading-none">{user?.name}</p>
                    <p className="text-[10px] text-slate-500 capitalize leading-none mt-1">{user?.role}</p>
                  </div>
                  <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-600/20">
                    {user?.name?.[0]}
                  </div>
                </button>
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-xl"
                    >
                      <button 
                        onClick={() => { setIsUserMenuOpen(false); navigate('/profile'); }}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <UserCircle size={18} />
                        {t('Profile')}
                      </button>
                      <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                      <button 
                        onClick={handleLogout}
                        className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <LogOut size={18} />
                        {t('Logout')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-8">
        <div className="container mx-auto px-4 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
