import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { loadConfig } from '../../src/config';
import { checkTailwindVersion } from '../../src/tokens/design-system';
import { summary, tailwindMergeFile } from '../../src/tokens/report';
import { loadTokens, type TokenTable } from '../../src/tokens/table';
import { chainOf, substitute, toPx } from '../../src/tokens/values';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '../..');
const projectRoot = path.join(here, '../fixtures/design-system');

let project: TokenTable;

beforeAll(async () => {
  const { config } = await loadConfig(projectRoot);
  project = await loadTokens(projectRoot, config.tokens ?? '');
});

function token(key: string) {
  const found = project.byKey.get(key);
  if (!found) throw new Error(`No token ${key}`);
  return found;
}

describe("a real project's token manifest", () => {
  it('resolves --color-primary through its chain, in both modes', () => {
    const primary = token('--color-primary');

    expect(primary).toMatchObject({
      origin: 'alias',
      category: 'color',
      name: 'primary',
      source: { file: 'src/app/globals.css' },
      value: 'var(--primary)',
      chain: {
        light: ['--primary', '--color-brand-1-600'],
        dark: ['--primary', '--color-brand-1-500'],
      },
    });
    expect(primary.light.hex).toBe('#1c68d4');
    expect(primary.dark.hex).toBe('#3d82f2');
    expect(primary.light.oklab).toMatch(/^oklab\(/);
  });

  it('reads a primitive overridden in .dark by its own name', () => {
    const grey = token('--color-grey-100');

    expect(grey.origin).toBe('ours');
    expect(grey.light.hex).toBe('#ffffff');
    expect(grey.dark.hex).toBe('#1e1d26');
  });

  it('gives the effective radius, from the later @theme inline block', () => {
    expect(token('--radius-sm').light.px).toBe(8);
    expect(token('--radius-md').light.px).toBe(8);
    expect(token('--radius-lg').light.px).toBe(12);
    expect(token('--radius-lg').origin).toBe('alias');
    expect(token('--radius-xl')).toMatchObject({
      origin: 'ours',
      light: { px: 12 },
    });

    expect(project.manifest.shadowed.map((s) => s.key)).toEqual([
      '--radius-sm',
      '--radius-md',
      '--radius-lg',
    ]);
    const md = project.manifest.shadowed[1];
    expect(md?.declarations.map((d) => d.block)).toEqual([
      'theme',
      'theme inline',
    ]);
  });

  it('gives text styles their line height and weight, in px', () => {
    expect(token('--text-title-m')).toMatchObject({
      category: 'text',
      light: { px: 16 },
      textStyle: {
        lineHeight: { value: '18px', px: 18 },
        fontWeight: { value: '700' },
      },
    });
    // A unitless line height is a multiple of the font size.
    expect(token('--text-label-md').textStyle?.lineHeight?.px).toBe(18.2);
    expect(token('--text-sm')).toMatchObject({
      origin: 'default',
      textStyle: { lineHeight: { px: 20 } },
    });
  });

  it('tells ours from aliases, libraries and Tailwind defaults', () => {
    expect(token('--spacing-400')).toMatchObject({
      origin: 'ours',
      category: 'spacing',
      light: { px: 12 },
      source: { file: 'src/app/globals.css' },
    });
    expect(token('--color-red-50')).toMatchObject({
      origin: 'default',
      light: { hex: '#fef2f2' },
      replacesDefault: false,
    });
    expect(token('--color-red-500')).toMatchObject({
      origin: 'ours',
      replacesDefault: true,
    });
    expect(token('--animate-in').origin).toBe('library');
    expect(token('--animate-in').source?.file).toMatch(/tw-animate-css/);
  });

  it('gives every token of ours a source line in the stylesheet', () => {
    const ours = project.manifest.tokens.filter(
      (t) => t.origin === 'ours' || t.origin === 'alias',
    );
    expect(ours.length).toBeGreaterThan(150);
    for (const t of ours) {
      expect(t.source?.file).toBe('src/app/globals.css');
      expect(t.source?.line).toBeGreaterThan(0);
    }
  });

  it('lists the semantic variables with their values in each mode', () => {
    const primary = project.manifest.variables.find(
      (v) => v.key === '--primary',
    );
    expect(primary?.light).toMatchObject({ hex: '#1c68d4' });
    expect(primary?.dark).toMatchObject({ hex: '#3d82f2' });

    // A theme colour .dark overrides is a token, not a variable.
    expect(
      project.manifest.variables.some((v) => v.key === '--color-grey-100'),
    ).toBe(false);
    expect(project.manifest.variables.filter((v) => v.light === null)).toEqual(
      [],
    );
    // Tailwind's reference-only `--radius` doesn't hide our :root one.
    expect(
      project.manifest.variables.find((v) => v.key === '--radius')?.light,
    ).toMatchObject({ value: '0.75rem', px: 12 });

    // Only in :root, so the same in dark, and no utility reads it.
    const legacy = project.manifest.variables.find(
      (v) => v.key === '--color-app-br-neutral-static',
    );
    expect(legacy?.light?.hex).toBe('#ffffff');
    expect(project.byKey.has('--color-app-br-neutral-static')).toBe(false);
  });
});

describe('class lookups', () => {
  it('reads bg-primary/50 as primary at 50%', () => {
    expect(project.tokenForClass('bg-primary/50')).toMatchObject({
      status: 'token',
      token: { key: '--color-primary', name: 'primary' },
      opacity: 0.5,
      negative: false,
    });
  });

  it('reads px-401 as compiling without a token', () => {
    expect(project.tokenForClass('px-401')).toEqual({
      status: 'compiles',
      className: 'px-401',
      reason: 'bare-value',
    });
  });

  it('keeps variants in the order they are written, and the sign', () => {
    expect(project.tokenForClass('md:hover:-mt-400')).toMatchObject({
      status: 'token',
      token: { key: '--spacing-400' },
      root: '-mt',
      negative: true,
      variants: ['md', 'hover'],
    });
  });

  it('names the utility root, which the spacing labels read (TRU-2.5)', () => {
    expect(project.tokenForClass('px-400')).toMatchObject({
      status: 'token',
      root: 'px',
      token: { key: '--spacing-400', light: { px: 12 } },
    });
  });

  it.each([
    ['text-title-m', '--text-title-m'],
    ['text-primary', '--color-primary'],
    ['shadow-pane', '--shadow-pane'],
    ['max-w-reading', '--container-reading'],
    ['rounded-lg', '--radius-lg'],
    ['font-sans', '--font-sans'],
    ['bg-red-50', '--color-red-50'],
  ])('reads %s as %s', (className, key) => {
    expect(project.tokenForClass(className)).toMatchObject({
      status: 'token',
      token: { key },
    });
  });

  it('keeps a non-opacity modifier as written', () => {
    expect(project.tokenForClass('text-sm/6')).toMatchObject({
      status: 'token',
      token: { key: '--text-sm' },
      modifier: '6',
    });
  });

  it.each([
    ['bg-[#1c68d4]', 'arbitrary'],
    ['flex', 'static'],
    ['w-1/2', 'bare-value'],
  ])('reads %s as compiling (%s)', (className, reason) => {
    expect(project.tokenForClass(className)).toMatchObject({
      status: 'compiles',
      reason,
    });
  });

  it.each([
    ['pbs-400', '--spacing-400'],
    ['-inset-bs-400', '--spacing-400'],
    ['scroll-pe-400', '--spacing-400'],
    ['border-spacing-x-400', '--spacing-400'],
    ['max-inline-reading', '--container-reading'],
    ['columns-reading', '--container-reading'],
    ['mask-x-from-primary', '--color-primary'],
  ])('reads %s, a root no list had to name, as %s', (className, key) => {
    expect(project.tokenForClass(className)).toMatchObject({
      status: 'token',
      token: { key },
    });
  });

  it('reads w-100/2 as a fraction, not as spacing-100', () => {
    expect(project.tokenForClass('w-100/2')).toMatchObject({
      status: 'compiles',
      reason: 'bare-value',
    });
  });

  it('finds the token in every class of ours whose CSS reads it', () => {
    const roots = project.designSystem.utilities.keys('functional');
    const ours = project.manifest.tokens.filter(
      (t) =>
        t.origin === 'ours' &&
        t.name !== null &&
        !project.designSystem.theme.getOptions(t.key),
    );
    const missed: string[] = [];
    let checked = 0;
    for (const root of roots) {
      for (const t of ours) {
        const className = `${root}-${t.name}`;
        const css = project.designSystem.candidatesToCss([className])[0];
        if (!css?.includes(`var(${t.key})`)) continue;
        checked++;
        const found = project.tokenForClass(className);
        if (found.status !== 'token' || found.token.key !== t.key) {
          missed.push(className);
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
    expect(missed).toEqual([]);
  });

  it('reads a class that generates no CSS as unknown', () => {
    expect(project.tokenForClass('border-app-br-neutral-static').status).toBe(
      'unknown',
    );
    expect(project.tokenForClass('bg-nope').status).toBe('unknown');
  });

  it('registers what compiles, not what the suggestion list holds', () => {
    const suggested = new Set(
      project.designSystem.getClassList().map(([name]) => name),
    );
    expect(suggested.has('px-401')).toBe(false);
    expect(project.isRegistered('px-401')).toBe(true);
    expect(project.isRegistered('bg-nope')).toBe(false);
  });
});

describe('tailwind-merge groups', () => {
  it('match the file the project commits', async () => {
    const { config } = await loadConfig(projectRoot);
    if (!config.tailwindMerge) throw new Error('No tailwindMerge in config');

    const committed: unknown = JSON.parse(
      readFileSync(path.join(projectRoot, config.tailwindMerge), 'utf8'),
    );
    const expected: unknown = JSON.parse(tailwindMergeFile(project.manifest));
    // If this fails, a text style or shadow changed: run truing tokens.
    expect(committed).toEqual(expected);
  });

  it('hold every text style and shadow of ours', () => {
    const groups: unknown = JSON.parse(tailwindMergeFile(project.manifest));
    expect(groups).toMatchObject({
      'font-size': expect.arrayContaining(['title-m', 'label-md', 'body-sm']),
      shadow: expect.arrayContaining(['pane', 'floating-card']),
    });
  });
});

describe("the app's own Tailwind", () => {
  function fakeTailwind(version: string): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'tokens-own-'));
    mkdirSync(path.join(dir, 'node_modules/tailwindcss'), { recursive: true });
    writeFileSync(
      path.join(dir, 'node_modules/tailwindcss/package.json'),
      JSON.stringify({ name: 'tailwindcss', version }),
    );
    const css = path.join(dir, 'globals.css');
    writeFileSync(css, "@import 'tailwindcss';\n");
    return css;
  }

  it('reports the version the app has installed', () => {
    const installed = z
      .object({ version: z.string() })
      .parse(
        JSON.parse(
          readFileSync(
            path.join(packageRoot, 'node_modules/tailwindcss/package.json'),
            'utf8',
          ),
        ),
      ).version;

    expect(project.manifest.tailwindcss).toBe(installed);
  });

  it("accepts any other 4.x, since it compiles with the app's own copy", () => {
    expect(checkTailwindVersion(fakeTailwind('4.0.0'))).toBe('4.0.0');
  });

  it('refuses an older major and says what it needs', () => {
    expect(() => checkTailwindVersion(fakeTailwind('3.4.1'))).toThrow(
      /app uses tailwindcss 3\.4\.1\. Truing reads tokens from Tailwind 4/,
    );
  });
});

describe('the summary', () => {
  it('counts by category and origin, and names the shadowed keys', () => {
    const text = summary(project.manifest);

    expect(text).toMatch(
      /^category\s+ours\s+alias\s+default\s+library\s+total$/m,
    );
    expect(text).toMatch(/^color\s+72\s+40\s+/m);
    expect(text).toContain(
      '--radius-md: line 131 (@theme) 6px -> line 866 (@theme inline)',
    );
  });
});

describe('the manifest of a frozen stylesheet', () => {
  it('changes only when Tailwind or the fixture does', async () => {
    const table = await loadTokens(
      packageRoot,
      'test/fixtures/tokens/tokens.css',
    );
    const lookups = [
      'bg-primary/50',
      'text-title-m',
      'px-401',
      'p-3',
      'rounded-sm',
      'bg-red-50',
      'shadow-pane',
      'bg-[#1c68d4]',
      'bg-nope',
    ].map((className) => {
      const result = table.tokenForClass(className);
      return result.status === 'token'
        ? { ...result, token: result.token.key }
        : result;
    });

    // An upgrade that changes this snapshot needs a look before it lands:
    // the inspector, the lint and the panels all read these values.
    await expect(
      `${JSON.stringify({ manifest: table.manifest, lookups }, null, 2)}\n`,
    ).toMatchFileSnapshot('__snapshots__/tokens-fixture.json');
  });
});

describe('values', () => {
  it.each([
    ['12px', undefined, 12],
    ['0.75rem', undefined, 12],
    ['calc(0.75rem - 4px)', undefined, 8],
    ['calc(1.25 / 0.875)', 14, 20],
    ['1.3', 14, 18.2],
    ['1.3', undefined, null],
    ['var(--x)', undefined, null],
    ['2em', undefined, null],
  ])('reads %s (font size %s) as %s px', (value, unitless, px) => {
    expect(toPx(value, unitless)).toBe(px);
  });

  it('keeps minified var() tokens apart when it substitutes them', () => {
    const scope = new Map([
      ['--a', '1s'],
      ['--b', 'ease'],
    ]);
    expect(substitute('x var(--a)var(--b) var(--c, 0s)', scope)).toBe(
      'x 1s ease 0s',
    );
    expect(substitute('var(--font-inter), sans-serif', scope)).toBe(
      'var(--font-inter), sans-serif',
    );
  });

  it('stops at a cycle', () => {
    const scope = new Map([
      ['--a', 'var(--b)'],
      ['--b', 'var(--a)'],
    ]);
    expect(chainOf('var(--a)', scope)).toEqual(['--a', '--b']);
    expect(substitute('var(--a)', scope)).toBe('var(--a)');
  });
});
