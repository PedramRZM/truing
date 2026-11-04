// `truing [folder]`: opens a project. Nothing to configure: the first time, the
// setup screens connect Claude and let it read the project; after that, it opens.
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { AppStartError } from './app-process';
import {
  findProjectRoot,
  hasProjectRoot,
  loadConfig,
  type TruingConfig,
} from './config';
import { doctorReport } from './doctor';
import { askClaude } from './modules/claude-config/ask-claude';
import { runSetup } from './modules/claude-config/setup';
import { checkConnection } from './setup/connection';
import { chooseOpening } from './setup/opening';
import {
  loadProfile,
  projectKey,
  profileFor,
  saveProfile,
  withAppPort,
} from './setup/profile';
import { isConfigTrusted } from './setup/trust';
import { browserIsReady, ensureChromium, runSetupWindow } from './setup/window';
import { tokensReport } from './tokens/cli';
import { startTruing } from './truing';

const HELP = `Truing: refine your real app visually. No config.

Usage
  truing [folder]             Open a project. The first time, set it up.
  truing --reconfigure        Let Claude read this project again.
  truing doctor               Check Claude Code and this project.
  truing setup                Check what Claude Code loads in this project.
  truing tokens               Print this project's tokens. Options:
    --stylesheet <file>         Read this stylesheet instead.
    --merge-out <file>          Also write tailwind-merge groups to this file.
  truing --version
  truing --help

Truing only runs your own Claude Code. Your sign-in stays with it.`;

function option(args: readonly string[], name: string): string | undefined {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
}

function version(): string {
  const file = new URL('../package.json', import.meta.url);
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { version: string };
  return parsed.version;
}

/** Where the person ran it, or the folder they named. */
function targetOf(args: readonly string[], from: string): string {
  const folder = args.find((arg) => !arg.startsWith('-'));
  return folder ? path.resolve(from, folder) : from;
}

async function doctor(from: string): Promise<number> {
  const { lines, code } = await doctorReport(from, {
    connection: await checkConnection(),
    browserReady: browserIsReady(),
  });
  console.log(lines.join('\n'));
  return code;
}

const NOT_SET_UP =
  "This folder isn't set up yet. Run truing to set it up first.";

/**
 * The project's settings, from a config file only if a person has confirmed it.
 * A folder nobody has opened in Truing has none, and these commands run things
 * from the project (its Tailwind, its Claude hooks), so a person looks first.
 */
async function savedSettings(
  from: string,
): Promise<
  { root: string; config: TruingConfig } | { problem: string; unset: boolean }
> {
  if (hasProjectRoot(from)) {
    const root = findProjectRoot(from);
    if (isConfigTrusted(root)) return loadConfig(root);
    return {
      problem: `The truing.config.ts in ${root} isn't confirmed yet, so it wasn't run. Run truing to see it and confirm it.`,
      unset: false,
    };
  }
  const profile = profileFor(from);
  return profile
    ? { root: profile.root, config: profile.config }
    : { problem: NOT_SET_UP, unset: true };
}

async function tokens(args: readonly string[], from: string): Promise<void> {
  const stylesheet = option(args, '--stylesheet');
  const mergeOut = option(args, '--merge-out');
  const saved = await savedSettings(from);
  if ('problem' in saved) {
    console.log(
      saved.unset && !stylesheet
        ? 'No tokens found for this project. Truing works without them, showing raw values.'
        : saved.problem,
    );
    return;
  }
  const sheet = stylesheet ?? saved.config.tokens;
  if (!sheet) {
    console.log(
      'No tokens found for this project. Truing works without them, showing raw values. To read a stylesheet anyway, pass --stylesheet <file>.',
    );
    return;
  }
  console.log(await tokensReport(saved.root, sheet, mergeOut));
}

async function setup(from: string): Promise<string> {
  const saved = await savedSettings(from);
  if ('problem' in saved) return saved.problem;
  return runSetup(saved.root, () =>
    askClaude(saved.root, { config: saved.config }),
  );
}

/** A browser profile per project, so each app's sign-in survives on its own. */
function browserProfile(root: string): string {
  return path.join(os.homedir(), '.cache', 'truing', projectKey(root));
}

async function open(args: readonly string[], from: string): Promise<void> {
  const watch = args.includes('--watch');
  const target = targetOf(args, from);
  const reconfigure = args.includes('--reconfigure');

  await ensureChromium();

  const opening = chooseOpening(target, { reconfigure });
  let opened: Awaited<ReturnType<typeof runSetupWindow>>;
  switch (opening.kind) {
    case 'config':
      opened = {
        root: opening.root,
        config: (await loadConfig(opening.root)).config,
        close: null,
      };
      break;
    case 'confirm':
      opened = await runSetupWindow({ from: target, confirm: opening.root });
      break;
    case 'profile':
      opened = {
        root: opening.profile.root,
        config: opening.profile.config,
        close: null,
      };
      break;
    case 'reconfigure':
      opened = await runSetupWindow({
        from: target,
        reconfigure: opening.root,
      });
      break;
    case 'setup':
      opened = await runSetupWindow({ from: target });
      break;
  }
  if (!opened) return;

  const start = (project: NonNullable<typeof opened>) =>
    startTruing({
      root: project.root,
      config: project.config,
      watch,
      profileDir: browserProfile(project.root),
      ...(project.app ? { app: project.app } : {}),
    });

  let truing: Awaited<ReturnType<typeof startTruing>>;
  try {
    truing = await start(opened);
  } catch (error) {
    // A saved start command that no longer works can be corrected, not just reported.
    if (!(error instanceof AppStartError) || opening.kind !== 'profile') {
      throw error;
    }
    opened = await runSetupWindow({
      from: target,
      review: { root: opening.profile.root, problem: error.message },
    });
    if (!opened) return;
    truing = await start(opened);
  }
  // The window that takes over is up, so the setup window can go.
  await opened.close?.();

  // A server that moved stays where it went, next time too.
  const saved = loadProfile(opened.root);
  if (truing.app.moved && saved) {
    saveProfile({
      root: saved.root,
      framework: saved.framework,
      evidence: saved.evidence,
      config: withAppPort(saved.config, truing.app.port),
    });
  }

  const shutdown = (): void => {
    void truing.close().then(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  await truing.closed;
  await truing.close();
}

async function main(): Promise<number> {
  // pnpm runs this from the package folder; INIT_CWD is where the person typed it.
  const from = process.env.INIT_CWD ?? process.cwd();
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return 0;
  }
  if (args.includes('--version') || args.includes('-v')) {
    console.log(version());
    return 0;
  }

  switch (args[0]) {
    case 'doctor':
      return doctor(from);
    case 'tokens':
      await tokens(args.slice(1), from);
      return 0;
    case 'setup':
      console.log(await setup(from));
      return 0;
    default:
      await open(args, from);
      return 0;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(
      '[truing]',
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  });
