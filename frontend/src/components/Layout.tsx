'use client';

import { useNavigate, Link, useLocation } from '../lib/router';
import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { LogOut, User as UserIcon, LayoutDashboard, Ticket, HelpCircle, UserCircle, Bell, Sun, Moon, Shield, BarChart3, Laptop, Calendar, Check, Languages, History, ChevronDown, Users } from 'lucide-react';
import { useThemeContext } from '../contexts/ThemeContext';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { safeDate } from '../utils/dateUtils';
import { motion, AnimatePresence } from 'motion/react';
import { canInviteStaff, isAdmin, isManager, isPrivileged } from '../lib/permissions';
import { cn } from '../lib/utils';

import { useNotifications } from '../contexts/NotificationContext';

const DEFAULT_SIDEBAR_WIDTH = 288;
const MIN_SIDEBAR_WIDTH = 224;
const MAX_SIDEBAR_WIDTH = 420;

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
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([]);
  const isAdminUser = isAdmin(user);
  const isManagerLevel = isManager(user);
  const isPrivilegedUser = isPrivileged(user);
  const canInviteStaffUser = canInviteStaff(user);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const recentMenuRef = useRef<HTMLDivElement>(null);
  const sidebarWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);

  useEffect(() => {
    const savedWidth = Number(localStorage.getItem('sidebarWidth'));
    if (Number.isFinite(savedWidth)) {
      const nextWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, savedWidth));
      sidebarWidthRef.current = nextWidth;
      setSidebarWidth(nextWidth);
    }
  }, []);

  const handleResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidthRef.current;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, startWidth + moveEvent.clientX - startX));
      sidebarWidthRef.current = nextWidth;
      setSidebarWidth(nextWidth);
    };

    const handleUp = () => {
      localStorage.setItem('sidebarWidth', String(sidebarWidthRef.current));
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const resetSidebarWidth = () => {
    sidebarWidthRef.current = DEFAULT_SIDEBAR_WIDTH;
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    localStorage.setItem('sidebarWidth', String(DEFAULT_SIDEBAR_WIDTH));
  };

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
    { label: t('Dashboard'), path: '/dashboard', icon: <LayoutDashboard size={18} /> },
    { label: t('Maintenance'), path: '/maintenance', icon: <Calendar size={18} /> },
    { label: t('FAQ'), path: '/faq', icon: <HelpCircle size={18} /> },
  ];

  if (isPrivilegedUser) {
    navItems.splice(1, 0, { label: t('All Tickets'), path: '/tickets/all', icon: <Ticket size={18} /> });
    navItems.splice(2, 0, { label: t('Assets'), path: '/assets', icon: <Laptop size={18} /> });
  }
  
  if (isManagerLevel) {
    navItems.splice(2, 0, { label: t('Reports'), path: '/reports', icon: <BarChart3 size={18} /> });
    navItems.splice(3, 0, { label: t('Technicians'), path: '/reports/technicians', icon: <Users size={18} /> });
    if (canInviteStaffUser) {
      navItems.push({ label: isAdminUser ? t('Admin') : t('Invite Staff'), path: '/admin', icon: <Shield size={18} /> });
    }
  }

  const isNavItemActive = (path: string) =>
    pathname === path || (path !== '/reports' && pathname.startsWith(`${path}/`));

  return (
    <div
      className="flex min-h-screen flex-col text-slate-900 transition-colors duration-200 dark:text-slate-100 lg:flex-row"
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      {/* Sidebar */}
      <motion.header
        initial={{ y: -18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80 lg:fixed lg:inset-y-0 lg:left-0 lg:h-screen lg:w-[var(--sidebar-width)] lg:border-b-0 lg:border-r"
      >
        <div className="app-shell lg:flex lg:h-full lg:max-w-none lg:flex-col lg:px-4">
          <div className="flex min-h-16 items-center justify-between gap-3 py-2 lg:h-full lg:flex-col lg:items-stretch lg:gap-4 lg:py-5">
            {/* Logo */}
            <div className="flex min-w-0 items-center gap-6 lg:flex-col lg:items-stretch">
              <Link to="/dashboard" className="flex items-center gap-2 group">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm transition-transform group-hover:scale-105 group-active:scale-95 dark:bg-white dark:text-slate-950">
                  <Ticket size={20} />
                </div>
                <span className="hidden text-lg font-black tracking-tight text-slate-950 dark:text-white sm:block lg:block">
                  {t('ICT Support')}
                </span>
              </Link>

              {/* Desktop Sidebar Nav */}
              <nav className="hidden max-h-[calc(100vh-15rem)] items-stretch gap-1 overflow-y-auto pr-1 lg:flex lg:flex-col">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "relative flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-all",
                      isNavItemActive(item.path)
                        ? "text-white shadow-sm dark:text-slate-950"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    )}
                  >
                    {isNavItemActive(item.path) && (
                      <motion.span
                        layoutId="desktop-nav-active"
                        className="absolute inset-0 rounded-xl bg-slate-950 dark:bg-white"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      {item.icon}
                      {item.label}
                    </span>
                  </Link>
                ))}
              </nav>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center justify-end gap-1.5 lg:mt-auto lg:w-full lg:flex-col lg:items-stretch lg:gap-3">
              <div className="flex items-center justify-end gap-1.5 lg:-mt-2 lg:-ml-1 lg:mr-auto lg:grid lg:w-fit lg:grid-cols-4 lg:rounded-2xl lg:border lg:border-slate-200/80 lg:bg-slate-50/70 lg:p-1.5 lg:dark:border-slate-800 lg:dark:bg-slate-900/70">
                {/* Language */}
                <div className="relative" ref={langMenuRef}>
                  <button
                    onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                    className="icon-btn pressable"
                    aria-label={t('Language')}
                  >
                    <Languages size={20} />
                  </button>
                  <AnimatePresence>
                    {isLangMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="menu-surface absolute right-0 mt-2 w-40 p-1 lg:bottom-full lg:left-0 lg:right-auto lg:mt-0 lg:mb-2"
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
                    className="icon-btn pressable"
                    aria-label={t('Recently Viewed')}
                  >
                    <History size={20} />
                  </button>
                  <AnimatePresence>
                    {isRecentMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="menu-surface absolute right-0 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden lg:bottom-full lg:left-0 lg:right-auto lg:mt-0 lg:mb-2"
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
                  className="icon-btn pressable"
                  aria-label={mode === 'light' ? t('Dark mode') : t('Light mode')}
                >
                  {mode === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>

                {/* Notifications */}
                <div className="relative" ref={notifMenuRef}>
                  <button
                    onClick={() => setIsNotifMenuOpen(!isNotifMenuOpen)}
                    className="icon-btn pressable relative"
                    aria-label={t('Notifications')}
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
                        className="menu-surface absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden lg:bottom-full lg:left-0 lg:right-auto lg:mt-0 lg:mb-2"
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
                              <div
                                key={n.id}
                                className={cn(
                                  "p-4 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0",
                                  n.read ? "opacity-60" : "bg-blue-50/30 dark:bg-blue-900/10 border-l-4 border-l-blue-600"
                                )}
                              >
                                <button
                                  onClick={async () => {
                                    await markAsRead(n.id);
                                    if (n.link) navigate(n.link);
                                    setIsNotifMenuOpen(false);
                                  }}
                                  className="w-full text-left"
                                >
                                  <p className={cn("text-sm", !n.read && "font-bold")}>{n.title}</p>
                                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                  <p className="text-[10px] text-slate-400 mt-1">
                                    {format(safeDate(n.createdAt), 'MMM dd, HH:mm')}
                                  </p>
                                </button>
                                {!n.read && (
                                  <button
                                    onClick={() => markAsRead(n.id)}
                                    className="mt-2 text-[10px] font-bold uppercase text-blue-600 transition-colors hover:text-blue-700"
                                  >
                                    Mark read
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 sm:block lg:hidden" />

              {/* User Profile */}
              <div className="relative lg:w-full lg:border-t lg:border-slate-200 lg:pt-3 lg:dark:border-slate-800" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="pressable flex items-center gap-3 rounded-xl p-1 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 lg:w-full lg:rounded-2xl lg:border lg:border-blue-200/80 lg:bg-blue-50/90 lg:p-3 lg:text-left lg:shadow-sm lg:shadow-blue-900/5 lg:hover:bg-blue-100/80 lg:dark:border-blue-900/60 lg:dark:bg-blue-950/45 lg:dark:hover:bg-blue-950/65"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-black uppercase text-white shadow-sm shadow-blue-600/20 lg:h-11 lg:w-11">
                    {user?.name?.[0]}
                  </div>
                  <div className="hidden min-w-0 flex-1 sm:block text-right lg:text-left">
                    <p className="truncate text-xs font-black leading-none text-slate-950 dark:text-white lg:text-sm">{user?.name}</p>
                    <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">{user?.role || t('Admin')}</p>
                  </div>
                  <ChevronDown
                    size={17}
                    className={cn(
                      "hidden shrink-0 text-slate-400 transition-transform lg:block",
                      isUserMenuOpen && "rotate-180"
                    )}
                  />
                </button>
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="menu-surface absolute right-0 mt-2 w-48 p-1 lg:bottom-full lg:left-0 lg:right-auto lg:mt-0 lg:mb-2 lg:w-full"
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
          <nav className="-mx-1 flex gap-1 overflow-x-auto pb-2 lg:hidden">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                  className={cn(
                    "relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition-all",
                  isNavItemActive(item.path)
                    ? "text-white dark:text-slate-950"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                )}
              >
                {isNavItemActive(item.path) && (
                  <motion.span
                    layoutId="mobile-nav-active"
                    className="absolute inset-0 rounded-xl bg-slate-950 dark:bg-white"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {item.icon}
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>
        </div>
        <button
          type="button"
          onPointerDown={handleResizeStart}
          onDoubleClick={resetSidebarWidth}
          className="group absolute inset-y-0 right-[-5px] hidden w-3 cursor-col-resize items-center justify-center lg:flex"
          aria-label={t('Resize sidebar')}
          title={t('Drag to resize sidebar. Double-click to reset.')}
        >
          <span className="h-16 w-1 rounded-full bg-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-slate-700" />
        </button>
      </motion.header>

      {/* Main Content */}
      <main className="flex-grow py-6 sm:py-8 lg:pl-[var(--sidebar-width)]">
        <div className="app-shell">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
