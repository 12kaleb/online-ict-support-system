'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Ticket, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  ExternalLink, 
  Filter, 
  MoreVertical, 
  Search, 
  X, 
  History, 
  UserPlus, 
  Zap, 
  Calendar, 
  Users, 
  BarChart2,
  ChevronRight,
  ArrowUpRight,
  Archive,
  Laptop
} from 'lucide-react';
import { Link } from '../lib/router';
import { useThemeContext } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { safeDate } from '../utils/dateUtils';
import { handleResponse } from '../utils/apiUtils';
import { cn } from '../lib/utils';
import { canInviteStaff, isAdmin, isManager, isPrivileged } from '../lib/permissions';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#6366f1'] as const;
const containerMotion = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemMotion = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

export default function Dashboard({ user }: { user: any }) {
  const { t } = useTranslation();
  const { mode } = useThemeContext();
  const isAdminUser = isAdmin(user);
  const isManagerLevel = isManager(user);
  const canInviteStaffUser = canInviteStaff(user);
  const [tickets, setTickets] = useState<any[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<any[]>([]);
  const [maintenanceTasks, setMaintenanceTasks] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [selectedTechId, setSelectedTechId] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ticketsUrl = isPrivileged(user) ? '/api/tickets/all' : '/api/tickets';

        const requests: Promise<Response>[] = [
          fetch(ticketsUrl),
          fetch('/api/stats'),
        ];

        if (isPrivileged(user)) {
          requests.push(fetch('/api/technicians'));
        }

        if (user?.role === 'technician') {
          requests.push(fetch('/api/maintenance'));
        }

        const [ticketsRes, statsRes, techsRes, maintenanceRes] = await Promise.all(requests);
        if (!ticketsRes || !statsRes) {
          throw new Error('Dashboard data request failed to initialize.');
        }

        const ticketsData = await handleResponse(ticketsRes);
        const safeTickets = Array.isArray(ticketsData) ? ticketsData : [];
        setTickets(safeTickets);
        setFilteredTickets(safeTickets);
        
        if (user?.role === 'technician') {
          setMyTickets(safeTickets.filter(t => t.assignedTo === user.id));
          if (!maintenanceRes) {
            throw new Error('Maintenance request failed to initialize.');
          }
          const maintenanceData = await handleResponse(maintenanceRes);
          setMaintenanceTasks(Array.isArray(maintenanceData) ? maintenanceData : []);
        }

        setStats(await handleResponse(statsRes));
        if (techsRes?.ok) setTechnicians(await handleResponse(techsRes));
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const recent = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
    setRecentlyViewed(recent);
  }, [user]);

  const handleOpenAssign = (ticket: any) => {
    setSelectedTicket(ticket);
    setSelectedTechId(ticket.assignedTo || '');
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedTicket) return;
    try {
      const res = await fetch(`/api/tickets/${selectedTicket.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: selectedTechId })
      });
      if (res.ok) {
        const updated = await res.json();
        setTickets(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated, technician: technicians.find(tech => tech.id === selectedTechId) } : t));
        setAssignDialogOpen(false);
      }
    } catch (err) {
      console.error("Assign error:", err);
    }
  };

  useEffect(() => {
    let result = tickets;

    if (search) {
      result = result.filter(t => 
        t.title.toLowerCase().includes(search.toLowerCase()) || 
        t.description.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(t => t.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter);
    }

    if (categoryFilter !== 'all') {
      result = result.filter(t => t.category === categoryFilter);
    }

    setFilteredTickets(result);
  }, [search, statusFilter, priorityFilter, categoryFilter, tickets]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setCategoryFilter('all');
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'open': return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case 'in-progress': return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case 'pending-confirmation': return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
      case 'resolved': return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      default: return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return "text-red-600 dark:text-red-400";
      case 'high': return "text-orange-600 dark:text-orange-400";
      case 'medium': return "text-blue-600 dark:text-blue-400";
      case 'low': return "text-emerald-600 dark:text-emerald-400";
      default: return "text-slate-600 dark:text-slate-400";
    }
  };

  const chartData = useMemo(() => stats?.byCategory?.map((c: any) => ({ 
    name: c.category, 
    count: c._count?.id || 0
  })) || [], [stats]);

  const pieData = useMemo(() => [
    { name: t('Open'), value: stats?.open || 0 },
    { name: t('Pending'), value: stats?.pending || 0 },
    { name: t('Pending Confirmation'), value: stats?.pendingConfirmation || 0 },
    { name: t('Resolved'), value: stats?.resolved || 0 },
    { name: t('Closed'), value: stats?.closed || 0 },
  ].filter(d => d.value > 0), [stats, t]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
      <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-slate-500 font-medium animate-pulse">{t('Loading your dashboard...')}</p>
    </div>
  );

  return (
    <motion.div
      variants={containerMotion}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-10"
    >
      {/* Header */}
      <motion.div variants={itemMotion} className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="page-title">
            {t('Welcome back')}, {user?.name?.split(' ')[0]}
          </h1>
          <p className="page-subtitle">
            {t("Here's what's happening with your support tickets today.")}
          </p>
        </div>
        {user?.role === 'staff' && (
          <Link 
            to="/tickets/new"
            className="btn-primary interactive-lift"
          >
            <Plus size={20} />
            {t('Create New Ticket')}
          </Link>
        )}
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={containerMotion} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { label: t('Total Tickets'), value: stats?.total, icon: <Ticket size={24} />, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: t('Open Issues'), value: stats?.open, icon: <AlertCircle size={24} />, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
          { label: t('In Progress'), value: stats?.pending, icon: <Clock size={24} />, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
          { label: t('Resolved'), value: stats?.resolved, icon: <CheckCircle size={24} />, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
          { label: t('Closed'), value: stats?.closed, icon: <Archive size={24} />, color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800" },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            variants={itemMotion}
            whileHover={{ y: -4, scale: 1.015 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="surface-compact flex items-center gap-5 p-5"
          >
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", stat.bg, stat.color)}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-2xl font-black tabular-nums text-slate-950 dark:text-white">{stat.value || 0}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Actions & My Tasks */}
      <motion.div variants={itemMotion} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Section (Tasks or Actions) */}
        <div className="lg:col-span-8">
          <div className="surface h-full p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600">
                  <Zap size={24} />
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  {user?.role === 'technician' ? t('My Assigned Tasks') : t('Quick Actions')}
                </h2>
              </div>
              {user?.role === 'technician' && (
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full">
                  {myTickets.length + maintenanceTasks.length} {t('Active')}
                </span>
              )}
            </div>

            {user?.role === 'technician' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(myTickets.length > 0 || maintenanceTasks.length > 0) ? (
                  <>
                    {myTickets.slice(0, 2).map((t) => (
                      <Link 
                        key={t.id} 
                        to={`/tickets/${t.id}`}
                        className="interactive-lift group p-5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/5 transition-all"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-xs font-bold text-slate-400">#{t.id.slice(-5)}</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider",
                            getStatusStyles(t.status)
                          )}>
                            {t.status}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors line-clamp-1 mb-1">
                          {t.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t.category}</p>
                      </Link>
                    ))}
                    {maintenanceTasks.slice(0, 2).map((task) => (
                      <Link
                        key={task.id}
                        to="/maintenance"
                        className="interactive-lift group p-5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-xl hover:shadow-amber-500/5 transition-all"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-xs font-bold text-slate-400">{t('Maint.')}</span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            {task.status}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors line-clamp-1 mb-1">
                          {task.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {task.type}
                        </p>
                      </Link>
                    ))}
                  </>
                ) : (
                  <div className="col-span-2 py-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-slate-500 font-medium">{t('No tasks assigned to you.')}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: t('Schedule Maintenance'), icon: <Calendar size={24} />, to: '/maintenance', color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
                  { label: isAdminUser ? t('Manage Users') : t('Invite Staff'), icon: <Users size={24} />, to: '/admin', color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", inviteOnly: true },
                  { label: t('View Reports'), icon: <BarChart2 size={24} />, to: '/reports', color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20", managerOnly: true },
                  { label: t('Inventory'), icon: <Laptop size={24} />, to: '/assets', color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20", privilegedOnly: true },
                ].filter(a => (!a.inviteOnly || canInviteStaffUser) && (!a.privilegedOnly || isPrivileged(user)) && (!a.managerOnly || isManagerLevel)).map((action, i) => (
                  <Link 
                    key={i} 
                    to={action.to}
                    className="interactive-lift group p-6 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/5 transition-all text-center flex flex-col items-center gap-3"
                  >
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", action.bg, action.color)}>
                      {action.icon}
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{action.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recently Viewed */}
        <div className="lg:col-span-4">
          <div className="surface flex h-full flex-col p-6">
            <div className="flex items-center gap-2 mb-6">
              <History size={20} className="text-slate-400" />
              <h2 className="text-lg font-black text-slate-900 dark:text-white">{t('Recently Viewed')}</h2>
            </div>
            <div className="space-y-3 flex-1">
              {recentlyViewed.length > 0 ? (
                recentlyViewed.map((ticket) => (
                  <Link 
                    key={ticket.id} 
                    to={`/tickets/${ticket.id}`}
                    className="interactive-lift flex items-center justify-between p-4 rounded-2xl border border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-blue-500/30 transition-all group"
                  >
                    <div className="min-w-0 flex-1 mr-4">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                        {ticket.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider",
                          getStatusStyles(ticket.status)
                        )}>
                          {ticket.status}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {safeDate(ticket.viewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </Link>
                ))
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-8 opacity-50">
                  <p className="text-sm text-slate-500 font-medium">{t('No recently viewed tickets')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Search and Filters */}
      <motion.div variants={itemMotion} className="surface p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={t("Search tickets...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field pl-10"
            />
          </div>
          <div className="lg:col-span-2">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="field appearance-none"
            >
              <option value="all">{t('All Status')}</option>
              <option value="open">{t('Open')}</option>
              <option value="in-progress">{t('In Progress')}</option>
              <option value="pending-confirmation">{t('Pending Confirmation')}</option>
              <option value="resolved">{t('Resolved')}</option>
              <option value="closed">{t('Closed')}</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <select 
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="field appearance-none"
            >
              <option value="all">{t('All Priority')}</option>
              <option value="low">{t('low')}</option>
              <option value="medium">{t('medium')}</option>
              <option value="high">{t('high')}</option>
              <option value="critical">{t('critical')}</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <select 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="field appearance-none"
            >
              <option value="all">{t('All Category')}</option>
              <option value="Hardware">{t('Hardware')}</option>
              <option value="Software">{t('Software')}</option>
              <option value="Network">{t('Network')}</option>
              <option value="Account/Access">{t('Account/Access')}</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <button 
              onClick={clearFilters}
              disabled={search === '' && statusFilter === 'all' && priorityFilter === 'all' && categoryFilter === 'all'}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-slate-500 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <X size={16} />
              {t('Clear')}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Charts Section */}
      <motion.div variants={itemMotion} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="surface flex h-[450px] flex-col p-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">{t('Tickets by Category')}</h2>
              <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <Filter size={20} />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={mode === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: mode === 'light' ? '#64748b' : '#94a3b8', fontSize: 12, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: mode === 'light' ? '#64748b' : '#94a3b8', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                      backgroundColor: mode === 'light' ? '#fff' : '#0f172a',
                      color: mode === 'light' ? '#1e293b' : '#f8fafc',
                      padding: '12px'
                    }}
                    cursor={{ fill: mode === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)' }}
                  />
                  <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="lg:col-span-4">
          <div className="surface flex h-[450px] flex-col p-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-8">{t('Status Distribution')}</h2>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length] ?? COLORS[0]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                      backgroundColor: mode === 'light' ? '#fff' : '#0f172a'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              {pieData.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] ?? COLORS[0] }} />
                  <span className="text-xs font-bold text-slate-500">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Recent Tickets Table */}
      <motion.div variants={itemMotion} className="surface overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">{t('Recent Activity')}</h2>
          <Link 
            to="/tickets/all"
            className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
          >
            {t('View All')}
            <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Ticket Details')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Category')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Priority')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Status')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Assigned')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Created')}</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filteredTickets.slice(0, 10).map((ticket) => (
                <motion.tr
                  key={ticket.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                        #{ticket.id.slice(-3)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">{ticket.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">By {ticket.user?.name || 'User'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{ticket.category}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full", 
                        ticket.priority === 'critical' ? 'bg-red-500' : 
                        ticket.priority === 'high' ? 'bg-orange-500' : 
                        ticket.priority === 'medium' ? 'bg-blue-500' : 'bg-emerald-500'
                      )} />
                      <span className={cn("text-sm font-bold capitalize", getPriorityColor(ticket.priority))}>
                        {ticket.priority}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                      getStatusStyles(ticket.status)
                    )}>
                      {ticket.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {ticket.technician ? (
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
                          {ticket.technician.name[0]}
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{ticket.technician.name}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic font-medium">{t('Unassigned')}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                      {safeDate(ticket.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isManagerLevel && (
                        <button 
                          onClick={() => handleOpenAssign(ticket)}
                          className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          title={t("Assign Technician")}
                        >
                          <UserPlus size={18} />
                        </button>
                      )}
                      <Link 
                        to={`/tickets/${ticket.id}`}
                        className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        <MoreVertical size={18} />
                      </Link>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filteredTickets.length === 0 && (
            <div className="py-20 text-center">
              <div className="inline-flex p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full text-slate-300 dark:text-slate-700 mb-4">
                <Search size={40} />
              </div>
              <p className="text-slate-500 font-medium">{t('No tickets found matching your filters.')}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Assign Technician Dialog */}
      <AnimatePresence>
        {assignDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAssignDialogOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="surface relative w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{t('Assign Technician')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  {t('Assigning to')}: <span className="font-bold text-slate-700 dark:text-slate-200">{selectedTicket?.title}</span>
                </p>

                <div className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{t("Select Technician")}</label>
                    <select 
                      value={selectedTechId}
                      onChange={(e) => setSelectedTechId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none appearance-none"
                    >
                      <option value="">{t('Unassigned')}</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>{tech.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={handleAssign}
                      disabled={selectedTechId === (selectedTicket?.assignedTo || '')}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('Assign')}
                    </button>
                    <button 
                      onClick={() => setAssignDialogOpen(false)}
                      className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      {t('Close')}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
