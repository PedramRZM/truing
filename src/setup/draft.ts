// From what setup learned to what Truing runs on.
import { type TruingConfig, truingConfigSchema } from '../config';
import { loadTokens } from '../tokens/table';

import type { Profile } from './profile';
import { type Draft, isSafeCheck } from './read-project';

export const DEFAULT_MODULES = [
  'selection',
  'changes',
  'claude-config',
  'claude',
];

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
    writable: {
      include: draft.writableInclude,
      exclude: draft.writableExclude,
    },
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
  // What the config file's schema refuses would save a profile that won't load.
  const parsed = truingConfigSchema.safeParse(draftToConfig(draft));
  if (parsed.success) return null;
  const fields = parsed.error.issues.map((issue) => {
    const field = issue.path.join('.');
    return SETTING_NAMES[field] ?? field;
  });
  return `Check these settings: ${[...new Set(fields)].join(', ')}.`;
}

/** A saved project back on the review screen, to change what it starts with. */
export function profileToDraft(profile: Profile): Draft {
  const { config, framework, evidence } = profile;
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
    writableInclude: config.writable.include,
    writableExclude: config.writable.exclude,
    checks: config.claude?.shell?.allow ?? [],
    dropEnv: config.claude?.dropEnv ?? [],
    evidence,
    questions: [],
  };
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
