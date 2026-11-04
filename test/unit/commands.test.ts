// The one list of commands (TRU-2.3): what each key runs, where it may run, and
// how it is written down, from the same entries.
import { describe, expect, it, vi } from 'vitest';

import {
  type Chord,
  type CommandSpec,
  chordMatches,
  commandForKey,
  CORE_COMMANDS,
  CORE_ENTRIES,
  FRAME_ENTRIES,
  type KeyInput,
  keyFormat,
} from '../../src/commands';
import selection from '../../src/modules/selection/module';

/** A key event as the list sees it; `target` stands in for where focus is. */
function key(
  init: Partial<KeyInput> & { key: string },
  target: EventTarget | null = null,
): KeyInput {
  return {
    code: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    target,
    ...init,
  };
}

const ALL: Array<readonly [string, CommandSpec]> = [
  ...CORE_ENTRIES,
  ...Object.entries(selection.actions).map(
    ([name, spec]) => [`selection:${name}`, spec] as const,
  ),
];

describe('commandForKey', () => {
  it('finds the core commands by their keys', () => {
    expect(commandForKey(key({ key: 'v' }), ALL)).toBe('mode-select');
    expect(commandForKey(key({ key: 'I' }), ALL)).toBe('mode-interact');
    expect(commandForKey(key({ key: 'h' }), ALL)).toBe('hand-tool');
    expect(
      commandForKey(key({ key: '!', code: 'Digit1', shiftKey: true }), ALL),
    ).toBe('fit');
    expect(
      commandForKey(key({ key: ')', code: 'Digit0', shiftKey: true }), ALL),
    ).toBe('zoom-reset');
    expect(
      commandForKey(key({ key: '?', code: 'Slash', shiftKey: true }), ALL),
    ).toBe('shortcuts');
    expect(commandForKey(key({ key: 'Escape' }), ALL)).toBe('escape');
  });

  it('zooms with Ctrl or ⌘, with or without Shift, and while the key is held', () => {
    for (const init of [
      { key: '=', code: 'Equal', ctrlKey: true },
      { key: '+', code: 'Equal', ctrlKey: true, shiftKey: true },
      { key: '=', code: 'Equal', metaKey: true, repeat: true },
      { key: '+', code: 'NumpadAdd', ctrlKey: true },
    ]) {
      expect(commandForKey(key(init), ALL)).toBe('zoom-in');
    }
    expect(
      commandForKey(key({ key: '-', code: 'Minus', ctrlKey: true }), ALL),
    ).toBe('zoom-out');
    expect(
      commandForKey(key({ key: '0', code: 'Digit0', metaKey: true }), ALL),
    ).toBe('zoom-reset');
  });

  it('tells a key from the same key with Shift, Alt or a modifier', () => {
    expect(commandForKey(key({ key: 'O', shiftKey: true }), ALL)).toBe(
      'selection:open-definition',
    );
    expect(commandForKey(key({ key: 'o' }), ALL)).toBe(
      'selection:open-call-site',
    );
    expect(commandForKey(key({ key: 'v', altKey: true }), ALL)).toBeNull();
    expect(commandForKey(key({ key: 'v', metaKey: true }), ALL)).toBeNull();
    expect(commandForKey(key({ key: 'v', repeat: true }), ALL)).toBeNull();
    expect(
      commandForKey(key({ key: '\\', code: 'Backslash', ctrlKey: true }), ALL),
    ).toBe('toggle-left');
    expect(
      commandForKey(
        key({ key: '|', code: 'Backslash', ctrlKey: true, shiftKey: true }),
        ALL,
      ),
    ).toBe('toggle-right');
  });

  it('hides everything with . and opens or closes both panels with Shift and .', () => {
    expect(commandForKey(key({ key: '.', code: 'Period' }), ALL)).toBe(
      'hide-ui',
    );
    expect(
      commandForKey(key({ key: '>', code: 'Period', shiftKey: true }), ALL),
    ).toBe('collapse-panels');
  });

  it('switches the left panel’s tabs with Alt and a digit, by the key’s place', () => {
    expect(
      commandForKey(key({ key: '1', code: 'Digit1', altKey: true }), ALL),
    ).toBe('tab-design');
    // ⌥2 on a Mac types a symbol, so the key's own name can't be trusted.
    expect(
      commandForKey(key({ key: '™', code: 'Digit2', altKey: true }), ALL),
    ).toBe('tab-theme');
  });

  it('keeps Alt chords apart from the same key without Alt', () => {
    expect(commandForKey(key({ key: '1', code: 'Digit1' }), ALL)).toBeNull();
    expect(
      commandForKey(
        key({ key: '!', code: 'Digit1', altKey: true, shiftKey: true }),
        ALL,
      ),
    ).toBeNull();
    expect(
      commandForKey(key({ key: 'v', code: 'KeyV', altKey: true }), ALL),
    ).toBeNull();
  });

  it('leaves Alt and a digit to a field being typed in', () => {
    const field = fakeElement({ editable: true });
    expect(
      commandForKey(
        key({ key: '¡', code: 'Digit1', altKey: true }, field),
        ALL,
      ),
    ).toBeNull();
  });

  it('leaves . to a field being typed in', () => {
    const field = fakeElement({ editable: true });
    expect(
      commandForKey(key({ key: '.', code: 'Period' }, field), ALL),
    ).toBeNull();
    expect(
      commandForKey(
        key({ key: '>', code: 'Period', shiftKey: true }, field),
        ALL,
      ),
    ).toBeNull();
  });

  it('moves the pick with Enter and Tab, with and without Shift', () => {
    expect(commandForKey(key({ key: 'Enter' }), ALL)).toBe(
      'selection:select-child',
    );
    expect(commandForKey(key({ key: 'Enter', shiftKey: true }), ALL)).toBe(
      'selection:select-parent',
    );
    expect(commandForKey(key({ key: 'Tab' }), ALL)).toBe(
      'selection:select-next',
    );
    expect(commandForKey(key({ key: 'Tab', shiftKey: true }), ALL)).toBe(
      'selection:select-previous',
    );
  });

  it('never runs a key without a modifier in a field, the app’s or Truing’s', () => {
    const field = fakeElement({ editable: true });
    for (const typed of [
      'v',
      'i',
      'h',
      'o',
      'c',
      '?',
      'Enter',
      'Tab',
      'Escape',
    ]) {
      expect(commandForKey(key({ key: typed }, field), ALL)).toBeNull();
    }
    // A key with Ctrl or ⌘ still works there: Chromium must not zoom the window.
    expect(
      commandForKey(
        key({ key: '=', code: 'Equal', ctrlKey: true }, field),
        ALL,
      ),
    ).toBe('zoom-in');
  });

  it('leaves Enter and Tab to a focused control, and takes single letters there', () => {
    const button = fakeElement({ control: true });
    expect(commandForKey(key({ key: 'Enter' }, button), ALL)).toBeNull();
    expect(commandForKey(key({ key: 'Tab' }, button), ALL)).toBeNull();
    expect(commandForKey(key({ key: 'v' }, button), ALL)).toBe('mode-select');
  });

  it('hands only the keys a frame must not keep to the shell', () => {
    const ids = FRAME_ENTRIES.map(([id]) => id);
    expect(ids).toEqual([
      'mode-select',
      'mode-interact',
      'hand-tool',
      'spacing',
      'zoom-in',
      'zoom-out',
      'zoom-reset',
      'fit',
      'collapse-panels',
      'hide-ui',
      'tab-design',
      'tab-theme',
      'view-claude',
    ]);
  });
});

describe('the list', () => {
  it('binds no key to two commands', () => {
    const bound = new Map<string, string>();
    for (const [id, spec] of ALL) {
      for (const chord of spec.keys ?? []) {
        for (const code of chord.codes ?? [chord.key ?? '']) {
          for (const shift of chord.shift === 'any'
            ? [false, true]
            : [Boolean(chord.shift)]) {
            const name = `${chord.mod ? 'mod+' : ''}${chord.alt ? 'alt+' : ''}${shift ? 'shift+' : ''}${code.toLowerCase()}`;
            expect(bound.get(name), `${name} is bound twice`).toBeUndefined();
            bound.set(name, id);
          }
        }
      }
    }
  });

  it('matches each chord it lists, so the sheet never shows a key that does nothing', () => {
    for (const [, spec] of ALL) {
      for (const chord of spec.keys ?? []) {
        expect(chordMatches(chord, eventFor(chord))).toBe(true);
      }
    }
  });
});

describe('keyFormat', () => {
  const mac = keyFormat('mac');
  const other = keyFormat('other');

  it('writes ⌘ and ⇧ on a Mac, and Ctrl and Shift elsewhere', () => {
    const keys = CORE_COMMANDS['toggle-right'].keys;
    expect(mac.keys(keys)).toBe('⌘⇧\\');
    expect(other.keys(keys)).toBe('Ctrl+Shift+\\');
    expect(mac.keys(CORE_COMMANDS['zoom-reset'].keys)).toBe('⇧0 or ⌘0');
    expect(other.keys(CORE_COMMANDS['zoom-reset'].keys)).toBe(
      'Shift+0 or Ctrl+0',
    );
    // A symbol already says Shift; 'any' isn't written.
    expect(other.keys(CORE_COMMANDS.shortcuts.keys)).toBe('?');
    expect(mac.keys(CORE_COMMANDS['zoom-in'].keys)).toBe('⌘+');
    expect(other.keys(CORE_COMMANDS.escape.keys)).toBe('Esc');
  });

  it('writes the tooltips the toolbar showed before, from the list', () => {
    expect(mac.tooltip(CORE_COMMANDS['mode-select'])).toBe(
      "Select (V). Pick elements. Clicks don't reach the page.",
    );
    expect(mac.tooltip(CORE_COMMANDS['mode-interact'])).toBe(
      'Interact (I). The page works as usual.',
    );
    expect(mac.tooltip(CORE_COMMANDS['hand-tool'])).toBe(
      'Hand (H). Drag to move around, or hold Space or the middle button and drag.',
    );
    expect(mac.tooltip(CORE_COMMANDS.fit)).toBe('Zoom to fit (⇧1)');
    expect(other.tooltip(CORE_COMMANDS.fit)).toBe('Zoom to fit (Shift+1)');
    expect(mac.tooltip(CORE_COMMANDS['zoom-reset'])).toBe('Zoom to 100% (⇧0)');
  });

  it('writes Alt as ⌥ on a Mac', () => {
    const keys = CORE_COMMANDS['tab-theme'].keys;
    expect(mac.keys(keys)).toBe('⌥2');
    expect(other.keys(keys)).toBe('Alt+2');
    expect(other.tooltip(CORE_COMMANDS['tab-design'])).toBe(
      'Show the Design tab (Alt+1)',
    );
    expect(other.aria(keys)).toBe('Alt+2');
  });

  it('writes aria-keyshortcuts as the ARIA spec names keys', () => {
    expect(other.aria(CORE_COMMANDS['toggle-left'].keys)).toBe('Control+\\');
    expect(mac.aria(CORE_COMMANDS['toggle-left'].keys)).toBe('Meta+\\');
    expect(other.aria(CORE_COMMANDS.fit.keys)).toBe('Shift+1');
    expect(other.aria(CORE_COMMANDS['mode-select'].keys)).toBe('V');
    expect(other.aria(CORE_COMMANDS.escape.keys)).toBe('Escape');
    expect(other.aria(undefined)).toBeUndefined();
  });
});

/** A key event that should match the chord. */
function eventFor(chord: Chord): KeyInput {
  return key({
    key: chord.key ?? '',
    code: chord.codes?.[0] ?? '',
    ctrlKey: Boolean(chord.mod),
    altKey: Boolean(chord.alt),
    shiftKey: chord.shift === true,
  });
}

/**
 * Stands in for a focused element: vitest runs in Node, so there is no DOM.
 * `commands.ts` asks only `instanceof Element`, `matches` and `closest`.
 */
class FakeElement {
  isContentEditable = false;
  constructor(
    private readonly editable: boolean,
    private readonly control: boolean,
  ) {}
  matches(): boolean {
    return this.editable;
  }
  closest(): FakeElement | null {
    return this.control || this.editable ? this : null;
  }
}
vi.stubGlobal('Element', FakeElement);
vi.stubGlobal('HTMLElement', FakeElement);

function fakeElement({
  editable = false,
  control = false,
}: {
  editable?: boolean;
  control?: boolean;
}): EventTarget {
  return new FakeElement(editable, control) as unknown as EventTarget;
}
