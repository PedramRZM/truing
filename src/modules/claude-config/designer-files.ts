// The Claude files a designer may add, change and remove (TRU-5.2): their own
// Markdown, in the folders any project keeps for it. Everything else in Claude's
// configuration changes how every session works, so it's a developer's to change.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { refusal } from '../../claude/path-guard.mjs';
import { DESIGN_CONFIG_PATHS } from '../../claude/session';
import { matchesGlob } from '../../globs.mjs';

export type DesignerKind = 'rule' | 'skill';

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SKILL_FILE = /^\.claude\/skills\/design-[^/]+\/SKILL\.md$/;

/** Whether the path a list shows is one of a designer's files. */
export function isDesignerFile(shown: string | null): boolean {
  return (
    shown !== null &&
    shown.endsWith('.md') &&
    DESIGN_CONFIG_PATHS.some((glob) => matchesGlob(shown, glob))
  );
}

/** The file on disk, once it's known to be a designer's; links are followed first. */
function designerPath(root: string, shown: string): string {
  const reason = isDesignerFile(shown)
    ? refusal(
        { root, include: [...DESIGN_CONFIG_PATHS], exclude: [] },
        shown,
        root,
      )
    : `${shown} isn't one of them.`;
  if (reason) {
    throw new Error(
      `Designers can change only their own rules and skills. ${reason}`,
    );
  }
  return path.join(root, shown);
}

export function newFilePath(kind: DesignerKind, name: string): string {
  return kind === 'rule'
    ? `.claude/rules/design-${name}.md`
    : `.claude/skills/design-${name}/SKILL.md`;
}

/** What a new file starts with: enough for Claude Code to load it. */
export function newFileText(
  kind: DesignerKind,
  name: string,
  uiFiles: readonly string[],
): string {
  if (kind === 'rule') {
    const paths = uiFiles.map((glob) => `  - ${JSON.stringify(glob)}`);
    return `---\npaths:\n${paths.join('\n')}\n---\n\n# ${name}\n\n`;
  }
  return `---\nname: design-${name}\ndescription: Say when Claude should use this.\n---\n\n# ${name}\n\n`;
}

/** Makes the file, and refuses to write over one that's there. */
export async function createDesignerFile(
  root: string,
  kind: DesignerKind,
  name: string,
  uiFiles: readonly string[],
): Promise<string> {
  if (!NAME.test(name)) {
    throw new Error(
      'Use lowercase letters, numbers and hyphens for the name, such as cancel-buttons.',
    );
  }
  const shown = newFilePath(kind, name);
  const full = designerPath(root, shown);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, newFileText(kind, name, uiFiles), { flag: 'wx' }).catch(
    (error: NodeJS.ErrnoException) => {
      throw error.code === 'EEXIST'
        ? new Error(`${shown} already exists. Open it from the list.`)
        : error;
    },
  );
  return shown;
}

/**
 * Saves over what the editor opened. If the file moved on since, Claude or
 * someone else changed it, and saving would lose that.
 */
export async function saveDesignerFile(
  root: string,
  shown: string,
  text: string,
  base: string,
): Promise<void> {
  const full = designerPath(root, shown);
  const now = await readFile(full, 'utf8').catch(() => null);
  if (now !== base) {
    throw new Error(
      `${shown} changed after you opened it. Copy your text, open it again, then save.`,
    );
  }
  await writeFile(full, text);
}

/** Removes a rule's file, or a skill's whole folder when it's the skill's own file. */
export async function removeDesignerFile(
  root: string,
  shown: string,
): Promise<void> {
  const full = designerPath(root, shown);
  await rm(SKILL_FILE.test(shown) ? path.dirname(full) : full, {
    recursive: true,
    force: true,
  });
}
