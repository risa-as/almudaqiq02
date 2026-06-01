'use client';

import { Loader2 } from 'lucide-react';
import { ButtonHTMLAttributes, ReactNode } from 'react';

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
}

/**
 * Unified button with consistent loading state across the system.
 * Loading pattern: Loader2 spinner + loading text, disabled:opacity-60 disabled:cursor-not-allowed
 */
export default function LoadingButton({
  loading = false,
  loadingText,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {loading
        ? <Loader2 size={15} className="animate-spin shrink-0" />
        : icon ?? null}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}
