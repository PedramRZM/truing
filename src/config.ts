import { existsSync } from 'node:fs';
import path from 'node:path';

import { createJiti } from 'jiti';
import { z } from 'zod';

/**
 * Everything Truing knows about the project it runs in. Nobody has to write
 * this: setup asks Claude to read the project and saves the answer outside it
 * (src/setup/profile.ts). A `truing.config.ts` at the project's root takes its
 * place for anyone who wants the settings in git. Besides this, Truing reads
 * only the source files it edits (ADR 0001) and the project's Claude Code files,
 * which it shows and passes on to Claude (TRU-5.1).
 */
export const truingConfigSchema = z.object({
  /** Short project name; keys Truing's browser profile. */
  name: z.string().min(1),
  app: z.object({
    /** Shell command that starts the app's dev server, run from the project root. */
    devCommand: z.string().min(1),
    /**
     * Port the dev server listens on (on localhost). Left out, Truing follows
     * what the command prints when it starts.
     */
    port: z.number().int().positive().optional(),
    /** Route Truing opens first. */
    startRoute: z.string().startsWith('/').optional(),
    /**
     * The Next app's folder, relative to the root, when it isn't the root.
     * Next names source files relative to it.
     */
    dir: z.string().min(1).optional(),
  }),
  server: z
    .object({
      /** Port of Truing's own server (shell and WebSocket). */
      port: z.number().int().positive().optional(),
    })
    .optional(),
  /** Folder of the design-system primitives, relative to the root, if it has one. */
  primitives: z.string().min(1).optional(),
  /**
   * Folder of the app's own code, relative to the root: where the inspector
   * looks for a component's uses (TRU-2.2). `src` when it isn't set.
   */
  source: z.string().min(1).optional(),
  /** Tailwind v4 stylesheet that defines the design tokens, relative to the root, if it has one. */
  tokens: z.string().min(1).optional(),
  /**
   * The JSON file of tailwind-merge class groups the tokens add (text styles,
   * shadows), relative to the root. `truing tokens` writes it.
   */
  tailwindMerge: z.string().min(1).optional(),
  /** Which files Truing and Claude may write: globs relative to the root. None until someone says. */
  writable: z.object({
    include: z.array(z.string().min(1)),
    exclude: z.array(z.string().min(1)),
  }),
  /** Branch the designer's changes go to; `{feature}` is the feature branch's name. */
  branch: z
    .object({
      pattern: z.string().includes('{feature}'),
    })
    .optional(),
  /**
   * The modules to load, in order (TRU-1.6): a built-in module's name, or a
   * path from the root (`./…`) to the project's own. Each is a folder with a
   * `module.ts`; docs/modules.md explains how to write one.
   */
  modules: z.array(z.string().min(1)).optional(),
  claude: z
    .object({
      /**
       * Variables a Claude session must not inherit, past the ones Truing
       * always drops: a project's own switch that would change what loads.
       */
      dropEnv: z.array(z.string().min(1)).optional(),
      /**
       * Shell rules for a design session, in Claude Code's `Bash(...)` syntax
       * without the wrapper. `allow` runs unasked: the project's checks, which
       * run none of the code Claude writes. Only a plain command does: a wildcard
       * would also take a flag that runs a file, so it asks (TRU-5.3). `ask` always
       * asks the designer, even for something `allow` covers (a flag that writes
       * files). Every other shell rule the project allows its developers asks too.
       */
      shell: z
        .object({
          allow: z.array(z.string().min(1)).optional(),
          ask: z.array(z.string().min(1)).optional(),
        })
        .optional(),
    })
    .optional(),
});

export type TruingConfig = z.infer<typeof truingConfigSchema>;

/** The modules a project gets when nobody chose others. */
export const DEFAULT_MODULES = [
  'selection',
  'changes',
  'claude-config',
  'claude',
  'settings',
  // TRU-18.2: Claude's frame tools; server only, so nothing reaches the frames.
  'frames',
];

/** The writable list that means every file in the project (TRU-10.7). */
export const WHOLE_PROJECT = ['**'];

/** A list with off-limits of its own is a list, however wide: only this is the choice. */
export function isWholeProject(writable: TruingConfig['writable']): boolean {
  return (
    writable.include.length === 1 &&
    writable.include[0] === '**' &&
    writable.exclude.length === 0
  );
}

/**
 * A check runs with no prompt, so it's one plain command: no wildcard, which an
 * allow rule would take as anything, and nothing that chains or expands.
 */
export function isSafeCheck(command: string): boolean {
  return command.trim() !== '' && !/[*?;&|$`<>()\n]/.test(command);
}

export const CONFIG_FILE = 'truing.config.ts';

/** Walks up from `from` to the first folder holding the config file. */
export function findProjectRoot(from: string): string {
  let dir = path.resolve(from);

  for (;;) {
    if (existsSync(path.join(dir, CONFIG_FILE))) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `No ${CONFIG_FILE} found in ${from} or any folder above it.`,
      );
    }
    dir = parent;
  }
}

export function hasProjectRoot(from: string): boolean {
  try {
    findProjectRoot(from);
    return true;
  } catch {
    return false;
  }
}

export function validateConfig(value: unknown): TruingConfig {
  const parsed = truingConfigSchema.safeParse(value);

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.'));
    throw new Error(
      `${CONFIG_FILE} is missing or has invalid: ${[...new Set(fields)].join(', ')}.`,
    );
  }

  return parsed.data;
}

export async function loadConfig(
  root: string,
): Promise<{ root: string; config: TruingConfig }> {
  const file = path.join(root, CONFIG_FILE);
  // jiti compiles the TypeScript config itself, so loading it doesn't depend
  // on the runner (tsx for the CLI, Playwright's or Vitest's loader in tests)
  // or on the project's package.json "type".
  const jiti = createJiti(import.meta.url, { moduleCache: false });
  const exported: unknown = await jiti.import(file, { default: true });

  return { root, config: validateConfig(exported) };
}

export function branchFor(config: TruingConfig, feature: string): string {
  return (config.branch?.pattern ?? 'design/{feature}').replace(
    '{feature}',
    feature,
  );
}
