import { forwardRef, memo } from 'react';

/** Its text is written inside it: every use shows the same word. */
export function Badge(_props: object, _ref?: unknown) {
  return <span className="px-100">New</span>;
}

// A compare function makes React give it a fiber of its own around Badge's.
export const MemoBadge = memo(Badge, () => false);
export const RefBadge = forwardRef(Badge);
