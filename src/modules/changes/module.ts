import * as z from 'zod/mini';

import { applyResultSchema, defineModule } from '../../module';

/**
 * The Changes tray (TRU-4.1). Every visual change a module stages lands here,
 * whichever path will apply it. The probe previews them in each frame
 * through an override stylesheet, without touching the source; the panel
 * lists them with Undo and "Let Claude do this", then Apply and Discard.
 */

/** What one frame shows for one change: CSS scoped to the element, and its new text. */
const previewRule = z.object({
  /** The page the element is on: other pages leave the rule out. */
  href: z.string(),
  selector: z.string(),
  css: z.string(),
  text: z.nullable(z.string()),
});
export type PreviewRule = z.infer<typeof previewRule>;

export default defineModule({
  id: 'changes',
  title: 'Changes',
  probe: {
    reports: {
      /** The page loaded: the server sends it the preview again. */
      ready: z.object({ href: z.string() }),
    },
    commands: {
      /** Shows the staged changes in this frame; the count it could show. */
      preview: {
        input: z.object({ rules: z.array(previewRule) }),
        output: z.object({ shown: z.number() }),
      },
    },
  },
  panel: { docks: ['right'], foot: true },
  server: {
    ops: {
      /** Undoes one staged change. */
      undo: { input: z.object({ id: z.string() }), output: z.object({}) },
      /** "Let Claude do this", or back. */
      claude: {
        input: z.object({ id: z.string(), claude: z.boolean() }),
        output: z.object({}),
      },
      /** Writes the direct changes; the Claude ones stay staged. */
      apply: {
        input: z.object({}),
        output: z.object({
          outcomes: z.array(
            z.object({ id: z.string(), result: applyResultSchema }),
          ),
        }),
      },
      /** Drops every staged change. */
      discard: { input: z.object({}), output: z.object({}) },
    },
  },
});
