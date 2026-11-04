'use client';

import { useState, useSyncExternalStore } from 'react';

function subscribe(): () => void {
  return () => {};
}

export function ClickCounter() {
  const [clicks, setClicks] = useState(0);
  // Disabled until React has hydrated it, so a click is never lost to a page
  // that isn't interactive yet (tests wait for it to be enabled).
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <button
      type="button"
      disabled={!hydrated}
      onClick={() => setClicks((count) => count + 1)}
    >
      Clicked {clicks} times
    </button>
  );
}
