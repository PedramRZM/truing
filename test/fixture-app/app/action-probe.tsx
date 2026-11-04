'use client';

import { useState } from 'react';

import { ping } from './actions';

export function ActionProbe() {
  const [result, setResult] = useState('idle');

  return (
    <p>
      <button
        type="button"
        onClick={async () => {
          try {
            setResult(await ping());
          } catch (error) {
            setResult(
              `error: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }}
      >
        Run Server Action
      </button>{' '}
      <output aria-label="server action result">{result}</output>
    </p>
  );
}
