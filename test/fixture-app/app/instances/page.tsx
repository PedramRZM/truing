import { InstancesPanel } from './instances-panel';
import { ServerButtons } from './server-buttons';

// The Instances fixture (TRU-2.2): three Button variants, a mapped list of
// Buttons, a Server Component's Button, a component used plain, through memo
// and through forwardRef, and one whose text is a prop.
export default function InstancesPage() {
  return (
    <main>
      <h1>Instances fixture</h1>
      <InstancesPanel />
      <ServerButtons />
    </main>
  );
}
