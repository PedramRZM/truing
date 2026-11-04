// Truing on the fixture app's /inspect route, shared by the inspector's
// specs (TRU-2.1, TRU-2.3): hydrated, both docks open, in Select mode.
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { test as base, type Page } from '@playwright/test';

import type { Truing } from '../../src/truing';

import {
  expect,
  fixtureAppDir,
  fixtureConfig,
  frame,
  frameStatus,
  packageRoot,
  startHeadless,
} from './fixtures';

export { expect, frame, packageRoot };

/** `test/fixture-app/<file>:<line>`, the line being the first that contains `needle`. */
export function at(file: string, needle: string): string {
  const lines = readFileSync(path.join(fixtureAppDir, file), 'utf8').split(
    '\n',
  );
  const index = lines.findIndex((line) => line.includes(needle));
  if (index === -1) throw new Error(`"${needle}" is not in ${file}.`);
  return `test/fixture-app/${file}:${index + 1}`;
}

// Next's launch-editor runs $REACT_EDITOR; this one writes down what it got.
const editorDir = mkdtempSync(path.join(os.tmpdir(), 'truing-editor-'));
export const editorLog = path.join(editorDir, 'opened.txt');
const editor = path.join(editorDir, 'editor.sh');
writeFileSync(editor, `#!/bin/sh\necho "$@" >> '${editorLog}'\n`);
chmodSync(editor, 0o755);

export const test = base.extend<{ shell: Page }, { truing: Truing }>({
  truing: [
    async ({}, provide) => {
      const truing = await startHeadless(packageRoot, {
        ...fixtureConfig,
        app: {
          ...fixtureConfig.app,
          devCommand: `REACT_EDITOR='${editor}' ${fixtureConfig.app.devCommand}`,
          startRoute: '/inspect',
        },
        server: { port: 4114 },
        modules: ['selection'],
      });
      await provide(truing);
      await truing.close();
    },
    { scope: 'worker', timeout: 240_000 },
  ],
  // Every test starts on /inspect, hydrated, with both docks open, in Select.
  shell: async ({ truing }, provide) => {
    const { shell } = truing;
    // These specs read today's inspector, which lives in the Code section (TRU-3.8).
    await shell.addInitScript(() => {
      localStorage.setItem('truing:section:code', 'open');
    });
    await shell.goto(`${truing.session.shellOrigin}/?route=/inspect`);
    await modeButton(shell, 'Interact').click();
    await expect(frameStatus(shell, 'Desktop', '/inspect')).toBeVisible();
    // These specs read today's tree: the Code view (TRU-3.6).
    const tree = shell.getByRole('navigation', {
      name: 'Layers of the Desktop frame',
    });
    await tree.getByRole('button', { name: 'Code', exact: true }).click();
    // The tree lists the client component once React has hydrated it.
    await expect(tree).toContainText('ClientPanel');
    await modeButton(shell, 'Select').click();
    await provide(shell);
  },
});

/** The text of the app element the picked outline is drawn over. */
export function pickedText(shell: Page): Promise<string | null> {
  return frame(shell, 'Desktop')
    .locator('truing-overlay')
    .evaluate((host) => {
      // The overlay's boxes, in order: hover, picked, then the rest (overlay.ts).
      const picked = host.shadowRoot?.children[1];
      if (!(picked instanceof HTMLElement) || picked.style.display === 'none') {
        return null;
      }
      const box = picked.getBoundingClientRect();
      const under = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      );
      return under?.textContent ?? null;
    });
}

/** Select or Interact in Truing's rail (the tree may list a `Select` component too). */
export const modeButton = (shell: Page, name: 'Select' | 'Interact') =>
  shell
    .getByRole('toolbar', { name: 'Truing' })
    .getByRole('button', { name, exact: true });

export const design = (shell: Page) =>
  shell.getByRole('region', { name: 'Selection' });
export const layers = (shell: Page) =>
  shell.getByRole('navigation', { name: 'Layers of the Desktop frame' });
