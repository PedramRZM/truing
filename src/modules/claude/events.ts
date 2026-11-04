// Claude Code's stream-json events, turned into what the chat shows. Pure, and
// tolerant: an event it doesn't know changes nothing, as these details move
// between Claude Code's versions (seen on 2.1.317).
import path from 'node:path';

import { z } from 'zod';

import type { Part, Problem } from './module';

export type TurnProgress = {
  sessionId: string | null;
  parts: Part[];
  problem: Problem | null;
  /** The answer came to an end, by `result`. */
  ended: boolean;
  /** Assistant messages already shown through their deltas. */
  streamed: readonly string[];
  /** The message the deltas now belong to. */
  message: string | null;
};

export function newProgress(sessionId: string | null): TurnProgress {
  return {
    sessionId,
    parts: [],
    problem: null,
    ended: false,
    streamed: [],
    message: null,
  };
}

const withSession = z.object({ session_id: z.string() });

const streamEvent = z.object({
  type: z.literal('stream_event'),
  parent_tool_use_id: z.string().nullable().optional(),
  event: z.object({
    type: z.string(),
    message: z.object({ id: z.string() }).optional(),
    delta: z
      .object({ type: z.string(), text: z.string().optional() })
      .optional(),
  }),
});

const assistant = z.object({
  type: z.literal('assistant'),
  parent_tool_use_id: z.string().nullable().optional(),
  error: z.string().optional(),
  message: z.object({
    id: z.string().optional(),
    content: z.array(
      z.looseObject({
        type: z.string(),
        text: z.string().optional(),
        id: z.string().optional(),
        name: z.string().optional(),
        input: z.record(z.string(), z.unknown()).optional(),
      }),
    ),
  }),
});

const user = z.object({
  type: z.literal('user'),
  message: z.object({
    content: z.union([
      z.string(),
      z.array(
        z.looseObject({
          type: z.string(),
          tool_use_id: z.string().optional(),
          is_error: z.boolean().optional(),
        }),
      ),
    ]),
  }),
});

const rateLimit = z.object({
  type: z.literal('rate_limit_event'),
  rate_limit_info: z.object({
    status: z.string(),
    resetsAt: z.number().optional(),
  }),
});

const apiRetry = z.object({
  type: z.literal('system'),
  subtype: z.literal('api_retry'),
  error: z.string().optional(),
});

const result = z.object({
  type: z.literal('result'),
  subtype: z.string().optional(),
  is_error: z.boolean().optional(),
});

/** The stop with no reason given: on a resumed chat it may mean the record has gone. */
export const GENERIC_STOP =
  'Claude stopped before finishing. Send it again to retry.';

/** A limit with no time says less than one that has it, so it doesn't replace it. */
function worseProblem(known: Problem | null, next: Problem): Problem {
  return next.kind === 'limit' &&
    next.resetsAt === null &&
    known?.kind === 'limit'
    ? known
    : next;
}

/** A category Claude Code reports, as what the designer can do about it. */
function problemOf(category: string | undefined): Problem | null {
  switch (category) {
    case 'authentication_failed':
      return { kind: 'signed-out' };
    case 'rate_limit':
      return { kind: 'limit', resetsAt: null };
    case 'billing_error':
      return {
        kind: 'other',
        message:
          "Your Claude plan can't run this. Check it at claude.ai, then send again.",
      };
    case 'oauth_org_not_allowed':
      return {
        kind: 'other',
        message:
          "Your organisation doesn't allow Claude Code on this plan. Ask its admin.",
      };
    default:
      return null;
  }
}

function fileName(input: Record<string, unknown>): string | null {
  const file = input.file_path ?? input.notebook_path;
  return typeof file === 'string' ? path.basename(file) : null;
}

const NO_ROW = new Set(['TodoWrite', 'ToolSearch']);

/** A tool call in plain words; null for what a designer has no use for. */
export function describeTool(
  name: string,
  input: Record<string, unknown>,
): Pick<Extract<Part, { kind: 'activity' }>, 'verb' | 'object'> | null {
  if (NO_ROW.has(name) || name.endsWith('__approve')) return null;
  switch (name) {
    case 'Read':
      return { verb: 'read', object: fileName(input) };
    case 'Edit':
    case 'Write':
    case 'MultiEdit':
    case 'NotebookEdit':
      return { verb: 'changed', object: fileName(input) };
    case 'Grep':
    case 'Glob':
      return { verb: 'searched', object: null };
    case 'Bash':
      return {
        verb: 'ran',
        object: typeof input.command === 'string' ? input.command : null,
      };
    case 'Skill':
      return {
        verb: 'used',
        object: typeof input.skill === 'string' ? input.skill : null,
      };
    case 'Task':
    case 'Agent':
      return { verb: 'asked', object: 'a helper' };
    default:
      break;
  }
  if (name.startsWith('mcp__next__')) {
    return { verb: 'asked', object: 'Next.js' };
  }
  return { verb: 'used', object: name.replace(/^mcp__[^_]+(?:-[^_]+)*__/, '') };
}

function appendText(parts: readonly Part[], text: string): Part[] {
  const last = parts.at(-1);
  if (last?.kind === 'text') {
    return [...parts.slice(0, -1), { kind: 'text', text: last.text + text }];
  }
  return [...parts, { kind: 'text', text }];
}

/** One event's effect on a turn. Anything it doesn't know leaves the turn alone. */
export function applyEvent(turn: TurnProgress, event: unknown): TurnProgress {
  const session = withSession.safeParse(event);
  const next = session.success
    ? { ...turn, sessionId: session.data.session_id }
    : turn;

  const stream = streamEvent.safeParse(event);
  if (stream.success) {
    // A helper's words stay with the helper.
    if (stream.data.parent_tool_use_id) return next;
    const { type, message, delta } = stream.data.event;
    if (type === 'message_start' && message) {
      return { ...next, message: message.id };
    }
    if (type === 'content_block_delta' && delta?.type === 'text_delta') {
      return {
        ...next,
        parts: appendText(next.parts, delta.text ?? ''),
        streamed: next.message
          ? [...new Set([...next.streamed, next.message])]
          : next.streamed,
      };
    }
    return next;
  }

  const said = assistant.safeParse(event);
  if (said.success) {
    if (said.data.parent_tool_use_id) return next;
    // A failure arrives as a made-up assistant message: its text isn't Claude's answer.
    const failure = problemOf(said.data.error);
    if (failure) {
      return { ...next, problem: worseProblem(next.problem, failure) };
    }
    const { id, content } = said.data.message;
    const shown = id !== undefined && next.streamed.includes(id);
    let parts = next.parts;
    for (const block of content) {
      if (block.type === 'text' && block.text && !shown) {
        parts = appendText(parts, block.text);
      }
      if (block.type === 'tool_use' && block.name && block.id) {
        const row = describeTool(block.name, block.input ?? {});
        if (row) {
          parts = [
            ...parts,
            { kind: 'activity', id: block.id, failed: false, ...row },
          ];
        }
      }
    }
    return { ...next, parts };
  }

  const answered = user.safeParse(event);
  if (answered.success) {
    const { content } = answered.data.message;
    if (typeof content === 'string') return next;
    const failed = new Set(
      content.flatMap((block) =>
        block.type === 'tool_result' && block.is_error && block.tool_use_id
          ? [block.tool_use_id]
          : [],
      ),
    );
    if (failed.size === 0) return next;
    return {
      ...next,
      parts: next.parts.map((part) =>
        part.kind === 'activity' && failed.has(part.id)
          ? { ...part, failed: true }
          : part,
      ),
    };
  }

  const limit = rateLimit.safeParse(event);
  if (limit.success) {
    const { status, resetsAt } = limit.data.rate_limit_info;
    if (status !== 'rejected') return next;
    return {
      ...next,
      problem: { kind: 'limit', resetsAt: resetsAt ?? null },
    };
  }

  const retry = apiRetry.safeParse(event);
  if (retry.success) {
    const failure = problemOf(retry.data.error);
    return failure
      ? { ...next, problem: worseProblem(next.problem, failure) }
      : next;
  }

  const ended = result.safeParse(event);
  if (ended.success) {
    if (!ended.data.is_error) {
      // A retry that went through took its problem with it.
      return { ...next, ended: true, problem: null };
    }
    return {
      ...next,
      ended: true,
      problem:
        next.problem ??
        (ended.data.subtype === 'error_max_turns'
          ? {
              kind: 'other',
              message:
                'Claude reached its limit of steps for one message. Send another to continue.',
            }
          : { kind: 'other', message: GENERIC_STOP }),
    };
  }

  return next;
}
