import * as z from 'zod/mini';

import { defineModule } from '../../module';

/**
 * Claude in Truing (TRU-5.2): the chat in the right panel and the prompt on a
 * pick. It runs on the designer's own Claude Code, with the project's own
 * configuration, and nothing here knows about one project.
 */

declare const __TRUING_RUNTIME__: boolean | undefined;

export const MODELS = ['fable', 'opus', 'sonnet', 'haiku'] as const;
export type Model = (typeof MODELS)[number];
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];
/** Claude Code's permission modes; `src/claude/session.ts` has the flags. */
export const MODES = [
  'manual',
  'acceptEdits',
  'plan',
  'auto',
  'dontAsk',
  'bypassPermissions',
] as const;
export type Mode = (typeof MODES)[number];

/**
 * Only Truing's process and the shell read these, made in one function the
 * bundler may drop: a top-level schema would ship in every frame.
 */
function chatSchemas() {
  const place = z.object({
    file: z.string(),
    line: z.number(),
    column: z.number(),
  });

  /** A picked element, as Claude gets it. Its text and classes come from the page. */
  const attachment = z.object({
    /** What the chip says: the component, or the tag. */
    label: z.string(),
    frame: z.string(),
    href: z.string(),
    selector: z.string(),
    /** The frame's width when it was picked. */
    width: z.number(),
    tag: z.string(),
    classes: z.array(z.string()),
    text: z.nullable(z.string()),
    component: z.nullable(z.string()),
    primitive: z.nullable(z.string()),
    variants: z.array(z.object({ name: z.string(), value: z.string() })),
    callSite: z.nullable(place),
    definition: z.nullable(place),
    /** The classes that read a token, with the token. */
    tokens: z.array(z.object({ className: z.string(), token: z.string() })),
  });

  /** The frames on the canvas when a message was sent, for "this page". */
  const screen = z.object({
    frames: z.array(
      z.object({
        id: z.string(),
        /** Phone, Tablet, Desktop, a device name or Custom. */
        label: z.string(),
        /** Its path and hash; null while it's still loading. */
        page: z.nullable(z.string()),
        width: z.number(),
        height: z.number(),
      }),
    ),
    /** The frame the person is working in; null when nothing marks one out. */
    workingIn: z.nullable(z.string()),
  });

  const part = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('text'), text: z.string() }),
    z.object({
      kind: z.literal('activity'),
      id: z.string(),
      verb: z.enum(['read', 'changed', 'searched', 'ran', 'used', 'asked']),
      /** What it was done to: a file's name, a command. */
      object: z.nullable(z.string()),
      failed: z.boolean(),
    }),
  ]);

  const problem = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('signed-out') }),
    /** When the limit lifts, in seconds since the epoch, if Claude said. */
    z.object({ kind: z.literal('limit'), resetsAt: z.nullable(z.number()) }),
    z.object({ kind: z.literal('other'), message: z.string() }),
  ]);

  const file = z.object({
    path: z.string(),
    /** Null for a file git can't count lines in. */
    added: z.nullable(z.number()),
    removed: z.nullable(z.number()),
  });

  const turn = z.object({
    id: z.string(),
    /** What the designer wrote. */
    text: z.string(),
    chips: z.array(z.string()),
    scoped: z.boolean(),
    model: z.enum(MODELS),
    effort: z.enum(EFFORTS),
    status: z.enum(['running', 'done', 'stopped', 'failed']),
    parts: z.array(part),
    problem: z.nullable(problem),
    /** What the turn changed, once it has ended; empty if nothing. */
    files: z.array(file),
    diff: z.string(),
    /** Each frame after the turn, as a data URL, while the decision is open. */
    frames: z.array(z.object({ frame: z.string(), image: z.string() })),
    decision: z.enum(['none', 'open', 'kept', 'undone']),
    /** Why Undo couldn't run, if it couldn't. */
    undoProblem: z.nullable(z.string()),
  });

  const queued = z.object({
    id: z.string(),
    text: z.string(),
    chips: z.array(z.string()),
  });

  const prompt = z.object({
    id: z.string(),
    /** The tool, as Claude Code names it. */
    tool: z.string(),
    /** What it wants to do, in one line: a command, a path. */
    what: z.string(),
  });

  const chat = z.object({
    working: z.boolean(),
    /** Stopped, or hit a limit or a sign-in: the queue waits for the next message. */
    paused: z.boolean(),
    turns: z.array(turn),
    queue: z.array(queued),
    prompts: z.array(prompt),
    /** Null until asked, or when Claude Code couldn't say. */
    signedIn: z.nullable(z.boolean()),
    /** The chat showing; null until its first message. */
    chatId: z.nullable(z.string()),
    /** Earlier chats in this project, newest first. */
    sessions: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        updatedAt: z.string(),
        messages: z.number(),
      }),
    ),
    /** What each model in the menu is today, as Claude Code says: `Opus 5.5`. */
    models: z.partialRecord(z.enum(MODELS), z.string()),
  });

  return { attachment, screen, chat, turn, part, problem, file };
}

export const schemas = /* @__PURE__ */ chatSchemas();

export type Attachment = z.infer<typeof schemas.attachment>;
export type Screen = z.infer<typeof schemas.screen>;
export type Chat = z.infer<typeof schemas.chat>;
export type Turn = z.infer<typeof schemas.turn>;
export type Part = z.infer<typeof schemas.part>;
export type Problem = z.infer<typeof schemas.problem>;
export type ChangedFile = z.infer<typeof schemas.file>;

const anchor = z.object({
  selector: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type Anchor = z.infer<typeof anchor>;

const nothing = z.object({ ok: z.boolean() });
const byId = z.object({ id: z.string() });

export default defineModule({
  id: 'claude',
  title: 'Claude',
  panel: {
    docks: ['right'],
    view: 'claude',
    // The pick is what a message attaches.
    follows: { selection: ['selected'] },
  },
  probe: {
    reports: {
      /** Where the element the prompt sits on is now; null in Interact, or when it's gone. */
      anchor: z.nullable(anchor),
    },
    commands: {
      /** Follows this element for the prompt on a pick; null stops. */
      track: {
        input: z.object({ selector: z.nullable(z.string()) }),
        output: nothing,
      },
    },
  },
  actions: {
    'ask-claude': {
      title: 'Ask Claude about this',
      keys: [{ key: 'a' }],
      menu: 'open',
    },
  },
  // Only Truing's own process and the shell read these.
  server:
    typeof __TRUING_RUNTIME__ === 'undefined'
      ? {
          state: {
            /** Everything but the turn under way. */
            chat: schemas.chat,
            /** The turn under way, sent often while it streams. */
            live: z.nullable(schemas.turn),
          },
          ops: {
            /** Asks Claude Code whether it's signed in. It costs no model call. */
            status: { input: z.object({}), output: nothing },
            /** Sends a message, or queues it while Claude is working. */
            send: {
              input: z.object({
                text: z.string(),
                attachments: z.array(schemas.attachment),
                /** What's on the canvas as it's sent (TRU-10.7). */
                screen: z.optional(schemas.screen),
                /** A prompt on one element: the request is about that element only. */
                scoped: z.boolean(),
                model: z.enum(MODELS),
                effort: z.enum(EFFORTS),
                mode: z.enum(MODES),
              }),
              output: nothing,
            },
            /** Forgets the conversation. What Claude changed stays in the code. */
            newChat: { input: z.object({}), output: nothing },
            /** Carries on an earlier chat, with Claude's memory of it. */
            resume: { input: byId, output: nothing },
            stop: { input: z.object({}), output: nothing },
            unqueue: { input: byId, output: nothing },
            /** The designer's answer to a permission prompt: only yes or no. */
            answer: {
              input: z.object({ id: z.string(), allow: z.boolean() }),
              output: nothing,
            },
            keep: { input: byId, output: nothing },
            undo: { input: byId, output: nothing },
          },
        }
      : undefined,
});
