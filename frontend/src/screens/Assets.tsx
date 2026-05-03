'use client';

import { useState, useEffect } from 'react';
import { Plus, Laptop, Search, Filter, Calendar, Clock, Package, Send, X, Edit2, Trash2, ChevronRight, MoreVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { safeDate } from '../utils/dateUtils';
import { handleResponse } from '../utils/apiUtils';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { isManager, isTechnician } from '../lib/permissions';

export default function Assets({ user }: { user: any }) {
  const { t } = useTranslation();
  const isManagerLevel = isManager(user);
  const [assets, setAssets] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [assetTypes, setAssetTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [newAsset, setNewAsset] = useState({ 
    name: '', 
    brand: '', 
    type: '', 
    typeId: '', 
    serialNo: '', 
    quantity: 1, 
    status: 'active',
    minStockLevel: 5,
    isConsumable: false
  });
  const [newMaintenance, setNewMaintenance] = useState({ type: 'Preventive', scheduledDate: format(new Date(), 'yyyy-MM-dd'), description: '' });
  const [requestQuantity, setRequestQuantity] = useState(1);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('All');

  const fetchAssets = async () => {
    try {
      const res = await fetch('/api/assets');
      const data = await handleResponse(res);
      setAssets(Array.isArray(data) ? data : []);
      
      const requestsRes = await fetch('/api/assets/requests');
      const requestsData = await handleResponse(requestsRes);
      setRequests(Array.isArray(requestsData) ? requestsData : []);

      const typesRes = await fetch('/api/asset-types');
      const typesData = await handleResponse(typesRes);
      setAssetTypes(Array.isArray(typesData) ? typesData : []);
      if (typesData.length > 0 && !newAsset.typeId) {
        setNewAsset(prev => ({ ...prev, typeId: typesData[0].id, type: typesData[0].name }));
      }
    } catch (err) {
      console.error("Fetch assets error:", err);
      toast.error("Failed to fetch assets or types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleAddAsset = async () => {
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newAsset, quantity: parseInt(newAsset.quantity.toString()) }),
      });
      await handleResponse(res);
      toast.success('Asset added successfully');
      setOpen(false);
      setNewAsset({ 
        name: '', 
        brand: '', 
        type: assetTypes[0]?.name || '', 
        typeId: assetTypes[0]?.id || '', 
        serialNo: '', 
        quantity: 1, 
        status: 'active',
        minStockLevel: 5,
        isConsumable: false
      });
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add asset');
    }
  };

  const handleAddType = async () => {
    if (!newTypeName) return;
    try {
      const res = await fetch('/api/asset-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTypeName }),
      });
      await handleResponse(res);
      toast.success('Asset type added successfully');
      setNewTypeName('');
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add asset type');
    }
  };

  const handleDeleteType = async (id: string) => {
    try {
      const res = await fetch(`/api/asset-types/${id}`, {
        method: 'DELETE',
      });
      await handleResponse(res);
      toast.success('Asset type deleted successfully');
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete asset type');
    }
  };

  const handleEditAsset = async () => {
    try {
      const res = await fetch(`/api/assets/${editingAsset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingAsset.name,
          type: editingAsset.type,
          typeId: editingAsset.typeId,
          serialNo: editingAsset.serialNo,
          brand: editingAsset.brand,
          quantity: parseInt(editingAsset.quantity.toString()),
          status: editingAsset.status,
          minStockLevel: parseInt(editingAsset.minStockLevel?.toString() || '0'),
          isConsumable: editingAsset.isConsumable
        }),
      });
      await handleResponse(res);
      toast.success('Asset updated successfully');
      setEditOpen(false);
      setEditingAsset(null);
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update asset');
    }
  };

  const handleDeleteAsset = async (asset: any) => {
    const confirmed = window.confirm(
      asset.isConsumable && asset.quantity > 1
        ? `Delete one "${asset.name}" unit from inventory? Remaining stock will become ${asset.quantity - 1}.`
        : `Delete ${asset.isConsumable ? 'asset' : 'device unit'} "${asset.name}" from inventory?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'DELETE',
      });
      const data = await handleResponse(res);
      toast.success(data?.message || 'Asset deleted successfully');
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete asset');
    }
  };

  const handleScheduleMaintenance = async () => {
    if (!selectedAsset) return;
    try {
      const res = await fetch(`/api/assets/${selectedAsset.id}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMaintenance),
      });
      await handleResponse(res);
      toast.success('Maintenance scheduled successfully');
      setMaintenanceOpen(false);
      setNewMaintenance({ type: 'Preventive', scheduledDate: format(new Date(), 'yyyy-MM-dd'), description: '' });
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule maintenance');
    }
  };

  const handleRequestRestock = async (assetId: string, quantity: number) => {
    try {
      const res = await fetch(`/api/assets/${assetId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      await handleResponse(res);
      toast.success(t('Request submitted! Admins will be notified.'));
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit request');
    }
  };

  const handleFulfillRequest = async (id: string) => {
    try {
      const res = await fetch(`/api/assets/requests/${id}/fulfill`, {
        method: 'PUT',
      });
      await handleResponse(res);
      toast.success(t('Request fulfilled!'));
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to fulfill request');
    }
  };

  const handleReturnRequest = async (id: string) => {
    try {
      const res = await fetch(`/api/assets/requests/${id}/return`, {
        method: 'PUT',
      });
      const updatedRequest = await handleResponse(res);
      setRequests(requests.map(r => r.id === id ? updatedRequest : r));
      toast.success(updatedRequest.status === 'returned' ? t('Asset returned successfully!') : t('Return initiated! Waiting for other party confirmation.'));
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to return asset');
    }
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(search.toLowerCase()) || 
                         (asset.serialNo && asset.serialNo.toLowerCase().includes(search.toLowerCase()));
    const matchesType = filterType === 'All' || asset.type === filterType;
    return matchesSearch && matchesType;
  });

  const canScheduleMaintenance = (asset: any) =>
    !asset?.isConsumable &&
    asset?.quantity === 1 &&
    asset?.status !== 'maintenance';

  const getMaintenanceRestriction = (asset: any) => {
    if (asset?.isConsumable) return 'Consumables cannot be scheduled for maintenance.';
    if (asset?.quantity !== 1) return 'Maintenance can only be scheduled for individual asset units.';
    if (asset?.status === 'maintenance') return 'This asset is already under maintenance.';
    return '';
  };

  const requestableAssets = assets.filter((a) => a.quantity > 0 && a.status !== 'maintenance');

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
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{t('Asset Management')}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">{t('Track and manage hardware assets across the organization.')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isManagerLevel && (
            <>
              <button 
                onClick={() => setTypesOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
              >
                <Filter size={18} />
                {t('Manage Types')}
              </button>
              <button 
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-600/20"
              >
                <Plus size={18} />
                {t('Add Asset')}
              </button>
            </>
          )}
          {(isTechnician(user) || user?.role === 'staff') && (
            <button 
              onClick={() => setRequestOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
            >
              <Send size={18} />
              {t('Request Asset')}
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
        <button
          onClick={() => setTab(0)}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
            tab === 0 
              ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <Package size={18} />
          {t('Inventory')}
        </button>
        <button
          onClick={() => setTab(1)}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all",
            tab === 1 
              ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <Send size={18} />
          {t('Requests')}
        </button>
      </div>

      {tab === 0 ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-grow">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder={t('Search assets by name or serial number...')}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 min-w-[200px]">
              <Filter size={18} className="text-slate-400" />
              <select 
                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="All">{t('All Types')}</option>
                {assetTypes.map(type => (
                  <option key={type.id} value={type.name}>{t(type.name)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredAssets.map((asset) => (
              <motion.div 
                layout
                key={asset.id}
                className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600">
                      <Laptop size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight">{asset.name}</h3>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {asset.brand ? `${asset.brand} • ` : ''}{t(asset.type)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                      asset.status === 'active' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" :
                      asset.status === 'maintenance' ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600" :
                      asset.status === 'retired' ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600" :
                      "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    )}>
                      {t(asset.status)}
                    </span>
                    {asset.serialNo && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded">
                        {asset.serialNo}
                      </span>
                    )}
                    {!asset.isConsumable && asset.quantity !== 1 && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded text-right">
                        Individually track devices for maintenance
                      </span>
                    )}
                  </div>
                </div>

                {asset.isConsumable ? (
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl mb-6">
                    <div className="flex items-center gap-2">
                      <Package size={16} className={cn("text-slate-400", asset.quantity <= (asset.minStockLevel || 0) && "text-rose-500")} />
                      <span className={cn("text-xs font-bold uppercase tracking-wider", asset.quantity <= (asset.minStockLevel || 0) ? "text-rose-500" : "text-slate-500 dark:text-slate-400")}>
                        {t('Stock')} {asset.quantity <= (asset.minStockLevel || 0) && `(${t('Low')})`}
                      </span>
                    </div>
                    <span className={cn("text-lg font-black", asset.quantity <= (asset.minStockLevel || 0) ? "text-rose-600" : "text-slate-900 dark:text-white")}>
                      {asset.quantity}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl mb-6">
                    <div className="flex items-center gap-2">
                      <Laptop size={16} className="text-slate-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {t('Device Unit')}
                      </span>
                    </div>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {asset.serialNo || t('No Serial')}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    {isManagerLevel && (
                      <>
                        <button 
                          onClick={() => {
                            setEditingAsset(asset);
                            setEditOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedAsset(asset);
                            setMaintenanceOpen(true);
                          }}
                          disabled={!canScheduleMaintenance(asset)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all"
                          title={canScheduleMaintenance(asset) ? t('Schedule Maintenance') : getMaintenanceRestriction(asset)}
                        >
                          <Calendar size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteAsset(asset)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                          title={t('Delete')}
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                  {(isTechnician(user) || user?.role === 'staff') && asset.quantity > 0 && asset.status !== 'maintenance' && (
                    <button 
                      onClick={() => {
                        setSelectedAsset(asset);
                        setRequestOpen(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-blue-600/20"
                    >
                      <Send size={14} />
                      {t('Request')}
                    </button>
                  )}
                  {isManagerLevel && asset.isConsumable && asset.quantity < 5 && (
                    <button 
                      onClick={() => handleRequestRestock(asset.id, 10)}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-black transition-all"
                    >
                      {t('Restock')}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {filteredAssets.length === 0 && (
            <div className="bg-white dark:bg-slate-900 p-20 rounded-3xl border border-slate-100 dark:border-slate-800 text-center">
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="text-slate-300" size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{t('No assets found')}</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                {t('Try adjusting your search or filters to find what you are looking for.')}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('User')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Asset Requested')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Date')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Status')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                          {req.user?.name?.[0] || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{req.user?.name || t('Unknown')}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{req.user?.email || ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{req.asset?.name || t('Asset')}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {req.asset?.brand ? `${req.asset.brand} - ` : ''}{req.asset?.type ? t(req.asset.type) : ''} (Qty: {req.quantity})
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {format(safeDate(req.createdAt), 'MMM d, yyyy')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider w-fit",
                          req.status === 'fulfilled' ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600" :
                          req.status === 'returned' ? "bg-slate-100 dark:bg-slate-800 text-slate-500" :
                          "bg-amber-50 dark:bg-amber-900/20 text-amber-600"
                        )}>
                          {t(req.status)}
                        </span>
                        {req.status === 'fulfilled' && (req.userReturned || req.staffReturned) && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                            {req.userReturned && !req.staffReturned && t('Waiting for staff confirmation')}
                            {!req.userReturned && req.staffReturned && t('Waiting for user confirmation')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {req.status === 'pending' && isManagerLevel && (
                          <button 
                            onClick={() => handleFulfillRequest(req.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm"
                          >
                            {t('Fulfill')}
                          </button>
                        )}
                        {req.status === 'fulfilled' && (
                          <>
                            {user?.id === req.userId && !req.userReturned && (
                              <button 
                                onClick={() => handleReturnRequest(req.id)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm"
                              >
                                {req.staffReturned ? t('Confirm Return') : t('Return Asset')}
                              </button>
                            )}
                            {isManagerLevel && !req.staffReturned && (
                              <button 
                                onClick={() => handleReturnRequest(req.id)}
                                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm"
                              >
                                {req.userReturned ? t('Confirm Receipt') : t('Mark as Returned')}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {requests.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="text-slate-300" size={32} />
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">{t('No requests found.')}</p>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {requestOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('Request Asset')}</h2>
                  <button onClick={() => setRequestOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">
                  {t('Select an asset and specify quantity. Admins will be notified.')}
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Asset')}</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={selectedAsset?.id || ''}
                      onChange={(e) => {
                        const asset = assets.find(a => a.id === e.target.value);
                        setSelectedAsset(asset);
                        setRequestQuantity(1);
                      }}
                    >
                      <option value="" disabled>{t('Select an asset')}</option>
                      {requestableAssets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.brand ? `${a.brand} ` : ''}{a.name} {a.isConsumable ? `(${a.quantity} ${t('in stock')})` : `(${t('Individual Unit')})`}
                        </option>
                      ))}
                      {requestableAssets.length === 0 && (
                        <option disabled>{t('No assets available')}</option>
                      )}
                    </select>
                    <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Assets under maintenance are unavailable for requests.
                    </p>
                  </div>
                  {selectedAsset && (
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Quantity')}</label>
                      <input
                        type="number"
                        disabled={!selectedAsset.isConsumable}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                        value={selectedAsset.isConsumable ? requestQuantity : 1}
                        onChange={(e) => setRequestQuantity(Math.max(1, Math.min(selectedAsset.quantity, parseInt(e.target.value) || 1)))}
                        min={1}
                        max={selectedAsset.quantity}
                      />
                      <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {selectedAsset.isConsumable ? `${t('Available')}: ${selectedAsset.quantity}` : t('Individual devices are requested one at a time.')}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-8">
                  <button 
                    onClick={() => setRequestOpen(false)}
                    className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-black transition-all"
                  >
                    {t('Cancel')}
                  </button>
                  <button 
                    disabled={!selectedAsset}
                    onClick={() => {
                      handleRequestRestock(selectedAsset.id, requestQuantity);
                      setRequestOpen(false);
                    }}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-600/20"
                  >
                    {t('Submit Request')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

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
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('Add New Asset')}</h2>
                  <button onClick={() => setOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Asset Name')}</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newAsset.name}
                      onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Brand')}</label>
                    <input
                      type="text"
                      placeholder={t("e.g. Dell, HP, Lenovo")}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newAsset.brand}
                      onChange={(e) => setNewAsset({ ...newAsset, brand: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Type')}</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newAsset.typeId}
                      onChange={(e) => {
                        const type = assetTypes.find(t => t.id === e.target.value);
                        setNewAsset({ ...newAsset, typeId: e.target.value, type: type?.name || '' });
                      }}
                    >
                      {assetTypes.map(type => (
                        <option key={type.id} value={type.id}>{t(type.name)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Serial Number')}</label>
                    <input
                      type="text"
                      placeholder={t("Leave empty for consumables")}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newAsset.serialNo}
                      onChange={(e) => setNewAsset({ 
                        ...newAsset, 
                        serialNo: e.target.value,
                        quantity: e.target.value && !newAsset.isConsumable ? 1 : newAsset.quantity
                      })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Quantity')}</label>
                    <input
                      type="number"
                      disabled={Boolean(newAsset.serialNo) && !newAsset.isConsumable}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 disabled:opacity-60 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newAsset.quantity}
                      onChange={(e) => setNewAsset({ ...newAsset, quantity: parseInt(e.target.value) })}
                      min={1}
                    />
                    <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {newAsset.isConsumable
                        ? 'Use quantity for shared stock.'
                        : 'Each quantity creates a separate device unit in inventory.'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Min Stock Level')}</label>
                    <input
                      type="number"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newAsset.minStockLevel}
                      onChange={(e) => setNewAsset({ ...newAsset, minStockLevel: parseInt(e.target.value) })}
                      min={0}
                    />
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                    <input
                      type="checkbox"
                      id="isConsumable"
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={newAsset.isConsumable}
                      onChange={(e) => setNewAsset({ 
                        ...newAsset, 
                        isConsumable: e.target.checked,
                        quantity: !e.target.checked && newAsset.serialNo ? 1 : newAsset.quantity
                      })}
                    />
                    <label htmlFor="isConsumable" className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      {t('Is Consumable (Spare Part)')}
                    </label>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Status')}</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newAsset.status}
                      onChange={(e) => setNewAsset({ ...newAsset, status: e.target.value })}
                    >
                      <option value="active">{t('active')}</option>
                      <option value="maintenance">{t('maintenance')}</option>
                      <option value="retired">{t('retired')}</option>
                      <option value="requested">{t('requested')}</option>
                    </select>
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
                    onClick={handleAddAsset}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-600/20"
                  >
                    {t('Add Asset')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {editOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('Edit Asset')}</h2>
                  <button onClick={() => setEditOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>
                {editingAsset && (
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Asset Name')}</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                        value={editingAsset.name}
                        onChange={(e) => setEditingAsset({ ...editingAsset, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Brand')}</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                        value={editingAsset.brand || ''}
                        onChange={(e) => setEditingAsset({ ...editingAsset, brand: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Type')}</label>
                      <select
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                        value={editingAsset.typeId || ''}
                        onChange={(e) => {
                          const type = assetTypes.find(t => t.id === e.target.value);
                          setEditingAsset({ ...editingAsset, typeId: e.target.value, type: type?.name || '' });
                        }}
                      >
                        {assetTypes.map(type => (
                          <option key={type.id} value={type.id}>{t(type.name)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Serial Number')}</label>
                      <input
                        type="text"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                        value={editingAsset.serialNo || ''}
                        onChange={(e) => setEditingAsset({ 
                          ...editingAsset, 
                          serialNo: e.target.value,
                          quantity: e.target.value && !editingAsset.isConsumable ? 1 : editingAsset.quantity
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Quantity')}</label>
                      <input
                        type="number"
                        disabled={!editingAsset.isConsumable}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 disabled:opacity-60 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                        value={editingAsset.isConsumable ? editingAsset.quantity : 1}
                        onChange={(e) => setEditingAsset({ ...editingAsset, quantity: parseInt(e.target.value) })}
                        min={0}
                      />
                      <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {editingAsset.isConsumable
                          ? 'Use quantity for shared stock.'
                          : 'Device units are edited one record at a time.'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Min Stock Level')}</label>
                      <input
                        type="number"
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                        value={editingAsset.minStockLevel || 0}
                        onChange={(e) => setEditingAsset({ ...editingAsset, minStockLevel: parseInt(e.target.value) })}
                        min={0}
                      />
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                      <input
                        type="checkbox"
                        id="editIsConsumable"
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        disabled
                        checked={editingAsset.isConsumable || false}
                        onChange={(e) => setEditingAsset({ 
                          ...editingAsset, 
                          isConsumable: e.target.checked,
                          quantity: !e.target.checked && editingAsset.serialNo ? 1 : editingAsset.quantity
                        })}
                      />
                      <label htmlFor="editIsConsumable" className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {t('Is Consumable (Spare Part)')}
                      </label>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Inventory kind cannot be changed after creation. Create a new asset record if you need a different kind.
                    </p>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Status')}</label>
                      <select
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                        value={editingAsset.status}
                        onChange={(e) => setEditingAsset({ ...editingAsset, status: e.target.value })}
                      >
                        <option value="active">{t('active')}</option>
                        <option value="maintenance">{t('maintenance')}</option>
                        <option value="retired">{t('retired')}</option>
                        <option value="requested">{t('requested')}</option>
                      </select>
                    </div>
                  </div>
                )}
                <div className="flex gap-3 mt-8">
                  <button 
                    onClick={() => setEditOpen(false)}
                    className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-black transition-all"
                  >
                    {t('Cancel')}
                  </button>
                  <button 
                    onClick={handleEditAsset}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-600/20"
                  >
                    {t('Save')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {maintenanceOpen && (
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
                  <button onClick={() => setMaintenanceOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">
                  {t('Schedule maintenance for')} <strong className="text-slate-900 dark:text-white">{selectedAsset?.name}</strong>
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Maintenance Type')}</label>
                    <select
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newMaintenance.type}
                      onChange={(e) => setNewMaintenance({ ...newMaintenance, type: e.target.value })}
                    >
                      <option value="Preventive">{t('Preventive')}</option>
                      <option value="Corrective">{t('Corrective')}</option>
                      <option value="Upgrade">{t('Upgrade')}</option>
                      <option value="Inspection">{t('Inspection')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Scheduled Date')}</label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                      value={newMaintenance.scheduledDate}
                      onChange={(e) => setNewMaintenance({ ...newMaintenance, scheduledDate: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{t('Description')}</label>
                    <textarea
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                      value={newMaintenance.description}
                      onChange={(e) => setNewMaintenance({ ...newMaintenance, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-8">
                  <button 
                    onClick={() => setMaintenanceOpen(false)}
                    className="flex-1 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-black transition-all"
                  >
                    {t('Cancel')}
                  </button>
                  <button 
                    onClick={handleScheduleMaintenance}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-600/20"
                  >
                    {t('Schedule')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {typesOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('Manage Asset Types')}</h2>
                  <button onClick={() => setTypesOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>
                
                <div className="flex gap-2 mb-8">
                  <input
                    type="text"
                    placeholder={t('New type name...')}
                    className="flex-grow px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 transition-all"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                  />
                  <button 
                    onClick={handleAddType}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-blue-600/20"
                  >
                    {t('Add')}
                  </button>
                </div>

                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('Existing Types')}</h3>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {assetTypes.map((type) => (
                          <tr key={type.id} className="group">
                            <td className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200">{t(type.name)}</td>
                            <td className="px-4 py-3 text-right">
                              <button 
                                onClick={() => handleDeleteType(type.id)}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                <div className="mt-8">
                  <button 
                    onClick={() => setTypesOpen(false)}
                    className="w-full px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-sm font-black transition-all"
                  >
                    {t('Close')}
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
