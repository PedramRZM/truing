'use client';

import { createContext, type ReactNode, useContext } from 'react';

// Providers, as an app stacks them: each draws nothing and passes children on.
const Theme = createContext('light');

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <Theme.Provider value="light">{children}</Theme.Provider>;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  useContext(Theme);
  return <>{children}</>;
}

/** Draws nothing, like a tracker: it shouldn't count as a child of anything. */
export function Tracker() {
  return null;
}
