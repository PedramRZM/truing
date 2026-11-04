// The first run's promises: what's asked, what's checked, what's kept. Each of
// these stands for an acceptance criterion of the zero-config epic (TRU-6).
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ensureApp, findFreePort, systemPort } from '../../src/app-process';
import { truingConfigSchema } from '../../src/config';
import { doctorReport } from '../../src/doctor';
import { checkConnection, type Connection } from '../../src/setup/connection';
import {
  checkedTokens,
  draftProblem,
  draftToConfig,
  profileToDraft,
} from '../../src/setup/draft';
import {
  findProjects,
  recentClaudeProjects,
} from '../../src/setup/find-projects';
import { outerShadow } from '../../src/modules/selection/effect-classes';
import { chooseOpening } from '../../src/setup/opening';
import {
  listProfiles,
  loadProfile,
  profileFile,
  saveProfile,
  scrubSecrets,
} from '../../src/setup/profile';
import {
  checkReading,
  emptyDraft,
  type ReadEvent,
  type Reading,
  readProject,
  type Spawner,
} from '../../src/setup/read-project';
import { trustConfig } from '../../src/setup/trust';
import { browserIsComplete } from '../../src/setup/window';
import { tokensReport } from '../../src/tokens/cli';

const here = path.dirname(new URL(import.meta.url).pathname);
const packageRoot = path.resolve(here, '../..');

const temp = (name = 'truing-first-run-'): string =>
  realpathSync(mkdtempSync(path.join(os.tmpdir(), name)));

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
    source: 'src',
    sourceEvidence: 'The code lives in src.',
    primitives: null,
    primitivesEvidence: 'No components.json.',
    tokens: null,
    tokensEvidence: 'No @theme block.',
    tailwindMerge: null,
    writableInclude: ['src/**/*.tsx'],
    writableExclude: [],
    writableEvidence: 'UI files are in src.',
    checks: [],
    checksEvidence: 'No check scripts.',
    dropEnv: [],
    dropEnvEvidence: 'No hooks.',
    questions: [],
    ...overrides,
  };
}

const children: ChildProcess[] = [];
afterEach(() => {
  for (const running of children.splice(0)) running.kill();
});

describe('the connection check', () => {
  const answer = (result: string) => ({
    stdout: JSON.stringify({ result }),
    stderr: '',
  });
  const responses =
    (
      signedIn: Record<string, unknown>,
      roundTrip: () => { stdout: string; stderr: string },
    ) =>
    async (args: readonly string[]) => {
      if (args[0] === '--version') {
        return { stdout: '2.0.0 (Claude Code)', stderr: '' };
      }
      if (args[0] === 'auth') {
        return {
          stdout: JSON.stringify({ loggedIn: true, ...signedIn }),
          stderr: '',
        };
      }
      return roundTrip();
    };

  it('says a timeout is a timeout, and offers nothing to run', async () => {
    const connection = await checkConnection(
      responses({ authMethod: 'claude.ai' }, () => {
        throw Object.assign(new Error('Command failed'), {
          killed: true,
          stdout: '',
        });
      }),
    );
    expect(connection.ok).toBe(false);
    expect(connection.responds.ok).toBe(false);
    expect(connection.problem).toMatch(/didn't answer in time/);
    expect(connection.command).toBeNull();
  });

  it('counts an empty reply as no answer', async () => {
    const connection = await checkConnection(
      responses({ authMethod: 'claude.ai' }, () => answer('  ')),
    );
    expect(connection.responds.ok).toBe(false);
  });

  it.each([
    [{ authMethod: 'claude.ai', subscriptionType: 'pro' }],
    [{ authMethod: 'claude.ai', subscriptionType: 'max' }],
    [{ authMethod: 'claude.ai', subscriptionType: 'team' }],
    [{ authMethod: 'console' }],
    [{}],
  ])('works the same for any way of signing in: %j', async (fields) => {
    const connection = await checkConnection(
      responses(fields, () => answer('ready')),
    );
    expect(connection.ok).toBe(true);
  });

  it('never opens a file, so it can never read a credential', () => {
    const source = readFileSync(
      path.join(packageRoot, 'src/setup/connection.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/node:fs|from 'fs'|credentials\.json/);
  });
});

describe('no login of our own', () => {
  it('hands sign-in to Claude Code, with its terminal unread', () => {
    const source = readFileSync(
      path.join(packageRoot, 'src/setup/connection.ts'),
      'utf8',
    );
    expect(source).toMatch(
      /spawn\('claude', \['auth', 'login'\], \{\s*stdio: 'inherit'/,
    );
  });

  it('has no field for an email, password, key or login code', () => {
    const source = readFileSync(
      path.join(packageRoot, 'src/setup/ui/app.tsx'),
      'utf8',
    );
    expect(source).not.toMatch(/type="(password|email)"/);
    expect(source).not.toMatch(
      /password|e-?mail|api key|login code|access token/i,
    );
  });
});

describe('finding projects', () => {
  const encoded = (root: string): string => root.replace(/[^a-zA-Z0-9]/g, '-');

  /** A folder the way Claude Code keeps it: named after the project's path. */
  function recentIn(config: string, root: string, seconds = 0): void {
    const dir = path.join(config, 'projects', encoded(root));
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'a.jsonl');
    writeFileSync(file, '');
    const at = new Date(Date.now() + seconds * 1000);
    utimesSync(file, at, at);
  }

  it('takes a recent folder from its name, and never opens a transcript', async () => {
    const recent = temp('truing.my-app_');
    writeFileSync(path.join(recent, 'package.json'), '{}');
    const elsewhere = temp();
    writeFileSync(path.join(elsewhere, 'package.json'), '{}');
    const config = temp();
    recentIn(config, recent);
    // A transcript that says otherwise goes unread.
    writeFileSync(
      path.join(config, 'projects', encoded(recent), 'a.jsonl'),
      `${JSON.stringify({ cwd: elsewhere })}\n`,
    );

    expect(recentClaudeProjects({ CLAUDE_CONFIG_DIR: config })).toEqual([
      recent,
    ]);
    const source = readFileSync(
      path.join(packageRoot, 'src/setup/find-projects.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/fs\/promises|readFile|cwdOfTranscript/);
  });

  it('skips a folder that no longer exists, and lists the newest first', async () => {
    const older = temp();
    const newer = temp();
    for (const root of [older, newer]) {
      writeFileSync(path.join(root, 'package.json'), '{}');
    }
    const config = temp();
    recentIn(config, older, -60);
    recentIn(config, newer);
    recentIn(config, '/no/such/folder/at/all', 60);
    expect(recentClaudeProjects({ CLAUDE_CONFIG_DIR: config })).toEqual([
      newer,
      older,
    ]);
  });

  it('lists known projects with the most recent first', async () => {
    const env = { TRUING_HOME: temp(), CLAUDE_CONFIG_DIR: temp() };
    const [first, second] = [temp(), temp()] as [string, string];
    const profile = {
      framework: { name: 'Next.js', version: null },
      evidence: {},
      config: draftToConfig(checkReading(first, reading())),
    };
    saveProfile({ root: first, ...profile }, env);
    await new Promise((resolve) => setTimeout(resolve, 5));
    saveProfile({ root: second, ...profile }, env);

    const found = await findProjects(temp(), env);
    expect(found.map(({ root, source }) => [root, source])).toEqual([
      [second, 'known'],
      [first, 'known'],
    ]);
    expect(found.every(({ known }) => known)).toBe(true);
  });

  it('works on a machine with nothing saved', async () => {
    expect(
      await findProjects(temp(), {
        TRUING_HOME: temp(),
        CLAUDE_CONFIG_DIR: temp(),
      }),
    ).toEqual([]);
  });
});

describe('how Claude reads', () => {
  /** A `claude` that prints one result line and ends. */
  function printing(result: unknown): () => ChildProcess {
    const line = JSON.stringify({ type: 'result', structured_output: result });
    return () =>
      spawn(process.execPath, ['-e', `console.log(${JSON.stringify(line)})`]);
  }

  async function events(spawner: Spawner): Promise<ReadEvent[]> {
    const seen: ReadEvent[] = [];
    const handle = readProject(temp(), (event) => seen.push(event), {
      spawner,
    });
    await handle.finished;
    return seen;
  }

  it('denies secret files in the settings it hands Claude', async () => {
    let denied: string[] = [];
    await events((args) => {
      const settings = args[args.indexOf('--settings') + 1] ?? '';
      denied = (
        JSON.parse(readFileSync(settings, 'utf8')) as {
          permissions: { deny: string[] };
        }
      ).permissions.deny;
      return spawn(process.execPath, ['-e', '']);
    });
    for (const secret of [
      '.env)',
      '.env.*)',
      'secrets/**)',
      '*.pem)',
      '*.key)',
    ]) {
      expect(denied.some((rule) => rule.endsWith(secret))).toBe(true);
    }
  });

  it('asks once more when an answer is in the wrong shape', async () => {
    let runs = 0;
    const good = printing(reading());
    const bad = printing({ name: 1 });
    const seen = await events(() => {
      runs += 1;
      return runs === 1 ? bad() : good();
    });
    expect(runs).toBe(2);
    expect(seen.at(-1)?.type).toBe('done');
  });

  it('reports a second bad answer, and never half-uses it', async () => {
    let runs = 0;
    const bad = printing({ name: 1 });
    const seen = await events(() => {
      runs += 1;
      return bad();
    });
    expect(runs).toBe(2);
    expect(seen.at(-1)?.type).toBe('error');
    expect(seen.some((event) => event.type === 'done')).toBe(false);
  });

  it('keeps Claude’s reason for every value', () => {
    const draft = checkReading(temp(), reading());
    for (const field of [
      'framework',
      'appDir',
      'devCommand',
      'port',
      'startRoute',
      'source',
      'primitives',
      'tokens',
      'writable',
      'checks',
      'dropEnv',
    ]) {
      expect(draft.evidence[field]).toBeTruthy();
    }
  });

  it('drops a dropEnv entry that isn’t a variable name', () => {
    const draft = checkReading(
      temp(),
      reading({ dropEnv: ['SKIP_HOOKS', 'A=1; rm -rf /'] }),
    );
    expect(draft.dropEnv).toEqual(['SKIP_HOOKS']);
  });

  it('marks a stylesheet it can’t read as unknown, and says why', async () => {
    const root = temp();
    writeFileSync(path.join(root, 'tokens.css'), '@theme { --x: 1 }');
    const draft = await checkedTokens(
      root,
      checkReading(root, reading({ tokens: 'tokens.css' })),
    );
    expect(draft.tokens).toBeNull();
    expect(draft.evidence.tokens).toMatch(/tailwindcss/);
  });
});

describe('only the start command is required', () => {
  it('starts with no port and no writable files', () => {
    const draft = checkReading(
      temp(),
      reading({ port: null, writableInclude: [] }),
    );
    expect(draft.questions).toEqual([]);
    expect(draftProblem(draft)).toBeNull();
  });

  it('asks only for the command when nothing is known', () => {
    const draft = emptyDraft(temp());
    expect(draft.questions.map((question) => question.field)).toEqual([
      'devCommand',
    ]);
    expect(draftProblem(draft)).toMatch(/command/);
  });

  it('saves such a draft as a valid config, with no port in it', () => {
    const config = draftToConfig(
      checkReading(temp(), reading({ port: null, writableInclude: [] })),
    );
    expect(truingConfigSchema.safeParse(config).success).toBe(true);
    expect(config.app.port).toBeUndefined();
  });

  it('still refuses a port that isn’t one', () => {
    const draft = checkReading(temp(), reading());
    expect(draftProblem({ ...draft, port: 70000 })).toMatch(/port/i);
  });

  it('comes back from a saved profile as the same draft', () => {
    const root = temp();
    const draft = checkReading(
      root,
      reading({ checks: ['pnpm lint'], dropEnv: ['SKIP_HOOKS'] }),
    );
    const again = profileToDraft({
      version: 1,
      savedAt: 'now',
      root,
      framework: draft.framework,
      evidence: draft.evidence,
      config: draftToConfig(draft),
    });
    expect(again).toMatchObject({
      name: 'shop',
      devCommand: 'pnpm dev',
      port: 3000,
      checks: ['pnpm lint'],
      dropEnv: ['SKIP_HOOKS'],
      writableInclude: ['src/**/*.tsx'],
      questions: [],
    });
  });
});

describe('the saved profile holds no secrets', () => {
  it('takes a value out of a secret-looking variable, and keeps the rest', () => {
    expect(scrubSecrets('API_KEY=abc123 PORT=3000 pnpm dev')).toBe(
      'API_KEY=$API_KEY PORT=3000 pnpm dev',
    );
    expect(scrubSecrets('STRIPE_SECRET=$FROM_ENV pnpm dev')).toBe(
      'STRIPE_SECRET=$FROM_ENV pnpm dev',
    );
    expect(scrubSecrets('uses sk-abcdefghijklmnopqrstuvwx here')).toBe(
      'uses [removed] here',
    );
  });

  it('applies when saving, to the command and the evidence', () => {
    const env = { TRUING_HOME: temp() };
    const root = temp();
    const config = draftToConfig(checkReading(root, reading()));
    saveProfile(
      {
        root,
        framework: { name: 'Next.js', version: null },
        evidence: { devCommand: 'it says AUTH_TOKEN=hunter2' },
        config: {
          ...config,
          app: { ...config.app, devCommand: 'AUTH_TOKEN=hunter2 pnpm dev' },
        },
      },
      env,
    );
    expect(readFileSync(profileFile(root, env), 'utf8')).not.toContain(
      'hunter2',
    );
    expect(loadProfile(root, env)?.config.app.devCommand).toBe(
      'AUTH_TOKEN=$AUTH_TOKEN pnpm dev',
    );
    expect(listProfiles(env)).toHaveLength(1);
  });
});

describe('what opens', () => {
  const profileOf = (root: string) => ({
    root,
    framework: { name: 'Next.js', version: null },
    evidence: {},
    config: draftToConfig(checkReading(root, reading())),
  });
  // Loading this file would throw: if it's run, the test sees it.
  const CONFIG = `throw new Error('ran before anyone confirmed it');\n`;

  it('sets up a folder it knows nothing about', () => {
    expect(chooseOpening(temp(), {}, { TRUING_HOME: temp() }).kind).toBe(
      'setup',
    );
  });

  it('opens a saved profile', () => {
    const env = { TRUING_HOME: temp() };
    const root = temp();
    saveProfile(profileOf(root), env);
    expect(chooseOpening(root, {}, env).kind).toBe('profile');
  });

  it('asks before loading a config file nobody has confirmed, and shows it', () => {
    const env = { TRUING_HOME: temp() };
    const root = temp();
    writeFileSync(path.join(root, 'truing.config.ts'), CONFIG);
    expect(chooseOpening(root, {}, env)).toMatchObject({
      kind: 'confirm',
      root,
      text: CONFIG,
    });
  });

  it('a confirmed config file wins over a saved profile', () => {
    const env = { TRUING_HOME: temp() };
    const root = temp();
    writeFileSync(path.join(root, 'truing.config.ts'), CONFIG);
    saveProfile(profileOf(root), env);
    trustConfig(root, env);
    expect(chooseOpening(root, {}, env)).toEqual({ kind: 'config', root });
  });

  it('asks again when the file changes', () => {
    const env = { TRUING_HOME: temp() };
    const root = temp();
    writeFileSync(path.join(root, 'truing.config.ts'), CONFIG);
    trustConfig(root, env);
    writeFileSync(path.join(root, 'truing.config.ts'), `${CONFIG}// changed\n`);
    expect(chooseOpening(root, {}, env).kind).toBe('confirm');
  });

  it('--reconfigure reads again, whatever is saved', () => {
    const env = { TRUING_HOME: temp() };
    const root = temp();
    saveProfile(profileOf(root), env);
    expect(chooseOpening(root, { reconfigure: true }, env)).toEqual({
      kind: 'reconfigure',
      root,
    });
  });
});

describe('starting the app', () => {
  const HTTP = (port: number | string): string =>
    `node -e "require('node:http').createServer((q,s)=>s.end('ok')).listen(${port},()=>console.log('ready on http://localhost:'+${port}))"`;

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

  it('needs no port: it follows what the server prints', async () => {
    const port = await findFreePort(42100);
    const app = await ensureApp({
      root: temp(),
      command: HTTP(port),
      log: () => {},
      timeoutMs: 15_000,
    });
    expect(app.port).toBe(port);
    expect(app.moved).toBe(false);
    await app.stop();
  });

  it('counts a listening port as up only once HTTP answers', async () => {
    const port = await findFreePort(42200);
    const tcpOnly = `node -e "require('node:net').createServer().listen(${port},()=>console.log('http://localhost:${port}'))"`;
    await expect(
      ensureApp({
        root: temp(),
        command: tcpOnly,
        port,
        log: () => {},
        timeoutMs: 3000,
      }),
    ).rejects.toThrow(/didn't answer/);
  });

  it('won’t adopt a port another project holds, whatever the command prints', async () => {
    const taken = await findFreePort(42300);
    await serveIn(temp(), taken);
    const liar = `node -e "console.log('http://localhost:${taken}');setInterval(()=>{},1000)"`;
    await expect(
      ensureApp({
        root: temp(),
        command: liar,
        log: () => {},
        timeoutMs: 3000,
      }),
    ).rejects.toThrow(/didn't say which port/);
  });

  it('says it moved, and why, when another project holds the port', async () => {
    const theirs = temp();
    const port = await findFreePort(42400);
    await serveIn(theirs, port);
    const app = await ensureApp({
      root: temp(),
      command: HTTP('process.env.PORT'),
      port,
      log: () => {},
      timeoutMs: 15_000,
    });
    expect(app.moved).toBe(true);
    expect(app.port).not.toBe(port);
    expect(app.note).toContain(theirs);
    await app.stop();
  });

  it('reuses this project’s server when the command says one is already running', async () => {
    const root = temp();
    const port = await findFreePort(42500);
    await serveIn(root, port);
    // What Next prints and does when its lock is held.
    const other = await findFreePort(port + 1);
    const already = `node -e "console.log('Another next dev server is already running at http://localhost:${port}');process.exit(1)"`;
    const app = await ensureApp({
      root,
      command: already,
      port: other,
      log: () => {},
      timeoutMs: 15_000,
    });
    expect(app.port).toBe(port);
    expect(app.startedByTruing).toBe(false);
  });

  it('can be stopped twice: a process ended by a signal has no exit code', async () => {
    const port = await findFreePort(42600);
    const app = await ensureApp({
      root: temp(),
      command: HTTP(port),
      log: () => {},
      timeoutMs: 15_000,
    });
    await app.stop();
    await app.stop();
  });

  it('reports a command killed by a signal at once, not at the timeout', async () => {
    const started = Date.now();
    await expect(
      ensureApp({
        root: temp(),
        command: 'kill -9 $$',
        log: () => {},
        timeoutMs: 4000,
      }),
    ).rejects.toThrow(/stopped/);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('says so when a command never answers, with what it printed', async () => {
    await expect(
      ensureApp({
        root: temp(),
        command: `node -e "console.log('still compiling');setInterval(()=>{},1000)"`,
        log: () => {},
        timeoutMs: 1500,
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining("didn't say which port"),
      output: ['still compiling'],
    });
  });
});

describe('Truing’s own port', () => {
  it('asks the system for one', async () => {
    expect(await systemPort()).toBeGreaterThan(0);
  });

  it('has no port written into the code', () => {
    for (const file of [
      'src/config.ts',
      'src/truing.ts',
      'src/setup/server.ts',
    ]) {
      const source = readFileSync(path.join(packageRoot, file), 'utf8');
      expect(source).not.toMatch(/\b(4090|4100)\b/);
    }
  });
});

describe('Truing’s own browser', () => {
  const browserAt = (complete: boolean): string => {
    const dir = path.join(temp(), 'chromium-1234');
    mkdirSync(path.join(dir, 'chrome-linux'), { recursive: true });
    const executable = path.join(dir, 'chrome-linux/chrome');
    writeFileSync(executable, '');
    if (complete) writeFileSync(path.join(dir, 'INSTALLATION_COMPLETE'), '');
    return executable;
  };

  it('trusts a finished install', () => {
    expect(browserIsComplete(browserAt(true))).toBe(true);
  });

  it('doesn’t trust one a failed download left half done', () => {
    expect(browserIsComplete(browserAt(false))).toBe(false);
  });

  it('doesn’t trust one that isn’t there', () => {
    expect(browserIsComplete('/no/such/chrome')).toBe(false);
  });
});

describe('truing doctor', () => {
  const fine: Connection = {
    installed: { ok: true, detail: '2.0.0' },
    signedIn: { ok: true, detail: 'Claude Pro plan' },
    responds: { ok: true, detail: 'Answered in 1.0 s' },
    ok: true,
    problem: null,
    command: null,
  };
  const options = (overrides = {}) => ({
    connection: fine,
    browserReady: true,
    node: 'v24.0.0',
    env: { TRUING_HOME: temp() },
    ...overrides,
  });

  it('prints every check, and names what fixes a failure', async () => {
    const { lines, code } = await doctorReport(temp(), options());
    const text = lines.join('\n');
    for (const label of [
      'Node.js',
      'Browser',
      'Claude Code',
      'Signed in',
      'Answers',
      'Project',
    ]) {
      expect(text).toContain(label);
    }
    expect(text).toMatch(/Project.*Run: truing/);
    expect(code).toBe(1);
  });

  it('names the fix for a missing browser and an old Node', async () => {
    const { lines } = await doctorReport(
      temp(),
      options({ browserReady: false, node: 'v18.0.0' }),
    );
    const text = lines.join('\n');
    expect(text).toMatch(/Browser.*Run: truing/);
    expect(text).toMatch(/Node\.js.*20\.19/);
  });

  it('checks the saved project’s port, and who holds it', async () => {
    const env = { TRUING_HOME: temp() };
    const root = temp();
    const port = await findFreePort(42900);
    saveProfile(
      {
        root,
        framework: { name: 'Next.js', version: null },
        evidence: {},
        config: draftToConfig(checkReading(root, reading({ port }))),
      },
      env,
    );
    const { lines, code } = await doctorReport(root, options({ env }));
    const text = lines.join('\n');
    expect(text).toContain('pnpm dev');
    expect(text).toMatch(new RegExp(`Port.*${port}.*free`, 'i'));
    expect(code).toBe(0);
  });

  it('doesn’t run a config file nobody has confirmed', async () => {
    const root = temp();
    writeFileSync(
      path.join(root, 'truing.config.ts'),
      `throw new Error('ran');\n`,
    );
    const { lines } = await doctorReport(root, options());
    expect(lines.join('\n')).toMatch(/isn't confirmed/);
  });
});

describe('truing tokens', () => {
  it('with no tokens on record, says so and doesn’t fail', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', path.join(packageRoot, 'src/cli.ts'), 'tokens'],
      {
        cwd: packageRoot,
        env: { ...process.env, INIT_CWD: temp(), TRUING_HOME: temp() },
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No tokens found');
  });

  it('prints each token and where it came from, and writes nothing', async () => {
    const cache = path.join(packageRoot, 'node_modules/.cache/truing');
    const text = await tokensReport(
      packageRoot,
      'test/fixtures/tokens/tokens.css',
    );
    expect(text).toMatch(/--color-primary/);
    expect(text).toMatch(/test\/fixtures\/tokens\/tokens\.css:\d+/);
    expect(existsSync(path.join(cache, 'tokens.json'))).toBe(false);
  });
});

describe('a staged shadow', () => {
  it('counts as a shadow while it is still a token’s variable', () => {
    expect(outerShadow('var(--shadow-floating-card)')).toBe(
      'var(--shadow-floating-card)',
    );
  });
});
