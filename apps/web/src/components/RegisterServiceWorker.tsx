'use client';

import { useEffect } from 'react';

/** Registers the offline shell (production only, so dev hot-reload is never cached). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* offline support is a bonus; never block the app */
    });
  }, []);
  return null;
}
