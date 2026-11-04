import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { projectMerge } from '../../edits/classes';
import { defineServer, type StagedChange } from '../../module';
import { loadTokens, type TokenTable } from '../../tokens/table';
import { configFor, parseCvaFile } from '../selection/cva';
import { scopeRank } from '../selection/layout-classes';

import changes, { type PreviewRule } from './module';
import { previewOf, previewOfDraft } from './preview';

export default defineServer(changes, (ctx) => {
  const merge = projectMerge(ctx.root, ctx.config.tailwindMerge);
  let tokens: Promise<TokenTable | null> | null = null;
  const tokenTable = (): Promise<TokenTable | null> => {
    const stylesheet = ctx.config.tokens;
    if (!stylesheet) return Promise.resolve(null);
    tokens ??= loadTokens(ctx.root, stylesheet).catch((error: unknown) => {
      tokens = null;
      throw error;
    });
    return tokens;
  };

  /** A variant's classes before and after a switch, read from its cva config. */
  async function variantClasses(
    change: StagedChange,
  ): Promise<{ before: string[]; after: string[] } | null> {
    const edit = change.write?.by === 'edit' ? change.write.edit : null;
    if (edit?.kind !== 'variant') return null;
    const now = change.element?.component?.variants.find(
      (variant) => variant.name === edit.name,
    );
    if (!now) return null;
    const text = await readFile(path.join(ctx.root, edit.definition), 'utf8');
    const config = configFor(
      parseCvaFile(text, edit.definition),
      edit.component,
    );
    const values =
      config && Object.hasOwn(config.variants, edit.name)
        ? config.variants[edit.name]
        : undefined;
    if (!values) return null;
    const split = (value: string): string[] =>
      (values[value] ?? '').split(' ').filter(Boolean);
    return { before: split(now.value), after: split(edit.value) };
  }

  async function rules(list: readonly StagedChange[]): Promise<PreviewRule[]> {
    const draft = ctx.changes.draft();
    if (list.length === 0 && !draft) return [];
    const table = await tokenTable();
    const css = (name: string): string | null =>
      table?.designSystem.candidatesToCss([name])[0] ?? null;
    // The narrower scope last, as Tailwind's own order has it at Apply.
    const ordered = [...list].sort(
      (a, b) => scopeRank(a.scope) - scopeRank(b.scope),
    );
    const shown = await Promise.all(
      ordered.map((change) =>
        previewOf(change, { merge, css, variant: variantClasses }).catch(
          (error: unknown) => {
            ctx.log(`no preview for ${change.id}: ${String(error)}`);
            return null;
          },
        ),
      ),
    );
    const staged = shown.filter((rule): rule is PreviewRule => rule !== null);
    return draft ? [...staged, previewOfDraft(draft, { merge, css })] : staged;
  }

  // Only the latest list's preview is sent: a slower, older one is dropped.
  let sent = 0;
  async function push(frames: readonly string[]): Promise<void> {
    if (frames.length === 0) return;
    sent += 1;
    const mine = sent;
    const next = await rules(ctx.changes.list());
    if (mine !== sent) return;
    for (const frame of frames) {
      ctx.command(frame, 'preview', { rules: next }).catch(() => {});
    }
  }
  const pushAll = (): void => {
    push(ctx.frames()).catch((error: unknown) =>
      ctx.log(`preview failed: ${String(error)}`),
    );
  };

  ctx.changes.onChange(pushAll);

  return {
    ops: {
      undo: ({ id }) => {
        ctx.changes.remove(id);
        return {};
      },
      claude: async ({ id, claude }) => {
        await ctx.changes.setClaude(id, claude);
        return {};
      },
      apply: async () => ({ outcomes: await ctx.changes.apply() }),
      discard: () => {
        ctx.changes.discard();
        return {};
      },
    },
    onReport: (name, _payload, frame) => {
      if (name !== 'ready' || ctx.changes.list().length === 0) return;
      push([frame]).catch(() => {});
    },
  };
});
