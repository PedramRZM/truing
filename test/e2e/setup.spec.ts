// The setup screens against a fake `claude` on PATH: connect, choose, read,
// answer, review, start. test/fixtures/fake-claude says which state it plays.
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { request } from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { type AppHandle, findFreePort } from '../../src/app-process';
import { buildSetup } from '../../src/build';
import { profileFile, saveProfile } from '../../src/setup/profile';
import { type SetupEntry, startSetupServer } from '../../src/setup/server';
import { isConfigTrusted } from '../../src/setup/trust';

import { packageRoot } from './fixtures';

const FAKE = path.join(packageRoot, 'test/fixtures/fake-claude');
const SHOTS = process.env.TRUING_SHOTS;

function project(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fake-shop-'));
  mkdirSync(path.join(root, 'src/ui'), { recursive: true });
  writeFileSync(path.join(root, 'package.json'), '{"name":"fake-shop"}\n');
  return root;
}

type Run = {
  page: Page;
  root: string;
  env: NodeJS.ProcessEnv;
  apps: AppHandle[];
  stop: () => Promise<void>;
};

const runs: Run[] = [];

async function open(
  page: Page,
  scenario: string,
  port: number,
  entry: (root: string, env: NodeJS.ProcessEnv) => SetupEntry = () => ({}),
): Promise<Run> {
  const root = project();
  chmodSync(path.join(FAKE, 'claude'), 0o755);
  const saved = { ...process.env };
  process.env.PATH = `${FAKE}${path.delimiter}${saved.PATH ?? ''}`;
  process.env.FAKE_CLAUDE = scenario;
  process.env.FAKE_PORT = String(port);
  process.env.FAKE_DEV_COMMAND = `node ${path.join(FAKE, 'server.mjs')} ${port}`;
  process.env.FAKE_LOGIN_MARK = path.join(
    mkdtempSync(path.join(os.tmpdir(), 'truing-login-')),
    'signed-in',
  );
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TRUING_HOME: mkdtempSync(path.join(os.tmpdir(), 'truing-home-')),
    CLAUDE_CONFIG_DIR: mkdtempSync(path.join(os.tmpdir(), 'truing-claude-')),
  };
  const server = await startSetupServer({
    from: root,
    assets: await buildSetup(),
    env,
    ...entry(root, env),
  });
  const apps: AppHandle[] = [];
  void server.result.then(({ app }) => apps.push(app));
  await page.goto(server.url);
  const run: Run = {
    page,
    root,
    env,
    apps,
    stop: async () => {
      await Promise.all(apps.map((app) => app.stop()));
      await server.close();
      process.env = saved;
    },
  };
  runs.push(run);
  return run;
}

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

test.afterEach(async () => {
  for (const run of runs.splice(0)) await run.stop();
});

test('all the way through: connect, choose, read, review, start, saved', async ({
  page,
}) => {
  const port = await findFreePort(3190);
  const run = await open(page, 'ok', port);
  const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd: run.root, encoding: 'utf8' });
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'start');

  await expect(
    page.getByRole('heading', { name: 'Connect Claude' }),
  ).toBeVisible();
  await expect(page.getByText('Claude Pro plan')).toBeVisible();
  await expect(page.getByText(/Answered in/)).toBeVisible();
  // Never the email `auth status` prints.
  await expect(page.getByText('never-shown@example.com')).toHaveCount(0);
  await shot(page, '1-connect-ok');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(
    page.getByRole('heading', { name: 'Choose a project' }),
  ).toBeVisible();
  await expect(page.getByText('This folder')).toBeVisible();
  await shot(page, '2-projects');
  await page
    .getByRole('button', { name: new RegExp(path.basename(run.root)) })
    .click();

  await expect(page.getByRole('heading', { name: 'fake-shop' })).toBeVisible();
  await expect(page.getByText('Next.js 16.2.9')).toBeVisible();
  await expect(page.getByLabel('Start command')).toHaveValue(/server\.mjs/);
  await expect(page.getByLabel('Port')).toHaveValue(String(port));
  await shot(page, '3-review');
  // Each value shows, with Claude's reason.
  await expect(page.getByLabel('Framework')).toHaveValue('Next.js');
  for (const reason of [
    'package.json depends on next.',
    'package.json, the dev script.',
    'server.mjs listens on it.',
    'components.json names it.',
    'Server code lives in src/server.',
    'package.json, the typecheck script.',
  ]) {
    await expect(page.getByText(reason)).toBeVisible();
  }
  await expect(
    page.getByLabel('Checks Claude may run without asking'),
  ).toHaveValue('pnpm typecheck');
  await expect(
    page.getByLabel("Variables Claude's sessions don't get"),
  ).toBeVisible();
  // A person's correction wins over Claude's.
  await page.getByLabel('Token stylesheet').fill('');
  await page.getByLabel('Framework').fill('Next');

  await page.getByRole('button', { name: 'Everything Claude found' }).click();
  await expect(page.getByLabel('Components folder')).toHaveValue('src/ui');
  await shot(page, '3-review-open');

  // Nothing ran before the person pressed start.
  expect(existsSync(profileFile(run.root, run.env))).toBe(false);
  await page.getByRole('button', { name: 'Start fake-shop' }).click();

  await expect(
    page.getByRole('heading', { name: 'Opening fake-shop' }),
  ).toBeVisible();
  await shot(page, '4-opening');
  const saved = JSON.parse(
    readFileSync(profileFile(run.root, run.env), 'utf8'),
  ) as {
    config: { app: { port: number }; primitives: string };
  };
  expect(saved.config.app.port).toBe(port);
  expect(saved.config.primitives).toBe('src/ui');
  // Nothing was added to the project.
  expect(existsSync(path.join(run.root, 'truing.config.ts'))).toBe(false);
  expect(git('status', '--porcelain')).toBe('');
});

test("signing in runs Claude Code's own login, and the check runs again by itself", async ({
  page,
}) => {
  await open(page, 'sign-in-works', 3189);
  await expect(
    page.getByText("You're not signed in to Claude Code yet."),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  await expect(page.getByText('Claude Pro plan')).toBeVisible();
});

test('a login that fails says so, and offers to try again', async ({
  page,
}) => {
  await open(page, 'sign-in-fails', 3189);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByText("Sign-in didn't finish. You can try again."),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
});

test('browsing to a folder that is no project says so, and lets you go on', async ({
  page,
}) => {
  const run = await open(page, 'ok', 3189);
  const plain = mkdtempSync(path.join(os.tmpdir(), 'just-a-folder-'));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Browse folders' }).click();
  await page.getByLabel('Folder').fill(plain);
  await page.getByLabel('Folder').press('Enter');
  await expect(
    page.getByText('This folder has no package.json or git repository.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Use this folder' }).click();
  await expect(page.getByLabel('Start command')).toBeVisible();
  expect(run.root).not.toBe(plain);
});

test("which app it is gets read again; the answer isn't lost on the way", async ({
  page,
}) => {
  const run = await open(page, 'monorepo', 3189);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByRole('button', { name: new RegExp(path.basename(run.root)) })
    .click();
  await page.getByRole('button', { name: 'apps/web' }).click();
  await expect(page.getByRole('heading', { name: 'web' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Claude needs your answer' }),
  ).toHaveCount(0);
});

test('an answer in the wrong shape is asked for once more, then reported', async ({
  page,
}) => {
  const run = await open(page, 'bad-shape', 3189);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByRole('button', { name: new RegExp(path.basename(run.root)) })
    .click();
  await expect(
    page.getByRole('heading', { name: /Couldn't read/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Claude's answer wasn't in the shape Truing expected."),
  ).toBeVisible();
});

test('--reconfigure goes straight to reading, then back through the review', async ({
  page,
}) => {
  const run = await open(page, 'ok', 3189, (root) => ({ reconfigure: root }));
  await expect(page.getByRole('heading', { name: 'fake-shop' })).toBeVisible();
  await expect(page.getByLabel('Start command')).toBeVisible();
  expect(existsSync(profileFile(run.root, run.env))).toBe(false);
});

test("a config file is shown and confirmed before it's run", async ({
  page,
}) => {
  const port = await findFreePort(3197);
  const marker = path.join(
    mkdtempSync(path.join(os.tmpdir(), 'truing-ran-')),
    'ran',
  );
  const command = `node ${path.join(FAKE, 'server.mjs')} ${port}`;
  const file = `import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(marker)}, '');
export default {
  name: 'from-file',
  app: { devCommand: ${JSON.stringify(command)}, port: ${port} },
  writable: { include: ['src/**'], exclude: [] },
};
`;
  const run = await open(page, 'ok', port, (root) => {
    writeFileSync(path.join(root, 'truing.config.ts'), file);
    return { confirm: root };
  });

  await expect(
    page.getByRole('heading', { name: "Check this project's settings" }),
  ).toBeVisible();
  await expect(page.getByLabel('truing.config.ts')).toContainText('from-file');
  await shot(page, '3-confirm');
  // Showing it didn't run it.
  expect(existsSync(marker)).toBe(false);
  expect(isConfigTrusted(run.root, run.env)).toBe(false);

  await page.getByRole('button', { name: 'Run this file and start' }).click();
  await expect(page.getByRole('heading', { name: /^Opening/ })).toBeVisible();
  expect(existsSync(marker)).toBe(true);
  expect(isConfigTrusted(run.root, run.env)).toBe(true);
  // The file holds the settings, so nothing is saved beside it.
  expect(existsSync(profileFile(run.root, run.env))).toBe(false);
});

test("a file that changes after it's shown isn't run", async ({ page }) => {
  const port = await findFreePort(3201);
  const marker = path.join(
    mkdtempSync(path.join(os.tmpdir(), 'truing-ran-')),
    'ran',
  );
  const run = await open(page, 'ok', port, (root) => {
    writeFileSync(
      path.join(root, 'truing.config.ts'),
      `export default { name: 'shown' };\n`,
    );
    return { confirm: root };
  });
  await expect(page.getByLabel('truing.config.ts')).toContainText('shown');

  // As a `git pull` would, with the window open.
  writeFileSync(
    path.join(run.root, 'truing.config.ts'),
    `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)}, '');\nexport default {};\n`,
  );
  await page.getByRole('button', { name: 'Run this file and start' }).click();

  await expect(
    page.getByText(/This file changed after it was shown/),
  ).toBeVisible();
  expect(existsSync(marker)).toBe(false);
  expect(isConfigTrusted(run.root, run.env)).toBe(false);
});

test("reading a project doesn't run its Tailwind", async ({ page }) => {
  const mark = path.join(
    mkdtempSync(path.join(os.tmpdir(), 'truing-ran-')),
    'ran',
  );
  const run = await open(page, 'with-tokens', 3189, (root) => {
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
    writeFileSync(path.join(root, 'tokens.css'), '@import "tailwindcss";\n');
    return {};
  });
  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByRole('button', { name: new RegExp(path.basename(run.root)) })
    .click();
  await expect(page.getByLabel('Token stylesheet')).toHaveValue('tokens.css');
  expect(existsSync(mark)).toBe(false);
});

test('a saved start command that fails comes back to the review, to correct it', async ({
  page,
}) => {
  const port = await findFreePort(3198);
  const working = `node ${path.join(FAKE, 'server.mjs')} ${port}`;
  const run = await open(page, 'ok', port, (root, env) => {
    saveProfile(
      {
        root,
        framework: { name: 'Next.js', version: null },
        evidence: { devCommand: 'package.json, the dev script.' },
        config: {
          name: 'saved-shop',
          app: { devCommand: 'exit 4', port },
          writable: { include: ['src/**'], exclude: [] },
        },
      },
      env,
    );
    return {
      review: { root, problem: 'The start command stopped with code 4.' },
    };
  });

  await expect(page.getByRole('alert')).toContainText(
    'The start command stopped with code 4.',
  );
  await expect(page.getByLabel('Start command')).toHaveValue('exit 4');
  await page.getByLabel('Start command').fill(working);
  await page.getByRole('button', { name: 'Start saved-shop' }).click();
  await expect(
    page.getByRole('heading', { name: 'Opening saved-shop' }),
  ).toBeVisible();
  const saved = JSON.parse(
    readFileSync(profileFile(run.root, run.env), 'utf8'),
  ) as { config: { app: { devCommand: string } } };
  expect(saved.config.app.devCommand).toBe(working);
});

test('with no port known, Truing finds it and keeps it', async ({ page }) => {
  const port = await findFreePort(3199);
  const run = await open(page, 'no-port', port);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByRole('button', { name: new RegExp(path.basename(run.root)) })
    .click();
  await expect(page.getByLabel('Port')).toHaveValue('');
  await expect(
    page.getByText('Not known yet. Truing finds it when the app starts.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start fake-shop' }).click();
  await expect(
    page.getByRole('heading', { name: 'Opening fake-shop' }),
  ).toBeVisible();
  await expect(page.getByText(`It answered on port ${port}.`)).toBeVisible();
  const saved = JSON.parse(
    readFileSync(profileFile(run.root, run.env), 'utf8'),
  ) as { config: { app: { port?: number } } };
  expect(saved.config.app.port).toBe(port);
});

test("signed out: says so, offers Claude Code's own sign-in, and no form of ours", async ({
  page,
}) => {
  await open(page, 'signed-out', 3189);

  await expect(
    page.getByText("You're not signed in to Claude Code yet."),
  ).toBeVisible();
  await expect(page.getByText('claude auth login')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
  await shot(page, '1-connect-signed-out');
});

test('an expired sign-in fails the real round trip, not just the status', async ({
  page,
}) => {
  await open(page, 'expired', 3189);
  await expect(
    page.getByText('Your Claude sign-in has expired.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Check again' })).toBeVisible();
});

test("asks when Claude can't tell, and needs only the start command", async ({
  page,
}) => {
  const port = await findFreePort(3195);
  const run = await open(page, 'questions', port);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByRole('button', { name: new RegExp(path.basename(run.root)) })
    .click();

  await expect(
    page.getByRole('heading', { name: 'Claude needs your answer' }),
  ).toBeVisible();
  await shot(page, '3-review-questions');
  const start = page.getByRole('button', { name: 'Start fake-shop' });
  await expect(start).toBeDisabled();

  await page.getByRole('button', { name: 'node server.mjs' }).click();
  await expect(page.getByLabel('Start command')).toHaveValue('node server.mjs');
  await expect(start).toBeEnabled();
  await expect(
    page.getByRole('heading', { name: 'Claude needs your answer' }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Port')).toHaveValue('');
});

test('a value that fails against the folder is dropped, with the reason', async ({
  page,
}) => {
  const run = await open(page, 'bad-values', 3189);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByRole('button', { name: new RegExp(path.basename(run.root)) })
    .click();

  // Port 99999 isn't a port, so it's unknown, and that's said plainly.
  await expect(page.getByLabel('Port')).toHaveValue('');
  await expect(
    page.getByText("Claude said 99999, which isn't a port."),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Everything Claude found' }).click();
  await expect(page.getByLabel('Components folder')).toHaveValue('');
  await expect(page.getByLabel('Token stylesheet')).toHaveValue('');
  await expect(
    page.getByText(/src\/not-here, but there's no such path/),
  ).toBeVisible();
});

test('a failed read says what happened and offers a way on', async ({
  page,
}) => {
  const run = await open(page, 'read-error', 3189);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByRole('button', { name: new RegExp(path.basename(run.root)) })
    .click();

  await expect(
    page.getByRole('heading', { name: /Couldn't read/ }),
  ).toBeVisible();
  await expect(page.getByText('Claude hit a limit.')).toBeVisible();
  await shot(page, '2-read-error');
  await page.getByRole('button', { name: 'Fill it in myself' }).click();
  await expect(page.getByLabel('Start command')).toHaveValue('');
});

test('a start command that fails shows its output and lets you change it', async ({
  page,
}) => {
  const port = await findFreePort(3196);
  const run = await open(page, 'ok', port);
  process.env.FAKE_DEV_COMMAND = 'x';
  await page.getByRole('button', { name: 'Continue' }).click();
  await page
    .getByRole('button', { name: new RegExp(path.basename(run.root)) })
    .click();

  await page
    .getByLabel('Start command')
    .fill('node -e "console.log(\'broken\'); process.exit(3)"');
  await page.getByRole('button', { name: 'Start fake-shop' }).click();

  await expect(
    page.getByRole('heading', { name: "fake-shop didn't start" }),
  ).toBeVisible();
  await expect(
    page.getByText('The start command stopped with code 3.'),
  ).toBeVisible();
  await expect(
    page.getByRole('list', { name: 'What the app printed' }),
  ).toContainText('broken');
  await shot(page, '4-failed');
  await page.getByRole('button', { name: 'Change settings' }).click();
  await expect(page.getByLabel('Start command')).toBeVisible();
});

test('the server refuses a call with no token and a foreign Host', async ({
  page,
}) => {
  await open(page, 'ok', 3189);
  const status = await page.evaluate(async () => {
    const response = await fetch('/api/projects', { method: 'POST' });
    return response.status;
  });
  expect(status).toBe(403);
  const { port } = new URL(page.url());
  const foreign = await new Promise<number | undefined>((resolve) => {
    request(
      {
        host: '127.0.0.1',
        port,
        path: '/',
        headers: { host: 'attacker.example' },
      },
      (response) => resolve(response.statusCode),
    ).end();
  });
  expect(foreign).toBe(403);
});
