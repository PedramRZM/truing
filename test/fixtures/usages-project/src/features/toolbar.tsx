import { Button } from '@/src/components/ui/button';

const ITEMS = ['a', 'b'];

export function Toolbar({ variant, rest }: { variant: string; rest: object }) {
  return (
    <div>
      <Button variant="tonal">Save</Button>
      <Button variant={variant} />
      <Button {...rest} />
      {ITEMS.map((item) => (
        <Button key={item} variant="ghost">
          {item}
        </Button>
      ))}
    </div>
  );
}
