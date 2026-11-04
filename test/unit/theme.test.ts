// Truing's colours (TRU-3.1, DESIGN.md): one token set of light-dark() pairs,
// no colour literal anywhere else, and the contrast each text holds on the
// surfaces it sits on, in both modes.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Color from 'colorjs.io';
import { describe, expect, it } from 'vitest';

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const STYLES = 'src/shell/styles.css';
const OVERLAY = 'src/modules/selection/overlay.ts';
const SCANNED = ['src/shell', 'src/modules'];

/** Colour properties in a rule may only read tokens: this catches `red` and `CanvasText`. */
const COLOUR_DECLARATION =
  /(?:^|[\s;{])(color|background|background-color|border(?:-[a-z]+)*-color|outline-color|fill|stroke|box-shadow|caret-color|accent-color)\s*:\s*([^;}]+)/g;
const NOT_A_COLOUR =
  /\b(?:transparent|inherit|currentcolor|none|initial|unset|inset|linear-gradient|repeating-conic-gradient)\b|var\(--[\w-]+\)|-?[\d.]+(?:px|%|deg)?|[(),/]/gi;

function strayDeclarations(css: string): string[] {
  return [...withoutComments(css).matchAll(COLOUR_DECLARATION)].flatMap(
    ([, property, value = '']) => {
      const left = value.replace(NOT_A_COLOUR, ' ').trim();
      return left ? [`${property}: ${left}`] : [];
    },
  );
}

const LITERAL =
  /(?<![\w&-])#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(|(?<![\w-])(?:white|black)(?![\w-])/gi;

function read(file: string): string {
  return readFileSync(path.join(packageRoot, file), 'utf8');
}

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function literals(text: string): string[] {
  return withoutComments(text).match(LITERAL) ?? [];
}

/** The index just past the bracket that closes the one at `open`. */
function closing(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    if ('({'.includes(text.charAt(index))) depth++;
    if (')}'.includes(text.charAt(index))) depth--;
    if (depth === 0) return index + 1;
  }
  throw new Error(`Nothing closes the bracket at ${open}.`);
}

/** Cuts the block from `start` through its closing bracket. */
function cut(text: string, start: string): { block: string; rest: string } {
  const from = text.indexOf(start);
  if (from === -1) throw new Error(`"${start}" isn't in the file.`);
  const end = closing(text, text.indexOf('{', from));
  return {
    block: text.slice(from, end),
    rest: text.slice(0, from) + text.slice(end),
  };
}

function tokens(): Map<string, string> {
  const { block } = cut(withoutComments(read(STYLES)), ':root {');
  const found = block.matchAll(/(--ds-[\w-]+):\s*([^;]+);/g);
  return new Map([...found].map((match) => [match[1] ?? '', match[2] ?? '']));
}

/** The two sides of a token that is one light-dark() pair. */
function pair(value: string): { light: string; dark: string } {
  const inner = /^light-dark\(([\s\S]*)\)$/.exec(value.trim())?.[1];
  if (!inner) throw new Error(`"${value}" isn't a light-dark() pair.`);
  let depth = 0;
  for (let index = 0; index < inner.length; index++) {
    if (inner.charAt(index) === '(') depth++;
    if (inner.charAt(index) === ')') depth--;
    if (inner.charAt(index) === ',' && depth === 0) {
      return {
        light: inner.slice(0, index).trim(),
        dark: inner.slice(index + 1).trim(),
      };
    }
  }
  throw new Error(`"${value}" has no second side.`);
}

function sources(dir: string): string[] {
  return readdirSync(path.join(packageRoot, dir), {
    withFileTypes: true,
    recursive: true,
  })
    .filter(
      (entry) => entry.isFile() && /\.(ts|tsx|css|html)$/.test(entry.name),
    )
    .map((entry) =>
      path.relative(packageRoot, path.join(entry.parentPath, entry.name)),
    );
}

function contrast(text: string, surface: string): number {
  const background = new Color(surface).to('srgb');
  const foreground = new Color(text).to('srgb');
  const alpha = foreground.alpha ?? 1;
  const [r = 0, g = 0, b = 0] = foreground.coords.map(
    (channel, index) =>
      (channel ?? 0) * alpha + (background.coords[index] ?? 0) * (1 - alpha),
  );
  return new Color('srgb', [r, g, b]).contrast(background, 'WCAG21');
}

describe('the colour-literal guard', () => {
  it.each([
    'a { color: #fff }',
    "const x = '#0d99ff';",
    'color: rgb(0 0 0 / 0.5)',
    'color: oklch(67% 0.17 258)',
    'color: color-mix(in srgb, red, blue)',
    'color: white',
  ])('catches %s', (text) => {
    expect(literals(text)).not.toEqual([]);
  });

  it.each([
    'white-space: nowrap',
    'a { color: var(--ds-text) }',
    "document.querySelector('#root')",
    '/* was #fff */',
    '// was #fff',
  ])('leaves %s alone', (text) => {
    expect(literals(text)).toEqual([]);
  });
});

describe('the colour-declaration guard', () => {
  it.each(['a { color: red }', 'a { background: CanvasText; }'])(
    'catches %s',
    (css) => {
      expect(strayDeclarations(css)).not.toEqual([]);
    },
  );

  it.each([
    'a { color: var(--ds-text) }',
    'a { background: transparent; }',
    'a { box-shadow: inset 0 0 0 1px var(--ds-border); }',
    'a { color: inherit; white-space: nowrap; }',
  ])('leaves %s alone', (css) => {
    expect(strayDeclarations(css)).toEqual([]);
  });
});

describe('the tokens', () => {
  it('declare both colour schemes on the root', () => {
    const { block } = cut(read(STYLES), ':root {');
    expect(block).toContain('color-scheme: light dark;');
  });

  it('are light-dark() pairs wherever they hold a colour', () => {
    const loose = [...tokens()].flatMap(([name, value]) => {
      let rest = value;
      for (
        let at = rest.indexOf('light-dark(');
        at !== -1;
        at = rest.indexOf('light-dark(')
      ) {
        rest = rest.slice(0, at) + rest.slice(closing(rest, at + 10));
      }
      return literals(rest).map((literal) => `${name}: ${literal}`);
    });
    expect(loose).toEqual([]);
  });

  it('cover every colour the rules use', () => {
    const { rest } = cut(withoutComments(read(STYLES)), ':root {');
    const defined = tokens();
    const used = [...rest.matchAll(/var\((--ds-[\w-]+)/g)].map(
      (match) => match[1] ?? '',
    );
    expect(used.filter((name) => !defined.has(name))).toEqual([]);
  });
});

describe('the browser', () => {
  // Playwright emulates light unless told not to, and no test can change the
  // system's setting: emulateMedia would pass with or without this.
  it('leaves the colour scheme to the system', () => {
    expect(read('src/truing.ts')).toContain('colorScheme: null,');
  });
});

describe('no stray colours', () => {
  it('in the rules of the stylesheet, after the token block', () => {
    expect(literals(cut(read(STYLES), ':root {').rest)).toEqual([]);
  });

  it('with no named colour in a rule', () => {
    expect(strayDeclarations(cut(read(STYLES), ':root {').rest)).toEqual([]);
  });

  it('anywhere else in the shell and the modules', () => {
    const stray = SCANNED.flatMap(sources)
      .filter((file) => file !== STYLES)
      .flatMap((file) => {
        const text =
          file === OVERLAY
            ? cut(read(file), 'const COLOURS = {').rest
            : read(file);
        return literals(text).map((literal) => `${file}: ${literal}`);
      });
    expect(stray).toEqual([]);
  });

  it("with the overlay's accent and fill the same as the shell's", () => {
    const { block } = cut(read(OVERLAY), 'const COLOURS = {');
    const value = (key: string): string =>
      new RegExp(`\\b${key}: '([^']+)'`).exec(block)?.[1] ?? '';
    const shell = tokens();
    expect(value('accent')).toBe(pair(shell.get('--ds-accent') ?? '').light);
    expect(value('accentFill')).toBe(
      pair(shell.get('--ds-accent-fill') ?? '').light,
    );
  });
});

/** Where each colour sits, from the rules; the numbers are in TRU-3.1's task file. */
const TEXT_ON = {
  '--ds-text': [
    '--ds-panel',
    '--ds-canvas',
    '--ds-hover',
    '--ds-selected',
    '--ds-control-fill',
  ],
  '--ds-text-2': [
    '--ds-panel',
    '--ds-hover',
    '--ds-selected',
    '--ds-control-fill',
  ],
  '--ds-text-3': [
    '--ds-panel',
    '--ds-canvas',
    '--ds-hover',
    '--ds-selected',
    '--ds-control-fill',
  ],
  // The frame's size and route, and a disabled row: never on a hover.
  '--ds-text-4': ['--ds-panel', '--ds-canvas'],
  '--ds-on-accent': ['--ds-accent-fill'],
  '--ds-on-confirm': ['--ds-confirm', '--ds-confirm-hover'],
} as const;

/** Lines and icons hold 3:1 where they sit on the chrome. */
const LINE_ON = {
  // The ring is offset onto the panel. In dark it's under 3:1 on the selected
  // row (2.76) and a control (2.98), but its other edge meets the panel at 3.6.
  '--ds-focus': ['--ds-panel', '--ds-canvas'],
  '--ds-icon': [
    '--ds-panel',
    '--ds-canvas',
    '--ds-hover',
    '--ds-selected',
    '--ds-control-fill',
  ],
  '--ds-error': ['--ds-panel'],
} as const;

describe.each(['light', 'dark'] as const)('contrast in %s', (mode) => {
  const side = (name: string): string => pair(tokens().get(name) ?? '')[mode];

  const cases = (table: Record<string, readonly string[]>) =>
    Object.entries(table).flatMap(([colour, surfaces]) =>
      surfaces.map((surface) => [colour, surface] as const),
    );

  it.each(cases(TEXT_ON))('%s on %s is at least 4.5:1', (colour, surface) => {
    expect(contrast(side(colour), side(surface))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(cases(LINE_ON))('%s on %s is at least 3:1', (colour, surface) => {
    expect(contrast(side(colour), side(surface))).toBeGreaterThanOrEqual(3);
  });
});

describe('the overlay accent, on the page it outlines', () => {
  it.each(['#ffffff', '#1e1d26', '#181b24', '#000000'])(
    'holds 3:1 on %s',
    (surface) => {
      expect(
        contrast(pair(tokens().get('--ds-accent') ?? '').light, surface),
      ).toBeGreaterThanOrEqual(3);
    },
  );
});
