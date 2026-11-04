// Default Tailwind v4 has one `--spacing`, a multiplier, and no named steps. Its classes
// (`px-6`) are still what the panels should offer: with no steps, typing 24 for a
// padding snapped to 0 and wrote `px-0`. Found recording a demo on a plain project,
// as the fixtures all name their steps.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { spacingClass } from '../../src/modules/selection/layout-classes';
import { snapTyped } from '../../src/shell/controls/scale';
import { spacingRows, stepsOf } from '../../src/shell/controls/token-rows';
import { loadTokens } from '../../src/tokens/table';

/** The token table of a stylesheet, through the same Tailwind Truing uses. */
async function tokensOf(css: string) {
  // Inside the repo, where its Tailwind resolves.
  const cache = path.join(process.cwd(), 'node_modules/.cache');
  mkdirSync(cache, { recursive: true });
  const root = mkdtempSync(path.join(cache, 'truing-spacing-'));
  writeFileSync(path.join(root, 'tokens.css'), css);
  const table = await loadTokens(root, 'tokens.css');
  return table.manifest.tokens;
}

function typed(rows: ReturnType<typeof spacingRows>, text: string) {
  const steps = stepsOf(rows);
  const result = snapTyped(steps, text);
  if (result.status === 'invalid') return { result, className: null };
  const step = steps.find(({ value }) => value === result.value);
  return {
    result,
    className: step ? spacingClass('px', step) : null,
  };
}

describe('a project on Tailwind’s default spacing', () => {
  it('offers Tailwind’s own steps, from its multiplier', async () => {
    const rows = spacingRows(await tokensOf("@import 'tailwindcss';\n"));
    expect(rows.find((row) => row.name === '6')).toMatchObject({
      px: 24,
      value: '24',
      key: '--spacing',
    });
    expect(rows.find((row) => row.name === '0.5')?.px).toBe(2);
    expect(rows.find((row) => row.name === '96')?.px).toBe(384);
  });

  it('writes the class for a typed value', async () => {
    const rows = spacingRows(await tokensOf("@import 'tailwindcss';\n"));
    expect(typed(rows, '24')).toEqual({
      result: { status: 'exact', value: 24 },
      className: 'px-6',
    });
  });

  it('snaps a value off the scale to the nearest step, not to nothing', async () => {
    const rows = spacingRows(await tokensOf("@import 'tailwindcss';\n"));
    expect(typed(rows, '25')).toEqual({
      result: { status: 'snapped', value: 24 },
      className: 'px-6',
    });
  });

  it('follows a project’s own multiplier', async () => {
    const rows = spacingRows(
      await tokensOf("@import 'tailwindcss';\n@theme { --spacing: 5px; }\n"),
    );
    expect(rows.find((row) => row.name === '4')?.px).toBe(20);
  });
});

describe('a project with no token stylesheet', () => {
  it('still offers the default steps, not only zero', () => {
    const rows = spacingRows([]);
    expect(typed(rows, '16')).toEqual({
      result: { status: 'exact', value: 16 },
      className: 'px-4',
    });
  });
});

describe('a project that names its own steps', () => {
  it('offers those, and not the multiplier’s', async () => {
    const rows = spacingRows(
      await tokensOf(
        "@import 'tailwindcss';\n@theme { --spacing-sm: 8px; --spacing-lg: 24px; }\n",
      ),
    );
    expect(rows.map((row) => row.name)).toEqual(['sm', 'lg']);
  });
});
