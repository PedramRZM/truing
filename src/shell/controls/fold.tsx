import type { ReactNode } from 'react';

import { ArrowRight, ChevronRight } from 'lucide-react';

/** A `<details>`'s line: a lucide chevron for the native triangle, in a 24 px line. */
export function FoldSummary({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <summary className={className ? `fold ${className}` : 'fold'}>
      <ChevronRight aria-hidden size={16} className="fold-chevron" />
      <span>{children}</span>
    </summary>
  );
}

/**
 * `→`, which neither bundled font holds: a system font would draw it small and
 * low. The character stays, unpainted, for what tests, screen readers and a
 * copy read, and an icon draws it.
 */
export function PathArrow() {
  return (
    <span className="path-arrow">
      <span className="path-arrow-text"> → </span>
      <ArrowRight
        aria-hidden
        size={12}
        absoluteStrokeWidth
        strokeWidth={4 / 3}
      />
    </span>
  );
}

/** A label that may hold `→`s, drawn with the icon. */
export function WithArrows({ text }: { text: string }) {
  const [first, ...rest] = text.split(' → ');
  return (
    <>
      {first}
      {rest.map((part, index) => (
        <span key={index}>
          <PathArrow />
          {part}
        </span>
      ))}
    </>
  );
}
