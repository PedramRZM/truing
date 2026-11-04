import type { Button as ButtonType } from '@/src/components/ui/button';

// A component of the same name that isn't the primitive.
function Button() {
  return <span />;
}

export function Own(_props: { kind?: ButtonType }) {
  return <Button />;
}
