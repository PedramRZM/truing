// `truing.config.ts` is code in someone's repository, and loading it runs it. So a
// person sees the file and confirms it before Truing loads it, and again if it
// changes. What they confirmed is kept outside the project, as a hash per folder.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { CONFIG_FILE } from '../config';

import { projectKey, truingHome } from './profile';

function hashOf(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function trustFile(root: string, env: NodeJS.ProcessEnv): string {
  return path.join(truingHome(env), 'trusted', `${projectKey(root)}.txt`);
}

/** The file as it stands, which is what a person is asked to confirm. */
export function configText(root: string): string {
  return readFileSync(path.join(root, CONFIG_FILE), 'utf8');
}

export function isConfigTrusted(
  root: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const file = trustFile(root, env);
  if (!existsSync(file)) return false;
  return readFileSync(file, 'utf8').trim() === hashOf(configText(root));
}

export function trustConfig(
  root: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const file = trustFile(root, env);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${hashOf(configText(root))}\n`);
}
