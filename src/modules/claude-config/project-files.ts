// What a project's Claude files say, read from disk. It knows Claude Code's
// layout, and nothing about any one project. Settings are read for their hooks
// and permissions only: `env` can hold secrets, so it is never touched.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir, readFile, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { z } from 'zod';

import type { ConfigItem } from './module';

const run = promisify(execFile);

export type ClaudeFiles = {
  /** Found on disk, loaded in every session as far as the files can say. */
  instructions: ConfigItem[];
  onDemand: ConfigItem[];
  skills: ConfigItem[];
  agents: ConfigItem[];
  hooks: ConfigItem[];
  permissions: ConfigItem[];
  /** What Truing's own sessions add to all this (TRU-5.2). */
  truing: TruingLayer;
  unreadable: string[];
  hasAgentsMd: boolean;
  /** Turns a full path into the one shown, and remembers it for `file`. */
  label: (file: string) => string;
  sourceOf: (file: string) => ConfigItem['source'];
  /** The files that may be opened, by the path shown. */
  known: Map<string, string>;
};

/** The person's Claude folder: Claude Code's own rule. */
export function claudeConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), '.claude');
}

/** What a design session adds to the project's own configuration. */
export type TruingLayer = Pick<
  ClaudeFiles,
  'hooks' | 'permissions' | 'skills'
> & { instructions: ConfigItem[] };

export const NO_TRUING_LAYER: TruingLayer = {
  instructions: [],
  skills: [],
  hooks: [],
  permissions: [],
};

export function emptyItem(
  name: string,
  source: ConfigItem['source'],
): ConfigItem {
  return {
    name,
    source,
    path: null,
    note: null,
    description: null,
    body: null,
    missing: false,
    editable: false,
  };
}

type Frontmatter = Record<string, string | string[]>;

/** The simple YAML Claude Code's files use at their top: strings and lists. */
export function parseFrontmatter(text: string): Frontmatter {
  const block = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
  if (block === undefined) return {};

  const unquote = (value: string): string =>
    value.trim().replace(/^(['"])(.*)\1$/, '$2');
  const fields: Frontmatter = {};
  let key: string | null = null;
  for (const line of block.split(/\r?\n/)) {
    const item = /^\s*-\s+(.*)$/.exec(line);
    const current = key === null ? undefined : fields[key];
    if (item?.[1] !== undefined && key !== null) {
      fields[key] = [
        ...(Array.isArray(current) ? current : []),
        unquote(item[1]),
      ];
      continue;
    }
    // The next line of a folded description.
    if (/^\s+\S/.test(line) && key !== null && typeof current === 'string') {
      fields[key] = `${current} ${line.trim()}`.trim();
      continue;
    }
    const field = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (!field?.[1]) continue;
    key = field[1];
    const value = field[2] ?? '';
    if (/^\[.*\]$/.test(value)) {
      // A comma inside braces is part of its glob.
      fields[key] = value
        .slice(1, -1)
        .split(/,(?![^{]*\})/)
        .map(unquote)
        .filter(Boolean);
    } else {
      // `>` and `|` only say how the lines after them fold.
      fields[key] = /^[>|][+-]?$/.test(value) ? '' : unquote(value);
    }
  }
  return fields;
}

function text(value: string | string[] | undefined): string | null {
  if (value === undefined) return null;
  return (Array.isArray(value) ? value.join(', ') : value) || null;
}

async function readIfThere(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
}

/** Every `.md` under a folder; a folder that isn't there has none. */
async function markdownUnder(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, {
      recursive: true,
      withFileTypes: true,
    });
    return entries
      .filter(
        (entry) =>
          (entry.isFile() || entry.isSymbolicLink()) &&
          entry.name.endsWith('.md'),
      )
      .map((entry) => path.join(entry.parentPath, entry.name))
      .sort();
  } catch {
    return [];
  }
}

/**
 * CLAUDE.md files below the root, which Claude loads with the files beside
 * them. Ignored ones count: git's rules don't stop Claude reading a file.
 */
async function nestedInstructions(root: string): Promise<string[]> {
  const list = async (...flags: string[]): Promise<string[]> => {
    const { stdout } = await run(
      'git',
      [
        'ls-files',
        '-z',
        ...flags,
        '--exclude-standard',
        ':(glob)**/CLAUDE.md',
        ':(glob)**/CLAUDE.local.md',
      ],
      { cwd: root, maxBuffer: 16 * 1024 * 1024 },
    );
    return stdout.split('\0');
  };
  try {
    const found = [
      ...(await list('--cached', '--others')),
      ...(await list('--others', '--ignored')),
    ];
    return [...new Set(found)]
      .filter(
        (file) =>
          // Git also names nested repositories, as folders.
          /\/CLAUDE(\.local)?\.md$/.test(file) &&
          !file.startsWith('.claude/') &&
          !file.split('/').includes('node_modules'),
      )
      .sort()
      .map((file) => path.join(root, file));
  } catch {
    // Not a git repository: only the root's own files are looked at.
    return [];
  }
}

/** Hides what looks like a credential in a command or a rule shown on screen. */
export function maskSecrets(text: string): string {
  return text
    .replace(
      /\b([\w-]*(?:token|secret|password|passwd|api[_-]?key|auth)[\w-]*)(=|:\s*)(?:"[^"]*"|'[^']*'|\S+)/gi,
      '$1$2•••',
    )
    .replace(/\b(bearer\s+)\S+/gi, '$1•••');
}

const settingsSchema = z.object({
  permissions: z
    .object({
      allow: z.array(z.string()).optional(),
      ask: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
    })
    .optional(),
  hooks: z
    .record(
      z.string(),
      z.array(
        z.object({
          matcher: z.string().optional(),
          hooks: z.array(
            z.object({
              type: z.string(),
              command: z.string().optional(),
              prompt: z.string().optional(),
              url: z.string().optional(),
            }),
          ),
        }),
      ),
    )
    .optional(),
});

export const PERMISSION_KINDS = {
  allow: 'Allow',
  ask: 'Ask',
  deny: 'Deny',
} as const;

/** Reads a project's Claude files. `configDir` is the person's Claude folder. */
export async function readClaudeFiles(
  projectRoot: string,
  claudeDir: string = claudeConfigDir(),
): Promise<ClaudeFiles> {
  // Claude reports real paths, so a symlinked folder has to compare as one.
  const root = await realpath(projectRoot);
  const configDir = await realpath(claudeDir).catch(() => claudeDir);
  const known = new Map<string, string>();
  const inside = (file: string, dir: string): string | null => {
    const relative = path.relative(dir, file);
    return relative.startsWith('..') || path.isAbsolute(relative)
      ? null
      : relative;
  };
  const shownPath = (file: string): string => {
    const inProject = inside(file, root);
    const inConfig = inside(file, configDir);
    if (inConfig !== null) return `~/.claude/${inConfig}`;
    return inProject ?? file;
  };
  const label = (file: string): string => {
    const shown = shownPath(file);
    known.set(shown, file);
    return shown;
  };
  const sourceOf = (file: string): ConfigItem['source'] => {
    if (inside(file, configDir) !== null) return 'personal';
    if (inside(file, root) === null) return 'other';
    return /\.local\.[a-z]+$/.test(file) ? 'local' : 'project';
  };
  const fileItem = (file: string, name = path.basename(file)): ConfigItem => ({
    ...emptyItem(name, sourceOf(file)),
    path: label(file),
  });

  const instructions: ConfigItem[] = [];
  const onDemand: ConfigItem[] = [];

  // Claude Code loads the root's own files; AGENTS.md only through an import.
  const rootFiles = ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md'].map(
    (name) => path.join(root, name),
  );
  const personal = path.join(configDir, 'CLAUDE.md');
  let importsAgentsMd = false;
  for (const file of [...rootFiles, personal]) {
    const content = await readIfThere(file);
    if (content === null) continue;
    instructions.push(fileItem(file));
    if (file !== personal && importsAgents(content)) importsAgentsMd = true;
  }
  const agentsMd = path.join(root, 'AGENTS.md');
  // A CLAUDE.md that is a link to AGENTS.md already is it.
  const hasAgentsMd =
    existsSync(agentsMd) &&
    !(await sameFile(agentsMd, path.join(root, 'CLAUDE.md')));
  if (hasAgentsMd && importsAgentsMd) instructions.push(fileItem(agentsMd));

  for (const dir of [
    path.join(root, '.claude/rules'),
    path.join(configDir, 'rules'),
  ]) {
    for (const file of await markdownUnder(dir)) {
      const content = (await readIfThere(file)) ?? '';
      const globs = text(parseFrontmatter(content).paths);
      const name = path.relative(dir, file);
      if (globs === null) {
        instructions.push(fileItem(file, name));
      } else {
        onDemand.push({ ...fileItem(file, name), note: globs });
      }
    }
  }
  for (const file of await nestedInstructions(root)) {
    onDemand.push({
      ...fileItem(file, path.relative(root, file)),
      note: `Files in ${path.relative(root, path.dirname(file))}/`,
    });
  }

  const describedUnder = async (
    files: readonly string[],
    nameOf: (file: string) => string,
  ): Promise<ConfigItem[]> =>
    Promise.all(
      files.map(async (file) => {
        const fields = parseFrontmatter((await readIfThere(file)) ?? '');
        return {
          ...fileItem(file, text(fields.name) ?? nameOf(file)),
          description: text(fields.description),
        };
      }),
    );

  // Each folder's own SKILL.md, so a linked folder counts and a reference doesn't.
  const skillsDir = path.join(root, '.claude/skills');
  const skillFolders = await readdir(skillsDir).catch(() => [] as string[]);
  const skillFiles = skillFolders
    .sort()
    .map((folder) => path.join(skillsDir, folder, 'SKILL.md'))
    .filter((file) => existsSync(file));
  const agentFiles = await markdownUnder(path.join(root, '.claude/agents'));

  const hooks: ConfigItem[] = [];
  const permissions: ConfigItem[] = [];
  const unreadable: string[] = [];
  for (const file of [
    path.join(root, '.claude/settings.json'),
    path.join(root, '.claude/settings.local.json'),
  ]) {
    const content = await readIfThere(file);
    if (content === null) continue;
    const settings = parseSettings(content);
    if (!settings) {
      // Shown by name only: a file that can't be parsed can't have its env left out.
      unreadable.push(shownPath(file));
      continue;
    }
    const source = sourceOf(file);
    for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
      for (const group of groups) {
        for (const hook of group.hooks) {
          hooks.push({
            ...emptyItem(event, source),
            note: group.matcher || null,
            body: maskSecrets(
              hook.command ?? hook.prompt ?? hook.url ?? hook.type,
            ),
          });
        }
      }
    }
    for (const [kind, title] of Object.entries(PERMISSION_KINDS)) {
      const rules =
        settings.permissions?.[kind as keyof typeof PERMISSION_KINDS] ?? [];
      for (const rule of rules) {
        const shown = maskSecrets(rule);
        permissions.push({
          ...emptyItem(shown, source),
          note: title,
          body: shown,
        });
      }
    }
  }

  return {
    instructions,
    onDemand,
    skills: await describedUnder(skillFiles, (file) =>
      path.basename(path.dirname(file)),
    ),
    agents: await describedUnder(agentFiles, (file) =>
      path.basename(file, '.md'),
    ),
    hooks,
    permissions,
    truing: NO_TRUING_LAYER,
    unreadable,
    hasAgentsMd,
    label,
    sourceOf,
    known,
  };
}

/** Whether a CLAUDE.md's text imports the root's AGENTS.md. Claude skips code. */
export function importsAgents(content: string): boolean {
  const prose = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');
  return /(^|\s)@(\.\/)?AGENTS\.md(\s|$)/m.test(prose);
}

async function sameFile(a: string, b: string): Promise<boolean> {
  try {
    return (await realpath(a)) === (await realpath(b));
  } catch {
    return false;
  }
}

function parseSettings(content: string): z.infer<typeof settingsSchema> | null {
  try {
    const parsed = settingsSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
