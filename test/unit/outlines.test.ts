// #80: which elements the overlay outlines and names.
import { expect, it } from 'vitest';

import { outlineTargets } from '../../src/modules/selection/overlay';

it('outlines nothing while Outlines is off', () => {
  expect(outlineTargets(false, 'card', 'button')).toEqual({
    hover: null,
    pick: null,
  });
});

it('outlines the hover and the pick while Outlines is on', () => {
  expect(outlineTargets(true, 'card', 'button')).toEqual({
    hover: 'card',
    pick: 'button',
  });
});

it('leaves the hover out when it is the pick, whose own outline says it', () => {
  expect(outlineTargets(true, 'button', 'button')).toEqual({
    hover: null,
    pick: 'button',
  });
});
