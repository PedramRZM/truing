// The panel's controls (TRU-3.9), on test/modules/controls.
// Throwaway scripts checked the same.
import { type Page, test as base } from '@playwright/test';

import type { Truing } from '../../src/truing';

import {
  expect,
  fixtureConfig,
  frameStatus,
  packageRoot,
  startHeadless,
} from './fixtures';

const test = base.extend<{ shell: Page }, { truing: Truing }>({
  truing: [
    async ({}, provide) => {
      const truing = await startHeadless(packageRoot, {
        ...fixtureConfig,
        server: { port: 4116 },
        tokens: 'test/fixtures/tokens/controls.css',
        modules: ['selection', './test/modules/controls'],
      });
      await provide(truing);
      await truing.close();
    },
    { scope: 'worker', timeout: 240_000 },
  ],
  shell: async ({ truing }, provide) => {
    const { shell } = truing;
    await shell.goto(`${truing.session.shellOrigin}/?route=/`);
    await shell.evaluate(() => localStorage.clear());
    await shell.reload();
    await expect(frameStatus(shell, 'Desktop')).toBeVisible();
    await expect(padding(shell)).toBeVisible();
    // The Page section above loads later and moves the controls down.
    await expect(
      shell.getByRole('term').filter({ hasText: 'Viewport' }),
    ).toBeVisible();
    // A synthetic mouse has no real movement under a pointer lock, so the
    // drags run on the path a refused lock takes. The request is counted.
    await shell.evaluate(() => {
      const asked = { count: 0 };
      Object.assign(window, { pointerLocks: asked });
      HTMLElement.prototype.requestPointerLock = () => {
        asked.count++;
        return Promise.reject(new Error('Refused by the test.'));
      };
    });
    await provide(shell);
  },
});

const padding = (shell: Page) =>
  shell.getByRole('spinbutton', { name: 'Padding', exact: true });
const state = (shell: Page) =>
  shell.getByRole('status', { name: 'Padding state' });

/** Drags a field's label by `dx` pixels, a few moves at a time. */
async function scrub(shell: Page, name: string, dx: number): Promise<void> {
  const field = shell.locator('.field', {
    has: shell.getByRole('spinbutton', { name, exact: true }),
  });
  const box = await field.locator('.field-label').boundingBox();
  if (!box) throw new Error(`No label on ${name}.`);
  const y = box.y + box.height / 2;
  let x = box.x + box.width / 2;
  await shell.mouse.move(x, y);
  await shell.mouse.down();
  for (let moved = 0; moved < Math.abs(dx); moved += 6) {
    x += Math.sign(dx) * 6;
    await shell.mouse.move(x, y);
  }
}

test.describe('scrub', () => {
  test('steps along the scale while dragging and commits once on release', async ({
    shell,
  }) => {
    await expect(padding(shell)).toHaveValue('16');
    await scrub(shell, 'Padding', 12);
    await expect(padding(shell)).toHaveValue('20');
    await expect(state(shell)).toHaveText(
      'Padding 16, previewing 20, committed 0',
    );
    expect(
      await shell.evaluate(
        () =>
          (window as unknown as { pointerLocks: { count: number } })
            .pointerLocks.count,
      ),
    ).toBe(1);
    await shell.mouse.up();
    await expect(state(shell)).toHaveText(
      'Padding 20, previewing 20, committed 1',
    );
  });

  test('Esc while dragging puts the value back and commits nothing', async ({
    shell,
  }) => {
    await scrub(shell, 'Padding', -12);
    await expect(padding(shell)).toHaveValue('8');
    await shell.keyboard.press('Escape');
    await shell.mouse.up();
    await expect(padding(shell)).toHaveValue('16');
    await expect(state(shell)).toHaveText(
      'Padding 16, previewing 16, committed 0',
    );
  });

  test('a click on the label focuses the field', async ({ shell }) => {
    const field = shell.locator('.field', { has: padding(shell) });
    await field.locator('.field-label').click();
    await expect(padding(shell)).toBeFocused();
  });
});

test.describe('keyboard', () => {
  test('arrows step, Shift steps further, Enter commits', async ({ shell }) => {
    await padding(shell).focus();
    await shell.keyboard.press('ArrowUp');
    await expect(padding(shell)).toHaveValue('18');
    await shell.keyboard.press('Shift+ArrowUp');
    await expect(padding(shell)).toHaveValue('30');
    await shell.keyboard.press('Enter');
    await expect(state(shell)).toHaveText(
      'Padding 30, previewing 30, committed 1',
    );
  });

  test('Esc cancels', async ({ shell }) => {
    await padding(shell).focus();
    await shell.keyboard.press('ArrowDown');
    await expect(padding(shell)).toHaveValue('12');
    await shell.keyboard.press('Escape');
    await expect(padding(shell)).toHaveValue('16');
    await expect(state(shell)).toHaveText(
      'Padding 16, previewing 16, committed 0',
    );
  });

  test('a number off the scale snaps, says so and commits the step', async ({
    shell,
  }) => {
    await padding(shell).fill('17');
    await shell.keyboard.press('Enter');
    await expect(padding(shell)).toHaveValue('16');
    await expect(shell.getByText('Snapped to 16')).toBeVisible();
    await padding(shell).fill('19');
    await shell.keyboard.press('Enter');
    await expect(padding(shell)).toHaveValue('18');
    await expect(shell.getByText('Snapped to 18')).toBeVisible();
  });

  test('the slider steps by keyboard and commits', async ({ shell }) => {
    await shell.getByRole('slider', { name: 'Corners' }).focus();
    await shell.keyboard.press('ArrowRight');
    await expect(
      shell.getByRole('spinbutton', { name: 'Corners', exact: true }),
    ).toHaveValue('12');
  });

  test('the alignment pad and the segmented control move by arrows', async ({
    shell,
  }) => {
    await shell.getByRole('radio', { name: 'Top left' }).focus();
    await shell.keyboard.press('ArrowRight');
    await expect(
      shell.getByRole('radio', { name: 'Top centre' }),
    ).toBeChecked();
    await shell.keyboard.press('ArrowDown');
    await expect(
      shell.getByRole('radio', { name: 'Middle centre' }),
    ).toBeFocused();
    await shell.getByRole('radio', { name: 'Right', exact: true }).focus();
    await shell.keyboard.press('ArrowLeft');
    await expect(
      shell.getByRole('radio', { name: 'Down', exact: true }),
    ).toBeChecked();
  });
});

test.describe('the token menu', () => {
  test('filters as you type, and Enter chooses', async ({ shell }) => {
    await shell.getByRole('button', { name: 'Choose padding token' }).click();
    const list = shell.getByRole('listbox', { name: 'Padding tokens' });
    await expect(list.getByRole('option').first()).toBeVisible();
    await shell.keyboard.type('24');
    await expect(list.getByRole('option')).toHaveCount(1);
    await shell.keyboard.press('Enter');
    await expect(list).toBeHidden();
    await expect(padding(shell)).toHaveValue('24');
  });

  test('ticks the current token, and Esc closes it', async ({ shell }) => {
    const button = shell.getByRole('button', { name: /^Fill /, exact: false });
    await button.first().click();
    const list = shell.getByRole('listbox', { name: 'Fill tokens' });
    await expect(list.getByRole('option', { selected: true })).toHaveCount(1);
    await shell.keyboard.press('Escape');
    await expect(list).toBeHidden();
    await expect(button.first()).toBeFocused();
  });

  test('a press outside closes it', async ({ shell }) => {
    await shell.getByRole('button', { name: 'Choose padding token' }).click();
    const list = shell.getByRole('listbox', { name: 'Padding tokens' });
    await expect(list).toBeVisible();
    await shell.mouse.click(600, 500);
    await expect(list).toBeHidden();
  });

  test('a value off the scale opens at the nearest tokens', async ({
    shell,
  }) => {
    await shell.getByRole('button', { name: 'Choose margin token' }).click();
    const nearest = shell.getByRole('group', { name: 'Nearest' });
    await expect(nearest.getByRole('option')).toHaveCount(3);
  });
});
