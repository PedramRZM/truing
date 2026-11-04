// What a review before the first push found, each with a test that failed first. The
// worst: a failed git read looked like a file that isn't there, so Undo deleted files
// and overwrote later work, and said it had worked.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { refusal } from '../../src/claude/path-guard.mjs';
import { prepareSession } from '../../src/claude/session';
import { screenOf } from '../../src/modules/claude/attachments';
import { snapshot, undoTurn } from '../../src/modules/claude/checkpoint';
import { checkReading, writeDenyRules } from '../../src/setup/read-project';

const GUARD = fileURLToPath(
  new URL('../../src/claude/path-guard.mjs', import.meta.url),
);

function temp(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'truing-review-'));
}

describe('Undo, when git itself fails', () => {
  const REAL_GIT = execFileSync('sh', ['-c', 'command -v git'], {
    encoding: 'utf8',
  }).trim();

  /** A git that fails for any call with this argument, and is real for the rest. */
  function gitFailingOn(...words: string[]): void {
    const bin = temp();
    const cases = words.map((word) => `"${word}") exit 1 ;;`).join(' ');
    writeFileSync(
      path.join(bin, 'git'),
      `#!/bin/sh\nfor a in "$@"; do case "$a" in ${cases} esac; done\nexec "${REAL_GIT}" "$@"\n`,
    );
    chmodSync(path.join(bin, 'git'), 0o755);
    vi.stubEnv('PATH', `${bin}${path.delimiter}${process.env.PATH ?? ''}`);
  }

  async function aTurn() {
    const root = temp();
    const git = (...args: string[]) =>
      execFileSync(REAL_GIT, args, { cwd: root, stdio: 'ignore' });
    git('init', '-q');
    writeFileSync(path.join(root, 'a.tsx'), 'old\n');
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'one');
    const before = (await snapshot(root)) ?? '';
    writeFileSync(path.join(root, 'a.tsx'), 'turn\n');
    const after = (await snapshot(root)) ?? '';
    const read = () => readFileSync(path.join(root, 'a.tsx'), 'utf8');
    return { root, before, after, read };
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps the file when it can’t read what it was', async () => {
    const { root, before, after, read } = await aTurn();
    gitFailingOn(before);
    expect(await undoTurn(root, before, after, ['a.tsx'])).toMatchObject({
      ok: false,
      reason: 'failed',
    });
    expect(read()).toBe('turn\n');
  });

  it('keeps later work when it can’t read what the turn left', async () => {
    const { root, before, after, read } = await aTurn();
    writeFileSync(path.join(root, 'a.tsx'), 'later\n');
    gitFailingOn(after, 'hash-object');
    expect(await undoTurn(root, before, after, ['a.tsx'])).toMatchObject({
      ok: false,
      reason: 'failed',
    });
    expect(read()).toBe('later\n');
  });

  it('doesn’t call a failed read someone’s later work', async () => {
    const { root, before, after } = await aTurn();
    gitFailingOn('hash-object');
    expect(await undoTurn(root, before, after, ['a.tsx'])).toMatchObject({
      ok: false,
      reason: 'failed',
    });
  });

  it('says plainly when it couldn’t put a file back either', async () => {
    const root = temp();
    const git = (...args: string[]) =>
      execFileSync(REAL_GIT, args, { cwd: root, stdio: 'ignore' });
    git('init', '-q');
    for (const file of ['a.tsx', 'b.tsx']) {
      writeFileSync(path.join(root, file), 'old\n');
    }
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'one');
    const before = (await snapshot(root)) ?? '';
    for (const file of ['a.tsx', 'b.tsx']) {
      writeFileSync(path.join(root, file), 'turn\n');
    }
    const after = (await snapshot(root)) ?? '';
    let writes = 0;
    const failing = (async (file: string, data: Buffer) => {
      writes += 1;
      if (writes > 1) throw new Error('disk full');
      writeFileSync(file, data);
    }) as unknown as typeof import('node:fs/promises').writeFile;
    expect(
      await undoTurn(root, before, after, ['a.tsx', 'b.tsx'], failing),
    ).toMatchObject({ ok: false, reason: 'failed', rolledBack: false });
  });

  it('sees a same-size edit made in the same second as the commit', async () => {
    const nextSecond = () =>
      new Promise((resolve) => setTimeout(resolve, 1000 - (Date.now() % 1000)));
    // All of this lands inside one second, and the next snapshot in the one after. So
    // the file looks as it did to git, and only the index's own time can give it away.
    await nextSecond();
    const root = temp();
    const git = (...args: string[]) =>
      execFileSync(REAL_GIT, args, { cwd: root, stdio: 'ignore' });
    git('init', '-q');
    writeFileSync(path.join(root, 'b.tsx'), 'one\n');
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'one');
    const before = execFileSync(REAL_GIT, ['rev-parse', 'HEAD^{tree}'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    writeFileSync(path.join(root, 'b.tsx'), 'two\n');
    await nextSecond();
    expect(await snapshot(root)).not.toBe(before);
  });

  it('still undoes a turn that went fine, a new file included', async () => {
    const { root, before, read } = await aTurn();
    writeFileSync(path.join(root, 'new.tsx'), 'turn\n');
    const after = (await snapshot(root)) ?? '';
    expect(await undoTurn(root, before, after, ['a.tsx', 'new.tsx'])).toEqual({
      ok: true,
    });
    expect(read()).toBe('old\n');
  });

  it('holds with a long list of files, one at a time', async () => {
    const root = temp();
    const git = (...args: string[]) =>
      execFileSync(REAL_GIT, args, { cwd: root, stdio: 'ignore' });
    git('init', '-q');
    const files = Array.from({ length: 40 }, (_, at) => `f${at}.tsx`);
    for (const file of files) writeFileSync(path.join(root, file), 'old\n');
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'one');
    const before = (await snapshot(root)) ?? '';
    for (const file of files) writeFileSync(path.join(root, file), 'turn\n');
    const after = (await snapshot(root)) ?? '';
    expect(await undoTurn(root, before, after, files)).toEqual({ ok: true });
    for (const file of files) {
      expect(readFileSync(path.join(root, file), 'utf8')).toBe('old\n');
    }
  });
});

describe('the frontmatter check on a designer’s skills', () => {
  const SKILL = '.claude/skills/design-a/SKILL.md';

  function project(existing?: string): string {
    const root = temp();
    mkdirSync(path.join(root, '.claude/skills/design-a'), { recursive: true });
    if (existing !== undefined) {
      writeFileSync(path.join(root, SKILL), existing);
    }
    return root;
  }

  function guard(root: string, toolInput: Record<string, unknown>) {
    const rules = path.join(temp(), 'rules.json');
    writeFileSync(
      rules,
      JSON.stringify({ root, include: ['**'], exclude: [] }),
    );
    return spawnSync(process.execPath, [GUARD, rules], {
      input: JSON.stringify({ cwd: root, tool_input: toolInput }),
      encoding: 'utf8',
    });
  }

  it.each([
    ['indented keys', '---\n  name: a\n  allowed-tools: Bash(*)\n---\n'],
    ['a bare CR before a key', '---\nname: a\rallowed-tools: Bash(*)\n---\n'],
    ['an indented key after a plain one', '---\nname: a\n  hooks: {}\n---\n'],
  ])('refuses %s', (_what, content) => {
    const root = project();
    expect(guard(root, { file_path: SKILL, content }).status).toBe(2);
  });

  it('lets a folded description through', () => {
    const root = project();
    const content = '---\nname: a\ndescription: |\n  when: always\n---\n';
    expect(guard(root, { file_path: SKILL, content }).status).toBe(0);
  });

  it('lets a plain description that wraps through', () => {
    const root = project();
    const content = '---\nname: a\ndescription: one line\n  and another\n---\n';
    expect(guard(root, { file_path: SKILL, content }).status).toBe(0);
  });

  it('refuses an Edit whose old text isn’t in the file', () => {
    const root = project('---\nname: a\ndescription: “curly”\n---\n');
    expect(
      guard(root, {
        file_path: SKILL,
        old_string: 'description: "curly"',
        new_string: 'allowed-tools: Bash(*)',
      }).status,
    ).toBe(2);
  });

  it('checks a notebook’s path as well as a decoy file path', () => {
    const root = project();
    expect(
      guard(root, {
        file_path: 'src/a.tsx',
        notebook_path: '.git/hooks/pre-commit',
      }).status,
    ).toBe(2);
  });
});

describe('what the guard can’t be talked out of', () => {
  const INSTRUCTIONS = [
    'CLAUDE.md',
    'CLAUDE.local.md',
    'AGENTS.md',
    'GEMINI.md',
    'src/components/CLAUDE.md',
    '.github/workflows/check.yml',
    '.cursor/rules/a.md',
    '.vscode/tasks.json',
  ];

  it.each(INSTRUCTIONS)('keeps %s off limits, as it steers later', (file) => {
    const root = temp();
    expect(refusal({ root, include: ['**'], exclude: [] }, file, root)).toMatch(
      /Git's or Claude Code's|runs later/,
    );
  });

  it('tells Claude Code not to let a project switch hooks off', async () => {
    const root = temp();
    const session = await prepareSession({
      root,
      config: {
        app: { devCommand: 'x' },
        writable: { include: ['src/**'], exclude: [] },
      },
    });
    const settings = JSON.parse(
      readFileSync(
        session.args[session.args.indexOf('--settings') + 1] ?? '',
        'utf8',
      ),
    ) as {
      disableAllHooks: boolean;
      hooks: { PreToolUse: { hooks: { onFailure: string }[] }[] };
    };
    await session.dispose();
    expect(settings.disableAllHooks).toBe(false);
    expect(settings.hooks.PreToolUse[0]?.hooks[0]?.onFailure).toBe('block');
  });

  it('does the same for the project read', () => {
    const file = path.join(temp(), 'settings.json');
    writeDenyRules(file, temp());
    const settings = JSON.parse(readFileSync(file, 'utf8')) as {
      disableAllHooks: boolean;
      hooks: { PreToolUse: { hooks: { onFailure: string }[] }[] };
    };
    expect(settings.disableAllHooks).toBe(false);
    expect(settings.hooks.PreToolUse[0]?.hooks[0]?.onFailure).toBe('block');
  });
});

describe('what a project read can’t choose', () => {
  it('won’t turn on full access by answering with everything', () => {
    const draft = checkReading(temp(), {
      name: 'shop',
      summary: '',
      framework: { name: 'Next.js', version: null },
      frameworkEvidence: '',
      appDir: null,
      appDirEvidence: '',
      devCommand: 'pnpm dev',
      devCommandEvidence: '',
      port: null,
      portEvidence: '',
      startRoute: '/',
      startRouteEvidence: '',
      source: null,
      sourceEvidence: '',
      primitives: null,
      primitivesEvidence: '',
      tokens: null,
      tokensEvidence: '',
      tailwindMerge: null,
      writableInclude: ['**', 'src/**'],
      writableExclude: [],
      writableEvidence: '',
      checks: [],
      checksEvidence: '',
      dropEnv: [],
      dropEnvEvidence: '',
      questions: [],
    });
    expect(draft.writableInclude).toEqual(['src/**']);
  });
});

describe('a hash in a frame’s address', () => {
  const frame = (href: string) => ({
    id: 'main',
    label: 'Desktop',
    href,
    connected: true,
    width: 1440,
    height: 900,
  });

  it('leaves out one that isn’t a route, as it can hold a token', () => {
    const screen = screenOf(
      [frame('http://localhost:3000/a#access_token=abc')],
      'main',
    );
    expect(screen.frames[0]?.page).toBe('/a');
  });

  it('keeps one that is a route', () => {
    const screen = screenOf(
      [frame('http://localhost:3000/#/settings')],
      'main',
    );
    expect(screen.frames[0]?.page).toBe('/#/settings');
  });
});
