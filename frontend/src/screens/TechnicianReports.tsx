'use client';

import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Award, AlertTriangle, CheckCircle2, ClipboardList, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from '@/lib/router';
import { cn } from '@/lib/utils';

export default function TechnicianReports() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      });
  }, []);

  const technicianStats = useMemo(() => stats?.technicianStats || [], [stats]);

  const enrichedStats = useMemo(
    () =>
      technicianStats.map((tech: any) => ({
        ...tech,
        completed: tech.completed ?? ((tech.resolved || 0) + (tech.closed || 0)),
        successRate: tech.total > 0 ? Math.round(((tech.completed ?? ((tech.resolved || 0) + (tech.closed || 0))) / tech.total) * 100) : 0,
        active: Math.max((tech.total || 0) - (tech.completed ?? ((tech.resolved || 0) + (tech.closed || 0))), 0),
      })),
    [technicianStats],
  );

  const topPerformer = enrichedStats.reduce(
    (best: any, tech: any) => (!best || tech.successRate > best.successRate ? tech : best),
    null,
  );

  const highestDelay = enrichedStats.reduce(
    (worst: any, tech: any) => (!worst || tech.delayed > worst.delayed ? tech : worst),
    null,
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
            {t('Technician Reports')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {t('Track workload, completion rate, and delayed jobs for each technician.')}
          </p>
        </div>
        <Link
          to="/reports"
          className="inline-flex items-center justify-center px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          {t('Back to Reports')}
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600">
              <Users size={24} />
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Technicians')}</p>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{enrichedStats.length}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600">
              <Award size={24} />
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Top Performer')}</p>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white">{topPerformer?.name || t('N/A')}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{topPerformer?.successRate || 0}% {t('Success Rate')}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl text-amber-600">
              <ClipboardList size={24} />
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Active Work')}</p>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">
            {enrichedStats.reduce((sum: number, tech: any) => sum + tech.active, 0)}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl text-rose-600">
              <AlertTriangle size={24} />
            </div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('Most Delays')}</p>
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white">{highestDelay?.name || t('N/A')}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{highestDelay?.delayed || 0} {t('Delayed Jobs')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm h-[440px]">
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-8">{t('Completed vs Active Work')}</h2>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enrichedStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="resolved" stackId="work" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="closed" stackId="work" fill="#64748b" radius={[6, 6, 0, 0]} />
                <Bar dataKey="active" stackId="work" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-8">{t('Team Snapshot')}</h2>
          <div className="space-y-4">
            {enrichedStats.map((tech: any) => (
              <div key={tech.id} className="p-5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
                      {tech.name?.[0] || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">{tech.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{tech.total || 0} {t('Total')}</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-900 dark:text-white">{tech.successRate}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${tech.successRate}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-emerald-600">{tech.resolved || 0} {t('Resolved')}</span>
                  <span className="text-slate-500 dark:text-slate-300">{tech.closed || 0} {t('Closed')}</span>
                  <span className="text-blue-600">{tech.active || 0} {t('Active')}</span>
                  <span className={cn((tech.delayed || 0) > 0 ? 'text-rose-600' : 'text-slate-400')}>
                    {tech.delayed || 0} {t('Delayed')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-12 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-8">{t('Technician Performance')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('Technician')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('Total')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('Resolved')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('Closed')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('Active')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('Delayed Jobs')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{t('Success Rate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {enrichedStats.map((tech: any) => (
                  <tr key={tech.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                          {tech.name?.[0] || '?'}
                        </div>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{tech.name || t('Unknown')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-slate-600 dark:text-slate-400">{tech.total || 0}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-emerald-600">{tech.resolved || 0}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-slate-600 dark:text-slate-300">{tech.closed || 0}</td>
                    <td className="px-6 py-4 text-center text-sm font-bold text-blue-600">{tech.active || 0}</td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider',
                          (tech.delayed || 0) > 0
                            ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-400',
                        )}
                      >
                        {tech.delayed || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${tech.successRate}%` }} />
                        </div>
                        <span className="text-xs font-black text-slate-900 dark:text-white">{tech.successRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
