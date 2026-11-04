// A pick, as a message attaches it. The pick and its inspection are another
// module's, so they're read through schemas that take only what's needed, and a
// change over there costs a chip detail rather than the panel.
import { z } from 'zod';

import type { PanelFrame } from '../../module';

import type { Attachment, Screen } from './module';

const selected = z.object({
  id: z.number(),
  href: z.string(),
  tag: z.string(),
  classes: z.array(z.string()),
  selector: z.string(),
  text: z.string().nullable(),
  width: z.number(),
});

const place = z.object({
  status: z.string(),
  at: z
    .object({ file: z.string(), line: z.number(), column: z.number() })
    .optional(),
});

const inspected = z.object({
  component: z
    .object({
      name: z.string(),
      primitive: z.string().nullable(),
      variants: z.array(z.object({ name: z.string(), value: z.string() })),
    })
    .nullable(),
  callSite: place,
  definition: place,
  styles: z.array(
    z.object({ className: z.string(), token: z.string().optional() }),
  ),
});

export type Pick = z.infer<typeof selected> & { frame: string };

/** The picks in the report the selection module sends, frame by frame. */
export function picksFrom(reports: Readonly<Record<string, unknown>>): Pick[] {
  return Object.entries(reports).flatMap(([frame, value]) => {
    const parsed = selected.safeParse(value);
    return parsed.success ? [{ ...parsed.data, frame }] : [];
  });
}

function pageOf(href: string | null): string | null {
  if (!href) return null;
  try {
    // A hash can be the page, in a hash-routed app. A query can hold a one-time token.
    const { pathname, hash } = new URL(href);
    return `${pathname}${hash}`;
  } catch {
    return null;
  }
}

/**
 * What's on the canvas right now, so "this page" means something (TRU-10.7). The
 * person works in the active frame, and a lone frame is the one they mean.
 */
export function screenOf(
  frames: readonly PanelFrame[],
  activeFrame: string | null,
): Screen {
  const active = frames.some(({ id }) => id === activeFrame);
  return {
    frames: frames.map(({ id, label, href, width, height }) => ({
      id,
      label,
      page: pageOf(href),
      width,
      height,
    })),
    workingIn: active
      ? activeFrame
      : frames.length === 1
        ? (frames[0]?.id ?? null)
        : null,
  };
}

/** One pick across a page's changes: its id doesn't survive a reload. */
export function pickKey(pick: Pick): string {
  return `${pick.frame} ${pick.selector}`;
}

/** What a chip attaches: the pick, plus what the inspector knows if it answered. */
export function attachmentOf(pick: Pick, inspection: unknown): Attachment {
  const parsed = inspected.safeParse(inspection);
  const known = parsed.success ? parsed.data : null;
  return {
    label: known?.component?.name ?? pick.tag,
    frame: pick.frame,
    href: pick.href,
    selector: pick.selector,
    width: pick.width,
    tag: pick.tag,
    classes: pick.classes,
    text: pick.text,
    component: known?.component?.name ?? null,
    primitive: known?.component?.primitive ?? null,
    variants: (known?.component?.variants ?? []).map(({ name, value }) => ({
      name,
      value,
    })),
    callSite: known?.callSite.at ?? null,
    definition: known?.definition.at ?? null,
    tokens: (known?.styles ?? []).flatMap(({ className, token }) =>
      token ? [{ className, token }] : [],
    ),
  };
}
