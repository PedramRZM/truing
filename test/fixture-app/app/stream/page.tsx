import { Suspense } from 'react';

import { connection } from 'next/server';

// The second half arrives about 3 s after the first: a streamed page.
async function Slow() {
  await connection();
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return <p aria-label="streamed part">Streamed after 3 s</p>;
}

export default function StreamPage() {
  return (
    <main>
      <h1>Stream fixture</h1>
      <Suspense fallback={<p aria-label="stream fallback">Loading…</p>}>
        <Slow />
      </Suspense>
    </main>
  );
}
