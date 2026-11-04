import * as z from 'zod/mini';

import { defineModule } from '../../module';
import { SETTING_FIELDS, type SettingField } from '../../setup/setting-fields';

/**
 * A saved project's settings, in the right panel (TRU-10.3, TRU-10.7): what setup
 * confirmed, with Claude's reasons, and a way to change any of it without going
 * through setup again or finding a file.
 */

const valuesSchema = z.object({
  name: z.string(),
  framework: z.object({ name: z.string(), version: z.nullable(z.string()) }),
  devCommand: z.string(),
  port: z.nullable(z.number()),
  startRoute: z.string(),
  appDir: z.nullable(z.string()),
  source: z.string(),
  primitives: z.nullable(z.string()),
  tokens: z.nullable(z.string()),
  tailwindMerge: z.nullable(z.string()),
  /** Every file in the project, rather than the lists below it. */
  fullAccess: z.boolean(),
  writableInclude: z.array(z.string()),
  writableExclude: z.array(z.string()),
  checks: z.array(z.string()),
  dropEnv: z.array(z.string()),
});
export type Values = z.infer<typeof valuesSchema>;
export type Field = SettingField;

const viewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  /** The settings are in the project's own config file. */
  z.object({ kind: z.literal('file'), file: z.string() }),
  z.object({
    kind: z.literal('saved'),
    values: valuesSchema,
    /** Why each value is what it is, in Claude's words. */
    evidence: z.record(z.string(), z.string()),
    savedAt: z.string(),
    /** The values a person changed. A later read asks before replacing them. */
    yours: z.array(z.enum(SETTING_FIELDS)),
  }),
]);
export type View = z.infer<typeof viewSchema>;

export default defineModule({
  id: 'settings',
  title: 'Settings',
  panel: { docks: ['right'], view: 'settings' },
  server: {
    ops: {
      read: { input: z.object({}), output: viewSchema },
      save: {
        input: z.object({
          values: valuesSchema,
          /** The start command a person said yes to, when it's a new one. */
          confirmedCommand: z.nullable(z.string()),
        }),
        output: z.object({
          /** What changed that Truing reads when it opens. */
          reopen: z.array(z.string()),
          /** The stylesheet given couldn't be read, so the project has none now. */
          tokensDropped: z.boolean(),
        }),
      },
      /** Asks Claude about one value. Nothing is saved until a person says so. */
      readAgain: {
        input: z.object({ field: z.enum(SETTING_FIELDS) }),
        output: z.object({
          values: z.partial(valuesSchema),
          evidence: z.nullable(z.string()),
        }),
      },
    },
  },
});
