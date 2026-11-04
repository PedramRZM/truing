import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJiti } from 'jiti';
import { z } from 'zod';

import type { TruingConfig } from './config';
import {
  DOCKS,
  LEFT_TABS,
  MODULE_ID,
  type ModuleSpec,
  RIGHT_VIEWS,
  type Schema,
  type ServerDefinition,
  TOOL_NAME,
} from './module';

const here = path.dirname(fileURLToPath(import.meta.url));

const require = createRequire(import.meta.url);

/**
 * Loads a module's TypeScript in Node. A project's own module lives outside
 * this package, so its imports of zod resolve from Truing's own
 * dependencies (build.ts does the same for the bundles).
 */
function moduleLoader() {
  return createJiti(import.meta.url, {
    moduleCache: false,
    alias: {
      'zod/mini': require.resolve('zod/mini'),
      zod: require.resolve('zod'),
    },
  });
}

/** Where the modules that ship with Truing live; the config names them bare. */
export const BUILT_IN_MODULES = path.join(here, 'modules');

/** Each part's file, by convention, next to `module.ts`. */
export const PART_FILES = {
  probe: 'probe.ts',
  panel: 'panel.tsx',
  server: 'server.ts',
} as const;

export type LoadedModule = {
  spec: ModuleSpec;
  dir: string;
  /** `module.ts`, imported by every part. */
  file: string;
  probe: string | null;
  panel: string | null;
  server: string | null;
};

export class ModuleConfigError extends Error {}

/** A bare name is a built-in module; a path (`./…`) is the project's own, from the root. */
export function resolveModuleDir(root: string, entry: string): string {
  if (entry.startsWith('.') || path.isAbsolute(entry)) {
    return path.resolve(root, entry);
  }
  if (!MODULE_ID.test(entry)) {
    throw new ModuleConfigError(
      `"${entry}" in modules is neither a built-in module's name nor a path starting with ./`,
    );
  }
  return path.join(BUILT_IN_MODULES, entry);
}

/**
 * Loads and checks the modules the config lists, in its order. Fails before
 * anything starts if a module is missing, its files and its declaration
 * disagree, or two modules claim the same id or tool name.
 */
export async function loadModules(
  root: string,
  config: Pick<TruingConfig, 'modules'>,
): Promise<LoadedModule[]> {
  const jiti = moduleLoader();
  const loaded: LoadedModule[] = [];
  const tools = new Map<string, string>();

  for (const entry of config.modules ?? []) {
    const dir = resolveModuleDir(root, entry);
    const file = path.join(dir, 'module.ts');
    if (!existsSync(file)) {
      throw new ModuleConfigError(
        `Module "${entry}" has no module.ts (looked in ${dir}).`,
      );
    }

    const spec = checkSpec(await jiti.import(file, { default: true }), entry);
    if (loaded.some((other) => other.spec.id === spec.id)) {
      throw new ModuleConfigError(`Two modules have the id "${spec.id}".`);
    }

    const parts = {
      probe: partFile(dir, spec, 'probe', Boolean(spec.probe)),
      panel: partFile(dir, spec, 'panel', Boolean(spec.panel)),
      server: partFile(
        dir,
        spec,
        'server',
        Boolean(spec.server || spec.claude),
      ),
    };

    // The panel runs a module's actions, so declaring them needs one.
    if (spec.actions && !spec.panel) {
      throw new ModuleConfigError(
        `Module "${spec.id}" declares actions but no panel to run them.`,
      );
    }

    for (const name of Object.keys(spec.claude?.tools ?? {})) {
      const owner = tools.get(name);
      if (owner) {
        throw new ModuleConfigError(
          `Modules "${owner}" and "${spec.id}" both add the tool "${name}".`,
        );
      }
      tools.set(name, spec.id);
    }

    loaded.push({ spec, dir, file, ...parts });
  }

  return loaded;
}

/** The part's file if the module declares it; an error if the two disagree. */
function partFile(
  dir: string,
  spec: ModuleSpec,
  part: keyof typeof PART_FILES,
  declared: boolean,
): string | null {
  const file = path.join(dir, PART_FILES[part]);
  const present = existsSync(file);
  if (declared && !present) {
    throw new ModuleConfigError(
      `Module "${spec.id}" declares a ${part} but has no ${PART_FILES[part]}.`,
    );
  }
  if (!declared && present) {
    throw new ModuleConfigError(
      `Module "${spec.id}" has ${PART_FILES[part]} but its module.ts declares no ${part === 'server' ? 'server or claude' : part}.`,
    );
  }
  return present ? file : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const schema = z.custom<Schema>(
  (value) => isRecord(value) && '_zod' in value,
  'is not a zod schema',
);
const call = z.object({ input: schema, output: schema });

const chord = z.object({
  key: z.string().min(1).optional(),
  codes: z.array(z.string().min(1)).min(1).optional(),
  mod: z.boolean().optional(),
  shift: z.union([z.boolean(), z.literal('any')]).optional(),
  label: z.string().min(1).optional(),
  repeat: z.boolean().optional(),
});

/** What module.ts must export, checked at start (TypeScript checked the rest). */
const moduleSpecSchema = z.object({
  id: z.string().regex(MODULE_ID, 'must be kebab-case'),
  title: z.string().trim().min(1),
  probe: z
    .object({
      reports: z.record(z.string(), schema).optional(),
      serverOnly: z.array(z.string()).optional(),
      commands: z.record(z.string(), call).optional(),
    })
    .optional(),
  panel: z
    .object({
      docks: z
        .array(z.enum(DOCKS))
        .min(1)
        .refine((docks) => new Set(docks).size === docks.length, {
          message: 'names a dock twice',
        }),
      titles: z
        .partialRecord(z.enum(DOCKS), z.string().trim().min(1))
        .optional(),
      tab: z.enum(LEFT_TABS).optional(),
      foot: z.boolean().optional(),
      view: z.enum(RIGHT_VIEWS).optional(),
      follows: z.record(z.string(), z.array(z.string())).optional(),
    })
    .refine((panel) => !panel.tab || panel.docks.includes('left'), {
      message: 'names a tab but no left section',
    })
    .refine((panel) => !panel.view || panel.docks.includes('right'), {
      message: 'names a view but no right section',
    })
    .refine((panel) => !panel.foot || panel.docks.includes('right'), {
      message: 'asks for the foot but has no right section',
    })
    .optional(),
  server: z
    .object({
      ops: z.record(z.string(), call).optional(),
      state: z.record(z.string(), schema).optional(),
      direct: z.record(z.string(), z.object({ input: schema })).optional(),
    })
    .optional(),
  claude: z
    .object({
      tools: z.record(
        z.string().regex(TOOL_NAME, 'must be snake_case'),
        z.object({ description: z.string().trim().min(1), input: schema }),
      ),
    })
    .optional(),
  actions: z
    .record(
      z.string().regex(MODULE_ID, 'must be kebab-case'),
      z.object({
        title: z.string().trim().min(1),
        hint: z.string().trim().min(1).optional(),
        keys: z.array(chord).optional(),
        menu: z.string().regex(MODULE_ID, 'must be kebab-case').optional(),
      }),
    )
    .optional(),
}) satisfies z.ZodType<ModuleSpec>;

function checkSpec(value: unknown, entry: string): ModuleSpec {
  const parsed = moduleSpecSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }
  const issues = parsed.error.issues.map(
    (issue) =>
      `${issue.path.join('.') || 'its default export'} ${issue.message}`,
  );
  throw new ModuleConfigError(
    `Module "${entry}": ${issues.join('; ')}. module.ts must export defineModule(...) as its default.`,
  );
}

const serverPartSchema = z.object({
  part: z.literal('server'),
  module: z.object({ id: z.string() }),
  setup: z.custom<ServerDefinition['setup']>(
    (value) => typeof value === 'function',
  ),
});

/** Imports a module's server part, in Truing's Node process. */
export async function importServerPart(
  loaded: LoadedModule,
): Promise<ServerDefinition> {
  if (!loaded.server) {
    throw new Error(`Module "${loaded.spec.id}" has no server part.`);
  }
  const jiti = moduleLoader();
  const exported: unknown = await jiti.import(loaded.server, {
    default: true,
  });
  const parsed = serverPartSchema.safeParse(exported);
  if (!parsed.success) {
    throw new ModuleConfigError(
      `Module "${loaded.spec.id}": server.ts must export defineServer(...) as its default.`,
    );
  }
  if (parsed.data.module.id !== loaded.spec.id) {
    throw new ModuleConfigError(
      `Module "${loaded.spec.id}": server.ts is defined for "${parsed.data.module.id}".`,
    );
  }
  return { part: 'server', module: loaded.spec, setup: parsed.data.setup };
}

/**
 * The source of the virtual entries the runtime and the shell bundles import:
 * every listed probe, and every listed module with its panel if it has one.
 */
export function probesEntry(modules: readonly LoadedModule[]): string {
  const withProbe = modules.filter((loaded) => loaded.probe);
  const imports = withProbe.map(
    (loaded, index) =>
      `import m${index} from ${JSON.stringify(loaded.file)};\nimport p${index} from ${JSON.stringify(loaded.probe)};`,
  );
  const list = withProbe.map(
    (_, index) => `{ module: m${index}, probe: p${index} }`,
  );
  return `${imports.join('\n')}\nexport const probes = [${list.join(', ')}];\n`;
}

export function panelsEntry(modules: readonly LoadedModule[]): string {
  const imports = modules.map((loaded, index) =>
    [
      `import m${index} from ${JSON.stringify(loaded.file)};`,
      loaded.panel
        ? `import p${index} from ${JSON.stringify(loaded.panel)};`
        : '',
    ].join('\n'),
  );
  const list = modules.map(
    (loaded, index) =>
      `{ module: m${index}, panel: ${loaded.panel ? `p${index}` : 'null'} }`,
  );
  return `${imports.join('\n')}\nexport const panels = [${list.join(', ')}];\n`;
}
