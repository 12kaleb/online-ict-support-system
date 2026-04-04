import { useState } from 'react';
import { Sparkles, X, Check, Wand2, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';



interface AIAssistantProps {
  title: string;
  description: string;
  onSuggest: (suggestion: { category: string; priority: string }) => void;
}

export default function AIAssistant({ title, description, onSuggest }: AIAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<{ category: string; priority: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(true);

  const getSuggestion = async () => {
    if (!title || !description) {
      setError("Please provide a title and description first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        setError("VITE_GEMINI_API_KEY not configured. AI unavailable.");
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `As an ICT support expert, analyze this ticket and suggest a category and priority.
        
        Title: ${title}
        Description: ${description}
        
        Categories: Hardware, Software, Network, Account, Other
        Priorities: low, medium, high, urgent
        
        Return ONLY a JSON object like: {"category": "...", "priority": "..."}`,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text);
      setSuggestion(data);
      onSuggest(data);
    } catch (err) {
      console.error("AI Error:", err);
      setError("Failed to get AI suggestion. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 mb-6 rounded-3xl border border-blue-100 dark:border-blue-900/30 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 relative overflow-hidden group"
    >
      {/* Decorative background glow */}
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-400/10 blur-3xl rounded-full pointer-events-none group-hover:bg-blue-400/20 transition-colors" />
      
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-600/20">
            <Sparkles size={16} />
          </div>
          <h3 className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            AI Smart Assistant
          </h3>
        </div>
        <button 
          onClick={() => setShow(false)}
          className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-6 leading-relaxed relative z-10">
        Let Gemini analyze your ticket to suggest the best category and priority based on your input.
      </p>

      <div className="flex items-center gap-4 relative z-10">
        <button 
          onClick={getSuggestion} 
          disabled={loading}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95",
            loading 
              ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
              : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20"
          )}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Wand2 size={16} />
              Get Suggestions
            </>
          )}
        </button>
        
        <AnimatePresence>
          {error && (
            <motion.p 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="text-[10px] font-bold text-red-500"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {suggestion && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-6 p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">
                AI Suggestions:
              </span>
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-blue-100 dark:border-blue-900/30">
                  Category: {suggestion.category}
                </div>
                <div className="px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-purple-100 dark:border-purple-900/30">
                  Priority: {suggestion.priority}
                </div>
              </div>
              <button 
                onClick={() => {
                  onSuggest(suggestion);
                  setSuggestion(null);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-[0.98]"
              >
                <Check size={14} />
                Apply Suggestions
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
