import { definePanel } from '../../../src/module';

import module from './module';

export default definePanel(
  module,
  { left: () => <p className="module-empty">In the Theme tab.</p> },
  {
    properties: [
      {
        id: 'selection-colours',
        title: 'Selection colours',
        Body: ({ pick }) => (
          <p className="module-empty">Picked {pick.classes.length} classes.</p>
        ),
      },
      {
        id: 'page',
        title: 'Page check',
        empty: () => {
          throw new Error('The fixture stopped deciding.');
        },
        Body: () => null,
      },
      {
        id: 'claude',
        title: 'Claude',
        Body: () => {
          throw new Error('The fixture stopped.');
        },
      },
    ],
  },
);
