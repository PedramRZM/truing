// What Truing learned about a project, saved outside the project: nothing is
// added to the repository. One JSON file per folder, under the person's own
// config directory. `truing.config.ts` in a project still wins, for anyone
// who wants the settings in git, but nothing needs it.
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { z } from 'zod';

import { type TruingConfig, truingConfigSchema } from '../config';

const profileSchema = z.object({
  version: z.literal(1),
  root: z.string(),
  savedAt: z.string(),
  framework: z.object({
    name: z.string(),
    version: z.string().nullable(),
  }),
  /** Why each value is what it is, in Claude's words, for the review screen. */
  evidence: z.record(z.string(), z.string()),
  config: truingConfigSchema,
});

export type Profile = z.infer<typeof profileSchema>;

export function truingHome(env: NodeJS.ProcessEnv = process.env): string {
  if (env.TRUING_HOME) return env.TRUING_HOME;
  const base = env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  return path.join(base, 'truing');
}

/** A folder's short name plus a hash of its path: two `web` folders stay apart. */
export function projectKey(root: string): string {
  const slug =
    path
      .basename(root)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'project';
  const hash = createHash('sha256').update(root).digest('hex').slice(0, 8);
  return `${slug}-${hash}`;
}

export function profileFile(
  root: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return path.join(truingHome(env), 'projects', `${projectKey(root)}.json`);
}

function parse(file: string): Profile | null {
  try {
    const parsed = profileSchema.safeParse(
      JSON.parse(readFileSync(file, 'utf8')),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    // A file a person broke by hand is the same as none: setup runs again.
    return null;
  }
}

export function loadProfile(
  root: string,
  env: NodeJS.ProcessEnv = process.env,
): Profile | null {
  const file = profileFile(root, env);
  return existsSync(file) ? parse(file) : null;
}

const SECRET_WORD =
  /(?:^|_)(?:API_?KEY|ACCESS_?KEY|KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIALS?|AUTH)(?:_|$)/i;
const ASSIGNMENT = /\b([A-Za-z_][A-Za-z0-9_]*)=("[^"]*"|'[^']*'|\S+)/g;
const SECRET_FLAG =
  /(--?(?:token|password|passwd|secret|api-?key|auth)(?:=|\s+))("[^"]*"|'[^']*'|\S+)/gi;
const URL_LOGIN = /\/\/[^\s/:@]+:[^\s/@]+@/g;
const SECRET_VALUE =
  /\b(?:sk[-_][A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|AKIA[A-Z0-9]{16})/g;

/**
 * What a profile must never hold. A secret typed into a start command becomes a
 * reference to the variable, so the command still works where it's set. This is a
 * net, not a proof: the review screen is where a person sees what's kept.
 */
export function scrubSecrets(text: string): string {
  return text
    .replace(URL_LOGIN, '//[removed]@')
    .replace(ASSIGNMENT, (whole, name: string, value: string) =>
      SECRET_WORD.test(name) && !value.startsWith('$')
        ? `${name}=$${name}`
        : whole,
    )
    .replace(SECRET_FLAG, (_whole, flag: string) => `${flag}[removed]`)
    .replace(SECRET_VALUE, '[removed]');
}

export function saveProfile(
  profile: Omit<Profile, 'version' | 'savedAt'>,
  env: NodeJS.ProcessEnv = process.env,
): Profile {
  const shell = profile.config.claude?.shell;
  const saved: Profile = {
    ...profile,
    evidence: Object.fromEntries(
      Object.entries(profile.evidence).map(([field, reason]) => [
        field,
        scrubSecrets(reason),
      ]),
    ),
    config: {
      ...profile.config,
      app: {
        ...profile.config.app,
        devCommand: scrubSecrets(profile.config.app.devCommand),
      },
      ...(shell
        ? {
            claude: {
              ...profile.config.claude,
              shell: {
                ...shell,
                ...(shell.allow
                  ? { allow: shell.allow.map(scrubSecrets) }
                  : {}),
              },
            },
          }
        : {}),
    },
    version: 1,
    savedAt: new Date().toISOString(),
  };
  const file = profileFile(profile.root, env);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(saved, null, 2)}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
  return saved;
}

/** Every saved project whose folder still exists, most recent first. */
export function listProfiles(env: NodeJS.ProcessEnv = process.env): Profile[] {
  const dir = path.join(truingHome(env), 'projects');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .flatMap((name) => parse(path.join(dir, name)) ?? [])
    .filter((profile) => existsSync(profile.root))
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** The saved project this folder is in: itself or the nearest folder above. */
export function profileFor(
  from: string,
  env: NodeJS.ProcessEnv = process.env,
): Profile | null {
  let dir = path.resolve(from);
  for (;;) {
    const found = loadProfile(dir, env);
    if (found) return found;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function withAppPort(config: TruingConfig, port: number): TruingConfig {
  return { ...config, app: { ...config.app, port } };
}
