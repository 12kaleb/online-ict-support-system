import { useState, useEffect } from 'react';
import { Plus, Calendar, Clock, Server, Network, HardDrive, UserPlus, X, AlertTriangle, CheckCircle, Info, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { format, isFuture, isPast, isToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { safeDate } from '../utils/dateUtils';
import { handleResponse } from '../utils/apiUtils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function Maintenance({ user }: { user: any }) {
  const { t } = useTranslation();
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [newMaint, setNewMaint] = useState({ title: '', description: '', startTime: '', endTime: '', type: 'Server', technicianId: '', assetId: '' });
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedMaint, setSelectedMaint] = useState<any>(null);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [delayReason, setDelayReason] = useState('');

  const fetchMaintenance = async () => {
    try {
      const [maintRes, techRes, assetRes] = await Promise.all([
        fetch('/api/maintenance'),
        fetch('/api/technicians'),
        fetch('/api/assets')
      ]);
      
      const maintData = await handleResponse(maintRes);
      setMaintenance(Array.isArray(maintData) ? maintData : []);
      
      const techData = await handleResponse(techRes);
      setTechnicians(Array.isArray(techData) ? techData : []);
      
      const assetData = await handleResponse(assetRes);
      setAssets(Array.isArray(assetData) ? assetData : []);
    } catch (err) {
      console.error("Fetch maintenance error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaintenance();
  }, []);

  const handleAddMaintenance = async () => {
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newMaint,
          startTime: new Date(newMaint.startTime).toISOString(),
          endTime: new Date(newMaint.endTime).toISOString(),
          technicianId: newMaint.technicianId || null
        }),
      });
      await handleResponse(res);
      toast.success('Maintenance added successfully');
      setOpen(false);
      setNewMaint({ title: '', description: '', startTime: '', endTime: '', type: 'Server', technicianId: '', assetId: '' });
      fetchMaintenance();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add maintenance');
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/maintenance/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      await handleResponse(res);
      toast.success(`Maintenance status updated to ${status}`);
      fetchMaintenance();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleReportDelay = async () => {
    if (!selectedMaint) return;
    try {
      const res = await fetch(`/api/assets/maintenance/${selectedMaint.id}/delay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delayReason })
      });
      await handleResponse(res);
      toast.success('Delay reported successfully');
      setDelayDialogOpen(false);
      setDelayReason('');
      fetchMaintenance();
    } catch (err: any) {
      toast.error(err.message || 'Failed to report delay');
    }
  };

  const handleOpenAssign = (item: any) => {
    setSelectedMaint(item);
    setSelectedTechId(item.technicianId || '');
    setAssignDialogOpen(true);
  };

  const handleOpenDelay = (item: any) => {
    setSelectedMaint(item);
    setDelayReason(item.delayReason || '');
    setDelayDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedMaint) return;
    try {
      const res = await fetch(`/api/maintenance/${selectedMaint.id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianId: selectedTechId })
      });
      await handleResponse(res);
      toast.success('Technician assigned successfully');
      fetchMaintenance();
      setAssignDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign technician');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Server': return <Server size={18} />;
      case 'Network': return <Network size={18} />;
      case 'Hardware': return <HardDrive size={18} />;
      default: return <Server size={18} />;
    }
  };

  const getStatusBadge = (item: any) => {
    const startTime = safeDate(item.startTime);
    const endTime = safeDate(item.endTime);
    const now = new Date();

    if (item.status === 'completed') {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600">
          {t("Completed")}
        </span>
      );
    }
    
    if (item.status === 'in-progress' || (now >= startTime && now <= endTime)) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-900/20 text-rose-600">
          {t("Ongoing")}
        </span>
      );
    } else if (isFuture(startTime)) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-900/20 text-blue-600">
          {t("Scheduled")}
        </span>
      );
    } else {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-900/20 text-amber-600">
          {t("Overdue")}
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{t('Maintenance Calendar')}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t('Scheduled system updates and infrastructure maintenance.')}</p>
        </div>
        {(user?.role === 'manager') && (
          <button 
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus size={18} />
            {t('Schedule Maintenance')}
          </button>
        )}
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
        <button
          onClick={() => setView('list')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
            view === 'list' 
              ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <List size={18} />
          {t('List View')}
        </button>
        <button
          onClick={() => setView('calendar')}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
            view === 'calendar' 
              ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <Calendar size={18} />
          {t('Calendar View')}
        </button>
      </div>

      {view === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {maintenance.map((item) => (
          <motion.div 
            layout
            key={item.id}
            className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600">
                  {getTypeIcon(item.type)}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight">{item.title}</h3>
                  {item.asset && (
                    <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                      {t('Asset')}: {item.asset.brand ? `${item.asset.brand} ` : ''}{item.asset.name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {getStatusBadge(item)}
                {item.isDelayed && (
                  <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border border-amber-200 dark:border-amber-800 text-amber-600">
                    {t("Delayed")}
                  </span>
                )}
              </div>
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 flex-grow">
              {item.description}
            </p>

            {item.isDelayed && item.delayReason && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 p-3 rounded-2xl mb-6 flex gap-3 items-start">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  <span className="uppercase tracking-wider mr-1 opacity-60">{t('Delay Reason')}:</span> {item.delayReason}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {format(safeDate(item.startTime), 'MMM dd, yyyy')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {format(safeDate(item.startTime), 'HH:mm')} - {format(safeDate(item.endTime), 'HH:mm')}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {item.technician ? (
                  <>
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                      {item.technician.name[0]}
                    </div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {item.technician.name}
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-bold text-slate-400 italic">
                    {t('Unassigned')}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {item.status !== 'completed' && (user?.role === 'manager' || user?.id === item.technicianId) && (
                  <>
                    {item.status === 'scheduled' && (
                      <button 
                        onClick={() => handleUpdateStatus(item.id, 'in-progress')}
                        className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                      >
                        {t('Start')}
                      </button>
                    )}
                    {item.status === 'in-progress' && (
                      <button 
                        onClick={() => handleUpdateStatus(item.id, 'completed')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-600/20"
                      >
                        {t('Complete')}
                      </button>
                    )}
                    {item.status !== 'completed' && (
                      <button 
                        onClick={() => handleOpenDelay(item)}
                        className="px-4 py-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                      >
                        {t('Delay')}
                      </button>
                    )}
                  </>
                )}
                {(user?.role === 'manager') && (
                  <button 
                    onClick={() => handleOpenAssign(item)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                    title={t("Assign Technician")}
                  >
                    <UserPlus size={18} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        {maintenance.length === 0 && (
          <div className="col-span-full bg-white dark:bg-slate-900 p-20 rounded-3xl border border-slate-100 dark:border-slate-800 text-center">
            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="text-slate-300" size={40} />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium">{t('No maintenance events scheduled.')}</p>
          </div>
        )}
      </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-600 dark:text-slate-400"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={() => setCurrentMonth(new Date())}
                className="px-4 py-2 text-xs font-black uppercase tracking-wider text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
              >
                {t('Today')}
              </button>
              <button 
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-600 dark:text-slate-400"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {t(day)}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-[120px]">
            {(() => {
              const monthStart = startOfMonth(currentMonth);
              const monthEnd = endOfMonth(monthStart);
              const startDate = startOfWeek(monthStart);
              const endDate = endOfWeek(monthEnd);
              const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

              return calendarDays.map((day, i) => {
                const dayMaintenance = maintenance.filter(m => isSameDay(safeDate(m.startTime), day));
                
                return (
                  <div 
                    key={day.toString()} 
                    className={cn(
                      "p-2 border-r border-b border-slate-50 dark:border-slate-800 last:border-r-0 overflow-y-auto custom-scrollbar",
                      !isSameMonth(day, monthStart) && "bg-slate-50/50 dark:bg-slate-800/20 opacity-40"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "text-xs font-black w-6 h-6 flex items-center justify-center rounded-full",
                        isToday(day) ? "bg-blue-600 text-white" : "text-slate-500 dark:text-slate-400"
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {dayMaintenance.map(m => (
                        <div 
                          key={m.id}
                          onClick={() => handleOpenAssign(m)}
                          className={cn(
                            "px-2 py-1 rounded-lg text-[9px] font-bold truncate cursor-pointer transition-all",
                            m.status === 'completed' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" :
                            m.status === 'in-progress' ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600" :
                            "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                          )}
                          title={m.title}
                        >
                          {m.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      <AnimatePresence>
        {/* Schedule Maintenance Dialog */}
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('Schedule Maintenance')}</h2>
                  <button onClick={() => setOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Title')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newMaint.title}
                      onChange={(e) => setNewMaint({ ...newMaint, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Description')}</label>
                    <textarea
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                      value={newMaint.description}
                      onChange={(e) => setNewMaint({ ...newMaint, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Asset (Optional)')}</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newMaint.assetId}
                      onChange={(e) => {
                        const assetId = e.target.value;
                        const asset = assets.find(a => a.id === assetId);
                        setNewMaint({ 
                          ...newMaint, 
                          assetId,
                          title: (!newMaint.title || newMaint.title.startsWith('Maintenance for ')) && asset ? `Maintenance for ${asset.name}` : newMaint.title
                        });
                      }}
                    >
                      <option value="">{t('None (General Maintenance)')}</option>
                      {assets.map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.brand ? `${asset.brand} ` : ''}{asset.name} ({t(asset.type)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Type')}</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newMaint.type}
                      onChange={(e) => setNewMaint({ ...newMaint, type: e.target.value })}
                    >
                      <option value="Server">{t('Server')}</option>
                      <option value="Network">{t('Network')}</option>
                      <option value="Hardware">{t('Hardware')}</option>
                      <option value="Preventive">{t('Preventive')}</option>
                      <option value="Corrective">{t('Corrective')}</option>
                      <option value="Upgrade">{t('Upgrade')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Technician')}</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newMaint.technicianId}
                      onChange={(e) => setNewMaint({ ...newMaint, technicianId: e.target.value })}
                    >
                      <option value="">{t('Unassigned')}</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>{tech.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Start Time')}</label>
                      <input
                        type="datetime-local"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                        value={newMaint.startTime}
                        onChange={(e) => setNewMaint({ ...newMaint, startTime: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('End Time')}</label>
                      <input
                        type="datetime-local"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                        value={newMaint.endTime}
                        onChange={(e) => setNewMaint({ ...newMaint, endTime: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-8">
                  <button 
                    onClick={() => setOpen(false)}
                    className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-black transition-all"
                  >
                    {t('Cancel')}
                  </button>
                  <button 
                    onClick={handleAddMaintenance}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-600/20"
                  >
                    {t('Schedule')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Assign Technician Dialog */}
        {assignDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('Assign Technician')}</h2>
                  <button onClick={() => setAssignDialogOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  {t('Assigning to')}: <strong className="text-slate-900 dark:text-white">{selectedMaint?.title}</strong>
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Select Technician')}</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={selectedTechId}
                      onChange={(e) => setSelectedTechId(e.target.value)}
                    >
                      <option value="">{t('Unassigned')}</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>{tech.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-8">
                  <button 
                    onClick={() => setAssignDialogOpen(false)}
                    className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-black transition-all"
                  >
                    {t('Cancel')}
                  </button>
                  <button 
                    disabled={selectedTechId === (selectedMaint?.technicianId || '')}
                    onClick={handleAssign}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-600/20"
                  >
                    {t('Assign')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delay Reporting Dialog */}
        {delayDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('Report Delay')}</h2>
                  <button onClick={() => setDelayDialogOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                  {t('Please provide a reason for the delay in completing this maintenance.')}
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Delay Reason')}</label>
                    <textarea
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                      value={delayReason}
                      onChange={(e) => setDelayReason(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-8">
                  <button 
                    onClick={() => setDelayDialogOpen(false)}
                    className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-black transition-all"
                  >
                    {t('Cancel')}
                  </button>
                  <button 
                    onClick={handleReportDelay}
                    className="flex-1 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-amber-600/20"
                  >
                    {t('Report Delay')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
