// A saved project's settings, changed after setup (TRU-10.3, TRU-10.7). The settings
// module's server calls these. A project with a `truing.config.ts` keeps its settings
// in that file, so here they only show.
import { existsSync } from 'node:fs';
import path from 'node:path';

import { CONFIG_FILE, isSafeCheck, type TruingConfig } from '../config';

import {
  checkedTokens,
  draftProblem,
  draftToConfig,
  foldersOf,
  pathProblem,
  profileToDraft,
  readAgainValues,
  type SettingValues,
  valuesOf,
} from './draft';
import { loadProfile, type Profile, saveProfile } from './profile';
import {
  checkReading,
  type Draft,
  isSafeGlob,
  isVisibleCommand,
  readProject,
  type ReadOptions,
} from './read-project';
import { SETTING_FIELDS, type SettingField } from './setting-fields';

export type SettingsView =
  | { kind: 'none' }
  | { kind: 'file'; file: string }
  | {
      kind: 'saved';
      values: SettingValues;
      evidence: Record<string, string>;
      savedAt: string;
      /** The values a person changed: a later read keeps them, unless they say. */
      yours: SettingField[];
    };

/** The values marked as a person's, of those that still exist. */
function yoursOf(profile: Profile): SettingField[] {
  return SETTING_FIELDS.filter((field) =>
    (profile.yours ?? []).includes(field),
  );
}

export function readSettings(
  root: string,
  env: NodeJS.ProcessEnv = process.env,
): SettingsView {
  if (existsSync(path.join(root, CONFIG_FILE))) {
    return { kind: 'file', file: CONFIG_FILE };
  }
  const profile = loadProfile(root, env);
  if (!profile) return { kind: 'none' };
  return {
    kind: 'saved',
    values: valuesOf(profileToDraft(profile)),
    evidence: profile.evidence,
    savedAt: profile.savedAt,
    yours: yoursOf(profile),
  };
}

/** What each setting is called, for saying what needs Truing reopened. */
export const SETTING_LABELS: Record<SettingField, string> = {
  name: 'Project name',
  framework: 'Framework',
  devCommand: 'Start command',
  port: 'Port',
  startRoute: 'First page',
  appDir: 'App folder',
  source: 'Code folder',
  primitives: 'Components folder',
  tokens: 'Token stylesheet',
  tailwindMerge: 'tailwind-merge groups file',
  writable: 'Allowed files',
  checks: 'Checks Claude may run without asking',
  dropEnv: "Variables Claude's sessions don't get",
};

/** These are read each time they're used; the rest are read when Truing opens. */
const LIVE_FIELDS: readonly SettingField[] = ['writable', 'checks', 'dropEnv'];

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** What a person typed: the checks a read would apply, as a sentence if one fails. */
function valuesProblem(values: SettingValues): string | null {
  const glob = [...values.writableInclude, ...values.writableExclude].find(
    (entry) => !isSafeGlob(entry),
  );
  if (glob) return `"${glob}" leaves the project. Use a pattern inside it.`;
  const check = values.checks.find((entry) => !isSafeCheck(entry));
  if (check) {
    return `"${check}" can't run without asking. Use one plain command, with no wildcards, chaining, redirects or variables.`;
  }
  if (!isVisibleCommand(values.devCommand)) {
    return 'The start command has a hidden character in it. Type it again.';
  }
  const name = values.dropEnv.find(
    (entry) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(entry),
  );
  if (name) {
    return `"${name}" isn't a variable name. Use letters, digits and underscores, and don't start with a digit.`;
  }
  return null;
}

export type SavedSettings = {
  /** What Truing reads when it opens, of what changed. Empty means it's all in use. */
  reopen: string[];
  /** The stylesheet given couldn't be read, so the project has none now. */
  tokensDropped: boolean;
  config: TruingConfig;
};

/** Only what a saved profile doesn't draft: nothing a person sees here drops them. */
function keptFrom(config: TruingConfig): Partial<TruingConfig> {
  return {
    ...(config.server ? { server: config.server } : {}),
    ...(config.branch ? { branch: config.branch } : {}),
    ...(config.modules ? { modules: config.modules } : {}),
  };
}

function savedFields(
  profile: Profile,
  draft: Draft,
  config: TruingConfig,
  yours: SettingField[],
): Omit<Profile, 'version' | 'savedAt'> {
  const { folders: _folders, ...rest } = profile;
  const folders = foldersOf(draft);
  return {
    ...rest,
    framework: draft.framework,
    evidence: draft.evidence,
    config,
    yours,
    ...(folders ? { folders } : {}),
  };
}

/**
 * Saves one project's settings. A new start command needs saying yes to, as on the
 * review screen: it runs on this computer each time the project opens.
 */
export async function saveSettings(input: {
  root: string;
  values: SettingValues;
  confirmedCommand: string | null;
  /** What "Read again" came back with, so a value Claude read isn't marked as theirs. */
  read: ReadonlyMap<
    SettingField,
    { values: Partial<SettingValues>; evidence: string | null }
  >;
  env?: NodeJS.ProcessEnv;
}): Promise<SavedSettings> {
  const { root, values, confirmedCommand, read } = input;
  const env = input.env ?? process.env;
  if (existsSync(path.join(root, CONFIG_FILE))) {
    throw new Error(`These settings are in ${CONFIG_FILE}. Change them there.`);
  }
  const profile = loadProfile(root, env);
  if (!profile) {
    throw new Error(
      'This project has no saved settings. Reopen Truing to set it up.',
    );
  }

  const problem = valuesProblem(values) ?? pathProblem(root, values);
  if (problem) throw new Error(problem);

  const before = profileToDraft(profile);
  const commandChanged = values.devCommand !== before.devCommand;
  if (commandChanged && confirmedCommand !== values.devCommand) {
    throw new Error('Check the new start command, then save.');
  }

  const evidence = { ...profile.evidence };
  const yours = new Set(yoursOf(profile));
  const changed: SettingField[] = [];
  const after: Draft = { ...before, ...values, evidence };
  for (const field of SETTING_FIELDS) {
    const now = readAgainValues(after, field);
    if (same(readAgainValues(before, field), now)) continue;
    changed.push(field);
    const fromClaude = read.get(field);
    const asRead =
      fromClaude &&
      same(
        Object.keys(fromClaude.values).map(
          (key) => now[key as keyof SettingValues],
        ),
        Object.values(fromClaude.values),
      );
    if (asRead) {
      yours.delete(field);
      if (fromClaude.evidence) evidence[field] = fromClaude.evidence;
    } else {
      yours.add(field);
    }
  }
  const accessChanged = values.fullAccess !== before.fullAccess;
  if (accessChanged && !changed.includes('writable')) {
    changed.push('writable');
    yours.add('writable');
  }

  const wrong = draftProblem(after);
  if (wrong) throw new Error(wrong);
  // A stylesheet is read by the project's own Tailwind, which a person has agreed to run.
  const checked = changed.includes('tokens')
    ? await checkedTokens(root, after)
    : after;
  const config: TruingConfig = {
    ...draftToConfig(checked),
    ...keptFrom(profile.config),
  };
  saveProfile(savedFields(profile, checked, config, [...yours]), env);
  return {
    reopen: changed
      .filter((field) => !LIVE_FIELDS.includes(field))
      .map((field) => SETTING_LABELS[field]),
    tokensDropped: after.tokens !== null && checked.tokens === null,
    config,
  };
}

/**
 * Puts what can change while Truing runs into the config every module shares, which
 * they read each time they use it: the next Claude message and the next edit follow.
 */
export function applyLive(running: TruingConfig, saved: TruingConfig): void {
  running.writable = saved.writable;
  if (saved.claude) running.claude = saved.claude;
  else delete running.claude;
}

const ASKS: Record<SettingField, string> = {
  name: 'name',
  framework: 'framework and frameworkEvidence',
  devCommand: 'devCommand and devCommandEvidence',
  port: 'port and portEvidence',
  startRoute: 'startRoute and startRouteEvidence',
  appDir: 'appDir and appDirEvidence',
  source: 'source and sourceEvidence',
  primitives: 'primitives and primitivesEvidence',
  tokens: 'tokens and tokensEvidence',
  tailwindMerge: 'tailwindMerge',
  writable: 'writableInclude, writableExclude and writableEvidence',
  checks: 'checks and checksEvidence',
  dropEnv: 'dropEnv and dropEnvEvidence',
};

export type ReadValue = {
  values: Partial<SettingValues>;
  evidence: string | null;
};

/** Asks Claude about one value only. Nothing is saved until a person says so. */
export function readOneValue(
  root: string,
  field: SettingField,
  options: Pick<ReadOptions, 'spawner' | 'timeoutMs' | 'dropEnv'> = {},
): Promise<ReadValue> {
  return new Promise((resolve, reject) => {
    let answered = false;
    const reading = readProject(
      root,
      (event) => {
        if (event.type === 'error') {
          answered = true;
          reject(new Error(event.message));
        }
        if (event.type === 'done') {
          answered = true;
          const draft = checkReading(root, event.reading);
          resolve({
            values: readAgainValues(draft, field),
            evidence: draft.evidence[field] ?? null,
          });
        }
      },
      {
        ...options,
        focus: `Only this is needed now: ${ASKS[field]}. Read just what that takes and stop. For every other field, give null, an empty list or an empty string, and no questions.`,
      },
    );
    void reading.finished.then(() => {
      if (!answered) reject(new Error("Claude didn't answer."));
    });
  });
}
