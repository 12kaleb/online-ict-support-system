'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  UserPlus, 
  ExternalLink, 
  Download, 
  RefreshCw, 
  X,
  AlertCircle,
  Clock,
  CheckCircle,
  Trash2,
  FileText,
  Ticket,
  AlertTriangle,
  Activity,
  CheckCircle2,
  Archive,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Link } from '../lib/router';
import { useTranslation } from 'react-i18next';
import { safeDate } from '../utils/dateUtils';
import { useThemeContext } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const statusRank: Record<string, number> = {
  open: 0,
  'in-progress': 1,
  'pending-confirmation': 2,
  resolved: 3,
  closed: 4,
};

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function AllTickets({ user }: { user: any }) {
  const { t } = useTranslation();
  const { mode } = useThemeContext();
  const [tickets, setTickets] = useState<any[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState<any[]>([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  
  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Assignment Dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [selectedTechId, setSelectedTechId] = useState('');

  // Menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTicket, setMenuTicket] = useState<any>(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const [ticketsRes, techsRes] = await Promise.all([
        fetch('/api/tickets/all'),
        fetch('/api/technicians')
      ]);
      
      if (ticketsRes.ok) {
        const data = await ticketsRes.json();
        setTickets(Array.isArray(data) ? data : []);
      }
      if (techsRes.ok) {
        const data = await techsRes.json();
        setTechnicians(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    let result = tickets;

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(s) || 
        t.description.toLowerCase().includes(s) ||
        t.id.toLowerCase().includes(s) ||
        (t.user?.name && t.user.name.toLowerCase().includes(s))
      );
    }

    if (statusFilter !== 'all') result = result.filter(t => t.status === statusFilter);
    if (priorityFilter !== 'all') result = result.filter(t => t.priority === priorityFilter);
    if (categoryFilter !== 'all') result = result.filter(t => t.category === categoryFilter);
    if (techFilter !== 'all') {
      if (techFilter === 'unassigned') {
        result = result.filter(t => !t.assignedTo);
      } else {
        result = result.filter(t => t.assignedTo === techFilter);
      }
    }

    setFilteredTickets(result);
    setPage(0);
  }, [search, statusFilter, priorityFilter, categoryFilter, techFilter, tickets]);

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setCategoryFilter('all');
    setTechFilter('all');
    setPage(0);
  };

  const handleOpenAssign = (ticket: any) => {
    setSelectedTicket(ticket);
    setSelectedTechId(ticket.assignedTo || '');
    setAssignDialogOpen(true);
    setAnchorEl(null);
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
        fetchTickets();
        setAssignDialogOpen(false);
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Failed to assign technician');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign technician');
      console.error("Assign error:", err);
    }
  };

  const handleUpdateStatus = async (ticketId: string, status: string) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchTickets();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Failed to update ticket status');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update ticket status');
      console.error("Status update error:", err);
    }
    setAnchorEl(null);
  };

  const canMoveToStatus = (ticket: any, nextStatus: string) => {
    const currentRank = statusRank[ticket.status];
    const nextRank = statusRank[nextStatus];
    return currentRank !== undefined && nextRank !== undefined && nextRank >= currentRank;
  };

  const getStatusStyles = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400';
      case 'in-progress': return 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
      case 'pending-confirmation': return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400';
      case 'resolved': return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400';
      case 'closed': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
      default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical': return 'text-red-600 dark:text-red-400';
      case 'high': return 'text-orange-600 dark:text-orange-400';
      case 'medium': return 'text-blue-600 dark:text-blue-400';
      case 'low': return 'text-emerald-600 dark:text-emerald-400';
      default: return 'text-slate-600 dark:text-slate-400';
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Title', 'User', 'Category', 'Priority', 'Status', 'Assigned To', 'Created At'];
    const rows = filteredTickets.map(t => [
      t.id,
      t.title,
      t.user?.name || 'Unknown',
      t.category,
      t.priority,
      t.status,
      t.technician?.name || 'Unassigned',
      new Date(t.createdAt).toLocaleString()
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `tickets_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in-progress').length,
    pendingConfirmation: tickets.filter(t => t.status === 'pending-confirmation').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    critical: tickets.filter(t => t.priority === 'critical').length,
  };
  const currentTickets = filteredTickets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const totalPages = Math.ceil(filteredTickets.length / rowsPerPage);
  const visiblePages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
    const start = Math.min(Math.max(page - 2, 0), Math.max(totalPages - 5, 0));
    return start + i;
  });

  if (loading && tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-medium">{t('Loading all tickets...')}</p>
      </div>
    );
  }

  return (
    <motion.div 
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <motion.div variants={fadeUp} className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <h1 className="page-title">{t('Support Tickets')}</h1>
          <p className="page-subtitle">
            {t('Centralized management for all organization-wide support requests.')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
          <button 
            onClick={exportToCSV}
            className="btn-secondary interactive-lift w-full sm:w-auto"
          >
            <Download size={18} />
            {t('Export')}
          </button>
          <button 
            onClick={fetchTickets}
            className="btn-primary interactive-lift w-full sm:w-auto"
          >
            <RefreshCw size={18} />
            {t('Refresh')}
          </button>
        </div>
      </motion.div>

      {/* Stats Overview */}
      <motion.div variants={staggerContainer} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
        {[
          { label: t('Total Tickets'), value: stats.total, icon: Ticket, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: t('Open'), value: stats.open, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: t('In Progress'), value: stats.inProgress, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: t('Pending Confirmation'), value: stats.pendingConfirmation, icon: CheckCircle, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: t('Resolved'), value: stats.resolved, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: t('Closed'), value: stats.closed, icon: Archive, color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800' },
          { label: t('Critical'), value: stats.critical, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            variants={fadeUp}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="surface-compact flex min-w-0 items-center gap-3 p-3 sm:gap-4 sm:p-5"
          >
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11", stat.bg)}>
              <stat.icon className={stat.color} size={22} />
            </div>
            <div className="min-w-0">
              <p className="mb-1 truncate text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs">{stat.label}</p>
              <p className="text-xl font-black tabular-nums text-slate-950 dark:text-white sm:text-2xl">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Filters Bar */}
      <motion.div variants={fadeUp} className="surface p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={t("Search tickets...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field pl-10 pr-10"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
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
            <select 
              value={techFilter}
              onChange={(e) => setTechFilter(e.target.value)}
              className="field appearance-none"
            >
              <option value="all">{t('All Technicians')}</option>
              <option value="unassigned">{t('Unassigned')}</option>
              {technicians.map(tech => (
                <option key={tech.id} value={tech.id}>{tech.name}</option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-1">
            <button 
              onClick={handleClearFilters}
              disabled={search === '' && statusFilter === 'all' && priorityFilter === 'all' && categoryFilter === 'all' && techFilter === 'all'}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-800 lg:border-0"
            >
              <X size={16} />
              {t('Clear')}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Tickets Table */}
      <motion.div variants={fadeUp} className="surface overflow-hidden">
        <div className="block divide-y divide-slate-100 p-3 dark:divide-slate-800 md:hidden">
          <AnimatePresence mode="popLayout">
            {currentTickets.map((ticket) => (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="relative py-4 first:pt-1"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20">
                    <FileText size={18} />
                  </div>
                  <Link to={`/tickets/${ticket.id}`} className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={cn("badge", getStatusStyles(ticket.status))}>{t(ticket.status)}</span>
                      <span className={cn("text-xs font-black capitalize", getPriorityColor(ticket.priority))}>{t(ticket.priority)}</span>
                    </div>
                    <h3 className="line-clamp-2 text-sm font-black leading-5 text-slate-950 dark:text-white">{ticket.title}</h3>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-tight text-slate-400">#{ticket.id.slice(0, 8).toUpperCase()}</p>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAnchorEl(anchorEl === e.currentTarget ? null : e.currentTarget);
                      setMenuTicket(ticket);
                    }}
                    className="icon-btn shrink-0"
                    aria-label={t('Actions')}
                  >
                    <MoreVertical size={18} />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/50">
                  <div className="min-w-0">
                    <p className="font-black uppercase tracking-wider text-slate-400">{t('User')}</p>
                    <p className="mt-1 truncate font-bold text-slate-700 dark:text-slate-200">{ticket.user?.name || 'Unknown'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-black uppercase tracking-wider text-slate-400">{t('Assigned')}</p>
                    <p className="mt-1 truncate font-bold text-slate-700 dark:text-slate-200">{ticket.technician?.name || t('Unassigned')}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-black uppercase tracking-wider text-slate-400">{t('Category')}</p>
                    <p className="mt-1 truncate font-bold text-slate-700 dark:text-slate-200">{t(ticket.category)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-black uppercase tracking-wider text-slate-400">{t('Created')}</p>
                    <p className="mt-1 truncate font-bold text-slate-700 dark:text-slate-200">
                      {safeDate(ticket.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>

                {anchorEl && menuTicket?.id === ticket.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setAnchorEl(null); }} />
                    <div className="menu-surface absolute right-0 top-12 z-20 w-[min(14rem,calc(100vw-2rem))] overflow-hidden py-2">
                      <Link
                        to={`/tickets/${ticket.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <ExternalLink size={16} />
                        {t('View Details')}
                      </Link>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenAssign(ticket); }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <UserPlus size={16} />
                        {t('Assign Technician')}
                      </button>
                      <div className="my-1 h-px bg-slate-100 dark:bg-slate-800" />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'in-progress'); }}
                        disabled={ticket.status === 'in-progress' || !canMoveToStatus(ticket, 'in-progress')}
                        className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-30 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {t('Start Work')}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'resolved'); }}
                        disabled={ticket.status === 'resolved' || !canMoveToStatus(ticket, 'resolved')}
                        className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-30 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {t('Mark Resolved')}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'closed'); }}
                        disabled={ticket.status === 'closed' || !canMoveToStatus(ticket, 'closed')}
                        className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-30 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {t('Close Ticket')}
                      </button>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('ID & Title')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('User')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Category')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Priority')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Status')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Assigned')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Created')}</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              <AnimatePresence mode="popLayout">
                {currentTickets.map((ticket) => (
                  <motion.tr 
                    key={ticket.id} 
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => window.location.href = `/tickets/${ticket.id}`}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">{ticket.title}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">#{ticket.id.slice(0, 8).toUpperCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {ticket.user?.name?.[0] || '?'}
                        </div>
                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{ticket.user?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{t(ticket.category)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-1.5 h-1.5 rounded-full", 
                          ticket.priority === 'critical' ? 'bg-red-500' : 
                          ticket.priority === 'high' ? 'bg-orange-500' : 
                          ticket.priority === 'medium' ? 'bg-blue-500' : 'bg-emerald-500'
                        )} />
                        <span className={cn("text-sm font-bold capitalize", getPriorityColor(ticket.priority))}>
                          {t(ticket.priority)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                        getStatusStyles(ticket.status)
                      )}>
                        {t(ticket.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {ticket.technician ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                            {ticket.technician.name[0]}
                          </div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{ticket.technician.name}</span>
                        </div>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-400 italic">
                          {t('Unassigned')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        {safeDate(ticket.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative inline-block text-left">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setAnchorEl(anchorEl === e.currentTarget ? null : e.currentTarget);
                            setMenuTicket(ticket);
                          }}
                          className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                          <MoreVertical size={18} />
                        </button>
                        
                        {anchorEl && menuTicket?.id === ticket.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={(e) => { e.stopPropagation(); setAnchorEl(null); }}
                            />
                            <div className="menu-surface absolute right-0 z-20 mt-2 w-48 overflow-hidden py-2">
                              <Link 
                                to={`/tickets/${ticket.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                <ExternalLink size={16} />
                                {t('View Details')}
                              </Link>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleOpenAssign(ticket); }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                              >
                                <UserPlus size={16} />
                                {t('Assign Technician')}
                              </button>
                              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'in-progress'); }}
                                disabled={ticket.status === 'in-progress' || !canMoveToStatus(ticket, 'in-progress')}
                                className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-30"
                              >
                                {t('Start Work')}
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'resolved'); }}
                                disabled={ticket.status === 'resolved' || !canMoveToStatus(ticket, 'resolved')}
                                className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-30"
                              >
                                {t('Mark Resolved')}
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'closed'); }}
                                disabled={ticket.status === 'closed' || !canMoveToStatus(ticket, 'closed')}
                                className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-30"
                              >
                                {t('Close Ticket')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {filteredTickets.length === 0 && (
            <div className="py-20 text-center">
              <div className="inline-flex p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full text-slate-300 dark:text-slate-700 mb-4">
                <FileText size={48} />
              </div>
              <p className="text-slate-500 font-bold mb-2">{t('No tickets found matching your criteria')}</p>
              <button 
                onClick={handleClearFilters}
                className="text-sm font-bold text-blue-600 hover:underline"
              >
                {t('Clear all filters')}
              </button>
            </div>
        )}

        {/* Pagination */}
        <div className="flex flex-col gap-4 border-t border-slate-100 bg-slate-50/70 px-3 py-4 dark:border-slate-800 dark:bg-slate-800/50 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('Showing')} <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min(filteredTickets.length, page * rowsPerPage + 1)}</span> {t('to')} <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min(filteredTickets.length, (page + 1) * rowsPerPage)}</span> {t('of')} <span className="font-bold text-slate-700 dark:text-slate-200">{filteredTickets.length}</span>
            </p>
            <select 
              value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
              className="bg-transparent text-sm font-bold text-slate-600 dark:text-slate-400 outline-none cursor-pointer"
            >
              {[10, 25, 50].map(size => (
                <option key={size} value={size}>{size} per page</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-start">
            <button 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-1">
              {visiblePages.map((pageIndex) => (
                <button 
                  key={pageIndex}
                  onClick={() => setPage(pageIndex)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                    page === pageIndex
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  {pageIndex + 1}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * rowsPerPage >= filteredTickets.length}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Assign Technician Dialog */}
      <AnimatePresence>
        {assignDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
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
              className="relative my-4 max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl"
            >
              <div className="p-5 sm:p-8">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{t('Assign Technician')}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  {t('Assigning to')}: <span className="font-bold text-slate-700 dark:text-slate-200 break-words">{selectedTicket?.title}</span>
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
