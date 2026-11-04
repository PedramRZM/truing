// From what setup learned to what Truing runs on.
import {
  DEFAULT_MODULES,
  isWholeProject,
  type TruingConfig,
  truingConfigSchema,
  WHOLE_PROJECT,
} from '../config';
import path from 'node:path';

import { loadTokens } from '../tokens/table';

import type { Profile } from './profile';
import { type Draft, isSafeCheck, type KeptValue } from './read-project';
import { SETTING_FIELDS, type SettingField } from './setting-fields';

/** Flags that write files always ask, even on a check Claude may run unasked. */
const ALWAYS_ASK = ['* --fix', '* --fix *', '* --output-file *', '* -o *'];

export function draftToConfig(draft: Draft): TruingConfig {
  return {
    name: draft.name,
    app: {
      devCommand: draft.devCommand,
      ...(draft.port === null ? {} : { port: draft.port }),
      startRoute: draft.startRoute,
      ...(draft.appDir ? { dir: draft.appDir } : {}),
    },
    source: draft.source,
    ...(draft.primitives ? { primitives: draft.primitives } : {}),
    ...(draft.tokens ? { tokens: draft.tokens } : {}),
    ...(draft.tailwindMerge ? { tailwindMerge: draft.tailwindMerge } : {}),
    writable: draft.fullAccess
      ? { include: [...WHOLE_PROJECT], exclude: [] }
      : { include: draft.writableInclude, exclude: draft.writableExclude },
    modules: DEFAULT_MODULES,
    claude: {
      dropEnv: draft.dropEnv,
      shell: { allow: draft.checks.filter(isSafeCheck), ask: ALWAYS_ASK },
    },
  };
}

/** What the review screen calls them, for saying which one is wrong. */
const SETTING_NAMES: Record<string, string> = {
  name: 'Project name',
  'app.startRoute': 'First page, which starts with /',
  'app.dir': 'App folder',
  source: 'Code folder',
  primitives: 'Components folder',
  tokens: 'Token stylesheet',
};

/** What stops a draft from starting: only a missing command, or a port that can't be one. */
export function draftProblem(draft: Draft): string | null {
  if (!draft.devCommand.trim()) return 'Add the command that starts the app.';
  if (draft.port !== null && (draft.port < 1 || draft.port > 65535)) {
    return "That port isn't a number from 1 to 65535. Fix it, or leave it empty.";
  }
  // It names folders of Truing's own, so it can't be a path.
  if (/[/\\]/.test(draft.name) || /^\.+$/.test(draft.name.trim())) {
    return "Check these settings: Project name, which can't have a slash in it.";
  }
  // What the config file's schema refuses would save a profile that won't load.
  const parsed = truingConfigSchema.safeParse(draftToConfig(draft));
  if (parsed.success) return null;
  const fields = parsed.error.issues.map((issue) => {
    const field = issue.path.join('.');
    return SETTING_NAMES[field] ?? field;
  });
  return `Check these settings: ${[...new Set(fields)].join(', ')}.`;
}

/** A folder or file a person typed that isn't in the project, as a sentence. */
export function pathProblem(
  root: string,
  draft: Pick<
    Draft,
    'appDir' | 'source' | 'primitives' | 'tokens' | 'tailwindMerge'
  >,
): string | null {
  const paths: readonly (readonly [string, string | null])[] = [
    ['App folder', draft.appDir],
    ['Code folder', draft.source],
    ['Components folder', draft.primitives],
    ['Token stylesheet', draft.tokens],
    ['tailwind-merge groups file', draft.tailwindMerge],
  ];
  for (const [label, value] of paths) {
    if (!value) continue;
    const relative = path.relative(root, path.resolve(root, value));
    if (relative === '..' || relative.startsWith(`..${path.sep}`)) {
      return `${label}: "${value}" isn't in this project. Use a path inside it.`;
    }
    if (path.isAbsolute(relative)) {
      return `${label}: "${value}" isn't in this project. Use a path inside it.`;
    }
  }
  return null;
}

/** A saved project back on the review screen, to change what it starts with. */
export function profileToDraft(profile: Profile): Draft {
  const { config, framework, evidence } = profile;
  const fullAccess = isWholeProject(config.writable);
  const lists = fullAccess
    ? (profile.folders ?? { include: [], exclude: [] })
    : config.writable;
  return {
    name: config.name,
    summary: '',
    framework,
    devCommand: config.app.devCommand,
    port: config.app.port ?? null,
    startRoute: config.app.startRoute ?? '/',
    appDir: config.app.dir ?? null,
    source: config.source ?? '.',
    primitives: config.primitives ?? null,
    tokens: config.tokens ?? null,
    tailwindMerge: config.tailwindMerge ?? null,
    writableInclude: lists.include,
    writableExclude: lists.exclude,
    fullAccess,
    checks: config.claude?.shell?.allow ?? [],
    dropEnv: config.claude?.dropEnv ?? [],
    evidence,
    questions: [],
    yours: profile.yours ?? [],
  };
}

/** The lists to keep for going back, while the config gives the whole project. */
export function foldersOf(draft: Draft): Profile['folders'] {
  return draft.fullAccess
    ? { include: draft.writableInclude, exclude: draft.writableExclude }
    : undefined;
}

/** What a person can change for a saved project: a draft less what's about this read. */
export type SettingValues = Pick<
  Draft,
  | 'name'
  | 'framework'
  | 'devCommand'
  | 'port'
  | 'startRoute'
  | 'appDir'
  | 'source'
  | 'primitives'
  | 'tokens'
  | 'tailwindMerge'
  | 'writableInclude'
  | 'writableExclude'
  | 'checks'
  | 'dropEnv'
> & { fullAccess: boolean };

export function valuesOf(draft: Draft): SettingValues {
  return {
    name: draft.name,
    framework: draft.framework,
    devCommand: draft.devCommand,
    port: draft.port,
    startRoute: draft.startRoute,
    appDir: draft.appDir,
    source: draft.source,
    primitives: draft.primitives,
    tokens: draft.tokens,
    tailwindMerge: draft.tailwindMerge,
    fullAccess: draft.fullAccess ?? false,
    writableInclude: draft.writableInclude,
    writableExclude: draft.writableExclude,
    checks: draft.checks,
    dropEnv: draft.dropEnv,
  };
}

/** The part of a draft one setting is, as a read would change it. */
export function readAgainValues(
  draft: Draft,
  field: SettingField,
): Partial<SettingValues> {
  return field === 'writable'
    ? {
        writableInclude: draft.writableInclude,
        writableExclude: draft.writableExclude,
      }
    : { [field]: draft[field] };
}

function shownValue(values: Partial<SettingValues>): string {
  const text = Object.values(values)
    .map((value) => {
      if (Array.isArray(value)) return value.join(', ');
      if (value && typeof value === 'object') return value.name;
      return value === null || value === undefined ? '' : String(value);
    })
    .filter(Boolean)
    .join(' · ');
  return text || 'nothing';
}

/**
 * A new read over a saved project. What a person set stays, with what the read said
 * beside it for them to take instead, and so does the choice of full access, which
 * no read can make for them.
 */
export function keepYours(draft: Draft, profile: Profile | null): Draft {
  if (!profile) return draft;
  const saved = profileToDraft(profile);
  const fields = SETTING_FIELDS.filter((field) =>
    (profile.yours ?? []).includes(field),
  );
  const kept: KeptValue[] = [];
  let next: Draft = { ...draft, fullAccess: saved.fullAccess ?? false };
  for (const field of fields) {
    const read = readAgainValues(draft, field);
    const mine = readAgainValues(saved, field);
    if (JSON.stringify(read) === JSON.stringify(mine)) continue;
    kept.push({ field, read, shown: shownValue(read) });
    next = { ...next, ...mine };
  }
  return { ...next, yours: profile.yours ?? [], kept };
}

/**
 * A stylesheet Claude named is only as good as Truing's ability to read it. One
 * it can't read leaves the project without tokens, with the reason shown, and
 * everything else keeps working.
 */
export async function checkedTokens(
  root: string,
  draft: Draft,
): Promise<Draft> {
  if (!draft.tokens) return draft;
  try {
    await loadTokens(root, draft.tokens);
    return draft;
  } catch (error) {
    return {
      ...draft,
      tokens: null,
      evidence: {
        ...draft.evidence,
        tokens: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
