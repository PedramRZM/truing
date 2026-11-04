import Link from 'next/link';

import { ActionProbe } from './action-probe';
import { ClickCounter } from './click-counter';
import { HmrMarker } from './hmr-marker';

export default function HomePage() {
  return (
    <main>
      <h1>Fixture home</h1>
      <nav>
        <Link href="/other">Other page</Link>{' '}
        <Link href="/stream">Streamed page</Link>
      </nav>
      <ClickCounter />
      <ActionProbe />
      <HmrMarker />
    </main>
  );
}
