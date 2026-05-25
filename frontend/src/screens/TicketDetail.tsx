'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useNavigate } from '../lib/router';
import { 
  ArrowLeft, 
  Send, 
  User, 
  Calendar, 
  Tag, 
  AlertCircle, 
  Paperclip, 
  X, 
  Download, 
  MessageSquare, 
  CheckCircle, 
  ChevronDown, 
  History, 
  Trash2, 
  AlertTriangle,
  Pause,
  Play,
  Star,
  Clock,
  Package,
  CheckCircle2,
  MapPin
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { safeDate } from '../utils/dateUtils';
import { handleResponse } from '../utils/apiUtils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { isManager } from '../lib/permissions';

const TicketLocationMap = dynamic(() => import('../components/TicketLocationMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[260px] items-center justify-center bg-slate-100 text-sm font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      Loading map...
    </div>
  ),
});

export default function TicketDetail({ user }: { user: any }) {
  const { t } = useTranslation();
  const isManagerLevel = isManager(user);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentAttachments, setCommentAttachments] = useState<any[]>([]);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [usageQuantity, setUsageQuantity] = useState(1);
  const [assetUsages, setAssetUsages] = useState<any[]>([]);
  
  // Feedback state
  const [rating, setRating] = useState<number | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [appealSubmitted, setAppealSubmitted] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockingReasonInput, setBlockingReasonInput] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Confirmation Dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({
    title: '',
    message: '',
    onConfirm: () => {},
    color: 'primary' as 'primary' | 'danger' | 'success'
  });

  const openConfirm = (title: string, message: string, onConfirm: () => void, color: 'primary' | 'danger' | 'success' = 'primary') => {
    setConfirmConfig({ title, message, onConfirm, color });
    setConfirmOpen(true);
  };

  const statusRank: Record<string, number> = {
    open: 0,
    'in-progress': 1,
    'pending-confirmation': 2,
    resolved: 3,
    closed: 4,
  };

  const canMoveToStatus = (nextStatus: string) => {
    const currentRank = statusRank[ticket?.status];
    const nextRank = statusRank[nextStatus];
    return currentRank !== undefined && nextRank !== undefined && nextRank >= currentRank;
  };

  const getAgeColor = (date: string) => {
    const days = (new Date().getTime() - safeDate(date).getTime()) / (1000 * 60 * 60 * 24);
    if (days > 7) return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800';
    if (days > 2) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800';
    return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800';
  };

  const fetchData = async () => {
    try {
      const [ticketRes, commentsRes, historyRes, techsRes, assetsRes] = await Promise.all([
        fetch(`/api/tickets/${id}`),
        fetch(`/api/tickets/${id}/comments`),
        fetch(`/api/tickets/${id}/history`),
        isManagerLevel ? fetch('/api/technicians') : Promise.resolve({ json: () => [], ok: true, headers: new Headers() } as any),
        (isManagerLevel || user?.role === 'technician') ? fetch('/api/assets') : Promise.resolve({ json: () => [], ok: true, headers: new Headers() } as any)
      ]);
      
      const ticketData = await handleResponse(ticketRes);
      setTicket(ticketData);
      setSelectedTechId(ticketData.assignedTo || '');
      setSelectedPriority(ticketData.priority || 'medium');
      setFeedbackSubmitted(Boolean(ticketData.feedback));
      
      const commentsData = await handleResponse(commentsRes);
      setComments(Array.isArray(commentsData) ? commentsData : []);
      
      const historyData = await handleResponse(historyRes);
      setHistory(Array.isArray(historyData) ? historyData : []);
      
      setAssetUsages(ticketData.assetUsages || []);
      
      if (isManagerLevel) {
        const techsData = await handleResponse(techsRes);
        setTechnicians(Array.isArray(techsData) ? techsData : []);
      }
      
      if (isManagerLevel || user?.role === 'technician') {
        const assetsData = await handleResponse(assetsRes);
        setAllAssets(Array.isArray(assetsData) ? assetsData : []);
      }

      // Add to recently viewed
      if (ticketData && ticketData.id) {
        const recent = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
        const updated = [
          { 
            id: ticketData.id, 
            title: ticketData.title, 
            status: ticketData.status, 
            priority: ticketData.priority,
            viewedAt: new Date().toISOString() 
          },
          ...recent.filter((t: any) => t.id !== ticketData.id)
        ].slice(0, 5);
        localStorage.setItem('recentlyViewed', JSON.stringify(updated));
        window.dispatchEvent(new Event('recentlyViewedUpdated'));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch ticket details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, user?.role]);

  const handleUpdateStatus = async (status: string) => {
    const action = async () => {
      setPendingAction(status);
      try {
        const res = await fetch(`/api/tickets/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        const updatedTicket = await handleResponse(res);
        setTicket({ ...ticket, ...updatedTicket });
        toast.success(`Ticket status updated to ${updatedTicket.status || status}`);
        // Refresh history
        fetch(`/api/tickets/${id}/history`).then(r => r.json()).then(setHistory);
      } catch (err: any) {
        toast.error(err.message || 'Failed to update status');
      } finally {
        setPendingAction(null);
      }
      setConfirmOpen(false);
    };

    if (status === 'closed' || status === 'resolved') {
      openConfirm(
        t('Confirm Action'),
        status === 'closed' ? t('Are you sure you want to close this ticket?') : t('Are you sure you want to resolve this ticket?'),
        action,
        status === 'closed' ? 'danger' : 'success'
      );
    } else {
      action();
    }
  };

  const handleApprove = async () => {
    const action = async () => {
      setPendingAction('approve');
      try {
        const res = await fetch(`/api/tickets/${id}/approve`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        });
        await handleResponse(res);
        setTicket({ ...ticket, isApproved: true });
        toast.success('Ticket approved');
        // Refresh history
        fetch(`/api/tickets/${id}/history`).then(r => r.json()).then(setHistory);
      } catch (err: any) {
        toast.error(err.message || 'Failed to approve ticket');
      } finally {
        setPendingAction(null);
      }
      setConfirmOpen(false);
    };

    openConfirm(
      t('Confirm Action'),
      t('Are you sure you want to approve this ticket?'),
      action,
      'success'
    );
  };

  const handleDelete = async () => {
    const action = async () => {
      setPendingAction('delete');
      try {
        const res = await fetch(`/api/tickets/${id}`, {
          method: 'DELETE',
        });
        await handleResponse(res);
        toast.success('Ticket deleted');
        navigate('/dashboard');
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete ticket');
      } finally {
        setPendingAction(null);
      }
      setConfirmOpen(false);
    };

    openConfirm(
      t('Delete Ticket'),
      t('Are you sure you want to delete this ticket?') + ' ' + t('This action cannot be undone.'),
      action,
      'danger'
    );
  };

  const handleAssign = async () => {
    if (!selectedTechId && !ticket.assignedTo) return;
    setPendingAction('assign');
    try {
      const res = await fetch(`/api/tickets/${id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: selectedTechId }),
      });
      await handleResponse(res);
      const tech = technicians.find(t => t.id === selectedTechId);
      setTicket({ ...ticket, assignedTo: selectedTechId, technician: tech, status: 'in-progress' });
      toast.success('Technician assigned successfully');
      // Refresh history
      fetch(`/api/tickets/${id}/history`).then(r => r.json()).then(setHistory);
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign technician');
    } finally {
      setPendingAction(null);
    }
  };

  const handlePriorityChange = async () => {
    if (!selectedPriority || selectedPriority === ticket?.priority) return;
    setPendingAction('priority');
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: selectedPriority }),
      });
      await handleResponse(res);
      setTicket({ ...ticket, priority: selectedPriority });
      toast.success('Ticket priority updated');
      fetch(`/api/tickets/${id}/history`).then(r => r.json()).then(setHistory);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update priority');
    } finally {
      setPendingAction(null);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && commentAttachments.length === 0) return;
    try {
      const res = await fetch(`/api/tickets/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newComment, attachments: commentAttachments, isInternal: isInternalNote }),
      });
      const comment = await handleResponse(res);
      setComments([...comments, { ...comment, user: { name: user?.name } }]);
      setNewComment('');
      setCommentAttachments([]);
      setIsInternalNote(false);
      toast.success('Comment added');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add comment');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setCommentAttachments(prev => [...prev, {
            name: file.name,
            type: file.type,
            url: reader.result as string
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleRecordUsage = async () => {
    if (!selectedAssetId || usageQuantity < 1) return;
    const selectedAsset = allAssets.find((asset) => asset.id === selectedAssetId);
    const quantityToRecord = selectedAsset?.isConsumable ? usageQuantity : 1;
    try {
      const res = await fetch(`/api/tickets/${id}/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: selectedAssetId, quantity: quantityToRecord }),
      });
      const data = await handleResponse(res);
      setAssetUsages([data, ...assetUsages]);
      setSelectedAssetId('');
      setUsageQuantity(1);
      // Refresh history
      fetch(`/api/tickets/${id}/history`).then(r => r.json()).then(setHistory);
      // Refresh asset list to update quantities
      fetch('/api/assets').then(r => r.json()).then(setAllAssets);
      toast.success('Asset usage recorded');
    } catch (err: any) {
      toast.error(err.message || 'Failed to record usage');
    }
  };

  const handleReturnUsage = async (usageId: string) => {
    try {
      const res = await fetch(`/api/assets/usage/${usageId}/return`, {
        method: 'PUT',
      });
      const updatedUsage = await handleResponse(res);
      setAssetUsages(assetUsages.map(u => u.id === usageId ? updatedUsage : u));
      
      // If fully returned, refresh ticket data and asset list
      if (updatedUsage.status === 'returned') {
        fetch(`/api/tickets/${id}`).then(r => r.json()).then(data => {
          setTicket(data);
          setAssetUsages(data.assetUsages || []);
        });
        fetch('/api/assets').then(r => r.json()).then(setAllAssets);
      }
      toast.success('Asset return processed');
    } catch (err: any) {
      toast.error(err.message || 'Failed to return asset');
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!rating) return;
    try {
      const res = await fetch(`/api/tickets/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: feedbackComment }),
      });
      const feedback = await handleResponse(res);
      setTicket((prev: any) => prev ? { ...prev, feedback } : prev);
      setFeedbackSubmitted(true);
      toast.success('Thank you for your feedback!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit feedback');
    }
  };

  const handleStaffReview = async (approved: boolean) => {
    setPendingAction(approved ? 'staff-approve' : 'staff-reopen');
    try {
      const res = await fetch(`/api/tickets/${id}/staff-review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      });
      const updatedTicket = await handleResponse(res);
      setTicket({ ...ticket, ...updatedTicket });
      toast.success(approved ? 'Ticket confirmed as solved' : 'Issue sent back for more work');
      fetch(`/api/tickets/${id}/history`).then(r => r.json()).then(setHistory);
    } catch (err: any) {
      toast.error(err.message || 'Failed to review ticket');
    } finally {
      setPendingAction(null);
    }
  };

  const handleAppealSubmit = async () => {
    if (!appealReason.trim()) return;
    setPendingAction('appeal');
    try {
      const res = await fetch(`/api/tickets/${id}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: appealReason }),
      });
      await handleResponse(res);
      setAppealSubmitted(true);
      setAppealReason('');
      fetch(`/api/tickets/${id}/history`).then(r => r.json()).then(setHistory);
      toast.success('Appeal submitted for review');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit appeal');
    } finally {
      setPendingAction(null);
    }
  };

  const handlePauseSLA = async () => {
    if (!blockingReasonInput.trim()) return;
    setPendingAction('pause-sla');
    try {
      const res = await fetch(`/api/tickets/${id}/sla-pause`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockingReason: blockingReasonInput }),
      });
      const updatedTicket = await handleResponse(res);
      setTicket(updatedTicket);
      setBlockDialogOpen(false);
      setBlockingReasonInput('');
      fetch(`/api/tickets/${id}/history`).then(r => r.json()).then(setHistory);
      toast.success('SLA paused successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to pause SLA');
    } finally {
      setPendingAction(null);
    }
  };

  const handleResumeSLA = async () => {
    setPendingAction('resume-sla');
    try {
      const res = await fetch(`/api/tickets/${id}/sla-resume`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      const updatedTicket = await handleResponse(res);
      setTicket(updatedTicket);
      fetch(`/api/tickets/${id}/history`).then(r => r.json()).then(setHistory);
      toast.success('SLA resumed successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to resume SLA');
    } finally {
      setPendingAction(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="mx-auto text-slate-300 mb-4" size={48} />
        <h2 className="text-xl font-black text-slate-900">{t('Ticket not found')}</h2>
        <button onClick={() => navigate('/dashboard')} className="mt-4 text-blue-600 font-bold hover:underline">
          {t('Back to Dashboard')}
        </button>
      </div>
    );
  }

  const locationLatitude = typeof ticket.locationLatitude === 'number' ? ticket.locationLatitude : null;
  const locationLongitude = typeof ticket.locationLongitude === 'number' ? ticket.locationLongitude : null;
  const hasLocation = locationLatitude !== null && locationLongitude !== null;
  const isCompletedTicket = ['pending-confirmation', 'resolved', 'closed'].includes(ticket.status);
  const showSla = !isCompletedTicket;
  const canTechnicianManageWork = user?.role === 'technician' && !isCompletedTicket;
  const canManagerManageTicket = isManagerLevel && user?.role !== 'technician';

  return (
    <div className="pb-20">
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold mb-6 transition-colors"
      >
        <ArrowLeft size={18} />
        {t('Back to Dashboard')}
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Main Ticket Info */}
        <div className="lg:col-span-8 space-y-8">
          <div className="surface p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="page-title mb-2 leading-tight">
                  {ticket.title}
                </h1>
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cn(
                    "badge border",
                    ticket.status === 'open' ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800" :
                    ticket.status === 'in-progress' ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800" :
                    ticket.status === 'pending-confirmation' ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800" :
                    ticket.status === 'resolved' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800" :
                    "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                  )}>
                    {t(ticket.status)}
                  </span>
                  {showSla && ticket.isDelayed && (
                    <span className="px-3 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">
                      {t('Delayed')}
                    </span>
                  )}
                  {showSla && ticket.slaPaused && (
                    <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded-full text-[10px] font-black uppercase tracking-wider">
                      {t('SLA Paused')}
                    </span>
                  )}
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                    ticket.priority === 'critical' ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800" :
                    ticket.priority === 'high' ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800" :
                    ticket.priority === 'medium' ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800" :
                    "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800"
                  )}>
                    {t('Priority')}: {t(ticket.priority)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wider",
                  getAgeColor(ticket.createdAt)
                )}>
                  {formatDistanceToNow(safeDate(ticket.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>
            
            {showSla && ticket.slaPaused && (
              <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl flex items-start gap-3">
                <Pause className="text-amber-600 shrink-0" size={20} />
                <div>
                  <p className="text-sm font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider mb-1">{t('SLA Paused')}</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">{ticket.blockingReason}</p>
                  <p className="text-xs text-amber-700/80 dark:text-amber-300/80 font-bold mt-2">
                    {t('Remaining SLA Time')}: {ticket.slaPausedRemainingMinutes ?? 0} {t('minutes')}
                  </p>
                </div>
              </div>
            )}

            {showSla && ticket.isDelayed && !ticket.slaPaused && (
              <div className="mb-8 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="text-rose-600 shrink-0" size={20} />
                <div>
                  <p className="text-sm font-black text-rose-900 dark:text-rose-200 uppercase tracking-wider mb-1">{t('Delayed')}</p>
                  <p className="text-sm text-rose-700 dark:text-rose-300 font-medium">{ticket.delayReason}</p>
                </div>
              </div>
            )}
            
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                  <User size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('Requested By')}</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{ticket.user?.name || t('Unknown')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                  <Calendar size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('Created At')}</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{safeDate(ticket.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                  <Tag size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('Category')}</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t(ticket.category)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">{t('Description')}</h3>
              <div className="rounded-xl bg-slate-50 p-5 dark:bg-slate-800/50">
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed font-medium">
                  {ticket.description}
                </p>
              </div>
            </div>

            {hasLocation && (
              <div className="mb-8 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">{t('User Location')}</h3>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${locationLatitude}&mlon=${locationLongitude}#map=17/${locationLatitude}/${locationLongitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-black text-blue-600 hover:text-blue-700"
                  >
                    {t('Open in OpenStreetMap')}
                  </a>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800">
                  <TicketLocationMap
                    latitude={locationLatitude}
                    longitude={locationLongitude}
                    accuracy={ticket.locationAccuracy}
                    label={ticket.title}
                  />
                </div>
              </div>
            )}

            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="space-y-4 mb-8">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">{t('Attachments')}</h3>
                <div className="flex flex-wrap gap-3">
                  {ticket.attachments.map((file: any, i: number) => (
                    <a
                      key={i}
                      href={file.url}
                      download={file.name}
                      className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm group"
                    >
                      <Download size={14} className="text-slate-400 group-hover:text-blue-600" />
                      {file.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Admin/Tech/Manager Controls */}
            {(canTechnicianManageWork || canManagerManageTicket) && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">{t('Management Actions')}</h3>
                
                <div className="flex flex-wrap gap-3 mb-6">
                  {canTechnicianManageWork && (
                    <>
                      <button 
                        onClick={() => handleUpdateStatus('in-progress')}
                        disabled={pendingAction !== null || !canMoveToStatus('in-progress') || ticket.status === 'in-progress' || ticket.slaPaused}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20 disabled:shadow-none"
                      >
                        {pendingAction === 'in-progress' ? t('Starting...') : t('Start Work')}
                      </button>
                      {ticket.slaPaused ? (
                        <button 
                          onClick={handleResumeSLA}
                          disabled={pendingAction !== null}
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl text-sm font-bold transition-all"
                        >
                          <Play size={16} />
                          {pendingAction === 'resume-sla' ? t('Resuming...') : t('Resume SLA')}
                        </button>
                      ) : (
                        <button 
                          onClick={() => setBlockDialogOpen(true)}
                          disabled={pendingAction !== null}
                          className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl text-sm font-bold transition-all"
                        >
                          <Pause size={16} />
                          {pendingAction === 'pause-sla' ? t('Pausing...') : t('Pause SLA')}
                        </button>
                      )}
                      <button 
                        onClick={() => handleUpdateStatus('resolved')}
                        disabled={pendingAction !== null || !canMoveToStatus('resolved') || ['pending-confirmation', 'resolved'].includes(ticket.status) || ticket.slaPaused}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/20 disabled:shadow-none"
                      >
                        {pendingAction === 'resolved' ? t('Completing...') : t('Mark Resolved')}
                      </button>
                    </>
                  )}
                  {canManagerManageTicket && showSla && (
                    ticket.slaPaused ? (
                      <button 
                        onClick={handleResumeSLA}
                        disabled={pendingAction !== null}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed rounded-xl text-sm font-bold transition-all"
                      >
                        <Play size={16} />
                        {pendingAction === 'resume-sla' ? t('Resuming...') : t('Resume SLA')}
                      </button>
                    ) : null
                  )}
                  {canManagerManageTicket && (
                    <button 
                      onClick={handleApprove} 
                      disabled={pendingAction !== null || ticket.status === 'closed' || ticket.isApproved}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg",
                        ticket.isApproved 
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                      )}
                    >
                      {pendingAction === 'approve' ? t('Saving...') : (ticket.isApproved ? t('Approved') : t('Approve Ticket'))}
                    </button>
                  )}
                  {canManagerManageTicket && (
                    <>
                      <button 
                        onClick={() => handleUpdateStatus('closed')}
                        disabled={pendingAction !== null || !canMoveToStatus('closed') || ['pending-confirmation', 'resolved', 'closed'].includes(ticket.status) || ticket.isApproved}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400 text-slate-700 rounded-xl text-sm font-bold transition-all"
                        title={ticket.status === 'pending-confirmation' || ticket.status === 'resolved' || ticket.isApproved ? t('Solved tickets cannot be closed.') : t('Close Ticket')}
                      >
                        {pendingAction === 'closed' ? t('Saving...') : t('Close Ticket')}
                      </button>
                      <button 
                        onClick={handleDelete}
                        disabled={pendingAction !== null}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-rose-600/20 disabled:shadow-none"
                      >
                        <Trash2 size={16} />
                        {pendingAction === 'delete' ? t('Saving...') : t('Delete Ticket')}
                      </button>
                    </>
                  )}
                </div>
                
                {canManagerManageTicket && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                      {t('Assign Technician')} {!ticket.isApproved && `(${t('Requires Approval')})`}
                    </h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select
                        value={selectedTechId}
                        onChange={(e) => setSelectedTechId(e.target.value)}
                        disabled={!ticket.isApproved || pendingAction !== null}
                        className="flex-grow px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none disabled:opacity-50"
                      >
                        <option value="">{t('Unassigned')}</option>
                        {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <button 
                        onClick={handleAssign}
                        disabled={!ticket.isApproved || pendingAction !== null || selectedTechId === ticket.assignedTo}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20 disabled:shadow-none"
                      >
                        {pendingAction === 'assign' ? t('Saving...') : t('Assign')}
                      </button>
                    </div>
                  </div>
                )}

                {canManagerManageTicket && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                      {t('Priority')}
                    </h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select
                        value={selectedPriority}
                        onChange={(e) => setSelectedPriority(e.target.value)}
                        disabled={pendingAction !== null}
                        className="flex-grow px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none disabled:opacity-50"
                      >
                        <option value="low">{t('low')}</option>
                        <option value="medium">{t('medium')}</option>
                        <option value="high">{t('high')}</option>
                        <option value="critical">{t('critical')}</option>
                      </select>
                      <button
                        onClick={handlePriorityChange}
                        disabled={pendingAction !== null || selectedPriority === ticket.priority}
                        className="px-6 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-600/20 disabled:shadow-none"
                      >
                        {pendingAction === 'priority' ? t('Saving...') : t('Update Priority')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="text-blue-600" size={24} />
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('Communication History')}</h2>
            </div>
            
            <div className="surface p-6 sm:p-8">
              <div className="space-y-8 mb-10">
                {Array.isArray(comments) && comments.map((comment) => (
                  <div key={comment.id} className="flex gap-4">
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-500 font-black shrink-0">
                      {comment.user?.name?.[0] || '?'}
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-black text-slate-900 dark:text-white">{comment.user?.name || t('Unknown')}</span>
                        {comment.isInternal && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[9px] font-black uppercase tracking-wider">
                            {t('Internal')}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {safeDate(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">{comment.message}</p>
                      {comment.attachments && comment.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {comment.attachments.map((file: any, i: number) => (
                            <a
                              key={i}
                              href={file.url}
                              download={file.name}
                              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-all"
                            >
                              <Download size={12} />
                              {file.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <div className="text-center py-10">
                    <MessageSquare className="mx-auto text-slate-200 mb-4" size={40} />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t('No comments yet')}</p>
                  </div>
                )}
              </div>

              <form onSubmit={handleAddComment} className="space-y-4">
                {commentAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {commentAttachments.map((file, i) => (
                      <span 
                        key={i} 
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-wider border border-blue-100"
                      >
                        {file.name}
                        <button 
                          type="button"
                          onClick={() => setCommentAttachments(prev => prev.filter((_, idx) => idx !== i))}
                          className="hover:text-blue-800"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {(user?.role === 'technician' || isManagerLevel) && (
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    {t('Post as internal note')}
                  </label>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t("Add a comment or update...")}
                    className="field flex-grow"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <label className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-600 rounded-2xl cursor-pointer transition-all border border-slate-100 dark:border-slate-700">
                    <Paperclip size={20} />
                    <input type="file" className="hidden" multiple onChange={handleFileChange} />
                  </label>
                  <button 
                    type="submit"
                    className="btn-primary"
                  >
                    <Send size={18} />
                    {t('Send')}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Ticket History Section */}
          <div className="surface overflow-hidden">
            <details className="group">
              <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600">
                    <History size={20} />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{t('Ticket History')}</h2>
                </div>
                <ChevronDown className="text-slate-400 group-open:rotate-180 transition-transform" size={20} />
              </summary>
              <div className="px-6 pb-6 space-y-4">
                {history && history.length > 0 ? (
                  history.map((item: any, i: number) => (
                    <div 
                      key={item.id} 
                      className={cn(
                        "p-4 rounded-2xl transition-colors",
                        i % 2 === 0 ? "bg-slate-50 dark:bg-slate-800/50" : "bg-white dark:bg-slate-900"
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{t(item.action)}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{safeDate(item.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mb-2">{item.details}</p>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-[8px] font-black text-slate-500">
                          {item.user?.name?.[0] || 'S'}
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 italic">
                          {t('By')}: {item.user?.name || t('System')}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t('No history available')}</p>
                  </div>
                )}
              </div>
            </details>
          </div>

          {/* Staff Review */}
          {(ticket.status === 'pending-confirmation' || (ticket.status === 'resolved' && !ticket.isApproved)) && user?.role === 'staff' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-blue-100 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-600 rounded-xl text-white">
                  <CheckCircle2 size={24} />
                </div>
                <h2 className="text-2xl font-black text-blue-900 dark:text-blue-200 tracking-tight">{t('Is your issue solved?')}</h2>
              </div>
              <p className="text-blue-700 dark:text-blue-300 font-medium mb-8">
                {t('Confirm whether the technician solved your issue. If it is not solved, send it back with one click.')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleStaffReview(true)}
                  disabled={pendingAction !== null}
                  className="btn bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 disabled:bg-slate-300 disabled:shadow-none"
                >
                  {pendingAction === 'staff-approve' ? t('Saving...') : t('Issue Solved')}
                </button>
                <button
                  onClick={() => handleStaffReview(false)}
                  disabled={pendingAction !== null}
                  className="btn bg-white text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100 disabled:bg-slate-100 disabled:text-slate-400 dark:bg-slate-900 dark:text-blue-200 dark:ring-blue-800 dark:hover:bg-blue-950"
                >
                  {pendingAction === 'staff-reopen' ? t('Submitting...') : t('Not Solved')}
                </button>
              </div>
            </motion.div>
          )}

          {/* Closed Ticket Appeal */}
          {ticket.status === 'closed' && user?.role === 'staff' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-amber-100 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-amber-600 rounded-xl text-white">
                  <AlertTriangle size={24} />
                </div>
                <h2 className="text-2xl font-black text-amber-900 dark:text-amber-200 tracking-tight">{t('Appeal Closed Ticket')}</h2>
              </div>
              <p className="text-amber-700 dark:text-amber-300 font-medium mb-6">
                {t('Closed tickets cannot be reopened directly. Submit an appeal if this issue still needs attention.')}
              </p>
              {appealSubmitted ? (
                <p className="text-sm font-black text-amber-800 dark:text-amber-200">{t('Your appeal has been submitted for review.')}</p>
              ) : (
                <div className="space-y-4">
                  <textarea
                    className="field min-h-[110px]"
                    placeholder={t('Explain why this closed ticket should be reviewed again...')}
                    value={appealReason}
                    onChange={(e) => setAppealReason(e.target.value)}
                  />
                  <button
                    onClick={handleAppealSubmit}
                    disabled={pendingAction !== null || !appealReason.trim()}
                    className="btn bg-amber-600 text-white shadow-sm shadow-amber-600/20 hover:bg-amber-700 disabled:bg-slate-300 disabled:shadow-none"
                  >
                    {pendingAction === 'appeal' ? t('Submitting...') : t('Submit Appeal')}
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* User Feedback Form */}
          {(ticket.status === 'closed' || (ticket.status === 'resolved' && ticket.isApproved)) && user?.role === 'staff' && !feedbackSubmitted && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-900/20"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-600 rounded-xl text-white">
                  <CheckCircle2 size={24} />
                </div>
                <h2 className="text-2xl font-black text-emerald-900 dark:text-emerald-200 tracking-tight">{t('How did we do?')}</h2>
              </div>
              <p className="text-emerald-700 dark:text-emerald-300 font-medium mb-8">
                {t('Your feedback helps us improve our support services.')}
              </p>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-3">{t('Rating')}</h3>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className={cn(
                          "p-2 transition-all transform hover:scale-110",
                          (rating || 0) >= star ? "text-amber-400" : "text-slate-300"
                        )}
                      >
                        <Star size={32} fill={(rating || 0) >= star ? "currentColor" : "none"} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider mb-3">{t('Comments')}</h3>
                  <textarea
                    className="field min-h-[100px]"
                    placeholder={t("Any additional comments? (Optional)")}
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                  />
                </div>

                <button 
                  onClick={handleFeedbackSubmit}
                  disabled={!rating}
                  className="btn bg-emerald-600 text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700 disabled:bg-slate-300 disabled:shadow-none"
                >
                  {t('Submit Feedback')}
                </button>
              </div>
            </motion.div>
          )}

          {feedbackSubmitted && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-800">
              <div className="flex items-center gap-4">
                <CheckCircle className="text-emerald-600" size={24} />
                <p className="text-emerald-800 dark:text-emerald-200 font-bold">{t('Thank you for your feedback! It has been recorded.')}</p>
              </div>
              {ticket?.feedback && (
                <div className="mt-4 rounded-2xl bg-white/70 p-4 dark:bg-slate-900/40">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} size={18} fill={ticket.feedback.rating >= star ? "currentColor" : "none"} className={ticket.feedback.rating >= star ? "text-amber-400" : "text-slate-300"} />
                    ))}
                    <span className="ml-2 text-xs font-black text-slate-600 dark:text-slate-300">{ticket.feedback.rating}/5</span>
                  </div>
                  {ticket.feedback.comment && (
                    <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{ticket.feedback.comment}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="lg:col-span-4 space-y-8">
          <div className="surface p-6 sm:p-8">
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-6">{t('Ticket Details')}</h2>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                  <User size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('Assigned Technician')}</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{ticket.technician?.name || t('Unassigned')}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                  <Clock size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('Last Updated')}</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{safeDate(ticket.updatedAt).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('User Location')}</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {hasLocation
                      ? `${locationLatitude.toFixed(5)}, ${locationLongitude.toFixed(5)}`
                      : t('Not provided')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                  <MapPin size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('Building / Room')}</p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {ticket.buildingBlockNo || ticket.roomNumber
                      ? `${ticket.buildingBlockNo || t('Not provided')} / ${ticket.roomNumber || t('Not provided')}`
                      : t('Not provided')}
                  </p>
                </div>
              </div>
              {showSla && (
                <>
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                      {ticket.slaPaused ? <Pause size={18} /> : <AlertCircle size={18} />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t('SLA Status')}</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{ticket.slaPaused ? t('Paused') : t(ticket.slaStatus || 'on-track')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-400">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t(ticket.slaPaused ? 'Paused Since' : 'SLA Due')}</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {ticket.slaPaused
                          ? (ticket.blockedAt ? safeDate(ticket.blockedAt).toLocaleString() : t('Not available'))
                          : (ticket.dueDate ? safeDate(ticket.dueDate).toLocaleString() : t('Not scheduled'))}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Parts & Assets Usage Section */}
          {(user?.role === 'technician' || isManagerLevel) && (
            <div className="surface p-6 sm:p-8">
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-6">{t('Parts & Assets Used')}</h2>
              
              {/* Record New Usage */}
              <div className="mb-8 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-4">{t('Record Usage')}</h3>
                <div className="space-y-4">
                  <div>
                    <select
                      className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                      value={selectedAssetId}
                      onChange={(e) => setSelectedAssetId(e.target.value)}
                    >
                      <option value="">{t('Select Part/Asset')}</option>
                      {allAssets.filter(a => (a.status === 'active' || a.status === 'requested') && a.quantity > 0).map(asset => (
                        <option key={asset.id} value={asset.id}>
                          {asset.brand ? `${asset.brand} ` : ''}{asset.name} {asset.isConsumable ? `(${asset.quantity} ${t('in stock')})` : `(${t('Individual Unit')})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder={t('Qty')}
                      disabled={!allAssets.find((asset) => asset.id === selectedAssetId)?.isConsumable && Boolean(selectedAssetId)}
                      className="w-24 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                      value={allAssets.find((asset) => asset.id === selectedAssetId)?.isConsumable === false ? 1 : usageQuantity}
                      onChange={(e) => setUsageQuantity(parseInt(e.target.value))}
                      min={1}
                    />
                    <button 
                      onClick={handleRecordUsage}
                      disabled={!selectedAssetId}
                      className="flex-grow px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-blue-600/20 disabled:shadow-none"
                    >
                      {t('Record')}
                    </button>
                  </div>
                </div>
              </div>

              {/* List Usages */}
              <div className="space-y-4">
                {assetUsages.length > 0 ? (
                  assetUsages.map((usage) => (
                    <div key={usage.id} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                            {usage.asset?.brand ? `${usage.asset.brand} ` : ''}{usage.asset?.name || t('Asset')}
                          </h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                            {usage.user?.name || t('Unknown')} • {safeDate(usage.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-[10px] font-black">
                            x{usage.quantity}
                          </span>
                          {usage.status === 'returned' && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[8px] font-black uppercase tracking-wider">
                              {t('Returned')}
                            </span>
                          )}
                        </div>
                      </div>

                      {usage.status !== 'returned' && (
                        <div className="flex flex-col gap-2">
                          { (usage.userReturned || usage.staffReturned) && (
                            <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider bg-amber-50 p-1.5 rounded-lg text-center">
                              {usage.userReturned && !usage.staffReturned && t('Waiting for staff confirmation')}
                              {!usage.userReturned && usage.staffReturned && t('Waiting for user confirmation')}
                            </p>
                          )}
                          <div className="flex gap-2">
                            {user?.id === usage.userId && !usage.userReturned && (
                              <button 
                                onClick={() => handleReturnUsage(usage.id)}
                                className="flex-grow py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                              >
                                {usage.staffReturned ? t('Confirm Return') : t('Return')}
                              </button>
                            )}
                            {isManagerLevel && !usage.staffReturned && (
                              <button 
                                onClick={() => handleReturnUsage(usage.id)}
                                className="flex-grow py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                              >
                                {usage.userReturned ? t('Confirm Receipt') : t('Mark Returned')}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <Package className="mx-auto text-slate-200 mb-2" size={32} />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('No parts recorded')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SLA Pause Modal */}
      <AnimatePresence>
        {blockDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBlockDialogOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('Pause SLA')}</h2>
                  <button onClick={() => setBlockDialogOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={24} />
                  </button>
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">
                  {t('Document the blocker so the SLA clock is paused fairly while you wait for something outside your control.')}
                </p>
                <textarea
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-amber-500 transition-all outline-none min-h-[120px] mb-8"
                  placeholder={t("Blocking reason")}
                  value={blockingReasonInput}
                  onChange={(e) => setBlockingReasonInput(e.target.value)}
                />
                <div className="flex gap-3">
                  <button 
                    onClick={() => setBlockDialogOpen(false)}
                    className="flex-grow px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-black transition-all"
                  >
                    {t('Cancel')}
                  </button>
                  <button 
                    onClick={handlePauseSLA}
                    disabled={pendingAction !== null || !blockingReasonInput.trim()}
                    className="flex-grow px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-amber-600/20"
                  >
                    {pendingAction === 'pause-sla' ? t('Pausing...') : t('Pause SLA')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6",
                  confirmConfig.color === 'danger' ? "bg-rose-50 text-rose-600" :
                  confirmConfig.color === 'success' ? "bg-emerald-50 text-emerald-600" :
                  "bg-blue-50 text-blue-600"
                )}>
                  {confirmConfig.color === 'danger' ? <Trash2 size={32} /> : <CheckCircle size={32} />}
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">{confirmConfig.title}</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">{confirmConfig.message}</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setConfirmOpen(false)}
                    className="flex-grow px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-black transition-all"
                  >
                    {t('Cancel')}
                  </button>
                  <button 
                    onClick={confirmConfig.onConfirm}
                    className={cn(
                      "flex-grow px-6 py-3 text-white rounded-2xl text-sm font-black transition-all shadow-lg",
                      confirmConfig.color === 'danger' ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20" :
                      confirmConfig.color === 'success' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20" :
                      "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
                    )}
                  >
                    {t('Confirm')}
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
