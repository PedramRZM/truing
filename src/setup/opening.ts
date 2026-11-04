// What `truing` does in a folder: a project's own config file wins, once a person
// has confirmed it; then what setup saved; then setup. Nothing here loads the
// config file, because loading it runs it.
import { findProjectRoot, hasProjectRoot } from '../config';

import { projectRootOf } from './find-projects';
import { type Profile, profileFor } from './profile';
import { configText, isConfigTrusted } from './trust';

export type Opening =
  | { kind: 'config'; root: string }
  | { kind: 'confirm'; root: string; text: string }
  | { kind: 'profile'; profile: Profile }
  | { kind: 'reconfigure'; root: string }
  | { kind: 'setup' };

export function chooseOpening(
  target: string,
  options: { reconfigure?: boolean },
  env: NodeJS.ProcessEnv = process.env,
): Opening {
  if (options.reconfigure) {
    return { kind: 'reconfigure', root: projectRootOf(target) ?? target };
  }
  if (hasProjectRoot(target)) {
    const root = findProjectRoot(target);
    return isConfigTrusted(root, env)
      ? { kind: 'config', root }
      : { kind: 'confirm', root, text: configText(root) };
  }
  const profile = profileFor(target, env);
  return profile ? { kind: 'profile', profile } : { kind: 'setup' };
}
