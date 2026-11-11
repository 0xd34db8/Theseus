"use client";

import React, { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";

export interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [onClose, duration]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-full bg-card/95 border border-border shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 font-manrope select-none pointer-events-auto"
    >
      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500/15 text-red-500 shrink-0">
        <AlertCircle className="w-3.5 h-3.5" />
      </div>
      <span className="text-xs sm:text-sm font-medium text-foreground tracking-tight">
        {message}
      </span>
      <button
        type="button"
        onClick={onClose}
        className="ml-1 p-0.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-subtle cursor-pointer transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
