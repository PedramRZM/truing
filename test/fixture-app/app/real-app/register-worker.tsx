'use client';

import { useEffect } from 'react';

/** What an installable app does on its first page. */
export function RegisterWorker() {
  useEffect(() => {
    void navigator.serviceWorker.register('/sw.js');
  }, []);
  return null;
}
