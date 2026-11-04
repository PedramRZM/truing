import { Button } from '../../components/ui/button';

/** A Server Component's Buttons: the primitive has no 'use client', so these have no fiber. */
export function ServerButtons() {
  return (
    <section aria-label="Server buttons">
      <Button variant="tonal">Server tonal</Button>
    </section>
  );
}
