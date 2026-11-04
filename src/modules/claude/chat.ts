// The chat, apart from Truing's plumbing so a test can drive it with a fake
// Claude: a queue of messages, one run at a time, each turn's checkpoint, its
// permission prompts, and keeping or undoing it.
import { randomUUID } from 'node:crypto';

import {
  askModels,
  isLoggedIn,
  type RunClaude,
  runClaude,
} from '../../claude/cli';
import {
  prepareSession,
  type PreparedSession,
  sessionEnv,
} from '../../claude/session';
import type { TruingConfig } from '../../config';
import { messageOf, type ScreenshotControl } from '../../module';

import { type Bridge, type Decision, startBridge } from './bridge';
import { chatTitle, createChatStore, defaultChatsDir } from './chat-store';
import { changedFiles, diffOf, snapshot, undoTurn } from './checkpoint';
import { applyEvent, newProgress, type TurnProgress } from './events';
import { promptSummary, renderMessage, renderText } from './message';
import {
  type Attachment,
  type Chat,
  type Effort,
  MODELS,
  type Mode,
  type Model,
  type Problem,
  type Turn,
} from './module';
import { startRun, type Run, type StartRun } from './run';

/** A long turn is one a designer should look at. */
const MAX_TURNS = 40;
/** How often the turn under way goes to the panel: enough to read as streaming. */
const LIVE_EVERY_MS = 50;
/** Long enough for hot reload to show the change before the frames are captured. */
const SETTLE_MS = 1500;

export type SendInput = {
  text: string;
  attachments: readonly Attachment[];
  scoped: boolean;
  model: Model;
  effort: Effort;
  mode: Mode;
};

type Queued = SendInput & { id: string };

/** A kept turn's trees stay out of the panel: what Undo needs, and nothing else. */
type Checkpoint = { before: string; after: string };

export type ChatOptions = {
  root: string;
  config: Pick<
    TruingConfig,
    'app' | 'claude' | 'name' | 'primitives' | 'tokens' | 'writable'
  >;
  publish: {
    chat: (value: Chat) => void;
    live: (value: Turn | null) => void;
  };
  exclusive: <T>(job: () => Promise<T>) => Promise<T>;
  screenshot: ScreenshotControl;
  frames: () => readonly string[];
  log: (line: string) => void;
  /** The tests start a fake. */
  start?: StartRun;
  runCli?: RunClaude;
  settleMs?: number;
  /** Where its chats are kept; the tests pass a temporary folder. */
  chatsDir?: string;
};

function newTurn(message: Queued): Turn {
  return {
    id: message.id,
    text: message.text,
    chips: message.attachments.map((attachment) => attachment.label),
    scoped: message.scoped,
    model: message.model,
    effort: message.effort,
    status: 'running',
    parts: [],
    problem: null,
    files: [],
    diff: '',
    frames: [],
    decision: 'none',
    undoProblem: null,
  };
}

export function createChat(options: ChatOptions) {
  const { root, config, publish, exclusive, screenshot, frames, log } = options;
  const start = options.start ?? startRun;
  const runCli = options.runCli ?? runClaude;
  const settleMs = options.settleMs ?? SETTLE_MS;
  const store = createChatStore(
    options.chatsDir ?? defaultChatsDir(config.name),
  );

  // Random, as a chat brought back keeps the ids it was saved with.
  const newId = (kind: string): string => `${kind}-${randomUUID().slice(0, 8)}`;

  let chat: Chat = {
    working: false,
    paused: false,
    turns: [],
    queue: [],
    prompts: [],
    signedIn: null,
    chatId: null,
    sessions: [],
    models: {},
  };
  /** The attachments and choices of what's queued; the panel sees only the words. */
  const queue: Queued[] = [];
  const checkpoints = new Map<string, Checkpoint>();
  const answers = new Map<string, (decision: Decision) => void>();
  /** Claude's own memory says it made a change the designer has since undone. */
  let notes: string[] = [];
  let sessionId: string | null = null;
  let current: Run | null = null;
  let stopping = false;
  let live: Turn | null = null;
  let liveTimer: ReturnType<typeof setTimeout> | null = null;
  let bridge: Promise<Bridge> | null = null;
  let closed = false;

  function update(patch: Partial<Chat>): void {
    chat = { ...chat, ...patch };
    publish.chat(chat);
  }

  /** Writes the chat as it stands, and lists it. A failure here doesn't stop the turn. */
  async function saveChat(): Promise<void> {
    if (chat.turns.length === 0) return;
    const id = chat.chatId ?? newId('chat');
    try {
      await store.save({
        id,
        title: chatTitle(chat.turns),
        updatedAt: new Date().toISOString(),
        sessionId,
        // Pictures are for the turn in front of the designer.
        turns: chat.turns.map((turn) => ({ ...turn, frames: [] })),
      });
      update({ chatId: id, sessions: await store.list() });
    } catch (error) {
      log(`Couldn't save this chat: ${messageOf(error)}`);
    }
  }

  function sendLive(): void {
    if (liveTimer) {
      clearTimeout(liveTimer);
      liveTimer = null;
    }
    publish.live(live);
  }

  function sendLiveSoon(): void {
    liveTimer ??= setTimeout(sendLive, LIVE_EVERY_MS);
  }

  function replaceTurn(id: string, patch: Partial<Turn>): void {
    update({
      turns: chat.turns.map((turn) =>
        turn.id === id ? { ...turn, ...patch } : turn,
      ),
    });
  }

  function askDesigner(prompt: {
    tool_name: string;
    input: Record<string, unknown>;
  }): Promise<Decision> {
    const id = newId('prompt');
    return new Promise<Decision>((resolve) => {
      answers.set(id, resolve);
      update({
        prompts: [
          ...chat.prompts,
          {
            id,
            tool: prompt.tool_name,
            what: promptSummary(prompt.tool_name, prompt.input),
          },
        ],
      });
    });
  }

  /** A run that ended leaves no prompt to answer. */
  function refusePrompts(): void {
    for (const resolve of answers.values()) resolve({ allow: false });
    answers.clear();
    if (chat.prompts.length > 0) update({ prompts: [] });
  }

  function bridgeOnce(): Promise<Bridge> {
    bridge ??= startBridge(askDesigner);
    return bridge;
  }

  async function imagesFor(
    attachments: readonly Attachment[],
  ): Promise<(Buffer | null)[]> {
    return Promise.all(
      attachments.map(({ frame, selector }) =>
        screenshot.element(frame, selector).catch((error: unknown) => {
          log(`No screenshot of ${selector}: ${messageOf(error)}`);
          return null;
        }),
      ),
    );
  }

  /** A failure to start, in the designer's terms. */
  function startProblem(code: string): Problem {
    return {
      kind: 'other',
      message:
        code === 'ENOENT'
          ? "Couldn't find Claude Code on this computer. Install it or add it to your PATH."
          : 'Claude Code stopped before answering. Run claude in a terminal to see why.',
    };
  }

  async function runTurn(
    message: Queued,
    turn: Turn,
    session: PreparedSession,
  ): Promise<{ progress: TurnProgress; startError: string | null }> {
    let progress = newProgress(sessionId);
    const text = renderText({ ...message, notes });
    notes = [];
    const input = renderMessage(
      text,
      await imagesFor(message.attachments),
      sessionId,
    );
    const run = start({
      args: [
        '-p',
        ...session.args,
        '--input-format',
        'stream-json',
        '--output-format',
        'stream-json',
        '--verbose',
        '--include-partial-messages',
        // Without one, a run takes whatever default Claude Code has today.
        '--model',
        message.model,
        '--effort',
        message.effort,
        '--max-turns',
        String(MAX_TURNS),
        ...(sessionId ? ['--resume', sessionId] : []),
      ],
      cwd: root,
      env: session.env,
      input,
      onEvent: (event) => {
        progress = applyEvent(progress, event);
        live = { ...turn, parts: progress.parts, problem: progress.problem };
        sendLiveSoon();
      },
    });
    current = run;
    const end = await run.done;
    current = null;
    const resumed = sessionId !== null;
    sessionId = progress.sessionId;
    // Claude Code keeps a session's record for a limited time.
    if (
      resumed &&
      progress.parts.length === 0 &&
      progress.problem?.kind === 'other'
    ) {
      progress = {
        ...progress,
        problem: {
          kind: 'other',
          message:
            "Claude Code couldn't carry on this chat. Its record may have expired. Start a new chat to continue.",
        },
      };
    }
    if (end.code !== 0 && !progress.ended && !progress.problem && !stopping) {
      progress = {
        ...progress,
        problem: startProblem(end.startError ?? 'exit'),
      };
    }
    return { progress, startError: end.startError };
  }

  /** What the turn left on the canvas, once hot reload has shown it. */
  async function captureFrames(id: string): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, settleMs));
    if (closed) return;
    const shots = await Promise.all(
      frames().map(async (frame) => {
        const shot = await screenshot.frame(frame).catch(() => null);
        return shot
          ? [
              {
                frame,
                image: `data:image/jpeg;base64,${shot.toString('base64')}`,
              },
            ]
          : [];
      }),
    );
    const turn = chat.turns.find((entry) => entry.id === id);
    if (turn?.decision === 'open') {
      replaceTurn(id, { frames: shots.flat() });
    }
  }

  async function turnOf(message: Queued): Promise<void> {
    const turn = newTurn(message);
    live = turn;
    sendLive();

    const before = await snapshot(root);
    const session = await prepareSession({
      root,
      config,
      bridge: (await bridgeOnce()).address,
      mode: message.mode,
    });
    let finished: Turn;
    try {
      const { progress } = await runTurn(message, turn, session);
      const problem = progress.problem;
      finished = {
        ...turn,
        parts: progress.parts,
        problem,
        status: stopping ? 'stopped' : problem ? 'failed' : 'done',
      };
    } finally {
      refusePrompts();
      await session.dispose();
    }

    const after = before && (await snapshot(root));
    if (before && after && before !== after) {
      const files = await changedFiles(root, before, after);
      if (files.length > 0) {
        checkpoints.set(turn.id, { before, after });
        finished = {
          ...finished,
          files,
          diff: await diffOf(root, before, after),
          decision: 'open',
        };
      }
    }

    live = null;
    sendLive();
    // Pictures are for the turn in front of the designer, not the whole history.
    update({
      turns: [
        ...chat.turns.map((entry) => ({ ...entry, frames: [] })),
        finished,
      ],
    });
    await saveChat();
    if (finished.decision === 'open') void captureFrames(turn.id);

    // Waits for the next message, rather than fail each one in the queue.
    const blocked = stopping || finished.problem !== null;
    if (blocked) update({ paused: true });
    stopping = false;
  }

  function showQueue(): Chat['queue'] {
    return queue.map(({ id, text, attachments }) => ({
      id,
      text,
      chips: attachments.map((attachment) => attachment.label),
    }));
  }

  /** One run at a time, in the queue's order, and never beside a direct edit. */
  function pump(): void {
    if (chat.working || chat.paused || closed) return;
    const message = queue.shift();
    if (!message) return;
    update({ working: true, queue: showQueue() });
    void exclusive(() => turnOf(message))
      .catch((error: unknown) => {
        log(`A turn failed: ${messageOf(error)}`);
        live = null;
        sendLive();
        update({
          paused: true,
          turns: [
            ...chat.turns,
            {
              ...newTurn(message),
              status: 'failed',
              problem: { kind: 'other', message: messageOf(error) },
            },
          ],
        });
      })
      .finally(() => {
        update({ working: false });
        pump();
      });
  }

  return {
    publishInitial(): void {
      publish.chat(chat);
      publish.live(null);
      void store.list().then((sessions) => update({ sessions }));
    },

    async status(): Promise<void> {
      update({
        signedIn: await isLoggedIn(runCli, {
          cwd: root,
          env: sessionEnv(config.claude?.dropEnv),
        }),
      });
      // Once per run of Truing: it takes a process for each model.
      if (Object.keys(chat.models).length > 0) return;
      const session = await prepareSession({ root, config });
      try {
        update({
          models: await askModels(runCli, MODELS, {
            args: session.args,
            cwd: root,
            env: session.env,
          }),
        });
      } finally {
        await session.dispose();
      }
    },

    send(input: SendInput): void {
      if (!input.text.trim()) {
        throw new Error('Write what you want changed first.');
      }
      queue.push({ ...input, id: newId('turn') });
      // A new message is the designer saying to carry on.
      update({ paused: false, queue: showQueue() });
      pump();
    },

    /** The next message starts a new conversation. Undo goes with this one. */
    newChat(): void {
      if (chat.working) {
        throw new Error('Claude is working. Stop it first, or wait for it.');
      }
      sessionId = null;
      notes = [];
      queue.length = 0;
      checkpoints.clear();
      update({ chatId: null, turns: [], queue: [], paused: false });
    },

    /**
     * Brings back an earlier chat, and Claude's memory of it. A turn still waiting
     * for its decision comes back kept: Undo holds only for the chat in front of
     * the designer, as the code has moved on since.
     */
    async resume(id: string): Promise<void> {
      if (chat.working) {
        throw new Error('Claude is working. Stop it first, or wait for it.');
      }
      const saved = await store.load(id);
      if (!saved) throw new Error("That chat couldn't be read.");
      sessionId = saved.sessionId;
      notes = [];
      queue.length = 0;
      checkpoints.clear();
      update({
        chatId: saved.id,
        queue: [],
        paused: false,
        turns: saved.turns.map((turn) =>
          turn.decision === 'open' ? { ...turn, decision: 'kept' } : turn,
        ),
      });
    },

    stop(): void {
      if (!current) return;
      stopping = true;
      refusePrompts();
      current.interrupt();
    },

    unqueue(id: string): void {
      const at = queue.findIndex((message) => message.id === id);
      if (at >= 0) queue.splice(at, 1);
      update({ queue: showQueue() });
    },

    answer(id: string, allow: boolean): void {
      const resolve = answers.get(id);
      if (!resolve) {
        throw new Error('That question has gone: Claude has moved on.');
      }
      answers.delete(id);
      resolve({ allow });
      update({ prompts: chat.prompts.filter((prompt) => prompt.id !== id) });
    },

    keep(id: string): void {
      checkpoints.delete(id);
      replaceTurn(id, { decision: 'kept', frames: [], undoProblem: null });
      void saveChat();
    },

    async undo(id: string): Promise<void> {
      const checkpoint = checkpoints.get(id);
      const turn = chat.turns.find((entry) => entry.id === id);
      if (!checkpoint || !turn) {
        throw new Error("This turn can't be undone anymore.");
      }
      await exclusive(async () => {
        const result = await undoTurn(
          root,
          checkpoint.before,
          checkpoint.after,
          turn.files.map((file) => file.path),
        );
        if (!result.ok) {
          replaceTurn(id, {
            undoProblem: `${result.files.join(', ')} changed after this turn. Undo the later change first.`,
          });
          return;
        }
        checkpoints.delete(id);
        notes.push(
          `The designer undid your changes from an earlier message, to ${turn.files.map((file) => file.path).join(', ')}. Those files are back as they were before it.`,
        );
        replaceTurn(id, {
          decision: 'undone',
          frames: [],
          undoProblem: null,
        });
        await saveChat();
      });
    },

    async close(): Promise<void> {
      closed = true;
      if (liveTimer) clearTimeout(liveTimer);
      refusePrompts();
      current?.interrupt();
      const started = bridge;
      bridge = null;
      if (started) await (await started).close();
    },
  };
}
