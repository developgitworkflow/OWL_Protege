
import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-md pointer-events-none">
      {toasts.map(t => (
        <div 
          key={t.id} 
          className={`pointer-events-auto flex items-center justify-between p-3 rounded-lg shadow-2xl border animate-in slide-in-from-bottom-5 fade-in duration-300 ${
            t.type === 'success' ? 'bg-slate-900 border-green-500/50 text-green-100 shadow-green-900/10' :
            t.type === 'error' ? 'bg-slate-900 border-red-500/50 text-red-100 shadow-red-900/10' :
            'bg-slate-900 border-blue-500/50 text-blue-100 shadow-blue-900/10'
          }`}
        >
          <div className="flex items-center gap-3">
            {t.type === 'success' && <CheckCircle className="text-green-500" size={18} />}
            {t.type === 'error' && <AlertCircle className="text-red-500" size={18} />}
            {t.type === 'info' && <Info className="text-blue-500" size={18} />}
            <span className="text-sm font-medium">{t.message}</span>
          </div>
          <button onClick={() => onDismiss(t.id)} className="text-slate-500 hover:text-white transition-colors p-1">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toast;
