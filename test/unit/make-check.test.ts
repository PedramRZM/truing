// `make check` runs from the pre-commit hook. In a linked worktree git hands the hook
// an absolute GIT_DIR, so the tests' own temporary repositories ran `git init` and
// `git config` on the real one: that set core.bare and a test's name in the shared
// config, and replaced the worktree's index (TRU-5.3).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

describe('make', () => {
  it.each([
    'GIT_DIR',
    'GIT_WORK_TREE',
    'GIT_INDEX_FILE',
    'GIT_COMMON_DIR',
    'GIT_OBJECT_DIRECTORY',
    'GIT_PREFIX',
  ])('keeps %s from a hook away from what it runs', (name) => {
    const probe = spawnSync(
      'make',
      ['-s', `--eval=probe:\n\t@echo "[$$${name}]"`, 'probe'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, [name]: '/from/the/hook' },
      },
    );
    expect(probe.stderr).toBe('');
    expect(probe.stdout.trim()).toBe('[]');
  });
});
