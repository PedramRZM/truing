import { Button } from '../../components/ui/button';

/** A Server Component: its HTML comes from the server, with a primitive inside. */
export function ServerCard({ title }: { title: string }) {
  return (
    <section aria-label="Server card">
      <h2 className="text-title-m px-400">{title}</h2>
      <Button size="sm">Server button</Button>
    </section>
  );
}
