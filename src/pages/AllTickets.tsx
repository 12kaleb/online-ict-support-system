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
  ArrowUpRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { safeDate } from '../utils/dateUtils';
import { useThemeContext } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

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
      }
    } catch (err) {
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
      }
    } catch (err) {
      console.error("Status update error:", err);
    }
    setAnchorEl(null);
  };

  const getStatusStyles = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400';
      case 'in-progress': return 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
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
    resolved: tickets.filter(t => t.status === 'resolved').length,
    critical: tickets.filter(t => t.priority === 'critical').length,
  };

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
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">{t('Support Tickets')}</h1>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl">
            {t('Centralized management for all organization-wide support requests.')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            <Download size={18} />
            {t('Export')}
          </button>
          <button 
            onClick={fetchTickets}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95"
          >
            <RefreshCw size={18} />
            {t('Refresh')}
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: t('Total Tickets'), value: stats.total, icon: Ticket, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: t('Open'), value: stats.open, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: t('In Progress'), value: stats.inProgress, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: t('Resolved'), value: stats.resolved, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
          { label: t('Critical'), value: stats.critical, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", stat.bg)}>
              <stat.icon className={stat.color} size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder={t("Search tickets...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm"
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
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm appearance-none"
            >
              <option value="all">{t('All Status')}</option>
              <option value="open">{t('Open')}</option>
              <option value="in-progress">{t('In Progress')}</option>
              <option value="resolved">{t('Resolved')}</option>
              <option value="closed">{t('Closed')}</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <select 
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm appearance-none"
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
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm appearance-none"
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
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm appearance-none"
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
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-slate-500 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <X size={16} />
              {t('Clear')}
            </button>
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
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
                {filteredTickets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((ticket) => (
                  <motion.tr 
                    key={ticket.id} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
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
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-20 py-2 overflow-hidden">
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
                                disabled={ticket.status === 'in-progress'}
                                className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-30"
                              >
                                {t('Start Work')}
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'resolved'); }}
                                disabled={ticket.status === 'resolved'}
                                className="w-full text-left px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-30"
                              >
                                {t('Mark Resolved')}
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleUpdateStatus(ticket.id, 'closed'); }}
                                disabled={ticket.status === 'closed'}
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
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
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
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, Math.ceil(filteredTickets.length / rowsPerPage)) }).map((_, i) => (
                <button 
                  key={i}
                  onClick={() => setPage(i)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                    page === i 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                      : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  {i + 1}
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
      </div>

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
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
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
