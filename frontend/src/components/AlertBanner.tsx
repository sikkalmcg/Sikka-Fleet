'use client';

import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface AlertState {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AlertBannerProps {
  alert: AlertState | null;
  onDismiss?: () => void;
}

export default function AlertBanner({ alert, onDismiss }: AlertBannerProps) {
  if (!alert || !alert.message) return null;

  const styles = {
    success: {
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
    },
    error: {
      bg: 'bg-rose-50 border-rose-200 text-rose-800',
      icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
    },
    info: {
      bg: 'bg-sky-50 border-sky-200 text-sky-800',
      icon: <Info className="w-5 h-5 text-sky-600 shrink-0" />,
    },
  }[alert.type];

  return (
    <div
      className={`flex items-start justify-between gap-3 p-4 rounded-xl border ${styles.bg} shadow-xs transition-all mb-5 animate-in fade-in slide-in-from-top-2 duration-200`}
      role="alert"
    >
      <div className="flex items-center gap-3">
        {styles.icon}
        <p className="text-sm font-medium">{alert.message}</p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-black/5 transition"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
