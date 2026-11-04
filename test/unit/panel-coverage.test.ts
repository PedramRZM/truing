// Every CSS property a class in the app sets is either changed in the panel or
// left out for a stated reason (TRU-4.5). A class that sets something new fails
// here, as a decision to make, and the message names it.
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, it } from 'vitest';

import { propertiesOf } from '../../src/modules/selection/inspect';
import {
  IN_THE_PANEL,
  LEFT_OUT,
} from '../../src/modules/selection/panel-coverage';
import { loadTokens } from '../../src/tokens/table';

import { PACKAGE_ROOT } from './temp-modules';

const ROOT = path.join(PACKAGE_ROOT, 'test/fixtures/design-system');

/** Every class a real app's source uses, frozen, so the check keeps its reach. */
function classesInTheApp(): Set<string> {
  const text = readFileSync(path.join(ROOT, 'app-classes.txt'), 'utf8');
  return new Set(text.trim().split('\n'));
}

it('has a control or a reason for every property the classes in the app set', async () => {
  const table = await loadTokens(ROOT, 'src/app/globals.css');
  const undecided = new Map<string, string>();
  for (const name of classesInTheApp()) {
    const css = table.designSystem.candidatesToCss([name])[0] ?? null;
    let properties: string[] = [];
    try {
      properties = propertiesOf(css);
    } catch {
      // A word that compiled to something postcss can't read isn't a class.
    }
    for (const property of properties) {
      if (!IN_THE_PANEL.has(property) && !(property in LEFT_OUT)) {
        undecided.set(property, name);
      }
    }
  }
  expect(
    [...undecided].map(([property, name]) => `${property} (${name})`),
  ).toEqual([]);
}, 60_000);

it('counts a property once', () => {
  const both = [...IN_THE_PANEL].filter((property) => property in LEFT_OUT);
  expect(both).toEqual([]);
});
