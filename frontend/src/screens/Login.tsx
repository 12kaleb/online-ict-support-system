'use client';

import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Ticket, Sun, Moon, CheckCircle2, AlertCircle } from 'lucide-react';
import { useThemeContext } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { handleResponse } from '../utils/apiUtils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const { t } = useTranslation();
  const { mode, toggleTheme } = useThemeContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = await handleResponse(res);
      if (res.ok) {
        onLogin(data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(t(message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-950 dark:to-slate-900 p-4 relative transition-colors duration-500">
      {/* Theme Toggle */}
      <div className="absolute top-6 right-6">
        <button 
          onClick={toggleTheme}
          className="p-3 rounded-full bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-lg border border-slate-200 dark:border-slate-700 hover:scale-110 transition-transform"
          title={t(`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`)}
        >
          {mode === 'light' ? <Moon size={24} /> : <Sun size={24} />}
        </button>
      </div>

      <div className="w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-600/30 mb-4"
          >
            <Ticket size={36} />
          </motion.div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white mb-1">
            {t('ICT Support')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {t('Enterprise Support Management System')}
          </p>
        </div>

        {/* Form Container */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-slate-200 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden"
        >
          <div className="border-b border-slate-100 px-8 py-5 dark:border-slate-800">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">{t('Sign In')}</h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              {t('New users must use the invitation link sent by an administrator to set their password.')}
            </p>
          </div>

          <div className="p-8">
            <AnimatePresence mode="wait">
            {message && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 rounded-xl flex items-start gap-3 text-sm font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-900/30"
              >
                <CheckCircle2 size={18} className="shrink-0" />
                {t(message)}
              </motion.div>
            )}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                    "mb-6 p-4 rounded-xl flex items-start gap-3 text-sm font-medium",
                    "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30"
                  )}
                >
                  <AlertCircle size={18} className="shrink-0" />
                  {t(error)}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{t("Email Address")}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">{t("Password")}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    placeholder="••••••••"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all"
                  />
                  <span className="text-sm text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">{t('Remember me')}</span>
                </label>
                <button type="button" className="text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors">
                  {t('Forgot password?')}
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  t('Sign In')
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('By continuing, you agree to our Terms of Service and Privacy Policy.')}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
