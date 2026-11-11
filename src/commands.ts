// Truing's one list of commands (TRU-2.3). The frames' runtime, the shell's
// key handler, the rail's tooltips, the `?` sheet and the context menu all
// read it, so they can't disagree. Core commands are below; a module declares
// its own in `module.ts` (`commands`), and the shell adds them to the list.
//
// Imported by the runtime and the shell, so it imports nothing.

/** One key combination. */
export type Chord = {
  /**
   * `KeyboardEvent.key`: letters compare case-insensitively ('v'), named keys
   * as the browser names them ('Enter', 'Tab', 'Escape'). A symbol ('?') is
   * matched whatever Shift is, since the symbol already says it.
   */
  key?: string;
  /** `KeyboardEvent.code` instead, for keys whose `key` moves with Shift or the layout ('Digit1'). */
  codes?: readonly string[];
  /** ⌘ on a Mac, Ctrl elsewhere. */
  mod?: boolean;
  /** 'any' for keys typed with or without it (Ctrl and + is Shift and = on many layouts). */
  shift?: boolean | 'any';
  /** Alt, or ⌥ on a Mac, where it changes `key`: use `codes` with it. */
  alt?: boolean;
  /** How the key is written, when it isn't `key` ('1', '='). */
  label?: string;
  /** Fires again while held (zoom); off for everything else. */
  repeat?: boolean;
};

/** What a command says about itself, wherever it is shown. */
export type CommandSpec = {
  title: string;
  /** A sentence after the title in a tooltip ("Pick elements. Clicks don't reach the page."). */
  hint?: string;
  /** The first is the one a tooltip shows; the sheet shows them all. */
  keys?: readonly Chord[];
};

export const CORE_GROUPS = ['Tools', 'Canvas', 'Panels', 'Help'] as const;
export type CoreGroup = (typeof CORE_GROUPS)[number];

/*
 * The keys a frame's runtime hands to the shell, with focus inside the frame.
 * Each its own constant, so the bundler can leave CORE_COMMANDS out of the
 * runtime: it never shows their words, and it has a size budget.
 */
const MODE_SELECT_KEYS = [{ key: 'v' }] as const;
const MODE_INTERACT_KEYS = [{ key: 'i' }] as const;
const HAND_TOOL_KEYS = [{ key: 'h' }] as const;
const SPACING_KEYS = [{ key: 's' }] as const;
const OUTLINES_KEYS = [{ key: 'b' }] as const;
const ZOOM_IN_KEYS = [
  {
    codes: ['Equal', 'NumpadAdd'],
    mod: true,
    shift: 'any',
    label: '+',
    repeat: true,
  },
] as const;
const ZOOM_OUT_KEYS = [
  {
    codes: ['Minus', 'NumpadSubtract'],
    mod: true,
    shift: 'any',
    label: '-',
    repeat: true,
  },
] as const;
const ZOOM_RESET_KEYS = [
  { codes: ['Digit0'], shift: true, label: '0' },
  { codes: ['Digit0', 'Numpad0'], mod: true, shift: 'any', label: '0' },
] as const;
const FIT_KEYS = [{ codes: ['Digit1'], shift: true, label: '1' }] as const;
const COLLAPSE_PANELS_KEYS = [
  { codes: ['Period'], shift: true, label: '.' },
] as const;
const HIDE_UI_KEYS = [{ codes: ['Period'], label: '.' }] as const;
const TAB_DESIGN_KEYS = [{ codes: ['Digit1'], alt: true, label: '1' }] as const;
const TAB_THEME_KEYS = [{ codes: ['Digit2'], alt: true, label: '2' }] as const;
const VIEW_CLAUDE_KEYS = [
  { codes: ['Digit3'], alt: true, label: '3' },
] as const;

const FRAME_KEYS = {
  'mode-select': MODE_SELECT_KEYS,
  'mode-interact': MODE_INTERACT_KEYS,
  'hand-tool': HAND_TOOL_KEYS,
  spacing: SPACING_KEYS,
  outlines: OUTLINES_KEYS,
  'zoom-in': ZOOM_IN_KEYS,
  'zoom-out': ZOOM_OUT_KEYS,
  'zoom-reset': ZOOM_RESET_KEYS,
  fit: FIT_KEYS,
  'collapse-panels': COLLAPSE_PANELS_KEYS,
  'hide-ui': HIDE_UI_KEYS,
  'tab-design': TAB_DESIGN_KEYS,
  'tab-theme': TAB_THEME_KEYS,
  'view-claude': VIEW_CLAUDE_KEYS,
} as const satisfies Record<string, readonly Chord[]>;

/** Truing's own commands; the shell runs them, and the runtime forwards those in `FRAME_KEYS`. */
export const CORE_COMMANDS = {
  'mode-select': {
    group: 'Tools',
    title: 'Select',
    hint: "Pick elements. Clicks don't reach the page.",
    keys: MODE_SELECT_KEYS,
  },
  'mode-interact': {
    group: 'Tools',
    title: 'Interact',
    hint: 'The page works as usual.',
    keys: MODE_INTERACT_KEYS,
  },
  'hand-tool': {
    group: 'Tools',
    title: 'Hand',
    hint: 'Drag to move around, or hold Space or the middle button and drag.',
    keys: HAND_TOOL_KEYS,
  },
  spacing: {
    group: 'Tools',
    title: 'Spacing',
    hint: 'In Select mode, shows padding, margins and gaps on the selection and what you hover, and the distances between them.',
    keys: SPACING_KEYS,
  },
  outlines: {
    group: 'Tools',
    title: 'Outlines',
    hint: 'In Select mode, outlines and names the selection and what you hover. Off, the page stays clear to judge a change.',
    keys: OUTLINES_KEYS,
  },
  'zoom-in': {
    group: 'Canvas',
    title: 'Zoom in',
    keys: ZOOM_IN_KEYS,
  },
  'zoom-out': {
    group: 'Canvas',
    title: 'Zoom out',
    keys: ZOOM_OUT_KEYS,
  },
  'zoom-reset': {
    group: 'Canvas',
    title: 'Zoom to 100%',
    keys: ZOOM_RESET_KEYS,
  },
  fit: {
    group: 'Canvas',
    title: 'Zoom to fit',
    keys: FIT_KEYS,
  },
  'toggle-left': {
    group: 'Panels',
    title: 'Open or close the left panel',
    keys: [{ codes: ['Backslash'], mod: true, label: '\\' }],
  },
  'toggle-right': {
    group: 'Panels',
    title: 'Open or close the right panel',
    keys: [{ codes: ['Backslash'], mod: true, shift: true, label: '\\' }],
  },
  'collapse-panels': {
    group: 'Panels',
    title: 'Open or close both panels',
    keys: COLLAPSE_PANELS_KEYS,
  },
  'hide-ui': {
    group: 'Panels',
    title: 'Hide or show everything but the canvas',
    keys: HIDE_UI_KEYS,
  },
  'tab-design': {
    group: 'Panels',
    title: 'Show the Design tab',
    keys: TAB_DESIGN_KEYS,
  },
  'tab-theme': {
    group: 'Panels',
    title: 'Show the Theme tab',
    keys: TAB_THEME_KEYS,
  },
  'view-claude': {
    group: 'Panels',
    title: 'Show the Claude tab',
    keys: VIEW_CLAUDE_KEYS,
  },
  shortcuts: {
    group: 'Help',
    title: 'Keyboard shortcuts',
    keys: [{ key: '?' }],
  },
  escape: {
    group: 'Help',
    title: 'Close a menu or the filter, clear the selection, or leave Fill',
    keys: [{ key: 'Escape' }],
  },
} as const satisfies Record<string, CommandSpec & { group: CoreGroup }>;
export type CoreCommandId = keyof typeof CORE_COMMANDS;
export type CoreCommand = (typeof CORE_COMMANDS)[CoreCommandId];

/** The core commands as entries, in the list's order. */
export const CORE_ENTRIES = /* @__PURE__ */ Object.entries(
  CORE_COMMANDS,
) as Array<[CoreCommandId, CoreCommand]>;

/** The core commands a frame's runtime hands to the shell, when focus is inside the frame. */
export const FRAME_ENTRIES = Object.entries(FRAME_KEYS).map(([id, keys]) => [
  id,
  { keys },
]) as Array<[keyof typeof FRAME_KEYS, { keys: readonly Chord[] }]>;

/** What the `?` sheet lists that isn't a key: pointer gestures, written per platform. */
export const GESTURES: ReadonlyArray<{
  /** A core group, or a module's title. */
  group: string;
  title: string;
  how: (keys: KeyFormat) => string;
}> = [
  {
    group: 'Canvas',
    title: 'Move around',
    how: () => 'Hold Space and drag, or drag with the middle button',
  },
  {
    group: 'Canvas',
    title: 'Zoom at the pointer',
    how: (keys) => `Hold ${keys.modifier} and scroll`,
  },
  {
    group: 'Selection',
    title: 'Measure to another element',
    how: (keys) => `Hold ${keys.alt} and hover`,
  },
  {
    group: 'Selection',
    title: 'Pin a measurement',
    how: (keys) => `Hold ${keys.shift} and click while measuring`,
  },
  {
    group: 'Selection',
    title: 'Clear pinned measurements',
    how: () => 'Press Esc',
  },
];

// ---------------------------------------------------------------------------
// Matching.

/** Typing into a field must never fire a key without a modifier. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target instanceof HTMLElement && target.isContentEditable) {
    return true;
  }

  return target.matches('input, textarea, select, [contenteditable]');
}

/** Keys a focused control uses itself: Enter presses a button, Tab moves focus on. */
const CONTROL_KEYS = new Set(['Enter', 'Tab', ' ']);

function isControlTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest(
      'button, a[href], input, select, textarea, summary, [role="button"], [contenteditable], dialog',
    ) !== null
  );
}

/** The parts of a key event the list matches on. */
export type KeyInput = Pick<
  KeyboardEvent,
  | 'key'
  | 'code'
  | 'metaKey'
  | 'ctrlKey'
  | 'altKey'
  | 'shiftKey'
  | 'repeat'
  | 'target'
>;

function isSymbol(key: string): boolean {
  return key.length === 1 && !/[\p{L}\p{N} ]/u.test(key);
}

function shiftMatches(chord: Chord, shiftKey: boolean): boolean {
  return chord.shift === 'any' || shiftKey === Boolean(chord.shift);
}

/** Whether a chord is written with Shift: not for 'any', nor for a symbol, which already says it. */
function showsShift(chord: Chord): boolean {
  return chord.shift === true && !(chord.key && isSymbol(chord.key));
}

export function chordMatches(chord: Chord, event: KeyInput): boolean {
  if (event.altKey !== Boolean(chord.alt)) return false;
  if (event.repeat && !chord.repeat) return false;
  const mod = event.metaKey || event.ctrlKey;
  if (mod !== Boolean(chord.mod)) return false;

  if (chord.codes) {
    return (
      chord.codes.includes(event.code) && shiftMatches(chord, event.shiftKey)
    );
  }
  const wanted = chord.key;
  if (!wanted) return false;
  if (isSymbol(wanted)) return event.key === wanted;
  return (
    event.key.toLowerCase() === wanted.toLowerCase() &&
    shiftMatches(chord, event.shiftKey)
  );
}

/**
 * Whether a key event may run a command bound to this chord where focus is:
 * no key without a modifier in a field (the app's or Truing's), and no
 * Enter, Tab or Space on a control that uses them itself.
 */
export function chordAllowedAt(
  chord: Chord,
  target: EventTarget | null,
): boolean {
  if (chord.mod) return true;
  if (isEditableTarget(target)) return false;
  if (chord.key && CONTROL_KEYS.has(chord.key)) {
    return !isControlTarget(target);
  }
  return true;
}

/** The first command whose keys match the event where it happened, or null. */
export function commandForKey<Id extends string>(
  event: KeyInput,
  commands: Iterable<readonly [Id, { keys?: readonly Chord[] }]>,
): Id | null {
  for (const [id, { keys = [] }] of commands) {
    if (
      keys.some(
        (chord) =>
          chordMatches(chord, event) && chordAllowedAt(chord, event.target),
      )
    ) {
      return id;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Writing keys down.

export type Platform = 'mac' | 'other';

export type KeyFormat = {
  platform: Platform;
  /** ⌘ on a Mac, Ctrl elsewhere. */
  modifier: string;
  /** ⌥ on a Mac, Alt elsewhere. */
  alt: string;
  /** ⇧ on a Mac, Shift elsewhere. */
  shift: string;
  /** A chord as people read it: `⌘⇧\` on a Mac, `Ctrl+Shift+\` elsewhere. */
  chord: (chord: Chord) => string;
  /** A command's keys, for the sheet: "⇧0 or ⌘0". */
  keys: (keys: readonly Chord[] | undefined) => string;
  /** A tooltip: "Select (V). Pick elements. Clicks don't reach the page." */
  tooltip: (command: CommandSpec) => string;
  /** The `aria-keyshortcuts` value: "Shift+0 Meta+0". */
  aria: (keys: readonly Chord[] | undefined) => string | undefined;
};

const NAMED: Record<string, string> = {
  Escape: 'Esc',
  ' ': 'Space',
};

function keyLabel(chord: Chord): string {
  if (chord.label) return chord.label;
  const name = chord.key ?? '';
  return NAMED[name] ?? (name.length === 1 ? name.toUpperCase() : name);
}

export function keyFormat(platform: Platform): KeyFormat {
  const mac = platform === 'mac';
  const chord = (value: Chord): string => {
    const label = keyLabel(value);
    const shift = showsShift(value);
    if (mac) {
      return `${value.mod ? '⌘' : ''}${value.alt ? '⌥' : ''}${shift ? '⇧' : ''}${label}`;
    }
    return [
      value.mod ? 'Ctrl' : null,
      value.alt ? 'Alt' : null,
      shift ? 'Shift' : null,
      label,
    ]
      .filter(Boolean)
      .join('+');
  };
  const keys = (list: readonly Chord[] | undefined): string =>
    (list ?? []).map(chord).join(' or ');

  return {
    platform,
    modifier: mac ? '⌘' : 'Ctrl',
    alt: mac ? '⌥' : 'Alt',
    shift: mac ? '⇧' : 'Shift',
    chord,
    keys,
    tooltip(command) {
      const first = command.keys?.[0];
      const head = first ? `${command.title} (${chord(first)})` : command.title;
      return command.hint ? `${head}. ${command.hint}` : head;
    },
    aria(list) {
      if (!list?.length) return undefined;
      return list
        .map((value) =>
          [
            value.mod ? (mac ? 'Meta' : 'Control') : null,
            value.alt ? 'Alt' : null,
            showsShift(value) ? 'Shift' : null,
            value.key === 'Escape' ? 'Escape' : keyLabel(value),
          ]
            .filter(Boolean)
            .join('+'),
        )
        .join(' ');
    },
  };
}

/** The platform the shell runs on, for writing keys down. */
export function currentPlatform(): Platform {
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const name = nav.userAgentData?.platform ?? navigator.platform;
  return /mac/i.test(name) ? 'mac' : 'other';
}
