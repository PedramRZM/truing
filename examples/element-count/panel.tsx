import { Fragment } from 'react';

import { definePanel } from '../../src/module';

import elementCount from './module';

const number = new Intl.NumberFormat('en');

export default definePanel(elementCount, {
  left: function ElementCountPanel({ frames, reports }) {
    const counted = frames.flatMap((frame) => {
      const latest = reports.count[frame.id];
      return latest ? [{ frame, elements: latest.elements }] : [];
    });

    if (counted.length === 0) {
      return <p className="module-empty">Counts show once a frame loads.</p>;
    }

    return (
      <dl className="module-facts">
        {counted.map(({ frame, elements }) => (
          <Fragment key={frame.id}>
            <dt>{frame.label}</dt>
            <dd>
              {number.format(elements)}{' '}
              {elements === 1 ? 'element' : 'elements'}
            </dd>
          </Fragment>
        ))}
      </dl>
    );
  },
});
