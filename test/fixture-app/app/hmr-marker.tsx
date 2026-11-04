'use client';

// The HMR test rewrites the version below and waits for the frame to show it.
export function HmrMarker() {
  return <span aria-label="hmr marker">hmr-v0</span>;
}
