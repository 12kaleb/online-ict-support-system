'use client';

import { useState, useEffect } from 'react';
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
  Cell,
  LineChart,
  Line
} from 'recharts';
import { TrendingUp, CheckCircle, Clock, AlertTriangle, Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { Link } from '@/lib/router';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] as const;

export default function Reports() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const categoryData = stats?.byCategory?.map((c: any) => ({ name: c.category, value: c._count?.id || 0 })) || [];
  const priorityData = stats?.byPriority?.map((p: any) => ({ name: p.priority, value: p._count?.id || 0 })) || [];
  const statusData = stats?.byStatus?.map((s: any) => ({ name: s.status, value: s._count?.id || 0 })) || [];
  const getCompletedCount = (tech: any) => tech?.completed ?? ((tech?.resolved || 0) + (tech?.closed || 0));
  const getSuccessRate = (tech: any) => (tech?.total || 0) > 0 ? Math.round((getCompletedCount(tech) / (tech?.total || 0)) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">{t('System Reports')}</h1>
        <p className="text-slate-500 dark:text-slate-400 font-medium">
          {t('Overview of ticket volume, performance, and distribution.')}
        </p>
      </div>

      <div className="flex justify-end">
        <Link
          to="/reports/technicians"
          className="inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors shadow-lg shadow-blue-600/20"
        >
          {t('View Technician Reports')}
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600">
              <TrendingUp size={24} />
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Total Tickets')}</p>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{stats?.total || 0}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600">
              <CheckCircle size={24} />
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Resolved')}</p>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{stats?.resolved || 0}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl text-slate-600 dark:text-slate-300">
              <Archive size={24} />
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Closed')}</p>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{stats?.closed || 0}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-amber-600">
              <Clock size={24} />
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Pending')}</p>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{stats?.pending || 0}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl text-rose-600">
              <AlertTriangle size={24} />
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Delayed Jobs')}</p>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{(stats?.delayedTickets || 0) + (stats?.delayedMaintenance || 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">{t('SLA Performance')}</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{stats?.slaPerformance ?? 0}%</p>
          <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t('Resolved within SLA')}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">{t('SLA Risk')}</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{stats?.slaAtRisk || 0}</p>
          <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t('Tickets currently at risk')}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">{t('Open Approvals')}</p>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{stats?.openApprovals || 0}</p>
          <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{t('Pending management actions')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm h-[450px]">
          <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8">{t('Ticket Volume (Last 7 Days)')}</h3>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.volumeOverTime || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: 'none', 
                    borderRadius: '12px', 
                    color: '#fff',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                  }}
                  itemStyle={{ color: '#fff', fontWeight: 700 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3b82f6" 
                  strokeWidth={4} 
                  dot={{ r: 6, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 8, strokeWidth: 0 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm h-[450px]">
          <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8">{t('Status Distribution')}</h3>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {statusData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length] ?? COLORS[0]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: 'none', 
                    borderRadius: '12px', 
                    color: '#fff'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Bar Chart */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm h-[400px]">
          <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8">{t('By Category')}</h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Bar Chart */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm h-[400px]">
          <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8">{t('By Priority')}</h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="value" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Technician Performance Table */}
        {stats?.technicianStats && (
          <div className="lg:col-span-12 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8">{t('Technician Performance')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Technician')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('Total')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('Resolved')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('Closed')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('Delayed Jobs')}</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('Success Rate')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {stats?.technicianStats?.map((tech: any) => (
                    <tr key={tech.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                            {tech?.name?.[0] || '?'}
                          </div>
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{tech?.name || t('Unknown')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{tech?.total || 0}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-bold text-emerald-600">{tech?.resolved || 0}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{tech?.closed || 0}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                          (tech?.delayed || 0) > 0 
                            ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600" 
                            : "bg-slate-50 dark:bg-slate-800 text-slate-400"
                        )}>
                          {tech?.delayed || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-600 rounded-full" 
                              style={{ width: `${getSuccessRate(tech)}%` }}
                            />
                          </div>
                          <span className="text-xs font-black text-slate-900 dark:text-white">
                            {getSuccessRate(tech)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stats?.assetHealth && (
          <div className="lg:col-span-12 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8">{t('Asset Health Overview')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
                <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">{t('Active')}</p>
                <p className="mt-3 text-4xl font-black text-emerald-900 dark:text-emerald-100">{stats.assetHealth.active || 0}</p>
              </div>
              <div className="p-6 rounded-2xl bg-amber-50 dark:bg-amber-900/20">
                <p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">{t('Under Maintenance')}</p>
                <p className="mt-3 text-4xl font-black text-amber-900 dark:text-amber-100">{stats.assetHealth.maintenance || 0}</p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-100 dark:bg-slate-800">
                <p className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">{t('Retired')}</p>
                <p className="mt-3 text-4xl font-black text-slate-900 dark:text-white">{stats.assetHealth.retired || 0}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
