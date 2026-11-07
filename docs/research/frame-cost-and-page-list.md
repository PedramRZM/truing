---
title: 'What many frames of the app cost, and where a page list comes from'
date: 2026-11-07
status: concluded
question: "How many frames of a real app can the canvas hold, what happens to them on a hot reload and off screen, and where does a list of the app's pages come from with no setup?"
method: "Measured on one machine (Linux, 8 cores, 16 GB) against the real app: Next 16.2.9 with Turbopack, 195 App Router routes, signed out. Truing's own browser build (Playwright 1.59.1, channel chromium, headless). Scripts in the appendix."
revisit_by: 2027-02-07
outcome: 'TRU-14.2 (cap, off-screen policy, follow groups), TRU-14.3 (page source)'
---

# What many frames of the app cost, and where a page list comes from

## Answer

- **Frames are cheap after the first.** Frames of one app share one renderer process, so the first frame costs 170 to 216 MB and each further one 30 to 60 MB. Twelve frames of a heavy page added 623 MB and loaded in 5.8 s; idle CPU stayed at 0 to 1% of a core.
- **Cap: 12 frames, as a default with no setting.** Reaching it says so and offers to close one. Airship caps at 8; our numbers allow more, but signed-in screens were not measured (below).
- **Off screen: keep frames loaded.** Unloading a frame loses its state (scroll, form input, the signed-in page it reached) and buys back only 30 to 60 MB. Revisit if signed-in screens measure far heavier.
- **Hot reload: no problem.** One save refreshed 1, 4 and 8 frames alike, every one within 0.4 s.
- **Page list on Next: `get_routes` over the dev server''s `/_next/mcp`.** No setup. It returns every App Router route, but mixes in route handlers and files, so Truing filters them out (below). Other frameworks: Claude reads the routes into the profile at setup (not measured here; TRU-14.3 checks it).
- **Follow groups replace the single leader.** Frames on different routes cannot all follow one leader; a frame follows only its own group (TRU-14.2).

## Findings

All facts below are measurements from the appendix scripts on 2026-11-07 (primary).

**Memory and load, signed out** (the browser''s whole process tree, proportional set size, against an empty page in a fresh browser for each row):

| Frames | Light page (load, memory, a frame) | Heavy page (load, memory, a frame) |
| ------ | ---------------------------------- | ---------------------------------- |
| 1      | 0.6 s, +170 MB, 170 MB             | 0.8 s, +216 MB, 216 MB             |
| 4      | 1.6 s, +284 MB, 71 MB              | 2.0 s, +322 MB, 81 MB              |
| 8      | 3.0 s, +301 MB, 38 MB              | 3.9 s, +465 MB, 58 MB              |
| 12     | not run                            | 5.8 s, +623 MB, 52 MB              |

Idle CPU over 10 s was 0% of a core in every row but heavy x8 (1%). The light page is a short confirmation page (89 KB of HTML), the heavy one a search page (162 KB).

**Hot reload** (a comment appended to the light page''s source file, then the exact bytes put back): every frame logged `[Fast Refresh] done` and navigated in place; the first and last frame finished 383 ms (x1), 390 to 391 ms (x4) and 371 to 374 ms (x8) after the save.

**Page list.** `tools/call get_routes` on `/_next/mcp` returned 195 `appRouter` entries: 133 route handlers under `/api`, 67 with a `[parameter]`, and files such as `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest` and `/.well-known/...`. Route groups such as `(main)` are already left out. Of 39 static, non-API entries fetched signed out, 16 answered 200, 21 redirected (sign-in or a role check), one 404 and one 500.

**Off screen.** Not measured as a separate experiment: an iframe removed from the page loses its document, so bringing it back is a fresh load (the load column above), and its state is gone.

## Claims ledger

| #   | Claim                                                       | Source                                      | Verifier verdict |
| --- | ----------------------------------------------------------- | ------------------------------------------- | ---------------- |
| 1   | Further frames of one app cost 30 to 60 MB each             | `frame-cost.mts` (appendix), table above    | not verified     |
| 2   | 12 heavy frames: +623 MB, 5.8 s                             | `COUNTS=12 frame-cost.mts`                  | not verified     |
| 3   | One save refreshes every frame within 0.4 s                 | `hmr-cost.mts` (appendix)                   | not verified     |
| 4   | `get_routes` lists route handlers and files with the pages  | curl to `/_next/mcp`, counts above          | not verified     |
| 5   | Airship caps frames at 8 and loads only those near the view | `menus-spacing-frames-takes.md` (secondary) | not verified     |

## Options and trade-offs

- **Cap 8 (Airship) or 12.** 12 heavy frames stayed under 1 GB with idle CPU near zero; 12 lets Phone, Tablet and Desktop of four routes sit side by side. Chosen: 12.
- **Unload off screen, or keep.** Unloading saves 30 to 60 MB a frame and costs state and a reload when the person scrolls back. Chosen: keep.
- **Page list from Next, or always from Claude.** Next''s list is exact, free and current; Claude''s read costs a run and goes stale. Chosen: Next where it answers, Claude''s read otherwise.

Filtering `get_routes` for a page list: drop entries under `/api/`, entries with a file extension, and `/.well-known/`. A route with a parameter asks for its value or offers values already visited.

## Open questions and unverified claims

- **Signed-in screens were not measured.** The heavy signed-in screens (TRU-10.1) may cost more per frame. TRU-14.2 should log memory with the frame count and revisit the cap if a frame passes 150 MB.
- **One machine only.** The task asked for two.
- **Projects that are not Next.** What Claude finds when asked for the routes, and how often it is right, needs real Claude runs (`pnpm check-claude`); left to TRU-14.3.
- **Whether frames on different routes break the pick restore (TRU-2.1)** is checked in TRU-14.2, where it first applies.

## Appendix: the scripts

Run from the Truing checkout with the app''s dev server up: `pnpm exec tsx frame-cost.mts http://localhost:3000 <light page> <heavy page>`, and `pnpm exec tsx hmr-cost.mts http://localhost:3000 <page> <its page file>`.

```ts
// TRU-14.1: what 1, 4 and 8 frames of a route cost, measured on the browser's
// whole process tree. Usage: tsx .scratch/frame-cost.mts <origin> <route>...
import { readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';

import { chromium } from 'playwright';

const [origin = 'http://localhost:3000', ...routes] = process.argv.slice(2);
const TICK = 100; // USER_HZ on Linux
const PAGE = Number(
  readFileSync('/proc/self/status', 'utf8').length ? 4096 : 4096,
);

function children(): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const stat = readFileSync(`/proc/${name}/stat`, 'utf8');
      const ppid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
      map.set(ppid, [...(map.get(ppid) ?? []), Number(name)]);
    } catch {}
  }
  return map;
}
function tree(root: number): number[] {
  const map = children();
  const out = [root];
  for (let i = 0; i < out.length; i++)
    out.push(...(map.get(out[i] ?? 0) ?? []));
  return out;
}
/** Proportional set size: shared pages counted once across the tree. */
function pssMb(pids: number[]): number {
  let kb = 0;
  for (const pid of pids) {
    try {
      const rollup = readFileSync(`/proc/${pid}/smaps_rollup`, 'utf8');
      kb += Number(/^Pss:\s+(\d+)/m.exec(rollup)?.[1] ?? 0);
    } catch {}
  }
  return Math.round(kb / 1024);
}
function cpuTicks(pids: number[]): number {
  let ticks = 0;
  for (const pid of pids) {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      ticks += Number(fields[11]) + Number(fields[12]);
    } catch {}
  }
  return ticks;
}
void PAGE;

const host = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://x');
  const n = Number(url.searchParams.get('n') ?? 1);
  const route = url.searchParams.get('route') ?? '/';
  const frames = Array.from(
    { length: n },
    (_, i) =>
      `<iframe name="f${i}" src="${origin}${route}" width="1440" height="900" style="position:absolute;left:${i * 1480}px;top:0;border:0"></iframe>`,
  ).join('');
  response.setHeader('content-type', 'text/html');
  response.end(`<!doctype html><body style="margin:0">${frames}</body>`);
});
await new Promise<void>((r) => host.listen(0, r));
const hostPort = (host.address() as { port: number }).port;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const free = () =>
  Math.round(
    Number(
      /^MemAvailable:\s+(\d+)/m.exec(
        readFileSync('/proc/meminfo', 'utf8'),
      )?.[1] ?? 0,
    ) / 1024,
  );
console.log(`machine: ${free()} MB available`);

for (const route of routes) {
  for (const n of (process.env.COUNTS ?? '1,4,8').split(',').map(Number)) {
    // A fresh browser each time, measured against itself on an empty page.
    const server = await chromium.launchServer({
      channel: 'chromium',
      headless: true,
    });
    const browserPid = server.process().pid ?? 0;
    const browser = await chromium.connect(server.wsEndpoint());
    let crashed = '';
    browser.on('disconnected', () => (crashed ||= 'browser gone'));
    try {
      const page = await browser.newPage({
        viewport: { width: 1600, height: 1000 },
      });
      page.on('crash', () => (crashed ||= 'page crashed'));
      await page.goto(`http://localhost:${hostPort}/?n=0`);
      await wait(2000);
      const empty = pssMb(tree(browserPid));
      const started = Date.now();
      await page.goto(
        `http://localhost:${hostPort}/?n=${n}&route=${encodeURIComponent(route)}`,
      );
      const frames = () => page.frames().filter((f) => f !== page.mainFrame());
      for (let i = 0; i < 60 && frames().length < n; i++) await wait(250);
      await Promise.all(
        frames().map((f) => f.waitForLoadState('load', { timeout: 180_000 })),
      );
      const loaded = Date.now() - started;
      await page
        .waitForLoadState('networkidle', { timeout: 30_000 })
        .catch(() => {});
      await wait(5000);
      const pids = tree(browserPid);
      const memory = pssMb(pids) - empty;
      const before = cpuTicks(pids);
      await wait(10_000);
      const idle = ((cpuTicks(tree(browserPid)) - before) / TICK / 10) * 100;
      console.log(
        `${route} x${n}: all loaded in ${(loaded / 1000).toFixed(1)} s, +${memory} MB (${Math.round(memory / n)} MB a frame), idle ${idle.toFixed(0)}% of a core, machine ${free()} MB free${crashed ? `, ${crashed}` : ''}`,
      );
    } catch (error) {
      console.log(
        `${route} x${n}: failed (${crashed || (error as Error).message.split('\n')[0]}), machine ${free()} MB free`,
      );
    }
    await browser.close().catch(() => {});
    await server.close().catch(() => {});
    await wait(3000);
  }
}
host.close();
process.exit(0);
```

```ts
// TRU-14.1: does one save hot-reload every frame, and how long until all settle?
// Appends a comment to a page file, waits, then puts the exact bytes back.
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';

import { chromium } from 'playwright';

const [origin = '', route = '/', file = ''] = process.argv.slice(2);
const backup = `${file}.truing-spike-backup`;
copyFileSync(file, backup);
const original = readFileSync(file);

const host = createServer((request, response) => {
  const n = Number(
    new URL(request.url ?? '/', 'http://x').searchParams.get('n') ?? 1,
  );
  response.setHeader('content-type', 'text/html');
  response.end(
    `<!doctype html><body style="margin:0">${Array.from({ length: n }, (_, i) => `<iframe src="${origin}${route}" width="1440" height="900" style="position:absolute;left:${i * 1480}px;border:0"></iframe>`).join('')}</body>`,
  );
});
await new Promise<void>((r) => host.listen(0, r));
const hostPort = (host.address() as { port: number }).port;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  for (const n of [1, 4, 8]) {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    });
    const done: number[] = [];
    let saved = 0;
    page.on('console', (message) => {
      if (saved && /\[Fast Refresh\] done/.test(message.text()))
        done.push(Date.now() - saved);
    });
    let reloads = 0;
    page.on('framenavigated', (frame) => {
      if (saved && frame !== page.mainFrame()) reloads += 1;
    });
    await page.goto(`http://localhost:${hostPort}/?n=${n}`);
    const frames = () => page.frames().filter((f) => f !== page.mainFrame());
    for (let i = 0; i < 60 && frames().length < n; i++) await wait(250);
    await Promise.all(
      frames().map((f) => f.waitForLoadState('load', { timeout: 120_000 })),
    );
    await wait(8000);
    saved = Date.now();
    writeFileSync(
      file,
      Buffer.concat([
        original,
        Buffer.from(`\n// truing spike ${n} ${saved}\n`),
      ]),
    );
    for (let i = 0; i < 120 && done.length + reloads < n; i++) await wait(250);
    await wait(3000);
    const sorted = [...done].sort((a, b) => a - b);
    console.log(
      `x${n}: ${done.length} frames refreshed in place, ${reloads} reloaded; first ${sorted[0] ?? '-'} ms, last ${sorted.at(-1) ?? '-'} ms`,
    );
    writeFileSync(file, original);
    await wait(6000);
    await page.close();
  }
} finally {
  writeFileSync(file, original);
  await browser.close();
  host.close();
}
const same = Buffer.compare(readFileSync(file), readFileSync(backup)) === 0;
console.log(`file restored byte for byte: ${same}`);
process.exit(0);
```
