import { ClientPanel } from './client-panel';
import { Extras } from './extras';
import { ServerCard } from './server-card';
import { SpacingFixture } from './spacing';

// The inspector's fixture (TRU-2.1): a Server Component, a client component, a
// cva primitive from both, an asChild Button, a mapped list and a Dialog.
export default function InspectPage() {
  return (
    <main>
      <h1>Inspect fixture</h1>
      <ServerCard title="Server heading" />
      <ClientPanel />
      <Extras />
      <SpacingFixture />
    </main>
  );
}
