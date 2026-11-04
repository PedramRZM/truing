// The primitives' only import from their app: the cva test mocks cva, so the
// class names themselves don't matter here.
export function cn(...inputs: unknown[]): string {
  return inputs.filter(Boolean).join(' ');
}
