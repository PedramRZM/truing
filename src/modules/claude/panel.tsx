import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  ChevronRight,
  History,
  MessageSquare,
  Settings2,
  Square,
  SquarePen,
  TriangleAlert,
  X,
} from 'lucide-react';

import {
  type CanvasComponent,
  definePanel,
  messageOf,
  type PanelProps,
} from '../../module';
import { ChoiceMenu } from '../../shell/controls/choice-menu';
import { Composer, type ComposerChip } from '../../shell/controls/composer';

import {
  attachmentOf,
  type Pick,
  pickKey,
  picksFrom,
  screenOf,
} from './attachments';
import claude, {
  type Attachment,
  type Chat as ChatState,
  EFFORTS,
  type Effort,
  MODELS,
  MODES,
  type Mode,
  type Model,
  type Turn,
} from './module';
import { answerBlocks, problemWords, textRuns } from './words';

type Props = PanelProps<typeof claude>;

const CHOICES_KEY = 'truing:claude-choices';
const USED_KEY = 'truing:claude-used';

const MODEL_NAME = {
  fable: 'Fable',
  opus: 'Opus',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
} as const satisfies Record<Model, string>;

const EFFORT_NAME = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
} as const satisfies Record<Effort, string>;

/** Claude Code's permission modes, in the designer's words. */
const MODE_NAME = {
  manual: 'Ask first',
  acceptEdits: 'Accept edits',
  plan: 'Plan only',
  auto: 'Auto',
  dontAsk: "Don't ask",
  bypassPermissions: 'Bypass',
} as const satisfies Record<Mode, string>;

/** Under the composer, for the two modes that stop asking about commands. */
const MODE_NOTE: Partial<Record<Mode, string>> = {
  bypassPermissions:
    'Claude runs commands without asking, and a command can change any file. Its file tools stay limited to UI files.',
  dontAsk: "Claude won't ask. Anything not already allowed is refused.",
};

const FIRST_PROMPTS = [
  'Check this page against the design rules and list what looks off.',
  'Tighten the spacing on this page, using the tokens the project has.',
  'Which of these components could use an existing variant instead?',
];

type Choices = { model: Model; effort: Effort; mode: Mode };

const DEFAULT_CHOICES: Choices = {
  model: 'opus',
  effort: 'medium',
  mode: 'manual',
};

/** Bypass is for now: chosen in this page, and gone after a reload. */
let bypassChosen = false;

function loadChoices(): Choices {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(CHOICES_KEY) ?? '{}',
    );
    if (typeof stored !== 'object' || stored === null) return DEFAULT_CHOICES;
    const { model, effort, mode } = stored as Partial<Choices>;
    return {
      model: MODELS.find((name) => name === model) ?? DEFAULT_CHOICES.model,
      effort: EFFORTS.find((name) => name === effort) ?? DEFAULT_CHOICES.effort,
      mode:
        MODES.find(
          (name) =>
            name === mode && (name !== 'bypassPermissions' || bypassChosen),
        ) ?? DEFAULT_CHOICES.mode,
    };
  } catch {
    return DEFAULT_CHOICES;
  }
}

function markUsed(): void {
  localStorage.setItem(USED_KEY, 'yes');
}

const picksOf = (props: Props): Pick[] =>
  picksFrom(props.peers.reports('selection', 'selected'));

/** The pick the prompt on the canvas sits on: the active frame's, else the first. */
function pickToShow(props: Props): Pick | null {
  const picks = picksOf(props);
  return (
    picks.find((pick) => pick.frame === props.activeFrame) ?? picks[0] ?? null
  );
}

// ---------------------------------------------------------------------------
// Text

function Text({ text }: { text: string }) {
  return (
    <p className="chat-text">
      {textRuns(text).map((run, index) =>
        run.code ? (
          <code key={index}>{run.text}</code>
        ) : (
          <span key={index}>{run.text}</span>
        ),
      )}
    </p>
  );
}

function Failure({
  what,
  message,
  command,
}: {
  what: string;
  message: string | null;
  command?: string | null;
}) {
  return (
    <div className="module-failed" role="status">
      <TriangleAlert aria-hidden size={16} className="module-failed-icon" />
      <p>{what}</p>
      {message ? <p className="module-error">{message}</p> : null}
      {command ? <code className="chat-command">{command}</code> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One turn

const plural = new Intl.PluralRules('en');
const filesText = (n: number): string =>
  `Changed ${n} ${plural.select(n) === 'one' ? 'file' : 'files'}`;

function lineCount(added: number | null, removed: number | null): string {
  if (added === null || removed === null) return '';
  return `+${added} −${removed}`;
}

function TurnDiff({
  turn,
  props,
  frameLabel,
}: {
  turn: Turn;
  props: Props;
  frameLabel: (id: string) => string;
}) {
  const [pending, setPending] = useState(false);
  const decide = (op: 'keep' | 'undo'): void => {
    setPending(true);
    props
      .call(op, { id: turn.id })
      .catch((error: unknown) => {
        props.notify(messageOf(error), { stays: true });
      })
      .finally(() => setPending(false));
  };

  return (
    <section className="chat-diff" aria-label={filesText(turn.files.length)}>
      <details>
        <summary className="fold chat-diff-title">
          <span>{filesText(turn.files.length)}</span>
          <ChevronRight aria-hidden size={16} className="fold-chevron" />
        </summary>
        <pre className="chat-diff-text">{turn.diff}</pre>
      </details>
      <ul className="chat-files">
        {turn.files.map((file) => (
          <li key={file.path} className="chat-file">
            <code className="truncated-path" title={file.path}>
              <bdi>{file.path}</bdi>
            </code>
            <span className="chat-file-lines">
              {lineCount(file.added, file.removed)}
            </span>
          </li>
        ))}
      </ul>
      {turn.frames.length > 0 ? (
        <ul className="chat-frames">
          {turn.frames.map(({ frame, image }) => (
            <li key={frame}>
              <img src={image} alt={`${frameLabel(frame)} after this change`} />
              <span>{frameLabel(frame)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {turn.undoProblem ? (
        <Failure what="Couldn't undo this." message={turn.undoProblem} />
      ) : null}
      {turn.decision === 'open' ? (
        <div className="chat-decision">
          <button
            type="button"
            className="module-action"
            disabled={pending}
            onClick={() => decide('undo')}
          >
            Undo
          </button>
          <button
            type="button"
            className="module-action"
            disabled={pending}
            onClick={() => decide('keep')}
          >
            Keep
          </button>
        </div>
      ) : (
        <p className="chat-activity">
          {turn.decision === 'kept' ? 'Kept' : 'Undone'}
        </p>
      )}
    </section>
  );
}

function TurnView({
  turn,
  props,
  frameLabel,
}: {
  turn: Turn;
  props: Props;
  frameLabel: (id: string) => string;
}) {
  const problem = turn.problem ? problemWords(turn.problem) : null;
  const blocks = answerBlocks(turn.parts);

  return (
    <li className="chat-turn">
      <div className="chat-you">
        {turn.chips.length > 0 ? (
          <p className="chat-you-chips">{turn.chips.join(', ')}</p>
        ) : null}
        <p>{turn.text}</p>
      </div>
      {blocks.map((block) =>
        block.kind === 'text' ? (
          <Text key={block.key} text={block.text} />
        ) : (
          <ul key={block.key} className="chat-activities">
            {block.rows.map((row) => (
              <li
                key={row.key}
                className="chat-activity"
                data-failed={row.failed || undefined}
              >
                {row.failed ? <TriangleAlert aria-hidden size={12} /> : null}
                <span>{row.text}</span>
                {row.code ? (
                  <code className="truncated-path" title={row.code}>
                    <bdi>{row.code}</bdi>
                  </code>
                ) : null}
              </li>
            ))}
          </ul>
        ),
      )}
      {turn.status === 'running' ? (
        <p className="chat-activity" role="status">
          Working…
        </p>
      ) : null}
      {turn.status === 'stopped' ? (
        <p className="chat-activity">Stopped</p>
      ) : null}
      {problem ? (
        <Failure
          what={problem.what}
          message={problem.next}
          command={problem.command}
        />
      ) : null}
      {turn.decision !== 'none' ? (
        <TurnDiff turn={turn} props={props} frameLabel={frameLabel} />
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// The chat

function statusText(chat: ChatState): string | null {
  if (chat.signedIn === false) return null;
  if (chat.working) return 'Claude is working.';
  return chat.signedIn === true ? 'Claude is ready.' : 'Checking Claude…';
}

function FirstPrompts({ props }: { props: Props }) {
  function run(text: string): void {
    markUsed();
    props
      .call('send', {
        text,
        attachments: [],
        screen: screenOf(props.frames, props.activeFrame),
        scoped: false,
        ...loadChoices(),
      })
      .catch((error: unknown) => {
        props.notify(messageOf(error), { stays: true });
      });
  }

  return (
    <ul className="chat-prompts" aria-label="Example requests">
      {FIRST_PROMPTS.map((text) => (
        <li key={text} className="chat-prompt">
          <p>{text}</p>
          <div className="chat-prompt-actions">
            <button
              type="button"
              className="module-action"
              onClick={() => run(text)}
            >
              Run
            </button>
            <button
              type="button"
              className="module-action"
              onClick={() => {
                void navigator.clipboard.writeText(text).then(() => {
                  props.notify('Copied the request');
                });
              }}
            >
              Copy
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Prompts({ chat, props }: { chat: ChatState; props: Props }) {
  const answer = (id: string, allow: boolean): void => {
    props.call('answer', { id, allow }).catch((error: unknown) => {
      props.notify(messageOf(error), { stays: true });
    });
  };
  return chat.prompts.map((prompt) => (
    <div
      key={prompt.id}
      className="chat-permission"
      role="group"
      aria-label="Claude is asking"
    >
      <p>Claude wants to do this:</p>
      <code className="chat-command">{prompt.what}</code>
      <div className="chat-decision">
        <button
          type="button"
          className="module-action"
          onClick={() => answer(prompt.id, false)}
        >
          Don&apos;t allow
        </button>
        <button
          type="button"
          className="module-action"
          onClick={() => answer(prompt.id, true)}
        >
          Allow
        </button>
      </div>
    </div>
  ));
}

function Queue({ chat, props }: { chat: ChatState; props: Props }) {
  if (chat.queue.length === 0) return null;
  return (
    <section aria-label="Waiting to send">
      <h4 className="chat-queue-title">
        {chat.paused ? 'Waiting for your next message' : 'Next'}
      </h4>
      <ul className="chat-queue">
        {chat.queue.map((message) => (
          <li key={message.id} className="chat-queued">
            <span title={message.text}>{message.text}</span>
            <button
              type="button"
              className="tool"
              aria-label={`Remove ${message.text}`}
              onClick={() => {
                props
                  .call('unqueue', { id: message.id })
                  .catch((error: unknown) => {
                    props.notify(messageOf(error), { stays: true });
                  });
              }}
            >
              <X aria-hidden size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const when = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Earlier chats: picking one carries it on. */
function Sessions({
  chat,
  props,
  onChosen,
}: {
  chat: ChatState;
  props: Props;
  onChosen: () => void;
}) {
  return (
    <ul className="chat-sessions" aria-label="Earlier chats">
      {chat.sessions.map((session) => (
        <li key={session.id}>
          <button
            type="button"
            className="chat-session"
            aria-current={session.id === chat.chatId ? 'true' : undefined}
            disabled={chat.working}
            title={session.title}
            onClick={() => {
              props
                .call('resume', { id: session.id })
                .then(onChosen, (error: unknown) => {
                  props.notify(messageOf(error), { stays: true });
                });
            }}
          >
            <span className="chat-session-title">{session.title}</span>
            <span className="chat-session-when">
              {when.format(new Date(session.updatedAt))}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ChatPanel(props: Props) {
  const { chat, live } = props.state;
  const end = useRef<HTMLDivElement>(null);
  const [listing, setListing] = useState(false);
  const showing = props.rightView === 'claude';
  const { call } = props;

  // Asking starts a process, so it waits until the view is first shown.
  const asked = useRef(false);
  useEffect(() => {
    if (!showing || asked.current) return;
    asked.current = true;
    call('status', {}).catch(() => {});
  }, [showing, call]);

  const frameLabel = (id: string): string =>
    props.frames.find((frame) => frame.id === id)?.label ?? id;

  const lastPart = live?.parts.at(-1);
  const content = [
    chat?.turns.length,
    chat?.queue.length,
    chat?.prompts.length,
    live?.parts.length,
    lastPart?.kind === 'text' ? lastPart.text.length : 0,
  ].join();

  // Stays at the latest, unless the designer has scrolled up to read.
  useLayoutEffect(() => {
    const scroller = end.current?.closest('.dock-body');
    if (!scroller) return;
    const fromEnd =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    if (fromEnd < 160) scroller.scrollTop = scroller.scrollHeight;
  }, [content]);

  if (!chat) return <p className="module-empty">Connecting to Claude…</p>;

  const empty = chat.turns.length === 0 && !live;
  const nothingPicked = picksOf(props).length === 0;
  const firstTime = localStorage.getItem(USED_KEY) === null;
  const status = statusText(chat);

  return (
    <div className="chat" data-working={chat.working || undefined}>
      <div className="chat-bar">
        <button
          type="button"
          className="module-action"
          disabled={chat.working || (empty && chat.queue.length === 0)}
          onClick={() => {
            props.call('newChat', {}).catch((error: unknown) => {
              props.notify(messageOf(error), { stays: true });
            });
          }}
        >
          <SquarePen aria-hidden size={16} />
          New chat
        </button>
        <button
          type="button"
          className="module-action"
          aria-expanded={listing}
          disabled={chat.sessions.length === 0}
          onClick={() => setListing(!listing)}
        >
          <History aria-hidden size={16} />
          Sessions
        </button>
        <button
          type="button"
          className="module-action"
          onClick={() => props.showRightView('claude-config')}
        >
          <Settings2 aria-hidden size={16} />
          Configuration
        </button>
      </div>
      {listing ? (
        <Sessions
          chat={chat}
          props={props}
          onChosen={() => setListing(false)}
        />
      ) : null}
      {chat.signedIn === false ? (
        <Failure
          what="Sign in to Claude again."
          message="Run this in a terminal, then type /login:"
          command="claude"
        />
      ) : null}
      {empty && status ? <p className="chat-activity">{status}</p> : null}
      {empty && nothingPicked && firstTime ? (
        <FirstPrompts props={props} />
      ) : null}
      {empty && !firstTime ? (
        <p className="module-empty">
          Pick an element to attach it, or write what you want changed.
        </p>
      ) : null}
      <ol className="chat-turns">
        {chat.turns.map((turn) => (
          <TurnView
            key={turn.id}
            turn={turn}
            props={props}
            frameLabel={frameLabel}
          />
        ))}
        {live ? (
          <TurnView
            key={live.id}
            turn={live}
            props={props}
            frameLabel={frameLabel}
          />
        ) : null}
      </ol>
      <Prompts chat={chat} props={props} />
      <Queue chat={chat} props={props} />
      <div ref={end} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// The composer at the panel's foot

type Chip = {
  key: string;
  pick: Pick;
  attachment: Attachment | null;
};

function Choice<T extends string>({
  name,
  value,
  options,
  labels,
  onChange,
}: {
  name: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (next: T) => void;
}) {
  return (
    <ChoiceMenu
      name={name}
      value={labels[value]}
      choices={options.map((option) => ({
        label: labels[option],
        checked: option === value,
        onChange: () => onChange(option),
      }))}
    />
  );
}

function ChatComposer(props: Props) {
  const [choices, setChoices] = useState(loadChoices);
  const [chips, setChips] = useState<readonly Chip[]>([]);
  const showing = props.rightView === 'claude';
  const reports = props.peers.reports('selection', 'selected');

  // A new pick attaches, while this view shows. A pick already seen doesn't come
  // back after it's removed or sent, even when the page reports it again.
  const seen = useRef(new Map<string, string>());
  const attach = useEffectEvent((pick: Pick) => {
    const key = pickKey(pick);
    setChips((current) =>
      current.some((chip) => chip.key === key)
        ? current
        : [...current, { key, pick, attachment: null }],
    );
    props.peers
      .call('selection', 'inspect', { frame: pick.frame, id: pick.id })
      .catch(() => null)
      .then((inspection) => {
        setChips((current) =>
          current.map((chip) =>
            chip.key === key
              ? { ...chip, attachment: attachmentOf(pick, inspection) }
              : chip,
          ),
        );
      });
  });
  useEffect(() => {
    if (!showing) {
      seen.current.clear();
      return;
    }
    for (const pick of picksFrom(reports)) {
      const key = pickKey(pick);
      if (seen.current.get(pick.frame) === key) continue;
      seen.current.set(pick.frame, key);
      attach(pick);
    }
  }, [reports, showing]);

  const shown: ComposerChip[] = chips.map((chip) => ({
    key: chip.key,
    label: chip.attachment?.label ?? chip.pick.tag,
    title: chip.attachment?.callSite
      ? `${chip.attachment.callSite.file}:${chip.attachment.callSite.line}`
      : chip.pick.selector,
  }));

  const choose = (next: Choices): void => {
    bypassChosen = next.mode === 'bypassPermissions';
    setChoices(next);
    localStorage.setItem(CHOICES_KEY, JSON.stringify(next));
  };

  async function send(text: string): Promise<void> {
    try {
      await props.call('send', {
        text,
        attachments: chips.map(
          (chip) => chip.attachment ?? attachmentOf(chip.pick, null),
        ),
        screen: screenOf(props.frames, props.activeFrame),
        scoped: false,
        ...choices,
      });
      markUsed();
      setChips([]);
    } catch (error) {
      props.notify(messageOf(error), { stays: true });
      throw error;
    }
  }

  return (
    <Composer
      label="Message to Claude"
      placeholder="Ask Claude to change something"
      chips={shown}
      onRemoveChip={(key) =>
        setChips((current) => current.filter((chip) => chip.key !== key))
      }
      menus={
        <>
          <Choice
            name="Model"
            value={choices.model}
            options={MODELS}
            labels={{ ...MODEL_NAME, ...props.state.chat?.models }}
            onChange={(model) => choose({ ...choices, model })}
          />
          <Choice
            name="Effort"
            value={choices.effort}
            options={EFFORTS}
            labels={EFFORT_NAME}
            onChange={(effort) => choose({ ...choices, effort })}
          />
          <Choice
            name="Permissions"
            value={choices.mode}
            options={MODES}
            labels={MODE_NAME}
            onChange={(mode) => choose({ ...choices, mode })}
          />
        </>
      }
      action={
        props.state.chat?.working ? (
          <button
            type="button"
            className="tool"
            aria-label="Stop Claude"
            title="Stop"
            onClick={() => {
              props.call('stop', {}).catch((error: unknown) => {
                props.notify(messageOf(error), { stays: true });
              });
            }}
          >
            <Square aria-hidden size={16} />
          </button>
        ) : null
      }
      note={
        MODE_NOTE[choices.mode] ? (
          <p className="composer-note">
            <TriangleAlert aria-hidden size={16} />
            <span>{MODE_NOTE[choices.mode]}</span>
          </p>
        ) : null
      }
      onSend={send}
    />
  );
}

// ---------------------------------------------------------------------------
// The prompt on a pick

/** Open or not. The key and the context menu's row open it, from outside the box. */
let inlineOpen = false;
const inlineListeners = new Set<() => void>();
function setInlineOpen(open: boolean): void {
  inlineOpen = open;
  for (const listener of inlineListeners) listener();
}
function subscribeInline(listener: () => void): () => void {
  inlineListeners.add(listener);
  return () => inlineListeners.delete(listener);
}

const INLINE_GAP = 8;
const INLINE_WIDTH = 280;
/** The closed pill's and the box's room, so it stays on the frame near the page's foot. */
const INLINE_ROOM = 96;

const InlinePrompt: CanvasComponent<typeof claude> = (props) => {
  const open = useSyncExternalStore(subscribeInline, () => inlineOpen);
  const pick = pickToShow(props);
  const selector = pick?.selector ?? null;
  const frame = pick?.frame ?? null;
  // Not an effect's dependency: `command` is a new function with each report,
  // and this effect's own report would start it again.
  const track = useEffectEvent((id: string, followed: string | null) => {
    props.command(id, 'track', { selector: followed }).catch(() => {});
  });

  // Only the frame with the pick follows its element, and only while there's one.
  useEffect(() => {
    if (!frame) return;
    track(frame, selector);
    return () => track(frame, null);
  }, [frame, selector]);

  const anchor = frame ? props.reports.anchor[frame] : null;
  if (!pick || !anchor || anchor.selector !== pick.selector) return null;
  const shown = props.frames.find((entry) => entry.id === pick.frame);
  const top = Math.min(
    anchor.y + anchor.height,
    (shown?.height ?? Number.POSITIVE_INFINITY) - INLINE_ROOM,
  );
  const right = Math.min(
    anchor.x + anchor.width,
    shown?.width ?? Number.POSITIVE_INFINITY,
  );
  // At the element's foot on the right: its name's label sits on the left.
  const at = props.place(pick.frame, { x: right, y: Math.max(0, top) });
  if (!at) return null;
  const style = {
    left: at.left,
    top: at.top + INLINE_GAP,
    width: INLINE_WIDTH,
  };

  async function send(text: string): Promise<void> {
    if (!pick) return;
    const inspection = await props.peers
      .call('selection', 'inspect', { frame: pick.frame, id: pick.id })
      .catch(() => null);
    try {
      await props.call('send', {
        text,
        attachments: [attachmentOf(pick, inspection)],
        screen: screenOf(props.frames, props.activeFrame),
        scoped: true,
        ...loadChoices(),
      });
      markUsed();
      setInlineOpen(false);
      props.showRightView('claude');
    } catch (error) {
      props.notify(messageOf(error), { stays: true });
      throw error;
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="inline-ask"
        style={{ left: at.left, top: style.top }}
        title="Ask Claude about this (A)"
        onClick={() => setInlineOpen(true)}
      >
        <MessageSquare
          aria-hidden
          size={12}
          absoluteStrokeWidth
          strokeWidth={4 / 3}
        />
        Ask Claude
      </button>
    );
  }

  return (
    <div className="inline-prompt" style={style}>
      <Composer
        small
        autoFocus
        label={`Message to Claude about ${pick.tag}`}
        placeholder="What should change here?"
        onSend={send}
        onEscape={() => setInlineOpen(false)}
      />
    </div>
  );
};

export default definePanel(
  claude,
  { right: ChatPanel },
  {
    actions: {
      'ask-claude': {
        enabled: (props) => pickToShow(props) !== null,
        run: () => setInlineOpen(true),
      },
    },
    foot: ChatComposer,
    canvas: InlinePrompt,
  },
);
