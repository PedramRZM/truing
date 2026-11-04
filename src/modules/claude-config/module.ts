import * as z from 'zod/mini';

import { defineModule } from '../../module';

/**
 * What Claude loads for the project (TRU-5.1), in Claude's configuration view. It reads any
 * project's Claude files and asks Claude Code itself which of them it loaded,
 * so nothing here knows about one project.
 */

const itemSchema = z.object({
  name: z.string(),
  /** Whose it is: the shared project, this computer's, the person's, Truing's own, or from outside the project. */
  source: z.enum([
    'project',
    'local',
    'personal',
    'truing',
    'outside',
    'other',
  ]),
  /** The file, as shown; the `file` op reads it. Null for what has no file. */
  path: z.nullable(z.string()),
  /** A short fact beside the name: a rule's globs, a server's status. */
  note: z.nullable(z.string()),
  /** The longer text on hover: a skill's description. */
  description: z.nullable(z.string()),
  /** What opens when it has no file: a hook's command. */
  body: z.nullable(z.string()),
  /** On disk, but Claude's own list leaves it out. */
  missing: z.boolean(),
  /** One of the designer's own files: they can edit or remove it (TRU-5.2). */
  editable: z.boolean(),
});
export type ConfigItem = z.infer<typeof itemSchema>;

const claudeSchema = z.object({
  version: z.string(),
  model: z.string(),
  /** How it signs in: `none` is the person's own plan, with no API key. */
  apiKeySource: z.string(),
  /** Null when Claude Code couldn't say. */
  loggedIn: z.nullable(z.boolean()),
});

export const claudeConfigSchema = z.object({
  /** What Claude Code said about itself; null until it has answered. */
  claude: z.nullable(claudeSchema),
  /** Why Claude Code couldn't answer. */
  problem: z.nullable(z.string()),
  /** Whether the lists are Claude's own word, or only what the files suggest. */
  confirmed: z.boolean(),
  /** The project has an AGENTS.md that Claude doesn't load. */
  agentsMdMissing: z.boolean(),
  /** Loaded in every session. */
  instructions: z.array(itemSchema),
  /** Loaded when Claude opens a matching file. */
  onDemand: z.array(itemSchema),
  skills: z.array(itemSchema),
  agents: z.array(itemSchema),
  hooks: z.array(itemSchema),
  permissions: z.array(itemSchema),
  mcpServers: z.array(itemSchema),
  plugins: z.array(itemSchema),
  /** A settings file that couldn't be read. */
  unreadable: z.array(z.string()),
});
export type ClaudeConfig = z.infer<typeof claudeConfigSchema>;

export default defineModule({
  id: 'claude-config',
  title: 'What Claude loads',
  // It opens from the chat's Configuration button (TRU-5.2).
  panel: { docks: ['right'], view: 'claude-config' },
  server: {
    ops: {
      /** The project's files alone: under a second, and Claude isn't started. */
      files: { input: z.object({}), output: claudeConfigSchema },
      /** The files, with what Claude Code says it loaded. It costs no model call. */
      check: { input: z.object({}), output: claudeConfigSchema },
      /** One listed file's text. Anything not listed is refused. */
      file: {
        input: z.object({ path: z.string() }),
        output: z.object({ text: z.string() }),
      },
      /** Starts one of the designer's own files; answers with its path. */
      create: {
        input: z.object({
          kind: z.enum(['rule', 'skill']),
          name: z.string(),
        }),
        output: z.object({ path: z.string() }),
      },
      /** Saves a designer's file, if it's still what `base` says it was. */
      save: {
        input: z.object({
          path: z.string(),
          text: z.string(),
          base: z.string(),
        }),
        output: z.object({ ok: z.boolean() }),
      },
      remove: {
        input: z.object({ path: z.string() }),
        output: z.object({ ok: z.boolean() }),
      },
    },
  },
});
