import type { ReactNode } from 'react';

import { Marks } from '../../shell/controls/marks';

import type { Reading } from './design-values';

export function Rows({ children }: { children: ReactNode }) {
  return <dl className="design-rows">{children}</dl>;
}

export function Row({
  label,
  reading,
  title,
  children,
}: {
  label: string;
  reading?: Reading;
  /** The whole value, when it may be cut short. */
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="design-row">
      <dt>{label}</dt>
      <dd>
        <span className="design-value" title={title}>
          {children}
        </span>
        {reading ? <Marks reading={reading} /> : null}
      </dd>
    </div>
  );
}
