import { forwardRef, memo } from 'react';

export function Badge(_props: object, _ref?: unknown) {
  return <span>New</span>;
}

export const MemoBadge = memo(Badge);
export const RefBadge = forwardRef(Badge);
