'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Search, HelpCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { handleResponse } from '../utils/apiUtils';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export default function FAQ() {
  const { t } = useTranslation();
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/kb')
      .then(handleResponse)
      .then(data => {
        setFaqs(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch FAQs:', err);
        setLoading(false);
      });
  }, []);

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(search.toLowerCase()) ||
    faq.answer.toLowerCase().includes(search.toLowerCase()) ||
    faq.category.toLowerCase().includes(search.toLowerCase())
  );

  const categories = Array.from(new Set(faqs.map(f => f.category)));

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
          {t('Frequently Asked Questions')}
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">
          {t('Find answers to common ICT issues and requests.')}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm mb-10">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder={t("Search for answers...")}
            className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button 
              key={cat} 
              onClick={() => setSearch(cat)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all border",
                search === cat 
                  ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20" 
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
              )}
            >
              {t(cat)}
            </button>
          ))}
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="flex items-center gap-2 px-4 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-all"
            >
              <X size={14} />
              {t("Clear Search")}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredFaqs.length > 0 ? (
        <div className="space-y-4">
          {filteredFaqs.map((faq) => (
            <div 
              key={faq.id} 
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden"
            >
              <details className="group">
                <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600">
                      <HelpCircle size={20} />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                      {t(faq.question)}
                    </h3>
                  </div>
                  <ChevronDown className="text-slate-400 group-open:rotate-180 transition-transform shrink-0" size={20} />
                </summary>
                <div className="px-6 pb-6">
                  <div className="h-px bg-slate-100 dark:bg-slate-800 mb-6" />
                  <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap mb-6">
                    {t(faq.answer)}
                  </p>
                  <span className="px-3 py-1 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-slate-100 dark:border-slate-700">
                    {t(faq.category)}
                  </span>
                </div>
              </details>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
          <Search className="mx-auto text-slate-200 mb-4" size={48} />
          <p className="text-lg font-bold text-slate-400">
            {t('No results found for "{{search}}". Try a different search term.', { search })}
          </p>
        </div>
      )}
    </div>
  );
}
