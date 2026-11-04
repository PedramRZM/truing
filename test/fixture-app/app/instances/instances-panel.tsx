'use client';

import { Button } from '../../components/ui/button';

import { Badge, MemoBadge, RefBadge } from './badge';
import { Heading } from './heading';

const STEPS = ['First', 'Second', 'Third'];

/** Buttons in three variants, three more from one list, and four Badges. */
export function InstancesPanel() {
  return (
    <section aria-label="Instances panel">
      <Button>Plain</Button>
      <Button variant="tonal">Tonal</Button>
      <Button variant="tonal" size="sm">
        Small tonal
      </Button>
      <ol aria-label="Steps">
        {STEPS.map((step) => (
          <li key={step}>
            <Button variant="tonal">{step}</Button>
          </li>
        ))}
      </ol>
      <p aria-label="Badges">
        <Badge />
        <Badge />
        <MemoBadge />
        <RefBadge />
      </p>
      <Heading text="Alpha" />
      <Heading text="Beta" />
    </section>
  );
}
