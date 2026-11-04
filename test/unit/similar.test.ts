import { describe, expect, it } from 'vitest';

import type { Edit, StagedChange } from '../../src/module';
import { followersOf, sharedOf } from '../../src/modules/changes/panel';
import { alikeClasses } from '../../src/modules/selection/similar';
import {
  changesToSpread,
  editAt,
  placeKey,
  placeOfEdit,
} from '../../src/modules/selection/similar-plan';

const at = { file: 'a.tsx', line: 1, column: 1 };
const picked = { selector: 'a', href: 'h' };

const classes: Edit = {
  kind: 'classes',
  at,
  tag: 'p',
  add: ['bg-primary'],
  remove: ['bg-card'],
};

/** An element as the change records it, on the pick or another. */
const elementAt = (selector: string) => ({
  selector,
  href: 'h',
  tag: 'p',
  classes: [],
  callSite: null,
  definition: null,
  component: null,
});

const change = (over: Partial<StagedChange> = {}): StagedChange =>
  ({
    id: 'c1',
    module: 'selection',
    reach: { kind: 'use' },
    route: { by: 'direct' },
    element: elementAt('a'),
    write: { by: 'edit', edit: classes },
    ...over,
  }) as StagedChange;

describe('alikeClasses', () => {
  it('holds for the same thing with a different state or tone', () => {
    expect(alikeClasses(['p-4', 'flex'], ['p-4', 'flex'])).toBe(true);
    // Active and inactive items of a nav: the base, with a different tone.
    expect(
      alikeClasses(
        ['flex', 'h-10', 'gap-2', 'bg-grey-200', 'font-bold'],
        ['flex', 'h-10', 'gap-2', 'text-grey-800', 'hover:bg-grey-200'],
      ),
    ).toBe(true);
    expect(alikeClasses([], [])).toBe(true);
  });

  it('fails for what merely sits beside it', () => {
    expect(alikeClasses(['p-4', 'flex'], ['mt-2', 'text-sm'])).toBe(false);
    expect(alikeClasses(['p-4'], [])).toBe(false);
  });

  it('leaves states out on both sides', () => {
    expect(alikeClasses(['hover:p-4'], ['focus:mt-2'])).toBe(true);
  });
});

describe('changesToSpread', () => {
  it('asks about a class or a variant change on the pick', () => {
    const list = [change()];
    expect(changesToSpread(list, picked)).toEqual(list);
    const variant = change({
      write: {
        by: 'edit',
        edit: {
          kind: 'variant',
          at,
          definition: 'b.tsx',
          component: 'Button',
          name: 'size',
          value: 'lg',
        },
      },
    });
    expect(changesToSpread([variant], picked)).toEqual([variant]);
  });

  it('leaves out words, which differ from item to item', () => {
    expect(
      changesToSpread(
        [
          change({
            write: {
              by: 'edit',
              edit: { kind: 'text', at, before: 'a', after: 'b' },
            },
          }),
        ],
        picked,
      ),
    ).toEqual([]);
  });

  it('leaves out what is settled: every use, every item, or already followed', () => {
    expect(
      changesToSpread(
        [
          change({
            reach: { kind: 'component', component: 'B', usages: 3 },
          }),
          change({ id: 'c2', reach: { kind: 'list', items: 3 } }),
        ],
        picked,
      ),
    ).toEqual([]);
    expect(
      changesToSpread(
        [
          change(),
          change({
            id: 'c2',
            reach: { kind: 'similar', of: 'c1' },
            element: elementAt('b'),
          }),
        ],
        picked,
      ),
    ).toEqual([]);
  });

  it('leaves out a change on another element', () => {
    expect(
      changesToSpread(
        [
          change({
            element: elementAt('b'),
          }),
        ],
        picked,
      ),
    ).toEqual([]);
  });

  it('leaves out one with nothing the engine could write', () => {
    expect(changesToSpread([change({ write: null })], picked)).toEqual([]);
  });
});

it('still asks inside a component with one use, as nothing else asked', () => {
  const inside = change({
    reach: { kind: 'component', component: 'Nav', usages: 1 },
  });
  expect(changesToSpread([inside], picked)).toEqual([inside]);
});

it('stops asking once the one edit reaches the others', () => {
  const answered = change({
    reach: { kind: 'component', component: 'Nav', usages: 1 },
    element: { ...elementAt('a'), also: ['b'] },
  });
  expect(changesToSpread([answered], picked)).toEqual([]);
});

describe('editAt', () => {
  const other = { file: 'b.tsx', line: 2, column: 3 };

  it('writes the same classes at the other place, removing only what it has', () => {
    expect(
      editAt(classes, {
        at: other,
        tag: 'span',
        takes: true,
        classes: ['p-2'],
      }),
    ).toEqual({
      kind: 'classes',
      at: other,
      tag: 'span',
      takesClassName: true,
      add: ['bg-primary'],
      remove: [],
    });
  });

  it('keeps a removal the other element has', () => {
    const edit = editAt(classes, {
      at: other,
      tag: 'span',
      takes: false,
      classes: ['bg-card'],
    });
    expect(edit?.kind === 'classes' && edit.remove).toEqual(['bg-card']);
  });

  it('has nothing to write when only a removal it lacks was asked for', () => {
    expect(
      editAt({ ...classes, add: [] } as Edit, {
        at: other,
        tag: 'span',
        takes: false,
        classes: [],
      }),
    ).toBeNull();
  });

  it('moves a variant to the other use', () => {
    const variant: Edit = {
      kind: 'variant',
      at,
      tag: 'Button',
      definition: 'b.tsx',
      component: 'Button',
      name: 'size',
      value: 'lg',
    };
    expect(
      editAt(variant, { at: other, tag: 'Button', takes: false, classes: [] }),
    ).toEqual({ ...variant, at: other });
  });

  it('says where an edit is', () => {
    expect(placeOfEdit(classes)).toBe(at);
    expect(placeKey(at)).toBe('a.tsx:1:1');
  });
});

describe('the tray', () => {
  it('says a list is every item', () => {
    expect(sharedOf(change({ reach: { kind: 'list', items: 8 } }))).toBe(
      'Changes all 8 on this page',
    );
  });

  it('folds what followed into one line, and says what needs Claude', () => {
    const leader = change();
    const follower = (id: string, route: StagedChange['route']) =>
      change({ id, route, reach: { kind: 'similar', of: 'c1' } });
    expect(
      followersOf(leader, [
        leader,
        follower('c2', { by: 'direct' }),
        follower('c3', {
          by: 'claude',
          reason: 'class is built at runtime',
          requested: false,
        }),
      ]),
    ).toEqual({
      text: 'Also on 2 more like it',
      claude: '1 of them need Claude: class is built at runtime',
    });
    expect(followersOf(leader, [leader])).toBeNull();
  });
});
