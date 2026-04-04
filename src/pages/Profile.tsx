import { User, Mail, Shield, Calendar, MapPin, Phone, Edit2, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useThemeContext } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function Profile() {
  const { t } = useTranslation();
  const { mode } = useThemeContext();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800';
      case 'manager': return 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'technician': return 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'staff': return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">{t('My Profile')}</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-4 space-y-6"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-8 text-center">
            <div className="relative inline-block mb-6">
              <div className="w-32 h-32 rounded-full bg-indigo-600 flex items-center justify-center text-white text-5xl font-black shadow-2xl shadow-indigo-200 dark:shadow-none border-4 border-white dark:border-slate-800">
                {user?.name?.[0] || '?'}
              </div>
              <div className="absolute bottom-1 right-1 w-8 h-8 bg-green-500 border-4 border-white dark:border-slate-800 rounded-full shadow-lg"></div>
            </div>
            
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">{user?.name || t('User')}</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-4">{user?.email || '-'}</p>
            
            <span className={cn(
              "px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border inline-block mb-8",
              getRoleBadgeColor(user?.role || 'staff')
            )}>
              {t(user?.role || 'staff')}
            </span>
            
            <div className="h-px bg-slate-100 dark:bg-slate-800 mb-8 w-full" />
            
            <button className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-600 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 font-black rounded-2xl transition-all active:scale-95 group">
              <Edit2 size={18} className="group-hover:rotate-12 transition-transform" />
              {t('Edit Profile')}
            </button>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-8"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-8 md:p-10">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-3">
              <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
              {t('Account Information')}
            </h3>
            
            <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
              <div className="py-6 flex items-start gap-5 group">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  <User size={22} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{t('Full Name')}</p>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{user?.name || '-'}</p>
                </div>
              </div>
              
              <div className="py-6 flex items-start gap-5 group">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  <Mail size={22} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{t('Email Address')}</p>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{user?.email || '-'}</p>
                </div>
              </div>
              
              <div className="py-6 flex items-start gap-5 group">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  <Shield size={22} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{t('Account Role')}</p>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-200 capitalize">{t(user?.role || 'staff')}</p>
                </div>
              </div>
              
              <div className="py-6 flex items-start gap-5 group">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  <Calendar size={22} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{t('Member Since')}</p>
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{t('March 2026')}</p>
                </div>
              </div>
            </div>
            
            <div className="mt-10 p-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-4">
              <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-wider mb-1">{t('Security Tip')}</h4>
                <p className="text-sm text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">
                  {t('Ensure your password is strong and updated regularly. If you suspect any unauthorized access, contact the ICT security team immediately.')}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
