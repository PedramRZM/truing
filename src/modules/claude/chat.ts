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
import { refusal } from '../../claude/path-guard.mjs';
import {
  prepareSession,
  type PreparedSession,
  sessionEnv,
  writableRules,
} from '../../claude/session';
import type { TruingConfig } from '../../config';
import { messageOf, type ScreenshotControl } from '../../module';

import { type Bridge, type Decision, startBridge } from './bridge';
import {
  chatTitle,
  type ChatStore,
  createChatStore,
  defaultChatsDir,
} from './chat-store';
import {
  changedFiles,
  diffOf,
  snapshot,
  undoTurn,
  type UndoResult,
} from './checkpoint';
import {
  applyEvent,
  GENERIC_STOP,
  newProgress,
  type TurnProgress,
} from './events';
import { promptSummary, renderTurn } from './message';
import {
  type Attachment,
  type Chat,
  type Effort,
  MODELS,
  type Mode,
  type Model,
  type Problem,
  type Screen,
  type Turn,
} from './module';
import { startRun, type Run, type StartRun } from './run';

/** A long turn is one a designer should look at. */
const MAX_TURNS = 40;
/** How often the turn under way goes to the panel: enough to read as streaming. */
const LIVE_EVERY_MS = 50;
/** Long enough for hot reload to show the change before the frames are captured. */
const SETTLE_MS = 1500;

/** On a turn that may have changed files, when there's no way to undo them (TRU-5.3). */
const NO_UNDO =
  "This project isn't in git, so there's no Undo for this message.";

/** Anything but reading and searching could have changed a file. */
function mayHaveChanged(parts: Turn['parts']): boolean {
  return parts.some(
    (part) =>
      part.kind === 'activity' &&
      part.verb !== 'read' &&
      part.verb !== 'searched',
  );
}

/** Why Undo didn't run, in the designer's terms. */
function undoWords(result: Exclude<UndoResult, { ok: true }>): string {
  const files = result.files.join(', ');
  if (result.reason === 'moved') {
    return `${files} changed after this turn. Undo the later change first.`;
  }
  return result.rolledBack
    ? `Couldn't put ${files} back, so nothing changed. Try Undo again.`
    : `Couldn't put ${files} back, and some files may already be undone. Check them before you go on.`;
}

export type SendInput = {
  text: string;
  attachments: readonly Attachment[];
  screen?: Screen | undefined;
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
  /** The tests pass a slow one. */
  store?: ChatStore;
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
  const store =
    options.store ??
    createChatStore(options.chatsDir ?? defaultChatsDir(config.name));

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
  /** The turn's plan so far, for the prompt that ends Plan mode. */
  let plan: string | null = null;
  /** A message came after Stop, before the turn ended: it's the go-ahead. */
  let carryOn = false;
  /** Each save follows the one before, so an older one can't land last. */
  let saves: Promise<void> = Promise.resolve();
  let live: Turn | null = null;
  let liveTimer: ReturnType<typeof setTimeout> | null = null;
  let bridge: Promise<Bridge> | null = null;
  let closed = false;

  function update(patch: Partial<Chat>): void {
    chat = { ...chat, ...patch };
    publish.chat(chat);
  }

  /** Writes the chat as it stands, and lists it. A failure here doesn't stop the turn. */
  function saveChat(): Promise<void> {
    if (chat.turns.length === 0) return saves;
    // Named and copied now (TRU-5.3): by the time it's written, the designer may have
    // started a new chat, and this one's id must not come back.
    const id = chat.chatId ?? newId('chat');
    if (chat.chatId === null) update({ chatId: id });
    const saved = {
      id,
      title: chatTitle(chat.turns),
      updatedAt: new Date().toISOString(),
      sessionId,
      // Pictures are for the turn in front of the designer.
      turns: chat.turns.map((turn) => ({ ...turn, frames: [] })),
    };
    saves = saves.then(async () => {
      try {
        await store.save(saved);
        update({ sessions: await store.list() });
      } catch (error) {
        log(`Couldn't save this chat: ${messageOf(error)}`);
      }
    });
    return saves;
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

  function askDesigner(
    prompt: {
      tool_name: string;
      input: Record<string, unknown>;
    },
    gone: AbortSignal,
  ): Promise<Decision> {
    const id = newId('prompt');
    return new Promise<Decision>((resolve) => {
      answers.set(id, resolve);
      // Nobody is waiting for this answer any more, so it can't stay clickable (TRU-5.3).
      gone.addEventListener('abort', () => {
        if (!answers.delete(id)) return;
        resolve({ allow: false });
        update({ prompts: chat.prompts.filter((entry) => entry.id !== id) });
      });
      update({
        prompts: [
          ...chat.prompts,
          {
            id,
            tool: prompt.tool_name,
            what: promptSummary(prompt.tool_name, prompt.input, plan),
          },
        ],
      });
    });
  }

  /**
   * Whether Undo may put this file back (TRU-5.3). A turn sees whatever changed while it
   * ran, and a change to anything else may be someone's own.
   */
  function mayWrite(file: string): boolean {
    try {
      return refusal(writableRules(root, config), file, root) === null;
    } catch {
      return false;
    }
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
    plan = null;
    const input = renderTurn(
      { ...message, notes },
      await imagesFor(message.attachments),
      sessionId,
    );
    // Stopped while it was getting ready (TRU-5.3): nothing has run, and Claude still
    // has the notes to hear.
    if (stopping) return { progress, startError: null };
    notes = [];
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
        plan = progress.plan;
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
      progress.problem?.kind === 'other' &&
      progress.problem.message === GENERIC_STOP
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
    if (!after && mayHaveChanged(finished.parts)) {
      finished = { ...finished, undoNote: NO_UNDO };
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
    const blocked = stopping ? !carryOn : finished.problem !== null;
    if (blocked) update({ paused: true });
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
          paused: !carryOn,
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
        stopping = false;
        carryOn = false;
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
      if (stopping) carryOn = true;
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
      if (!chat.working) return;
      stopping = true;
      carryOn = false;
      refusePrompts();
      current?.interrupt();
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
        const paths = turn.files.map((file) => file.path);
        const mine = paths.filter(mayWrite);
        const left = paths.filter((file) => !mine.includes(file)).join(', ');
        if (mine.length === 0) {
          replaceTurn(id, {
            undoProblem: `Undo covers only the files Claude may write, so ${left} stayed as they are.`,
          });
          return;
        }
        const result = await undoTurn(
          root,
          checkpoint.before,
          checkpoint.after,
          mine,
        );
        if (!result.ok) {
          replaceTurn(id, { undoProblem: undoWords(result) });
          return;
        }
        checkpoints.delete(id);
        notes.push(
          `The designer undid your changes from an earlier message, to ${mine.join(', ')}. Those files are back as they were before it.${left ? ` Undo left these as they are: ${left}.` : ''}`,
        );
        replaceTurn(id, {
          decision: 'undone',
          frames: [],
          undoProblem: null,
          ...(left
            ? {
                undoNote: `Left as they are: ${left}. Undo covers only the files Claude may write.`,
              }
            : {}),
        });
        await saveChat();
      });
    },

    async close(): Promise<void> {
      closed = true;
      // A turn still getting ready mustn't start Claude after this.
      if (chat.working) stopping = true;
      if (liveTimer) clearTimeout(liveTimer);
      refusePrompts();
      current?.interrupt();
      const started = bridge;
      bridge = null;
      if (started) await (await started).close();
    },
  };
}
