import { Button } from '../../components/ui/button';

// The Changes tray's fixture (TRU-4.1): text to edit and a cva Button to switch.
// changes.spec.ts writes to this file and puts it back after each test.
export default function ChangesPage() {
  return (
    <main>
      <h1>Changes fixture</h1>
      <p className="px-100">Refine the real interface.</p>
      <Button variant="tonal">Send the design</Button>
    </main>
  );
}
