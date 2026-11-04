// Measures Truing on the real app: panning, zooming, hovering and picking,
// with what each costs in CPU, main-thread time, frames and socket traffic.
//
//   pnpm perf <label> [--profile] [--layout=side-by-side] [--only=a,b]
//
// It opens its own window on its own port and profile, so it can run beside a
// truing that's already open. The app must be running, or it starts it.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { CDPSession, Page } from 'playwright';

import { findProjectRoot, loadConfig } from '../src/config';
import { startTruing } from '../src/truing';

const args = process.argv.slice(2);
const label = args.find((arg) => !arg.startsWith('--')) ?? 'run';
const profiling = args.includes('--profile');
const sideBySide = args.includes('--layout=side-by-side');
const only = args
  .find((arg) => arg.startsWith('--only='))
  ?.slice('--only='.length)
  .split(',');

const PROFILE_DIR = path.join(os.tmpdir(), 'truing-perf-profile');
const OUT_DIR = os.tmpdir();
const TICKS_PER_SECOND = 100;

type ProcessTree = Map<string, number>;

function allProcesses(): Array<{ pid: number; ppid: number; ticks: number }> {
  return readdirSync('/proc').flatMap((name) => {
    if (!/^\d+$/.test(name)) return [];
    try {
      const stat = readFileSync(`/proc/${name}/stat`, 'utf8');
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      return [
        {
          pid: Number(name),
          ppid: Number(fields[1]),
          ticks: Number(fields[11]) + Number(fields[12]),
        },
      ];
    } catch {
      return [];
    }
  });
}

function cmdline(pid: number): string {
  try {
    return readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\0', ' ');
  } catch {
    return '';
  }
}

function browserPid(): number {
  const found = allProcesses().find(({ pid }) => {
    const line = cmdline(pid);
    return (
      line.includes(`--user-data-dir=${PROFILE_DIR}`) &&
      !line.includes('--type=')
    );
  });
  if (!found) throw new Error('Truing browser process was not found.');
  return found.pid;
}

/** The browser and everything it started. */
function treeOf(
  root: number,
  all: ReturnType<typeof allProcesses>,
): Set<number> {
  const seen = new Set([root]);
  // Children come after parents only by luck: go round until nothing is added.
  for (let grew = true; grew;) {
    grew = false;
    for (const { pid, ppid } of all) {
      if (seen.has(ppid) && !seen.has(pid)) {
        seen.add(pid);
        grew = true;
      }
    }
  }
  return seen;
}

/** CPU ticks of the browser's process tree by process type, plus Next's server. */
function cpuTicks(root: number): ProcessTree {
  const all = allProcesses();
  const totals: ProcessTree = new Map();
  const seen = treeOf(root, all);
  for (const { pid, ticks } of all) {
    if (!seen.has(pid)) {
      if (cmdline(pid).startsWith('next-server')) {
        totals.set('next', (totals.get('next') ?? 0) + ticks);
      }
      continue;
    }
    const type = /--type=(\S+)/.exec(cmdline(pid))?.[1] ?? 'browser';
    totals.set(type, (totals.get(type) ?? 0) + ticks);
  }
  return totals;
}

type Metrics = Record<string, number>;

async function metrics(session: CDPSession): Promise<Metrics> {
  const { metrics: list } = await session.send('Performance.getMetrics');
  return Object.fromEntries(list.map(({ name, value }) => [name, value]));
}

type FrameStats = { frames: number; p50: number; p95: number; worst: number };

// As strings: tsx's helpers don't exist in the page.
async function startFrames(shell: Page): Promise<void> {
  await shell.evaluate(`(() => {
    const frames = [];
    window.__perfFrames = frames;
    const tick = (at) => {
      if (window.__perfFrames !== frames) return;
      frames.push(at);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })()`);
}

async function stopFrames(shell: Page): Promise<FrameStats> {
  const at = await shell.evaluate<number[]>(`(() => {
    const frames = window.__perfFrames ?? [];
    window.__perfFrames = [];
    return frames;
  })()`);
  const gaps = at
    .slice(1)
    .map((value, index) => value - (at[index] ?? value))
    .sort((a, b) => a - b);
  const percentile = (fraction: number): number =>
    gaps[Math.floor(gaps.length * fraction)] ?? 0;
  return {
    frames: at.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    worst: gaps.at(-1) ?? 0,
  };
}

type ProfileNode = {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  hitCount?: number;
};

function topSelfTime(
  profile: {
    nodes: ProfileNode[];
    samples?: number[];
    timeDeltas?: number[];
  },
  count: number,
): string[] {
  const byId = new Map(profile.nodes.map((node) => [node.id, node]));
  const self = new Map<string, number>();
  (profile.samples ?? []).forEach((id, index) => {
    const node = byId.get(id);
    if (!node) return;
    const { functionName, url, lineNumber } = node.callFrame;
    const file = url.split('/').pop()?.split('?')[0] ?? '';
    const key = `${functionName || '(anon)'} ${file}:${lineNumber + 1}`;
    self.set(
      key,
      (self.get(key) ?? 0) + (profile.timeDeltas?.[index] ?? 0) / 1000,
    );
  });
  return [...self.entries()]
    .filter(([key]) => !key.startsWith('(idle)'))
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([key, ms]) => `${ms.toFixed(0).padStart(6)} ms  ${key}`);
}

const root = findProjectRoot(process.cwd());
const { config } = await loadConfig(root);
const truing = await startTruing({
  root,
  config: { ...config, server: { port: 4101 } },
  profileDir: PROFILE_DIR,
  log: () => {},
});
const { shell } = truing;
const session = await truing.context.newCDPSession(shell);
await session.send('Performance.enable');
await session.send('Network.enable');

// Everything the shell's socket carries.
let socketIn = { messages: 0, bytes: 0 };
let socketOut = { messages: 0, bytes: 0 };
session.on('Network.webSocketFrameReceived', ({ response }) => {
  socketIn.messages += 1;
  socketIn.bytes += response.payloadData.length;
});
session.on('Network.webSocketFrameSent', ({ response }) => {
  socketOut.messages += 1;
  socketOut.bytes += response.payloadData.length;
});

const browser = browserPid();

function processCount(type: string): number {
  return [...treeOf(browser, allProcesses())].filter((pid) =>
    cmdline(pid).includes(`--type=${type}`),
  ).length;
}

async function settled(): Promise<void> {
  await shell
    .locator('.frame-route[data-live="true"]')
    .first()
    .waitFor({ timeout: 120_000 });
  // The app settles, and the layers arrive.
  await shell.waitForTimeout(6000);
}

await settled();
if (sideBySide) {
  await shell.getByRole('button', { name: 'Side by side' }).click();
  await settled();
}

const renderer = await shell.evaluate<string>(`(() => {
  const gl = document.createElement('canvas').getContext('webgl');
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'none';
})()`);
const appFrame = shell.frames().find((frame) => frame !== shell.mainFrame());
const appSession = appFrame
  ? await truing.context.newCDPSession(appFrame).catch(() => null)
  : null;
await appSession?.send('Performance.enable');
console.log(
  JSON.stringify({
    gpu: renderer,
    renderers: processCount('renderer'),
    appInOwnProcess: appSession !== null,
  }),
);

const canvas = await shell.locator('main.canvas').boundingBox();
const card = await shell.locator('.frame-card').first().boundingBox();
if (!canvas || !card) throw new Error('The canvas has no box.');
const inside = {
  x: Math.max(card.x, canvas.x) + Math.min(card.width, canvas.width) / 2,
  y: Math.max(card.y, canvas.y) + Math.min(card.height, canvas.height) / 3,
};
const margin = { x: canvas.x + 8, y: canvas.y + 8 };

async function drag(
  from: { x: number; y: number },
  button: 'left' | 'middle',
): Promise<void> {
  await shell.mouse.move(from.x, from.y);
  await shell.mouse.down({ button });
  for (let i = 0; i < 240; i++) {
    const swing = Math.sin(i / 20) * 200;
    await shell.mouse.move(from.x + swing, from.y + swing / 2);
  }
  await shell.mouse.up({ button });
}

const scenarios: Array<{
  name: string;
  /** Before the clock starts. */
  setup?: () => Promise<void>;
  run: () => Promise<void>;
  teardown?: () => Promise<void>;
}> = [
  {
    name: 'idle-interact',
    run: () => shell.waitForTimeout(5000),
  },
  {
    name: 'idle-select',
    setup: () => shell.keyboard.press('v'),
    run: () => shell.waitForTimeout(5000),
  },
  {
    name: 'pan-hand-drag',
    setup: () => shell.keyboard.press('h'),
    run: () => drag(margin, 'left'),
    teardown: () => shell.keyboard.press('h'),
  },
  {
    name: 'pan-middle-in-frame',
    run: () => drag(inside, 'middle'),
  },
  {
    name: 'pan-wheel',
    // The hand makes the frames ignore the pointer, so the canvas gets the wheel.
    setup: async () => {
      await shell.mouse.move(margin.x, margin.y);
      await shell.keyboard.press('h');
    },
    run: async () => {
      for (let i = 0; i < 240; i++) {
        await shell.mouse.wheel(i % 40 < 20 ? 8 : -8, i % 60 < 30 ? 6 : -6);
      }
    },
    teardown: () => shell.keyboard.press('h'),
  },
  {
    name: 'zoom-wheel',
    setup: async () => {
      await shell.mouse.move(margin.x, margin.y);
      await shell.keyboard.down('Control');
    },
    run: async () => {
      for (let i = 0; i < 120; i++) {
        await shell.mouse.wheel(0, i % 40 < 20 ? 4 : -4);
      }
    },
    teardown: () => shell.keyboard.up('Control'),
  },
  {
    name: 'hover-select',
    setup: () => shell.keyboard.press('Shift+1'),
    run: async () => {
      for (let i = 0; i < 240; i++) {
        await shell.mouse.move(
          inside.x + Math.sin(i / 15) * 300,
          inside.y + Math.cos(i / 25) * 200,
        );
      }
    },
  },
  {
    name: 'pan-with-pick',
    setup: async () => {
      await shell.mouse.click(inside.x, inside.y);
      await shell.waitForTimeout(2500);
      await shell.keyboard.press('h');
    },
    run: () => drag(margin, 'left'),
    teardown: async () => {
      await shell.keyboard.press('h');
    },
  },
  {
    name: 'idle-with-pick',
    run: () => shell.waitForTimeout(5000),
  },
  {
    // The page changes under a pick: the tree is built again, with no new rows.
    name: 'page-changes-with-pick',
    run: async () => {
      const app = shell.frames().find((frame) => frame !== shell.mainFrame());
      for (let i = 0; i < 4; i++) {
        await app?.evaluate(
          `document.body.classList.toggle('truing-perf-probe')`,
        );
        await shell.waitForTimeout(1500);
      }
    },
  },
  {
    name: 'resize-drag',
    run: async () => {
      const grip = await shell
        .locator('.frame-handle[data-grip="e"]')
        .first()
        .boundingBox();
      if (!grip) return;
      const from = {
        x: grip.x + grip.width / 2,
        y: grip.y + grip.height / 2,
      };
      await shell.mouse.move(from.x, from.y);
      await shell.mouse.down();
      for (let i = 0; i < 120; i++) {
        await shell.mouse.move(
          from.x - 100 * Math.abs(Math.sin(i / 20)),
          from.y,
        );
      }
      await shell.mouse.up();
    },
  },
];

const results: Record<string, unknown> = {};
for (const scenario of scenarios) {
  if (only && !only.includes(scenario.name)) {
    await scenario.setup?.();
    await scenario.teardown?.();
    continue;
  }
  await scenario.setup?.();
  await shell.waitForTimeout(800);
  if (profiling) {
    await session.send('Profiler.enable');
    await session.send('Profiler.setSamplingInterval', { interval: 500 });
    await session.send('Profiler.start');
  }
  socketIn = { messages: 0, bytes: 0 };
  socketOut = { messages: 0, bytes: 0 };
  const before = await metrics(session);
  const appBefore = appSession ? await metrics(appSession) : null;
  const cpuBefore = cpuTicks(browser);
  const nodeBefore = process.cpuUsage();
  await startFrames(shell);
  const started = performance.now();
  await scenario.run();
  const elapsed = (performance.now() - started) / 1000;
  const frames = await stopFrames(shell);
  const after = await metrics(session);
  const appAfter = appSession ? await metrics(appSession) : null;
  const cpuAfter = cpuTicks(browser);
  const nodeAfter = process.cpuUsage(nodeBefore);

  const cores: Record<string, number> = {};
  for (const [type, ticks] of cpuAfter) {
    const delta = ticks - (cpuBefore.get(type) ?? 0);
    cores[type] = Math.round((delta / TICKS_PER_SECOND / elapsed) * 100);
  }
  cores.node = Math.round(
    ((nodeAfter.user + nodeAfter.system) / 1e6 / elapsed) * 100,
  );
  const perSecond = (name: string): number =>
    Math.round((((after[name] ?? 0) - (before[name] ?? 0)) / elapsed) * 1000);
  const summary = {
    seconds: Number(elapsed.toFixed(1)),
    cpuPercentOfCore: cores,
    shellThreadMsPerSecond: {
      task: perSecond('TaskDuration'),
      script: perSecond('ScriptDuration'),
      layout: perSecond('LayoutDuration'),
      style: perSecond('RecalcStyleDuration'),
    },
    appThreadMsPerSecond:
      appBefore && appAfter
        ? {
            task: Math.round(
              (((appAfter.TaskDuration ?? 0) - (appBefore.TaskDuration ?? 0)) /
                elapsed) *
                1000,
            ),
            script: Math.round(
              (((appAfter.ScriptDuration ?? 0) -
                (appBefore.ScriptDuration ?? 0)) /
                elapsed) *
                1000,
            ),
          }
        : null,
    frames: {
      fps: Math.round(frames.frames / elapsed),
      p50: Number(frames.p50.toFixed(1)),
      p95: Number(frames.p95.toFixed(1)),
      worst: Number(frames.worst.toFixed(0)),
    },
    socket: {
      in: socketIn,
      out: socketOut,
    },
    domNodes: after.Nodes ?? 0,
    heapMb: Math.round((after.JSHeapUsedSize ?? 0) / 1e6),
  };
  results[scenario.name] = summary;
  console.log(`\n=== ${scenario.name} ===`);
  console.log(JSON.stringify(summary));
  if (profiling) {
    const { profile } = await session.send('Profiler.stop');
    const top = topSelfTime(profile as never, 30);
    console.log(top.join('\n'));
    (results[scenario.name] as { top?: string[] }).top = top;
  }
  await scenario.teardown?.();
}

const file = path.join(OUT_DIR, `truing-perf-${label}.json`);
writeFileSync(file, JSON.stringify(results, null, 2));
console.log(`\nwrote ${file}`);
await truing.close();
process.exit(0);
