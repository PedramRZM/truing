// TRU-2.2: which code an edit is for, and when that sends it to Claude.
import { expect, it } from 'vitest';

import { decideReach } from '../../src/modules/selection/reach';

const shared = (usages: number | null) => ({
  kind: 'component' as const,
  component: 'Card',
  usages,
});

it('writes at the use for "This use" when the code is at the use', () => {
  expect(
    decideReach({
      component: 'Button',
      usages: 12,
      chosen: 'use',
      writesInside: false,
    }),
  ).toEqual({ reach: { kind: 'use' }, claude: null });
});

it('writes inside the component for "Every", as a shared change with its count', () => {
  expect(
    decideReach({
      component: 'Card',
      usages: 4,
      chosen: 'component',
      writesInside: true,
    }),
  ).toEqual({ reach: shared(4), claude: null });
});

it('sends "This use" on code inside the component to Claude', () => {
  expect(
    decideReach({
      component: 'Card',
      usages: 4,
      chosen: 'use',
      writesInside: true,
    }),
  ).toEqual({
    reach: { kind: 'use' },
    claude: "it is written inside Card, so one use can't change alone",
  });
});

it('sends "Every" on code at the use to Claude, still as a shared change', () => {
  expect(
    decideReach({
      component: 'Card',
      usages: 4,
      chosen: 'component',
      writesInside: false,
    }),
  ).toEqual({ reach: shared(4), claude: 'it is set where each Card is used' });
});

it('has nothing to choose for a component with one use', () => {
  expect(
    decideReach({
      component: 'Card',
      usages: 1,
      chosen: 'use',
      writesInside: true,
    }),
  ).toEqual({ reach: shared(1), claude: null });
  expect(
    decideReach({
      component: 'Card',
      usages: 1,
      chosen: 'component',
      writesInside: false,
    }),
  ).toEqual({ reach: { kind: 'use' }, claude: null });
});

it("keeps to the choice when the uses couldn't be counted", () => {
  expect(
    decideReach({
      component: 'Card',
      usages: null,
      chosen: 'use',
      writesInside: true,
    }).claude,
  ).toBe("it is written inside Card, so one use can't change alone");
});

it('is this use, written as it is, when there is no component', () => {
  expect(
    decideReach({
      component: null,
      usages: null,
      chosen: 'component',
      writesInside: true,
    }),
  ).toEqual({ reach: { kind: 'use' }, claude: null });
});
