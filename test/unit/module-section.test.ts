import { expect, it } from 'vitest';

import { groupFailures } from '../../src/shell/module-section';

it('shows one failure for a probe that stopped the same way in every frame', () => {
  const groups = groupFailures([
    { module: 'm', part: 'probe', frame: 'phone', message: 'boom' },
    { module: 'm', part: 'probe', frame: 'desktop', message: 'boom' },
    { module: 'm', part: 'probe', frame: 'tablet', message: 'other' },
    { module: 'm', part: 'server', frame: null, message: 'boom' },
  ]);

  expect(groups).toEqual([
    {
      key: 'probe:boom',
      part: 'probe',
      message: 'boom',
      frames: ['phone', 'desktop'],
    },
    { key: 'probe:other', part: 'probe', message: 'other', frames: ['tablet'] },
    { key: 'server:boom', part: 'server', message: 'boom', frames: [] },
  ]);
});
