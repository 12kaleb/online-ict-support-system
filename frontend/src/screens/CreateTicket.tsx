'use client';

import { useState, useEffect } from 'react';
import { useNavigate } from '../lib/router';
import { ArrowLeft, Paperclip, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { handleResponse } from '../utils/apiUtils';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

const CATEGORIES = ['Hardware', 'Software', 'Network', 'Account/Access', 'Other'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const TEMPLATES = [
  { key: 'hardware', label: 'Hardware Fault', category: 'Hardware', priority: 'medium', title: 'Hardware fault or damage', description: 'Describe the device, symptoms, and whether the device is still usable.' },
  { key: 'network', label: 'Network Issue', category: 'Network', priority: 'high', title: 'Network connectivity issue', description: 'Describe the location, affected device, error message, and whether others are impacted.' },
  { key: 'account', label: 'Account Access', category: 'Account/Access', priority: 'medium', title: 'Account or access issue', description: 'Describe the account, affected system, and what access is missing or failing.' },
  { key: 'software', label: 'Software Issue', category: 'Software', priority: 'medium', title: 'Software or application issue', description: 'Describe the application, steps taken, and any exact error shown.' },
];

export default function CreateTicket() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Hardware');
  const [priority, setPriority] = useState('medium');
  const [assetId, setAssetId] = useState('');
  const [templateKey, setTemplateKey] = useState('');
  const [assets, setAssets] = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/assets')
      .then(res => res.json())
      .then(data => setAssets(data));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachments(prev => [...prev, {
            name: file.name,
            type: file.type,
            url: reader.result as string
          }]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, category, priority, assetId, attachments, templateKey: templateKey || undefined }),
      });
      await handleResponse(res);
      toast.success('Ticket created successfully');
      navigate('/');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (key: string) => {
    setTemplateKey(key);
    const template = TEMPLATES.find((item) => item.key === key);
    if (!template) return;
    setCategory(template.category);
    setPriority(template.priority);
    setTitle((prev) => prev || template.title);
    setDescription((prev) => prev || template.description);
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-amber-600';
      default: return 'text-slate-600';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 font-bold transition-colors group"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        {t('Back')}
      </button>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden"
      >
        <div className="p-8 md:p-12">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t('Report an Issue')}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              {t('Provide as much detail as possible to help us resolve your issue quickly.')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">{t('Ticket Template')}</label>
                <select
                  value={templateKey}
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none font-medium appearance-none text-slate-900 dark:text-white"
                >
                  <option value="">{t('Start from scratch')}</option>
                  {TEMPLATES.map((template) => (
                    <option key={template.key} value={template.key}>{t(template.label)}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">{t('Issue Title')}</label>
                <input 
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  placeholder={t('e.g., Cannot connect to Wi-Fi in Library')}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">{t('Category')}</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none font-medium appearance-none text-slate-900 dark:text-white"
                >
                  {CATEGORIES.map(c => <option key={c} value={c} className="bg-white dark:bg-slate-900">{t(c)}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">{t('Priority')}</label>
                <select 
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={cn(
                    "w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none font-bold appearance-none",
                    getPriorityColor(priority)
                  )}
                >
                  {PRIORITIES.map(p => <option key={p} value={p} className="bg-white dark:bg-slate-900">{t(p)}</option>)}
                </select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">{t('Related Asset (Optional)')}</label>
                <select 
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none font-medium appearance-none text-slate-900 dark:text-white"
                >
                  <option value="" className="bg-white dark:bg-slate-900">{t('None')}</option>
                  {assets.map(asset => (
                    <option key={asset.id} value={asset.id} className="bg-white dark:bg-slate-900">
                      {asset.brand ? `${asset.brand} ` : ''}{asset.name} ({asset.serialNo || t('No Serial')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">{t('Description')}</label>
                <textarea 
                  required
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none font-medium resize-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                  placeholder={t('Describe the problem, steps to reproduce, and any error messages...')}
                />
              </div>

              <div className="md:col-span-2 space-y-4">
                <label className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">{t('Attachments')}</label>
                <div className="flex flex-wrap gap-3">
                  <AnimatePresence>
                    {attachments.map((file, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl group"
                      >
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate max-w-[150px]">{file.name}</span>
                        <button 
                          type="button"
                          onClick={() => removeAttachment(i)}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  
                  <label className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl cursor-pointer transition-all group">
                    <Paperclip size={18} className="text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">{t('Upload Files')}</span>
                    <input type="file" hidden multiple onChange={handleFileChange} />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
              <button 
                type="button"
                onClick={() => navigate(-1)}
                className="w-full sm:w-auto px-8 py-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-bold transition-colors"
              >
                {t('Cancel')}
              </button>
              <button 
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    {t('Submitting...')}
                  </>
                ) : (
                  t('Submit Ticket')
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
