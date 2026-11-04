// Records the README's demo from a real run (TRU-7.6): `truing` on a small app nobody
// prepared, the review screen, a pick, a change, and the change landing in source. The
// app is built in a temp folder, so no private project shows. It spends a little of
// the person's usage, as Claude reads the app for real. Needs ffmpeg.
// `pnpm exec tsx scripts/record-demo.ts`, which writes docs/assets/demo.gif
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { chromium, type Page } from 'playwright';

import { buildSetup } from '../src/build';
import { startSetupServer } from '../src/setup/server';
import { startTruing } from '../src/truing';

const SIZE = { width: 1280, height: 800 };
const OUT = path.resolve('docs/assets/demo.gif');

function write(root: string, files: Record<string, string>): void {
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), text);
  }
}

/** A small pricing page on Next and Tailwind v4, with tokens and a git history. */
function demoApp(): string {
  const root = path.join(
    mkdtempSync(path.join(tmpdir(), 'truing-demo-')),
    'shop',
  );
  mkdirSync(root);
  write(root, {
    'package.json': JSON.stringify(
      {
        name: 'shop',
        private: true,
        scripts: { dev: 'next dev -p 3985' },
        dependencies: {
          next: '16.2.9',
          react: '19.2.7',
          'react-dom': '19.2.7',
          tailwindcss: '4.3.3',
          '@tailwindcss/postcss': '4.3.3',
          // Next installs these itself otherwise, which would show in the diff.
          typescript: '5.9.3',
          '@types/react': '19.2.7',
          '@types/node': '24.10.1',
        },
      },
      null,
      2,
    ),
    '.gitignore': 'node_modules\n.next\nnext-env.d.ts\n',
    'pnpm-workspace.yaml': 'packages: []\n',
    'postcss.config.mjs':
      "export default { plugins: { '@tailwindcss/postcss': {} } };\n",
    'app/globals.css': `@import 'tailwindcss';

@theme {
  --color-brand: #3b5bdb;
  --color-ink: #1c1f2b;
  --color-paper: #f7f7fb;
  --radius-card: 16px;
}
`,
    'app/layout.tsx': `import './globals.css';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-paper text-ink">{children}</body>
    </html>
  );
}
`,
    'app/page.tsx': `const PLANS = [
  { name: 'Starter', price: '$0', note: 'For trying it out' },
  { name: 'Studio', price: '$24', note: 'For a small team' },
];

export default function Pricing() {
  return (
    <main className="mx-auto max-w-3xl p-12">
      <h1 className="text-4xl font-semibold">Simple pricing</h1>
      <p className="mt-2 text-lg opacity-70">Start free. Upgrade when you ship.</p>
      <section className="mt-8 grid grid-cols-2 gap-4">
        {PLANS.map((plan) => (
          <article key={plan.name} className="rounded-card bg-white p-4 shadow-sm">
            <h2 className="font-medium">{plan.name}</h2>
            <p className="mt-2 text-3xl font-semibold">{plan.price}</p>
            <p className="mt-1 opacity-70">{plan.note}</p>
          </article>
        ))}
      </section>
      <button className="mt-8 rounded-card bg-brand px-4 py-2 text-white">
        Start your trial
      </button>
    </main>
  );
}
`,
  });
  execFileSync('pnpm', ['install', '--ignore-workspace'], {
    cwd: root,
    stdio: 'ignore',
  });
  for (const args of [
    ['init', '-q'],
    ['add', '.'],
    [
      '-c',
      'user.name=demo',
      '-c',
      'user.email=demo@example.com',
      'commit',
      '-qm',
      'First',
    ],
  ]) {
    execFileSync('git', args, { cwd: root });
  }
  return root;
}

/** Keeps taking pictures of whichever page is showing, each with how long it held. */
function recorder(folder: string) {
  const showing: { page: Page | null } = { page: null };
  let rolling = true;
  let count = 0;
  let last = Date.now();
  const list: string[] = [];
  const loop = (async () => {
    while (rolling) {
      const current = showing.page;
      if (!current) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }
      const name = `${String(count).padStart(5, '0')}.png`;
      const shot = await current
        .screenshot({ path: path.join(folder, name) })
        .catch(() => null);
      if (!shot) continue;
      const now = Date.now();
      list.push(`file '${name}'\nduration ${(now - last) / 1000}`);
      last = now;
      count += 1;
    }
  })();
  return {
    show(next: Page | null): void {
      showing.page = next;
      // A pause leaves nothing behind: the next frame starts from here.
      last = Date.now();
    },
    async stop(): Promise<string[]> {
      rolling = false;
      await loop;
      return list;
    },
  };
}

const hold = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const card = (
  body: string,
) => `<!doctype html><body style="margin:0;background:#16181f;color:#e6e8ef;
  font:20px/1.6 ui-monospace,Menlo,monospace;height:100vh;display:flex;align-items:center;justify-content:center">
  <div style="max-width:1120px;white-space:pre-wrap">${body}</div>`;

function escaped(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
}

function diffCard(diff: string): string {
  const lines = diff
    .split('\n')
    .filter((line) => /^[-+]/.test(line) || line.startsWith('@@'))
    .map((line) => {
      const colour = line.startsWith('+')
        ? '#7ee2a8'
        : line.startsWith('-')
          ? '#ff9c9c'
          : '#8d93a6';
      return `<span style="color:${colour}">${escaped(line.trim().length > 92 ? `${line.slice(0, 92)}…` : line)}</span>`;
    })
    .join('\n');
  return card(`<span style="color:#8d93a6">$ git diff</span>\n${lines}`);
}

const frames = mkdtempSync(path.join(tmpdir(), 'truing-demo-frames-'));
const root = demoApp();
const home = mkdtempSync(path.join(tmpdir(), 'truing-demo-home-'));
const env = { ...process.env, TRUING_HOME: home };
const film = recorder(frames);

const server = await startSetupServer({
  from: root,
  assets: await buildSetup(),
  env,
  log: () => {},
});
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: SIZE, colorScheme: 'light' });

await page.setContent(
  card(`<span style="color:#8d93a6">~/shop $</span> npx truing-cli`),
);
film.show(page);
await hold(1800);

await page.goto(server.url);
await page.getByRole('button', { name: 'Continue' }).click({ timeout: 60_000 });
await page.getByRole('button', { name: /shop/ }).first().click();
await hold(2500);
// The read takes a minute, and nobody needs to watch all of it.
film.show(null);
await page
  .getByLabel('Start command')
  .waitFor({ state: 'visible', timeout: 300_000 });
film.show(page);
await hold(3500);
await page.getByRole('button', { name: /^Start / }).click();
await hold(800);
film.show(null);
const started = await server.result;

const truing = await startTruing({
  root: started.root,
  config: started.config,
  app: started.app,
  headless: true,
  profileDir: mkdtempSync(path.join(tmpdir(), 'truing-demo-profile-')),
  log: () => {},
});
await truing.context.addInitScript(() =>
  localStorage.setItem('truing:changes-open', 'open'),
);
const { shell } = truing;
await shell.setViewportSize(SIZE);
await shell.goto(`${truing.session.shellOrigin}/?route=/`);
await shell
  .getByRole('status', { name: /frame at .*, connected$/ })
  .first()
  .waitFor({ timeout: 180_000 });
await hold(3000);
const app = shell.frameLocator('iframe').first();
await app.getByRole('heading', { name: 'Simple pricing' }).waitFor();
await hold(1500);
film.show(shell);
await hold(1200);

await shell
  .getByRole('toolbar', { name: 'Truing' })
  .getByRole('button', { name: 'Select', exact: true })
  .click();
await hold(700);
// With the real mouse: the frame is scaled on the canvas, and a locator's own click
// doesn't allow for that.
const inFrame = await app.getByText('Start your trial').evaluate((el) => {
  const box = el.getBoundingClientRect();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
});
const onCanvas = await shell.locator('iframe').first().boundingBox();
if (!onCanvas) throw new Error('No frame on the canvas.');
const scale = onCanvas.width / 1440;
await shell.mouse.move(
  onCanvas.x + inFrame.x * scale,
  onCanvas.y + inFrame.y * scale,
  { steps: 12 },
);
await hold(500);
await shell.mouse.down();
await shell.mouse.up();
await shell
  .getByRole('region', { name: 'Selection' })
  .getByText('page.tsx', { exact: false })
  .first()
  .waitFor({ state: 'attached' });
await hold(2200);

const text = shell
  .getByRole('region', { name: 'Selection' })
  .getByRole('textbox', { name: 'Text' });
await text.click();
await text.fill('Start for free');
await text.press('Enter');
await hold(2000);

const padding = shell.getByRole('spinbutton', { name: /^Padding/ }).first();
await padding.click();
await padding.fill('24');
await padding.press('Enter');
await hold(2500);

await shell
  .getByRole('region', { name: 'Changes' })
  .getByRole('button', { name: 'Apply' })
  .click();
await shell.getByText(/^Applied \d+ changes?\.$/).waitFor({ timeout: 30_000 });
await hold(3000);

const diff = execFileSync('git', ['diff', '-U0', '--', 'app'], {
  cwd: root,
  encoding: 'utf8',
});
if (!diff.includes('Start for free')) {
  throw new Error(`The change didn't reach the source:\n${diff}`);
}
await page.setContent(diffCard(diff));
film.show(page);
await hold(4500);

const list = await film.stop();
await truing.close();
await started.app.stop();
await browser.close();
await server.close();

const listing = path.join(frames, 'frames.txt');
writeFileSync(listing, `${list.join('\n')}\n`);
mkdirSync(path.dirname(OUT), { recursive: true });
execFileSync(
  'ffmpeg',
  [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listing,
    '-vf',
    'fps=8,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
    OUT,
  ],
  { stdio: 'inherit' },
);
console.log(`${readdirSync(frames).length - 1} frames, written to ${OUT}`);
console.log(diff);
rmSync(frames, { recursive: true, force: true });
process.exit(0);
