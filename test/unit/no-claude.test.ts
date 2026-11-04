import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { expect, it } from 'vitest';

it('puts a marking `claude` first on PATH, so the suite would see one start', () => {
  const mark = process.env.TRUING_NO_CLAUDE_MARK;
  expect(mark).toBeTruthy();
  expect(
    execFileSync('sh', ['-c', 'command -v claude']).toString().trim(),
  ).toMatch(/ds-no-claude-.*\/claude$/);
  expect(existsSync(mark ?? '')).toBe(false);
});
