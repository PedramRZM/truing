// A project's access and settings after setup (TRU-10.3, TRU-10.7): full access and
// what stays off limits whatever it says, changing a saved value, and what a later
// read of the project does to the values a person set.
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { refusal } from '../../src/claude/path-guard.mjs';
import { sessionPermissions, sessionPrompt } from '../../src/claude/session';
import { DEFAULT_MODULES, type TruingConfig } from '../../src/config';
import { createEditEngine } from '../../src/edits/engine';
import { createModuleHost } from '../../src/module-host';
import { loadModules } from '../../src/module-loader';
import {
  draftToConfig,
  keepYours,
  profileToDraft,
  type SettingValues,
  valuesOf,
} from '../../src/setup/draft';
import {
  loadProfile,
  type Profile,
  profileFile,
  saveProfile,
} from '../../src/setup/profile';
import {
  checkReading,
  type Reading,
  type Spawner,
} from '../../src/setup/read-project';
import {
  applyLive,
  readOneValue,
  readSettings,
  type ReadValue,
  saveSettings,
} from '../../src/setup/settings';
import {
  changedFields,
  type SettingField,
} from '../../src/setup/setting-fields';

function temp(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'truing-settings-'));
}

function reading(overrides: Partial<Reading> = {}): Reading {
  return {
    name: 'shop',
    summary: 'A shop.',
    framework: { name: 'Next.js', version: '16.0.0' },
    frameworkEvidence: 'package.json depends on next.',
    appDir: null,
    appDirEvidence: 'next.config.ts is at the root.',
    devCommand: 'pnpm dev',
    devCommandEvidence: 'package.json, the dev script.',
    port: 3000,
    portEvidence: "Next's default.",
    startRoute: '/',
    startRouteEvidence: 'app/page.tsx exists.',
    source: null,
    sourceEvidence: 'The code is at the root.',
    primitives: null,
    primitivesEvidence: 'No components.json.',
    tokens: null,
    tokensEvidence: 'No @theme block.',
    tailwindMerge: null,
    writableInclude: ['src/**/*.tsx'],
    writableExclude: ['src/api/**'],
    writableEvidence: 'UI files are in src.',
    checks: ['pnpm typecheck'],
    checksEvidence: 'A script in package.json.',
    dropEnv: [],
    dropEnvEvidence: 'No hooks.',
    questions: [],
    ...overrides,
  };
}

/** A saved project, in a home of its own. */
function saved(overrides: Partial<Profile> = {}) {
  const root = temp();
  const env = { TRUING_HOME: temp() };
  const draft = checkReading(root, reading());
  saveProfile(
    {
      root,
      framework: draft.framework,
      evidence: draft.evidence,
      config: draftToConfig(draft),
      ...overrides,
    },
    env,
  );
  const values = (): SettingValues => valuesOf(profileToDraft(profileOf()));
  const profileOf = (): Profile => {
    const profile = loadProfile(root, env);
    if (!profile) throw new Error('Not saved.');
    return profile;
  };
  const save = (
    change: Partial<SettingValues>,
    options: {
      confirmedCommand?: string;
      read?: ReadonlyMap<SettingField, ReadValue>;
    } = {},
  ) =>
    saveSettings({
      root,
      env,
      values: { ...values(), ...change },
      confirmedCommand: options.confirmedCommand ?? null,
      read: options.read ?? new Map(),
    });
  return { root, env, values, profileOf, save };
}

describe('full access', () => {
  it('gives the whole project, and keeps the lists to go back to', () => {
    const { root, env, save, profileOf, values } = saved();
    return save({ fullAccess: true }).then(({ config }) => {
      expect(config.writable).toEqual({ include: ['**'], exclude: [] });
      expect(loadProfile(root, env)?.config.writable.include).toEqual(['**']);
      expect(profileOf().folders?.include).toEqual(['src/**/*.tsx']);
      expect(values()).toMatchObject({
        fullAccess: true,
        writableInclude: ['src/**/*.tsx'],
        writableExclude: ['src/api/**'],
      });
    });
  });

  it('goes back to the lists it kept', async () => {
    const { save } = saved();
    await save({ fullAccess: true });
    const { config } = await save({ fullAccess: false });
    expect(config.writable).toEqual({
      include: ['src/**/*.tsx'],
      exclude: ['src/api/**'],
    });
  });

  it('is off unless someone chooses it', () => {
    const draft = checkReading(temp(), reading());
    expect(draftToConfig(draft).writable.include).toEqual(['src/**/*.tsx']);
  });

  const whole = (root: string) => ({
    root,
    include: ['**', '.claude/rules/design-*.md'],
    exclude: [],
  });

  it('lets the path guard pass any file in the project', () => {
    const root = temp();
    for (const file of ['server/db.ts', 'package.json', 'src/app/api/a.ts']) {
      expect(refusal(whole(root), file, root)).toBeNull();
    }
  });

  it.each([
    ['a test', 'src/a.test.tsx', /is a test/],
    ['a test folder', 'e2e/a.ts', /is a test/],
    ['a secret file', '.env', /may hold secrets/],
    ['a local secret file', 'apps/web/.env.local', /may hold secrets/],
    ['a secrets folder', 'secrets/a.txt', /may hold secrets/],
    ['a key', 'certs/a.PEM', /may hold secrets/],
    ["Git's files", '.git/config', /Git's or Claude Code's/],
    ["Claude Code's settings", '.claude/settings.json', /Claude Code's/],
    ['outside the project', '../other/a.ts', /outside the project/],
  ])('still refuses %s', (_what, file, reason) => {
    const root = temp();
    expect(refusal(whole(root), file, root)).toMatch(reason);
  });

  it('refuses a secret file even when a list names it', () => {
    const root = temp();
    expect(
      refusal({ root, include: ['.env'], exclude: [] }, '.env', root),
    ).toMatch(/may hold secrets/);
  });

  it('holds for a direct edit too', () => {
    const engine = createEditEngine({
      root: temp(),
      config: { writable: { include: ['**'], exclude: [] } },
    });
    expect(engine.writable('server/db.ts')).toBe(true);
    expect(engine.writable('src/a.test.tsx')).toBe(false);
    expect(engine.writable('.env.local')).toBe(false);
    expect(engine.writable('.git/config')).toBe(false);
  });

  const wholeConfig = {
    name: 'shop',
    app: { devCommand: 'pnpm dev' },
    writable: { include: ['**'], exclude: [] },
  };

  it('allows every file in Claude’s permissions, past what’s always denied', () => {
    const { allow, deny } = sessionPermissions(wholeConfig, [], false);
    expect(allow).toContain('Edit(**)');
    expect(deny).toEqual(
      expect.arrayContaining([
        'Edit(**/.env)',
        'Edit(**/.env.*)',
        'Read(**/.env)',
        'Edit(**/.git/**)',
        'Edit(.claude/settings.json)',
        'Bash(git commit)',
        'Bash(git commit *)',
        'Bash(git push)',
        'Bash(git push *)',
      ]),
    );
  });

  it('tells Claude what it may write in words', async () => {
    const prompt = await sessionPrompt(wholeConfig);
    expect(prompt).toContain('any file in the project, except tests');
    expect(prompt).not.toContain('- Never:');
  });
});

describe('changing a saved value', () => {
  it('shows what’s saved, with Claude’s reasons and when', () => {
    const { root, env } = saved();
    const view = readSettings(root, env);
    expect(view).toMatchObject({
      kind: 'saved',
      values: { devCommand: 'pnpm dev', startRoute: '/' },
      evidence: { devCommand: 'package.json, the dev script.' },
      yours: [],
    });
    expect(view.kind === 'saved' && view.savedAt).toBeTruthy();
  });

  it('says so when a project has no settings', () => {
    expect(readSettings(temp(), { TRUING_HOME: temp() })).toEqual({
      kind: 'none',
    });
  });

  it('sends a project with a config file back to that file', async () => {
    const { root, save } = saved();
    writeFileSync(path.join(root, 'truing.config.ts'), 'export default {};\n');
    expect(readSettings(root, { TRUING_HOME: temp() })).toEqual({
      kind: 'file',
      file: 'truing.config.ts',
    });
    await expect(save({ startRoute: '/a' })).rejects.toThrow(
      /truing\.config\.ts/,
    );
  });

  it('keeps a change, marked as the person’s', async () => {
    const { save, values, profileOf } = saved();
    await save({ startRoute: '/pricing' });
    expect(values().startRoute).toBe('/pricing');
    expect(profileOf().yours).toEqual(['startRoute']);
  });

  it('leaves everything else alone', async () => {
    const { save, values } = saved();
    const before = values();
    await save({ startRoute: '/pricing' });
    expect(values()).toEqual({ ...before, startRoute: '/pricing' });
  });

  it('keeps what the screen doesn’t show', async () => {
    const root = temp();
    const env = { TRUING_HOME: temp() };
    const draft = checkReading(root, reading());
    const config: TruingConfig = {
      ...draftToConfig(draft),
      server: { port: 4100 },
      branch: { pattern: 'look/{feature}' },
      modules: [...DEFAULT_MODULES, './own'],
    };
    saveProfile(
      { root, framework: draft.framework, evidence: {}, config },
      env,
    );
    const { config: next } = await saveSettings({
      root,
      env,
      values: { ...valuesOf(draft), startRoute: '/a' },
      confirmedCommand: null,
      read: new Map(),
    });
    expect(next.server).toEqual({ port: 4100 });
    expect(next.branch).toEqual({ pattern: 'look/{feature}' });
    expect(next.modules).toContain('./own');
  });

  it('says what waits for Truing to open again', async () => {
    const { save } = saved();
    expect((await save({ startRoute: '/a', port: 4000 })).reopen).toEqual([
      'Port',
      'First page',
    ]);
  });

  it('needs nothing reopened for what’s read each time', async () => {
    const { save } = saved();
    const { reopen } = await save({
      writableInclude: ['src/**'],
      checks: ['pnpm lint'],
      dropEnv: ['A_SWITCH'],
    });
    expect(reopen).toEqual([]);
  });

  it('reaches the next session and the next edit without a restart', async () => {
    const { save } = saved();
    const running: TruingConfig = {
      name: 'shop',
      app: { devCommand: 'pnpm dev' },
      writable: { include: ['src/**/*.tsx'], exclude: [] },
    };
    const engine = createEditEngine({ root: temp(), config: running });
    expect(engine.writable('server/db.ts')).toBe(false);

    applyLive(running, (await save({ fullAccess: true })).config);

    expect(engine.writable('server/db.ts')).toBe(true);
    expect(sessionPermissions(running, [], false).allow).toContain('Edit(**)');
  });

  it('won’t take a new start command nobody said yes to', async () => {
    const { save, values } = saved();
    await expect(save({ devCommand: 'node evil.js' })).rejects.toThrow(
      /Check the new start command/,
    );
    expect(values().devCommand).toBe('pnpm dev');
  });

  it('won’t take a yes to a different command', async () => {
    const { save, values } = saved();
    await expect(
      save({ devCommand: 'node evil.js' }, { confirmedCommand: 'pnpm dev' }),
    ).rejects.toThrow(/Check the new start command/);
    expect(values().devCommand).toBe('pnpm dev');
  });

  it('takes a new start command once someone says yes', async () => {
    const { save, values } = saved();
    await save(
      { devCommand: 'pnpm start' },
      { confirmedCommand: 'pnpm start' },
    );
    expect(values().devCommand).toBe('pnpm start');
  });

  it('keeps a secret typed into the command out of the file', async () => {
    const { save, values } = saved();
    const command = 'API_TOKEN=abc123 pnpm dev';
    await save({ devCommand: command }, { confirmedCommand: command });
    expect(values().devCommand).toBe('API_TOKEN=$API_TOKEN pnpm dev');
  });

  it.each([
    [
      'a path that leaves the project',
      { writableInclude: ['../**'] },
      /leaves/,
    ],
    ['an absolute path', { writableExclude: ['/etc/**'] }, /leaves/],
    ['a chained check', { checks: ['pnpm lint; rm a'] }, /plain command/],
    ['a wildcard check', { checks: ['pnpm *'] }, /plain command/],
    ['a bad variable name', { dropEnv: ['A B'] }, /variable name/],
    ['a first page with no slash', { startRoute: 'a' }, /First page/],
    ['no project name', { name: '' }, /Project name/],
    ['a port that can’t be one', { port: 70000 }, /port/],
  ])('refuses %s, and saves nothing', async (_what, change, reason) => {
    const { save, values } = saved();
    const before = values();
    await expect(save(change)).rejects.toThrow(reason);
    expect(values()).toEqual(before);
  });

  it('keeps a stylesheet that can’t be read out, and says why', async () => {
    const { save, values, profileOf } = saved();
    await save({ tokens: 'no-such.css' });
    expect(values().tokens).toBeNull();
    expect(profileOf().evidence.tokens).toBeTruthy();
  });

  it('won’t call a value Claude read the person’s', async () => {
    const { save, profileOf } = saved();
    const read = new Map<SettingField, ReadValue>([
      [
        'startRoute',
        { values: { startRoute: '/home' }, evidence: 'app/home/page.tsx.' },
      ],
    ]);
    await save({ startRoute: '/home' }, { read });
    expect(profileOf().yours).toEqual([]);
    expect(profileOf().evidence.startRoute).toBe('app/home/page.tsx.');
  });

  it('calls it the person’s if they changed what Claude read', async () => {
    const { save, profileOf } = saved();
    const read = new Map<SettingField, ReadValue>([
      ['startRoute', { values: { startRoute: '/home' }, evidence: 'Here.' }],
    ]);
    await save({ startRoute: '/home/a' }, { read });
    expect(profileOf().yours).toEqual(['startRoute']);
  });

  it('gives a project saved earlier the new module', () => {
    const { root, env } = saved();
    const file = profileFile(root, env);
    const old = loadProfile(root, env);
    if (!old) throw new Error('Not saved.');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify({
        ...old,
        config: {
          ...old.config,
          modules: ['selection', 'changes', 'claude-config', 'claude', './own'],
        },
      }),
    );
    expect(loadProfile(root, env)?.config.modules).toEqual([
      'selection',
      'changes',
      'claude-config',
      'claude',
      './own',
      'settings',
      'frames',
    ]);
  });
});

describe('reading one value again', () => {
  const children: ChildProcess[] = [];
  afterEach(() => {
    for (const child of children.splice(0)) child.kill();
  });

  /** A `claude` that prints one result line and ends, and what it was asked. */
  function printing(result: unknown) {
    const asked: string[][] = [];
    const spawner: Spawner = (args) => {
      asked.push(args);
      const line = JSON.stringify({
        type: 'result',
        structured_output: result,
      });
      const child = spawn(process.execPath, [
        '-e',
        `console.log(${JSON.stringify(line)})`,
      ]);
      children.push(child);
      return child;
    };
    return { asked, spawner };
  }

  it('asks about that value, and takes only that value', async () => {
    const { asked, spawner } = printing(
      reading({ devCommand: 'pnpm start', devCommandEvidence: 'A script.' }),
    );
    const answer = await readOneValue(temp(), 'devCommand', { spawner });
    expect(answer).toEqual({
      values: { devCommand: 'pnpm start' },
      evidence: 'A script.',
    });
    expect(asked[0]?.at(-1)).toContain(
      'Only this is needed now: devCommand and devCommandEvidence',
    );
  });

  it('runs with the same read-only limits as the first read', async () => {
    const { asked, spawner } = printing(reading());
    await readOneValue(temp(), 'port', { spawner });
    const args = asked[0] ?? [];
    expect(args[args.indexOf('--tools') + 1]).toBe('Read,Glob,Grep');
    expect(args[args.indexOf('--setting-sources') + 1]).toBe('user');
  });

  it('holds its answer to the same checks', async () => {
    const { spawner } = printing(
      reading({ checks: ['pnpm lint', 'pnpm lint; rm a'] }),
    );
    const answer = await readOneValue(temp(), 'checks', { spawner });
    expect(answer.values).toEqual({ checks: ['pnpm lint'] });
  });

  it('gives both lists for what may change', async () => {
    const { spawner } = printing(reading());
    const answer = await readOneValue(temp(), 'writable', { spawner });
    expect(answer.values).toEqual({
      writableInclude: ['src/**/*.tsx'],
      writableExclude: ['src/api/**'],
    });
  });

  it('fails plainly when Claude can’t answer', async () => {
    const spawner: Spawner = () => {
      const child = spawn(process.execPath, ['-e', 'process.exit(1)']);
      children.push(child);
      return child;
    };
    await expect(readOneValue(temp(), 'port', { spawner })).rejects.toThrow(
      /stopped before it finished/,
    );
  });
});

describe('a later read of the whole project', () => {
  it('keeps what a person set, and offers what it read', async () => {
    const { root, env, save, profileOf } = saved();
    await save({ startRoute: '/pricing' });
    const draft = keepYours(
      checkReading(root, reading({ startRoute: '/home' })),
      profileOf(),
    );
    expect(draft.startRoute).toBe('/pricing');
    expect(draft.kept).toEqual([
      {
        field: 'startRoute',
        read: { startRoute: '/home' },
        shown: '/home',
      },
    ]);
    expect(readSettings(root, env).kind).toBe('saved');
  });

  it('takes anything else from the read', async () => {
    const { root, save, profileOf } = saved();
    await save({ startRoute: '/pricing' });
    const draft = keepYours(
      checkReading(root, reading({ port: 4321 })),
      profileOf(),
    );
    expect(draft.port).toBe(4321);
  });

  it('has nothing to offer when the read agrees', async () => {
    const { root, save, profileOf } = saved();
    await save({ startRoute: '/pricing' });
    const draft = keepYours(
      checkReading(root, reading({ startRoute: '/pricing' })),
      profileOf(),
    );
    expect(draft.kept).toEqual([]);
  });

  it('keeps full access, which no read can choose', async () => {
    const { root, save, profileOf } = saved();
    await save({ fullAccess: true });
    const draft = keepYours(checkReading(root, reading()), profileOf());
    expect(draft.fullAccess).toBe(true);
    expect(draftToConfig(draft).writable.include).toEqual(['**']);
  });

  it('changes nothing for a project never saved', () => {
    const draft = checkReading(temp(), reading());
    expect(keepYours(draft, null)).toBe(draft);
  });
});

describe('the module, through the host', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('comes with a new project', async () => {
    const modules = await loadModules(temp(), { modules: DEFAULT_MODULES });
    expect(modules.map(({ spec }) => spec.id)).toContain('settings');
  });

  it('saves, and every module sees it from then on', async () => {
    const { root, env, values } = saved();
    vi.stubEnv('TRUING_HOME', env.TRUING_HOME);
    const config: TruingConfig = {
      name: 'shop',
      app: { devCommand: 'pnpm dev' },
      writable: { include: ['src/**/*.tsx'], exclude: [] },
    };
    const host = createModuleHost({
      modules: await loadModules(root, { modules: ['settings'] }),
      root,
      config,
    });
    await host.start();

    const view = await host.call('settings', 'read', {});
    expect(view).toMatchObject({ kind: 'saved' });

    const answer = await host.call('settings', 'save', {
      values: { ...values(), fullAccess: true },
      confirmedCommand: null,
    });

    expect(answer).toEqual({ reopen: [], tokensDropped: false });
    expect(config.writable.include).toEqual(['**']);
  });
});

function wholeConfigFor() {
  return {
    name: 'shop',
    app: { devCommand: 'pnpm dev' },
    writable: { include: ['**'], exclude: [] },
  };
}

describe('what a review of full access found', () => {
  function project(): string {
    const root = temp();
    mkdirSync(path.join(root, 'src'), { recursive: true });
    return root;
  }
  const whole = (root: string) => ({ root, include: ['**'], exclude: [] });

  it('won’t let a direct edit follow a link out of the project', () => {
    const root = project();
    const outside = path.join(temp(), 'a.tsx');
    writeFileSync(outside, '');
    symlinkSync(outside, path.join(root, 'src/x.tsx'));
    const engine = createEditEngine({
      root,
      config: { writable: { include: ['**'], exclude: [] } },
    });
    expect(engine.writable('src/x.tsx')).toBe(false);
  });

  // TRU-5.3 #3, checked.
  it('won’t let a direct edit follow a link to nothing out of the project', () => {
    const root = project();
    symlinkSync(path.join(temp(), 'nothing.tsx'), path.join(root, 'src/x.tsx'));
    const engine = createEditEngine({
      root,
      config: { writable: { include: ['**'], exclude: [] } },
    });
    expect(engine.writable('src/x.tsx')).toBe(false);
  });

  it('won’t let a direct edit follow a link to a test', () => {
    const root = project();
    writeFileSync(path.join(root, 'src/a.test.tsx'), '');
    symlinkSync('a.test.tsx', path.join(root, 'src/x.tsx'));
    const engine = createEditEngine({
      root,
      config: { writable: { include: ['**'], exclude: [] } },
    });
    expect(engine.writable('src/x.tsx')).toBe(false);
  });

  it('ignores case in a direct edit’s off-limits list, as the guard does', () => {
    const engine = createEditEngine({
      root: project(),
      config: { writable: { include: ['**'], exclude: ['src/server/**'] } },
    });
    expect(engine.writable('src/Server/a.tsx')).toBe(false);
  });

  it.each([
    ['Git’s hooks', '../.git/hooks/pre-commit', /Git's or Claude Code's/],
    [
      'Claude Code’s settings',
      '../.claude/settings.local.json',
      /Claude Code's/,
    ],
    ['a place outside', '../../elsewhere/a.ts', /outside the project/],
  ])('refuses a link to nothing yet that points at %s', (_what, to, reason) => {
    const root = project();
    symlinkSync(to, path.join(root, 'src/a.ts'));
    expect(refusal(whole(root), 'src/a.ts', root)).toMatch(reason);
  });

  it.each([
    '.claude/hooks/format.sh',
    '.claude/agents/a.md',
    '.claude/skills/commit/SKILL.md',
    '.mcp.json',
    '.git',
    '.husky/pre-commit',
    '.githooks/pre-commit',
    'lefthook.yml',
    '.pre-commit-config.yaml',
  ])('keeps %s off limits, as it runs later', (file) => {
    const root = project();
    expect(refusal(whole(root), file, root)).toMatch(/Git's or Claude Code's/);
  });

  it.each(['.claude/rules/design-a.md', '.claude/skills/design-a/SKILL.md'])(
    'still lets a designer’s own %s through',
    (file) => {
      const root = project();
      expect(refusal(whole(root), file, root)).toBeNull();
    },
  );

  it.each([
    'tests/setup.ts',
    'test/helpers.ts',
    'foo_test.go',
    'test_foo.py',
    'src/__snapshots__/a.snap',
    'playwright.config.ts',
    'vitest.config.ts',
    'jest.config.js',
  ])('calls %s a test under full access', (file) => {
    const root = project();
    expect(refusal(whole(root), file, root)).toMatch(/is a test/);
  });

  it('still writes a folder named test when a list names it', () => {
    const root = project();
    const rules = { root, include: ['test/app/**'], exclude: [] };
    expect(refusal(rules, 'test/app/page.tsx', root)).toBeNull();
  });

  it('doesn’t take a list with its own off-limits for full access', () => {
    const { profileOf } = saved();
    const profile = profileOf();
    const draft = profileToDraft({
      ...profile,
      config: {
        ...profile.config,
        writable: { include: ['**'], exclude: ['src/server/**'] },
      },
    });
    expect(draft.fullAccess).toBe(false);
    expect(draft.writableExclude).toEqual(['src/server/**']);
  });

  it('denies Claude reading more than the env files', () => {
    const { deny } = sessionPermissions(wholeConfigFor(), [], false);
    expect(deny).toEqual(
      expect.arrayContaining([
        'Read(**/secrets/**)',
        'Read(**/*.pem)',
        'Read(**/.npmrc)',
        'Edit(**/secrets/**)',
      ]),
    );
  });

  it('tells Claude server code is in reach under full access', async () => {
    const prompt = await sessionPrompt(wholeConfigFor());
    expect(prompt).not.toContain(
      'Server code, data, configuration and tests are out of reach,',
    );
    expect(prompt).toContain('Tests are always out of reach');
  });

  it.each([
    ['an app folder outside', { appDir: '../..' }],
    ['a code folder outside', { source: '/etc' }],
    ['a components folder outside', { primitives: '../../x' }],
    ['a groups file outside', { tailwindMerge: '../../outside.json' }],
    ['a stylesheet outside', { tokens: '../a.css' }],
  ])('refuses %s, and saves nothing', async (_what, change) => {
    const { save, values } = saved();
    const before = values();
    await expect(save(change)).rejects.toThrow(/isn't in this project/);
    expect(values()).toEqual(before);
  });

  it('refuses a project name that’s a path', async () => {
    const { save } = saved();
    await expect(save({ name: '../../..' })).rejects.toThrow(/Project name/);
  });

  it('refuses a start command with an invisible character', async () => {
    const { save } = saved();
    const command = `pnpm dev${String.fromCodePoint(0x202e)}`;
    await expect(
      save({ devCommand: command }, { confirmedCommand: command }),
    ).rejects.toThrow(/hidden character/);
  });

  it('marks what a person corrected on the review screen as theirs', () => {
    const before = checkReading(temp(), reading());
    const after = { ...before, startRoute: '/a', checks: ['pnpm lint'] };
    expect(changedFields(before, after)).toEqual(['startRoute', 'checks']);
    expect(changedFields(before, before)).toEqual([]);
  });
});
