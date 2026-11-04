// Truing's theme (TRU-3.1) through the real shell on the fixture app: the
// panel and canvas under each colour scheme, the measures, and the contrast
// of every text on screen, read from the page rather than from the tokens.
import type { Page } from '@playwright/test';
import Color from 'colorjs.io';

import { design, expect, frame, modeButton, test } from './inspect-fixture';

const SCHEMES = {
  light: { panel: 'rgb(242, 242, 242)', canvas: 'rgb(238, 238, 238)' },
  dark: { panel: 'rgb(42, 42, 42)', canvas: 'rgb(40, 40, 40)' },
} as const;

type Scheme = keyof typeof SCHEMES;
type Reading = { text: string; color: string; layers: string[] };

/** Every text on the shell's screen, with the backgrounds under it, nearest first. */
function readTexts(shell: Page): Promise<Reading[]> {
  return shell.evaluate(() => {
    const readings: Reading[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const element = node.parentElement;
      const text = node.textContent?.trim();
      if (!element || !text) continue;
      if (element.closest('script, style, .visually-hidden')) continue;
      // Exempt from the contrast rule, and shown as such.
      if (element.closest(':disabled')) continue;
      if (!element.checkVisibility({ visibilityProperty: true })) continue;
      if (element.getClientRects().length === 0) continue;
      const layers: string[] = [];
      for (let at: Element | null = element; at; at = at.parentElement) {
        layers.push(getComputedStyle(at).backgroundColor);
      }
      readings.push({ text, color: getComputedStyle(element).color, layers });
    }
    return readings;
  });
}

/** A colour's sRGB channels once laid over what's under it. */
function over(top: string, under: Color): Color {
  const colour = new Color(top).to('srgb');
  const alpha = colour.alpha ?? 1;
  const [r = 0, g = 0, b = 0] = colour.coords.map(
    (channel, index) =>
      (channel ?? 0) * alpha + (under.coords[index] ?? 0) * (1 - alpha),
  );
  return new Color('srgb', [r, g, b]);
}

function failures(readings: readonly Reading[]): string[] {
  return readings.flatMap(({ text, color, layers }) => {
    const surface = [...layers]
      .reverse()
      .reduce(
        (under, layer) => over(layer, under),
        new Color('srgb', [1, 1, 1]),
      );
    const ratio = over(color, surface).contrast(surface, 'WCAG21');
    return ratio >= 4.5 ? [] : [`${ratio.toFixed(2)}:1 "${text.slice(0, 40)}"`];
  });
}

/** Sizes and weights in the shell, outside the frames. */
function readType(shell: Page) {
  return shell.evaluate(() => {
    const sizes = new Set<string>();
    const weights = new Set<string>();
    for (const element of document.body.querySelectorAll('*')) {
      if (!element.checkVisibility() || !element.textContent?.trim()) continue;
      const style = getComputedStyle(element);
      sizes.add(style.fontSize);
      weights.add(style.fontWeight);
    }
    return { sizes: [...sizes], weights: [...weights] };
  });
}

for (const scheme of ['light', 'dark'] as const satisfies readonly Scheme[]) {
  test.describe(`in ${scheme}`, () => {
    test.beforeEach(async ({ shell }) => {
      await shell.emulateMedia({ colorScheme: scheme });
    });

    test('the panel and the canvas take the scheme, flat', async ({
      shell,
    }) => {
      await expect(shell.getByRole('toolbar', { name: 'Truing' })).toHaveCSS(
        'background-color',
        SCHEMES[scheme].panel,
      );
      const canvas = shell.locator('.canvas');
      await expect(canvas).toHaveCSS(
        'background-color',
        SCHEMES[scheme].canvas,
      );
      await expect(canvas).toHaveCSS('background-image', 'none');
    });

    test('the page in the frame keeps its own colours', async ({ shell }) => {
      await expect(frame(shell, 'Desktop').locator('body')).toHaveCSS(
        'color-scheme',
        'normal',
      );
    });

    test('every text holds 4.5:1 with a pick in the panels', async ({
      shell,
    }) => {
      await frame(shell, 'Desktop')
        .getByRole('button', { name: 'Pressed 0 times' })
        .click();
      await expect(design(shell)).toContainText('<button>');
      expect(failures(await readTexts(shell))).toEqual([]);
    });

    test("a field's placeholder holds 4.5:1", async ({ shell }) => {
      const reading = await shell
        .getByRole('searchbox', { name: 'Filter layers' })
        .evaluate((input) => {
          const layers: string[] = [];
          for (let at: Element | null = input; at; at = at.parentElement) {
            layers.push(getComputedStyle(at).backgroundColor);
          }
          return {
            text: 'placeholder',
            color: getComputedStyle(input, '::placeholder').color,
            layers,
          };
        });
      expect(failures([reading])).toEqual([]);
    });

    test('every text holds 4.5:1 in the viewport menu', async ({ shell }) => {
      await shell.getByRole('button', { name: /^Viewport/ }).click();
      await expect(
        shell.getByRole('form', { name: 'Custom size' }),
      ).toBeVisible();
      expect(failures(await readTexts(shell))).toEqual([]);
    });

    test('every text holds 4.5:1 in the shortcuts sheet', async ({ shell }) => {
      await shell.getByRole('button', { name: 'Keyboard shortcuts' }).click();
      await expect(shell.getByRole('dialog')).toBeVisible();
      expect(failures(await readTexts(shell))).toEqual([]);
    });
  });
}

test.describe('the measures', () => {
  test.beforeEach(async ({ shell }) => {
    await shell.emulateMedia({ colorScheme: 'light' });
  });

  test('type is 12 px on 16 px lines, with the three weights', async ({
    shell,
  }) => {
    await expect(shell.locator('body')).toHaveCSS('font-size', '12px');
    await expect(shell.locator('body')).toHaveCSS('line-height', '16px');
    await frame(shell, 'Desktop')
      .getByRole('button', { name: 'Pressed 0 times' })
      .click();
    // The component's name is the last to arrive, and the one <strong>.
    await expect(design(shell)).toContainText('Button · variant tonal');
    await shell.getByRole('button', { name: 'Keyboard shortcuts' }).click();
    await expect(shell.getByRole('dialog')).toBeVisible();
    const { sizes, weights } = await readType(shell);
    expect(
      sizes.filter((size) => !['10px', '12px', '13px'].includes(size)),
    ).toEqual([]);
    expect(
      weights.filter((weight) => !['400', '465', '500'].includes(weight)),
    ).toEqual([]);
  });

  test('the rail is 42 px and the canvas bar 41 px, with controls of 24 px and no borders', async ({
    shell,
  }) => {
    const rail = shell.getByRole('toolbar', { name: 'Truing' });
    const bar = shell.getByRole('banner');
    expect((await rail.boundingBox())?.width).toBe(42);
    expect((await bar.boundingBox())?.height).toBe(41);
    for (const control of [
      rail.getByRole('button', { name: 'Select', exact: true }),
      rail.getByRole('button', { name: 'Hand' }),
      bar.getByRole('form', { name: 'Route' }),
      bar.getByRole('button', { name: /^Viewport/ }),
    ]) {
      expect((await control.boundingBox())?.height).toBe(24);
      await expect(control).toHaveCSS('border-top-width', '0px');
    }
    await expect(bar.getByRole('form', { name: 'Route' })).toHaveCSS(
      'border-top-left-radius',
      '6px',
    );
    await expect(bar.getByRole('form', { name: 'Route' })).not.toHaveCSS(
      'box-shadow',
      'none',
    );
  });
});

/** The fonts Chromium drew a node's text with: its own record, not computed styles. */
async function renderedFonts(
  shell: Page,
  selector: string,
): Promise<{ family: string; bundled: boolean }[]> {
  const cdp = await shell.context().newCDPSession(shell);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector,
  });
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  await cdp.detach();
  return fonts.map((font) => ({
    family: font.familyName,
    bundled: font.isCustomFont,
  }));
}

test('the shell draws its text in its own fonts', async ({ shell }) => {
  const rail = shell.getByRole('toolbar', { name: 'Truing' });
  await expect(rail.getByRole('button', { name: 'Interact' })).toBeVisible();
  expect(await renderedFonts(shell, '.segmented button')).toEqual([
    { family: 'Inter', bundled: true },
  ]);
  expect(await renderedFonts(shell, '.frame-size')).toEqual([
    { family: 'JetBrains Mono', bundled: true },
  ]);
});

test('the three weights each draw heavier than the last, at 12 px', async ({
  shell,
}) => {
  // Ink, not width: hinted text here advances in whole pixels, so 465 and 500
  // can measure the same width while drawing differently.
  const ink = await shell.evaluate(async () => {
    const inkAt = async (weight: number): Promise<number> => {
      const font = `${weight} 12px Inter`;
      await document.fonts.load(font);
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 24;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No 2D context.');
      context.font = font;
      context.fillText('Properties and layers of the selection', 2, 16);
      const { data } = context.getImageData(0, 0, 400, 24);
      return data.reduce(
        (sum, value, index) => (index % 4 === 3 ? sum + value : sum),
        0,
      );
    };
    return Promise.all([400, 465, 500].map(inkAt));
  });
  const [regular = 0, label = 0, strong = 0] = ink;
  expect(label).toBeGreaterThan(regular);
  expect(strong).toBeGreaterThan(label);
});

async function fontsForText(shell: Page, text: string) {
  await shell.evaluate((content) => {
    const span = document.createElement('span');
    span.id = 'font-probe';
    span.textContent = content;
    document.body.append(span);
  }, text);
  const fonts = await renderedFonts(shell, '#font-probe');
  await shell.evaluate(() => document.getElementById('font-probe')?.remove());
  return fonts;
}

test('Latin Extended text draws in the bundled font', async ({ shell }) => {
  expect(await fontsForText(shell, 'Łódź')).toEqual([
    { family: 'Inter', bundled: true },
  ]);
});

test('text outside the bundled subsets falls back to a system font', async ({
  shell,
}) => {
  const fonts = await fontsForText(shell, 'طرح');
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.filter((font) => font.bundled)).toEqual([]);
});

test("a segment's hit area is the track's 24 px", async ({ shell }) => {
  const select = shell
    .getByRole('tablist', { name: 'Panel view' })
    .getByRole('tab', { name: 'Design' });
  const hits = await select.evaluate((button) => {
    const track = button.parentElement?.getBoundingClientRect();
    const { left, width } = button.getBoundingClientRect();
    if (!track) throw new Error('The segment has no track.');
    return [track.top + 0.5, track.bottom - 0.5].map((y) => {
      const hit = document.elementFromPoint(left + width / 2, y);
      return hit === button || button.contains(hit);
    });
  });
  expect(hits).toEqual([true, true]);
});

test("in dark, the pressed segment's fill differs from its track", async ({
  shell,
}) => {
  await shell.emulateMedia({ colorScheme: 'dark' });
  const tabs = shell.getByRole('tablist', { name: 'Panel view' });
  const pressed = tabs.getByRole('tab', { name: 'Design' });
  await expect(pressed).toHaveAttribute('aria-selected', 'true');
  await expect(pressed).toHaveCSS('background-color', 'rgb(55, 55, 55)');
  await expect(tabs).toHaveCSS('background-color', 'rgba(0, 0, 0, 0.2)');
});

test("the inspector's fields are 24 px too", async ({ shell }) => {
  await frame(shell, 'Desktop')
    .getByRole('button', { name: 'Pressed 0 times' })
    .click();
  const variant = design(shell).getByRole('button', { name: /^variant / });
  await expect(variant).toBeVisible();
  expect((await variant.boundingBox())?.height).toBe(24);
  const filter = shell.getByRole('searchbox', { name: 'Filter layers' });
  expect((await filter.boundingBox())?.height).toBe(24);
});

test('the outlines and labels in the frame use the new accent', async ({
  shell,
}) => {
  const app = frame(shell, 'Desktop');
  await app.getByRole('button', { name: 'Pressed 0 times' }).click();
  await expect(design(shell)).toContainText('<button>');
  const drawn = await app.locator('truing-overlay').evaluate((host) => {
    const picked = host.shadowRoot?.children[1];
    const label = host.shadowRoot?.querySelector('[data-label="pick"]');
    if (!(picked instanceof HTMLElement) || !(label instanceof HTMLElement)) {
      throw new Error('The overlay has no pick.');
    }
    return {
      outline: picked.style.outlineColor,
      fill: label.style.backgroundColor,
      text: label.style.color,
    };
  });
  expect(drawn).toEqual({
    outline: 'oklch(0.67 0.17 258)',
    fill: 'oklch(0.55 0.145 258)',
    text: 'rgb(255, 255, 255)',
  });
  await modeButton(shell, 'Interact').click();
});
