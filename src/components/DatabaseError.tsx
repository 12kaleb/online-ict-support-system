import { Database, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface DatabaseErrorProps {
  error: string;
  code?: string;
  onRetry?: () => void;
}

export default function DatabaseError({ error, code, onRetry }: DatabaseErrorProps) {
  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-slate-50 dark:bg-slate-950">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-slate-900 p-10 text-center rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none"
      >
        <div className="w-20 h-20 rounded-3xl bg-red-50 dark:bg-red-900/20 text-red-600 flex items-center justify-center mx-auto mb-8 shadow-inner">
          <Database size={40} />
        </div>
        
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-6">
          Database Connection Error
        </h1>
        
        <div className="bg-red-600 text-white p-5 rounded-2xl mb-8 flex items-start gap-4 text-left shadow-lg shadow-red-600/20">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm font-bold leading-relaxed">
            {error}
          </p>
        </div>

        {(code === 'DATABASE_URL_DEFAULT_VALUE' || code === 'DATABASE_URL_MISSING') && (
          <div className="text-left mb-8 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">
              How to fix this:
            </h2>
            <ol className="space-y-3 text-sm font-medium text-slate-600 dark:text-slate-300 list-decimal pl-4">
              <li>Open the <strong className="text-slate-900 dark:text-white">Secrets</strong> panel in AI Studio.</li>
              <li>Add or update the <strong className="text-slate-900 dark:text-white">DATABASE_URL</strong> secret.</li>
              <li className="break-all">Use your Supabase URL: <code className="bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 text-xs font-mono">postgresql://postgres:%40%23Kaleb1301@db.qmmojzifrvtkvlysjpbh.supabase.co:5432/postgres?sslmode=require</code></li>
              <li>Restart the development server.</li>
            </ol>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button 
            onClick={onRetry || (() => window.location.reload())}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-wider text-xs transition-all shadow-lg shadow-blue-600/25 active:scale-95"
          >
            <RefreshCw size={18} />
            Retry Connection
          </button>
          <a 
            href="https://neon.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-2xl font-black uppercase tracking-wider text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95"
          >
            <ExternalLink size={18} />
            Get a Database
          </a>
        </div>
      </motion.div>
    </div>
  );
}
