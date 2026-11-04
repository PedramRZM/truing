import { readFile, stat } from 'node:fs/promises';

import {
  DESIGN_SKILL,
  permissionsFor,
  sessionPrompt,
} from '../../claude/session';
import { defineServer } from '../../module';

import { askClaude, type ClaudeAnswer } from './ask-claude';
import {
  createDesignerFile,
  removeDesignerFile,
  saveDesignerFile,
} from './designer-files';
import { mergeConfig } from './merge';
import claudeConfig from './module';
import {
  type ClaudeFiles,
  emptyItem,
  PERMISSION_KINDS,
  readClaudeFiles,
  type TruingLayer,
} from './project-files';

/** A file past this is cut: the panel is for reading, not for editing. */
const MAX_FILE_BYTES = 512 * 1024;

export default defineServer(claudeConfig, (ctx) => {
  // Filled by every read: `file` opens only what the last list showed.
  let lastFiles: ClaudeFiles | null = null;
  let asking: Promise<ClaudeAnswer> | null = null;

  /** What Truing's own flags add, so the tab lists all a session loads. */
  async function truingLayer(found: ClaudeFiles): Promise<TruingLayer> {
    const permissions = await permissionsFor(ctx.root, ctx.config);
    return {
      instructions: [
        {
          ...emptyItem('Design rules', 'truing'),
          note: 'Sent with every message',
          body: await sessionPrompt(ctx.config),
        },
      ],
      skills: [
        {
          ...emptyItem('truing:design-rules', 'truing'),
          path: found.label(DESIGN_SKILL),
          description: "How Claude applies a designer's change.",
        },
      ],
      hooks: [
        {
          ...emptyItem('PreToolUse', 'truing'),
          note: 'Edit|Write|MultiEdit|NotebookEdit',
          body: `Refuses a write outside the files this project allows, and any test, secret file or file that runs later.`,
        },
      ],
      permissions: Object.entries(PERMISSION_KINDS).flatMap(([kind, title]) =>
        permissions[kind as keyof typeof permissions].map((rule) => ({
          ...emptyItem(rule, 'truing'),
          note: title,
          body: rule,
        })),
      ),
    };
  }

  async function files(): Promise<ClaudeFiles> {
    const found = await readClaudeFiles(ctx.root);
    lastFiles = { ...found, truing: await truingLayer(found) };
    return lastFiles;
  }

  return {
    ops: {
      files: async () => mergeConfig(await files(), null),
      check: async () => {
        // A second click while it's asking waits for the same answer.
        asking ??= askClaude(ctx.root, { config: ctx.config }).finally(() => {
          asking = null;
        });
        const answer = await asking;
        return mergeConfig(await files(), answer);
      },
      file: async ({ path }) => {
        if (!lastFiles?.known.has(path)) await files();
        const full = lastFiles?.known.get(path);
        if (!full) {
          throw new Error(
            `${path} isn't listed anymore. Check again, then open it.`,
          );
        }
        try {
          const { size } = await stat(full);
          const text = await readFile(full, 'utf8');
          return {
            text:
              size > MAX_FILE_BYTES
                ? `${text.slice(0, MAX_FILE_BYTES)}\n\nThe rest is cut. Open the file to read it all.`
                : text,
          };
        } catch {
          throw new Error(
            `Couldn't read ${path}. Check again to refresh the list.`,
          );
        }
      },
      // Each waits its turn with Claude, which may be writing the same files.
      create: ({ kind, name }) =>
        ctx.exclusive(async () => ({
          path: await createDesignerFile(
            ctx.root,
            kind,
            name,
            ctx.config.writable.include,
          ),
        })),
      save: ({ path, text, base }) =>
        ctx.exclusive(async () => {
          await saveDesignerFile(ctx.root, path, text, base);
          return { ok: true };
        }),
      remove: ({ path }) =>
        ctx.exclusive(async () => {
          await removeDesignerFile(ctx.root, path);
          return { ok: true };
        }),
    },
  };
});
