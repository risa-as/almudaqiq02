import { useLayoutEffect } from 'react';

export function usePageTitle(title: string) {
  const full = `${title} | نظام المدقق`;

  // Set synchronously during render so the browser never shows the default title
  if (typeof window !== 'undefined') {
    document.title = full;
  }

  // Keep in sync if title changes after mount
  useLayoutEffect(() => {
    document.title = full;
  }, [full]);
}
