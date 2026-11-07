// The setup screens: connect Claude, choose a project, let Claude read it, review
// what it found, start the app. Written once per person, so it takes more room
// than the dense tool that opens after it.
import { useEffect, useRef, useState } from 'react';

import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Folder,
  FolderOpen,
  LoaderCircle,
  TriangleAlert,
  X,
} from 'lucide-react';

import type { Connection } from '../connection';
import type { Candidate, FolderList } from '../find-projects';
import type { Draft, Question } from '../read-project';
import { changedFields } from '../setting-fields';

import { call, stream } from './api';

type Screen =
  | { name: 'connect' }
  | { name: 'projects'; byHand: boolean }
  | { name: 'reading'; root: string; answers: Answer[] }
  | { name: 'confirm'; root: string; text: string }
  | {
      name: 'review';
      root: string;
      draft: Draft;
      answers: Answer[];
      problem: string | null;
    }
  | { name: 'starting'; root: string; start: Start; yourself?: boolean };

/** How a project starts: from the review, from what's saved, or from a confirmed file. */
type Start =
  | { from: 'draft'; draft: Draft; answers: Answer[] }
  | { from: 'saved' }
  | { from: 'config' };

type Answer = { question: string; answer: string };

const STEPS = ['Connect', 'Project', 'Review', 'Start'] as const;

const stepOf: Record<Screen['name'], number> = {
  connect: 0,
  projects: 1,
  reading: 1,
  confirm: 2,
  review: 2,
  starting: 3,
};

function Mark() {
  return (
    <svg
      className="setup-mark"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Steps({ current }: { current: number }) {
  return (
    <ol className="setup-steps" aria-label="Setup steps">
      {STEPS.map((step, index) => (
        <li
          key={step}
          className="setup-step"
          data-state={
            index < current ? 'done' : index === current ? 'now' : 'next'
          }
          aria-current={index === current ? 'step' : undefined}
        >
          <span className="setup-step-dot" aria-hidden="true">
            {index < current ? <Check size={10} strokeWidth={3} /> : null}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="setup-command">
      <code>{command}</code>
      <button
        type="button"
        className="setup-icon-button"
        aria-label={`Copy ${command}`}
        onClick={() => {
          void navigator.clipboard
            .writeText(command)
            .then(() => setCopied(true));
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  );
}

function CheckRow({
  label,
  state,
  detail,
}: {
  label: string;
  state: 'waiting' | 'checking' | 'ok' | 'failed';
  detail: string | null;
}) {
  return (
    <li className="setup-check" data-state={state}>
      <span className="setup-check-icon" aria-hidden="true">
        {state === 'ok' ? <Check size={14} strokeWidth={2.5} /> : null}
        {state === 'failed' ? <X size={14} strokeWidth={2.5} /> : null}
        {state === 'checking' ? (
          <LoaderCircle size={14} className="setup-spin" />
        ) : null}
      </span>
      <span className="setup-check-label">{label}</span>
      <span className="setup-check-detail">
        {detail ?? (state === 'checking' ? 'Checking…' : '')}
      </span>
    </li>
  );
}

function ConnectScreen({
  onContinue,
  onByHand,
}: {
  onContinue: () => void;
  onByHand: () => void;
}) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signInEnded, setSignInEnded] = useState(false);
  const checking = useRef(false);

  const check = async (): Promise<void> => {
    if (checking.current) return;
    checking.current = true;
    setConnection(null);
    try {
      setConnection(await call<Connection>('/api/connection'));
    } finally {
      checking.current = false;
    }
  };

  useEffect(() => {
    void check();
  }, []);

  /** Claude Code's own sign-in, then whatever the check says about how it ended. */
  const signIn = async (): Promise<void> => {
    setSigningIn(true);
    setSignInEnded(false);
    await call('/api/sign-in').catch(() => {});
    const next = await call<Connection>('/api/connection');
    setConnection(next);
    setSigningIn(false);
    setSignInEnded(!next.ok);
  };

  const stateOf = (
    part: 'installed' | 'signedIn' | 'responds',
    ready: boolean,
  ): 'waiting' | 'checking' | 'ok' | 'failed' => {
    if (!connection) return part === 'installed' ? 'checking' : 'waiting';
    if (connection[part].ok) return 'ok';
    return ready ? 'failed' : 'waiting';
  };

  return (
    <section className="setup-panel" aria-labelledby="connect-title">
      <h1 id="connect-title">Connect Claude</h1>
      <p className="setup-lead">
        Truing uses your own Claude Code to read your project and change its UI.
      </p>

      <ul className="setup-checks">
        <CheckRow
          label="Claude Code"
          state={stateOf('installed', true)}
          detail={connection?.installed.detail ?? null}
        />
        <CheckRow
          label="Signed in"
          state={stateOf('signedIn', connection?.installed.ok ?? false)}
          detail={connection?.signedIn.detail ?? null}
        />
        <CheckRow
          label="Claude answers"
          state={stateOf('responds', connection?.signedIn.ok ?? false)}
          detail={connection?.responds.detail ?? null}
        />
      </ul>

      {connection && !connection.ok ? (
        <div className="setup-notice" role="status">
          <p>{connection.problem}</p>
          {connection.command ? (
            <CopyCommand command={connection.command} />
          ) : null}
          {signInEnded ? (
            <p className="setup-hint">
              Sign-in didn't finish. You can try again.
            </p>
          ) : null}
          {signingIn ? (
            <p className="setup-hint">
              Finish in the browser that opened. If Claude Code asks for a code,
              paste it in the terminal where you ran truing.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="setup-actions">
        {connection?.ok ? (
          <button
            type="button"
            className="setup-primary"
            onClick={onContinue}
            autoFocus
          >
            Continue
          </button>
        ) : null}
        {connection &&
        !connection.ok &&
        connection.command === 'claude auth login' ? (
          <button
            type="button"
            className="setup-primary"
            disabled={signingIn}
            onClick={() => void signIn()}
          >
            {signingIn ? 'Waiting for sign-in…' : 'Sign in'}
          </button>
        ) : null}
        {connection && !connection.ok ? (
          <>
            <button
              type="button"
              className="setup-secondary"
              onClick={() => void check()}
            >
              Check again
            </button>
            <button type="button" className="setup-text" onClick={onByHand}>
              Set up without Claude
            </button>
          </>
        ) : null}
      </div>

      <p className="setup-foot">
        Your sign-in stays with Claude Code. Truing never sees it.
      </p>
    </section>
  );
}

function FolderBrowser({
  start,
  onChoose,
  onClose,
}: {
  start: string;
  onChoose: (root: string) => void;
  onClose: () => void;
}) {
  const [folder, setFolder] = useState<FolderList | null>(null);
  const [typed, setTyped] = useState(start);
  const [problem, setProblem] = useState<string | null>(null);
  const latest = useRef(0);
  const typedSinceAsking = useRef(false);

  const open = (root: string): void => {
    // A slow answer for an older folder must not replace what was asked for since.
    latest.current += 1;
    const asked = latest.current;
    typedSinceAsking.current = false;
    call<FolderList>('/api/folder', { root })
      .then((next) => {
        if (asked !== latest.current) return;
        setFolder(next);
        // Nor does it replace what someone has typed while it was on its way.
        if (!typedSinceAsking.current) setTyped(next.path);
        setProblem(null);
      })
      .catch((error: unknown) => {
        if (asked !== latest.current) return;
        setProblem(error instanceof Error ? error.message : String(error));
      });
  };

  useEffect(() => {
    open(start);
  }, [start]);

  return (
    <div className="setup-browser">
      <form
        className="setup-browser-path"
        onSubmit={(event) => {
          event.preventDefault();
          open(typed);
        }}
      >
        <label htmlFor="folder-path">Folder</label>
        <input
          id="folder-path"
          value={typed}
          spellCheck={false}
          onChange={(event) => {
            typedSinceAsking.current = true;
            setTyped(event.target.value);
          }}
        />
      </form>
      {folder && !folder.isProject ? (
        <p className="setup-hint">
          This folder has no package.json or git repository. You can still use
          it.
        </p>
      ) : null}
      {problem ? (
        <p className="setup-field-error" role="alert">
          {problem}
        </p>
      ) : null}
      <ul className="setup-browser-list">
        {folder?.parent ? (
          <li>
            <button
              type="button"
              className="setup-browser-row"
              onClick={() => open(folder.parent ?? '/')}
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Up one folder
            </button>
          </li>
        ) : null}
        {folder?.folders.map((name) => (
          <li key={name}>
            <button
              type="button"
              className="setup-browser-row"
              onClick={() => open(`${folder.path}/${name}`)}
            >
              <Folder size={14} aria-hidden="true" />
              {name}
            </button>
          </li>
        ))}
        {folder && folder.folders.length === 0 ? (
          <li className="setup-empty">No folders inside this one.</li>
        ) : null}
      </ul>
      <div className="setup-actions">
        <button
          type="button"
          className="setup-primary"
          disabled={!folder}
          onClick={() => folder && onChoose(folder.path)}
        >
          Use this folder
        </button>
        <button type="button" className="setup-secondary" onClick={onClose}>
          Back to the list
        </button>
      </div>
    </div>
  );
}

const BADGES: Record<Candidate['source'], string> = {
  here: 'This folder',
  known: 'Set up',
  recent: 'Recent in Claude Code',
};

function ProjectsScreen({
  from,
  onRead,
  onOpen,
}: {
  from: string;
  onRead: (root: string) => void;
  onOpen: (root: string) => void;
}) {
  const [projects, setProjects] = useState<Candidate[] | null>(null);
  const [browsing, setBrowsing] = useState(false);

  useEffect(() => {
    // Nothing to offer isn't a dead end: browsing still works.
    call<Candidate[]>('/api/projects')
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  return (
    <section className="setup-panel" aria-labelledby="projects-title">
      <h1 id="projects-title">Choose a project</h1>
      <p className="setup-lead">
        Claude reads it and works out how to run it. Nothing is added to your
        repository.
      </p>

      {browsing ? (
        <FolderBrowser
          start={from}
          onChoose={onRead}
          onClose={() => setBrowsing(false)}
        />
      ) : (
        <>
          {projects === null ? (
            <p className="setup-empty">Looking for projects…</p>
          ) : null}
          {projects?.length === 0 ? (
            <p className="setup-empty">
              No projects found here. Browse to the folder you want.
            </p>
          ) : null}
          <ul className="setup-projects">
            {projects?.map((project) => (
              <li key={project.root}>
                <button
                  type="button"
                  className="setup-project"
                  onClick={() =>
                    project.known ? onOpen(project.root) : onRead(project.root)
                  }
                >
                  <span className="setup-project-text">
                    <span className="setup-project-name">{project.name}</span>
                    <span className="setup-project-path" title={project.root}>
                      {project.root}
                    </span>
                  </span>
                  <span className="setup-badge" data-source={project.source}>
                    {project.known ? BADGES.known : BADGES[project.source]}
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <div className="setup-actions">
            <button
              type="button"
              className="setup-secondary"
              onClick={() => setBrowsing(true)}
            >
              <FolderOpen size={14} aria-hidden="true" />
              Browse folders
            </button>
          </div>
        </>
      )}
    </section>
  );
}

type ReadLine =
  | { type: 'step'; text: string }
  | { type: 'done'; draft: Draft }
  | { type: 'error'; message: string };

function ReadingScreen({
  root,
  answers,
  onDone,
  onBack,
  onByHand,
}: {
  root: string;
  answers: Answer[];
  onDone: (draft: Draft) => void;
  onBack: () => void;
  onByHand: () => void;
}) {
  const [lines, setLines] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const name = root.split('/').filter(Boolean).at(-1) ?? root;

  useEffect(() => {
    let current = true;
    setLines([]);
    setProblem(null);
    stream<ReadLine>('/api/read', { root, answers }, (event) => {
      if (!current) return;
      if (event.type === 'step') {
        setLines((previous) => [...previous, event.text]);
        return;
      }
      if (event.type === 'done') {
        onDone(event.draft);
        return;
      }
      setProblem(event.message);
    }).catch((error: unknown) => {
      if (current) {
        setProblem(error instanceof Error ? error.message : String(error));
      }
    });
    return () => {
      current = false;
    };
    // Reads again only when asked to, not when a parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, attempt]);

  return (
    <section className="setup-panel" aria-labelledby="reading-title">
      <h1 id="reading-title">
        {problem ? `Couldn't read ${name}` : `Reading ${name}`}
      </h1>
      {problem ? (
        <>
          <p className="setup-lead">{problem}</p>
          <div className="setup-actions">
            <button
              type="button"
              className="setup-primary"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Read again
            </button>
            <button
              type="button"
              className="setup-secondary"
              onClick={onByHand}
            >
              Fill it in myself
            </button>
            <button type="button" className="setup-text" onClick={onBack}>
              Choose another project
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="setup-lead">
            Claude can read your project but can't change it. Secret files stay
            closed.
          </p>
          <div className="setup-progress" aria-hidden="true">
            <span />
          </div>
          <ul className="setup-feed" aria-live="polite">
            {lines.slice(-6).map((line, index, shown) => (
              <li
                key={`${line}-${lines.length - shown.length + index}`}
                data-age={shown.length - 1 - index}
              >
                {line}
              </li>
            ))}
            {lines.length === 0 ? <li data-age="0">Starting Claude…</li> : null}
          </ul>
          <div className="setup-actions">
            <button
              type="button"
              className="setup-secondary"
              onClick={() => {
                void call('/api/read-cancel');
                onBack();
              }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  evidence,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  evidence?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="setup-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <p className="setup-hint">{hint}</p> : null}
      {evidence ? <p className="setup-evidence">{evidence}</p> : null}
    </div>
  );
}

function lines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** What an answer changes. `project` isn't a field: it needs another read. */
function applyAnswer(draft: Draft, question: Question, answer: string): Draft {
  switch (question.field) {
    case 'devCommand':
      return { ...draft, devCommand: answer };
    case 'port': {
      const port = Number.parseInt(answer, 10);
      return { ...draft, port: Number.isNaN(port) ? null : port };
    }
    case 'startRoute':
      return { ...draft, startRoute: answer };
    case 'source':
      return { ...draft, source: answer };
    case 'primitives':
      return { ...draft, primitives: answer };
    case 'tokens':
      return { ...draft, tokens: answer };
    case 'writable':
      return { ...draft, writableInclude: lines(answer) };
    case 'project':
      return draft;
  }
}

function QuestionCard({
  question,
  onAnswer,
}: {
  question: Question;
  onAnswer: (answer: string) => void;
}) {
  const [typed, setTyped] = useState('');
  const id = `answer-${question.field}`;
  return (
    <form
      className="setup-question"
      onSubmit={(event) => {
        event.preventDefault();
        if (typed.trim()) onAnswer(typed.trim());
      }}
    >
      <label htmlFor={id}>{question.question}</label>
      {question.options.length > 0 ? (
        <div className="setup-options">
          {question.options.map((option) => (
            <button
              key={option}
              type="button"
              className="setup-option"
              onClick={() => onAnswer(option)}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
      <div className="setup-answer">
        <input
          id={id}
          value={typed}
          placeholder={question.options.length > 0 ? 'Or type your own' : ''}
          spellCheck={false}
          onChange={(event) => setTyped(event.target.value)}
        />
        <button
          type="submit"
          className="setup-secondary"
          disabled={!typed.trim()}
        >
          Answer
        </button>
      </div>
    </form>
  );
}

/** What the review screen calls a value a person set. */
const KEPT_NAMES: Record<string, string> = {
  name: 'Project name',
  framework: 'Framework',
  devCommand: 'Start command',
  port: 'Port',
  startRoute: 'First page',
  appDir: 'App folder',
  source: 'Code folder',
  primitives: 'Components folder',
  tokens: 'Token stylesheet',
  tailwindMerge: 'tailwind-merge groups file',
  writable: 'Allowed files',
  checks: 'Checks Claude may run without asking',
  dropEnv: "Variables Claude's sessions don't get",
};

function ReviewScreen({
  root,
  initial,
  answers,
  problem,
  onStart,
  onBack,
  onReadAgain,
}: {
  root: string;
  initial: Draft;
  answers: Answer[];
  problem: string | null;
  /** `yourself`: the person starts the app in their own terminal (TRU-10.10). */
  onStart: (draft: Draft, answers: Answer[], yourself?: boolean) => void;
  onBack: () => void;
  onReadAgain: (answers: Answer[]) => void;
}) {
  const [draft, setDraft] = useState(initial);
  // What Claude said, as a person has accepted it: what differs is theirs.
  const [baseline, setBaseline] = useState(initial);
  const [answered, setAnswered] = useState(answers);
  const [open, setOpen] = useState(false);
  const update = (change: Partial<Draft>): void =>
    setDraft((current) => ({ ...current, ...change }));

  const portIsWrong =
    draft.port !== null && (draft.port < 1 || draft.port > 65535);
  const canStart = draft.devCommand.trim() !== '' && !portIsWrong;
  const framework = draft.framework.version
    ? `${draft.framework.name} ${draft.framework.version}`
    : draft.framework.name;
  const onNext = /next/i.test(draft.framework.name);
  const start = (yourself: boolean): void =>
    onStart(
      {
        ...draft,
        yours: [
          ...new Set([
            ...(draft.yours ?? []),
            ...changedFields(baseline, draft),
          ]),
        ],
      },
      answered,
      yourself,
    );

  return (
    <section
      className="setup-panel setup-panel-wide"
      aria-labelledby="review-title"
    >
      <div className="setup-review-head">
        <h1 id="review-title">{draft.name}</h1>
        <span className="setup-badge">{framework}</span>
      </div>
      {draft.summary ? <p className="setup-lead">{draft.summary}</p> : null}
      <p className="setup-path">{root}</p>

      {problem ? (
        <div className="setup-notice" role="alert">
          <TriangleAlert size={14} aria-hidden="true" />
          <p>{problem} Change the settings below and start it again.</p>
        </div>
      ) : null}

      {!onNext ? (
        <div className="setup-notice" role="status">
          <TriangleAlert size={14} aria-hidden="true" />
          <p>
            Truing finds an element's code on Next.js. On {draft.framework.name}
            , you can still view the app and work with Claude, but picking an
            element may not find its file.
          </p>
        </div>
      ) : null}

      {draft.questions.length > 0 ? (
        <div className="setup-questions">
          <h2>Claude needs your answer</h2>
          {draft.questions.map((question) => (
            <QuestionCard
              key={question.question}
              question={question}
              onAnswer={(answer) => {
                const said = { question: question.question, answer };
                setAnswered((current) => [...current, said]);
                // Which app it is changes everything Claude read, so only this
                // one is read again. Every other answer goes straight in.
                if (question.field === 'project') {
                  onReadAgain([...answered, said]);
                  return;
                }
                setDraft((current) => ({
                  ...applyAnswer(current, question, answer),
                  questions: current.questions.filter(
                    (other) => other !== question,
                  ),
                }));
              }}
            />
          ))}
        </div>
      ) : null}

      {(draft.kept ?? []).length > 0 ? (
        <div className="setup-questions">
          <h2>Your values, kept</h2>
          {(draft.kept ?? []).map((kept) => (
            <div key={kept.field} className="setup-kept">
              <p>
                {KEPT_NAMES[kept.field]}: Claude read{' '}
                <code className="setup-mono">{kept.shown}</code>
              </p>
              <button
                type="button"
                className="setup-text"
                aria-label={`Use Claude's value for ${KEPT_NAMES[kept.field]}`}
                onClick={() => {
                  setBaseline((current) => ({ ...current, ...kept.read }));
                  setDraft((current) => ({
                    ...current,
                    ...kept.read,
                    yours: (current.yours ?? []).filter(
                      (field) => field !== kept.field,
                    ),
                    kept: (current.kept ?? []).filter(
                      (other) => other !== kept,
                    ),
                  }));
                }}
              >
                Use Claude&apos;s value
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="setup-fields">
        <Field
          id="field-command"
          label="Start command"
          hint="Truing runs this on your computer when you start. Check that you trust it."
          evidence={draft.evidence.devCommand}
        >
          <textarea
            id="field-command"
            className="setup-mono"
            rows={2}
            value={draft.devCommand}
            spellCheck={false}
            onChange={(event) =>
              update({ devCommand: event.target.value.replace(/\n/g, ' ') })
            }
          />
        </Field>
        <Field
          id="field-framework"
          label="Framework"
          evidence={draft.evidence.framework}
        >
          <input
            id="field-framework"
            value={draft.framework.name}
            spellCheck={false}
            onChange={(event) =>
              update({
                framework: { ...draft.framework, name: event.target.value },
              })
            }
          />
        </Field>
        <Field
          id="field-port"
          label="Port"
          {...(draft.port === null
            ? { hint: 'Not known yet. Truing finds it when the app starts.' }
            : {})}
          evidence={draft.evidence.port}
        >
          <input
            id="field-port"
            className="setup-mono setup-port"
            inputMode="numeric"
            aria-invalid={portIsWrong}
            value={draft.port ?? ''}
            onChange={(event) => {
              const port = Number.parseInt(event.target.value, 10);
              update({ port: Number.isNaN(port) ? null : port });
            }}
          />
        </Field>
        <Field
          id="field-tokens"
          label="Token stylesheet"
          {...(draft.tokens
            ? {}
            : {
                hint: 'None found. The panels show raw values until there is one.',
              })}
          evidence={draft.evidence.tokens}
        >
          <input
            id="field-tokens"
            className="setup-mono"
            value={draft.tokens ?? ''}
            spellCheck={false}
            onChange={(event) => update({ tokens: event.target.value || null })}
          />
        </Field>
        <Field
          id="field-primitives"
          label="Components folder"
          {...(draft.primitives
            ? {}
            : { hint: 'None found. Truing works without one.' })}
          evidence={draft.evidence.primitives}
        >
          <input
            id="field-primitives"
            className="setup-mono"
            value={draft.primitives ?? ''}
            spellCheck={false}
            onChange={(event) =>
              update({ primitives: event.target.value || null })
            }
          />
        </Field>
        <fieldset className="setup-choice">
          <legend>What Truing and Claude may change</legend>
          <label>
            <input
              type="radio"
              name="access"
              checked={!draft.fullAccess}
              onChange={() => update({ fullAccess: false })}
            />
            Only listed files
          </label>
          <label>
            <input
              type="radio"
              name="access"
              checked={draft.fullAccess ?? false}
              onChange={() => update({ fullAccess: true })}
            />
            The whole project
          </label>
          {draft.fullAccess ? (
            <p className="setup-hint">
              Includes server code and what runs when the project opens, so use
              it on a project you trust. Tests, secret files, Git&apos;s files
              and Claude Code&apos;s settings stay off limits. You can change
              this later in Settings.
            </p>
          ) : null}
        </fieldset>
        {draft.fullAccess ? null : (
          <Field
            id="field-include"
            label="Allowed files"
            hint={
              draft.writableInclude.length > 0
                ? 'One pattern per line.'
                : 'None yet, so nothing can be written until you add some. One pattern per line.'
            }
            evidence={draft.evidence.writable}
          >
            <textarea
              id="field-include"
              className="setup-mono"
              rows={3}
              spellCheck={false}
              value={draft.writableInclude.join('\n')}
              onChange={(event) =>
                update({ writableInclude: event.target.value.split('\n') })
              }
              onBlur={(event) =>
                update({ writableInclude: lines(event.target.value) })
              }
            />
          </Field>
        )}
        <Field
          id="field-checks"
          label="Checks Claude may run without asking"
          hint="One command per line. Claude runs these with no prompt, so check that you trust them."
          evidence={draft.evidence.checks}
        >
          <textarea
            id="field-checks"
            className="setup-mono"
            rows={2}
            spellCheck={false}
            value={draft.checks.join('\n')}
            onChange={(event) =>
              update({ checks: event.target.value.split('\n') })
            }
            onBlur={(event) => update({ checks: lines(event.target.value) })}
          />
        </Field>
        <Field
          id="field-drop-env"
          label="Variables Claude's sessions don't get"
          hint="One name per line. Claude read these from the project, so check that you agree."
          evidence={draft.evidence.dropEnv}
        >
          <textarea
            id="field-drop-env"
            className="setup-mono"
            rows={2}
            spellCheck={false}
            value={draft.dropEnv.join('\n')}
            onChange={(event) =>
              update({ dropEnv: event.target.value.split('\n') })
            }
            onBlur={(event) => update({ dropEnv: lines(event.target.value) })}
          />
        </Field>
      </div>

      <button
        type="button"
        className="setup-disclosure"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronRight size={14} aria-hidden="true" />
        Everything Claude found
      </button>
      {open ? (
        <div className="setup-fields">
          <Field id="field-name" label="Project name">
            <input
              id="field-name"
              value={draft.name}
              spellCheck={false}
              onChange={(event) => update({ name: event.target.value })}
            />
          </Field>
          <Field
            id="field-app-dir"
            label="App folder"
            hint="Leave empty if the app is at the top of the project."
            evidence={draft.evidence.appDir}
          >
            <input
              id="field-app-dir"
              className="setup-mono"
              value={draft.appDir ?? ''}
              spellCheck={false}
              onChange={(event) =>
                update({ appDir: event.target.value || null })
              }
            />
          </Field>
          <Field
            id="field-route"
            label="First page"
            evidence={draft.evidence.startRoute}
          >
            <input
              id="field-route"
              className="setup-mono"
              value={draft.startRoute}
              spellCheck={false}
              onChange={(event) => update({ startRoute: event.target.value })}
            />
          </Field>
          <Field
            id="field-source"
            label="Code folder"
            evidence={draft.evidence.source}
          >
            <input
              id="field-source"
              className="setup-mono"
              value={draft.source}
              spellCheck={false}
              onChange={(event) => update({ source: event.target.value })}
            />
          </Field>
          <Field id="field-merge" label="tailwind-merge groups file">
            <input
              id="field-merge"
              className="setup-mono"
              value={draft.tailwindMerge ?? ''}
              spellCheck={false}
              onChange={(event) =>
                update({ tailwindMerge: event.target.value || null })
              }
            />
          </Field>
          {draft.fullAccess ? null : (
            <Field
              id="field-exclude"
              label="Files that stay off limits"
              hint="One pattern per line."
            >
              <textarea
                id="field-exclude"
                className="setup-mono"
                rows={3}
                spellCheck={false}
                value={draft.writableExclude.join('\n')}
                onChange={(event) =>
                  update({ writableExclude: event.target.value.split('\n') })
                }
                onBlur={(event) =>
                  update({ writableExclude: lines(event.target.value) })
                }
              />
            </Field>
          )}
        </div>
      ) : null}

      <div className="setup-actions">
        <button
          type="button"
          className="setup-primary"
          disabled={!canStart}
          onClick={() => start(false)}
        >
          Start {draft.name}
        </button>
        {problem ? (
          <button
            type="button"
            className="setup-secondary"
            disabled={!canStart}
            onClick={() => start(true)}
          >
            Start it myself
          </button>
        ) : null}
        <button type="button" className="setup-text" onClick={onBack}>
          Choose another project
        </button>
      </div>
    </section>
  );
}

function ConfirmScreen({
  root,
  text,
  onConfirm,
}: {
  root: string;
  text: string;
  onConfirm: () => void;
}) {
  return (
    <section
      className="setup-panel setup-panel-wide"
      aria-labelledby="confirm-title"
    >
      <h1 id="confirm-title">Check this project's settings</h1>
      <p className="setup-lead">
        This project has a truing.config.ts. It's code, and opening the project
        runs it, anything it imports and its start command. Read it before you
        go on.
      </p>
      <p className="setup-path">{root}</p>
      <pre className="setup-file" aria-label="truing.config.ts">
        {text}
      </pre>
      <div className="setup-actions">
        <button type="button" className="setup-primary" onClick={onConfirm}>
          Run this file and start
        </button>
      </div>
      <p className="setup-foot">
        Truing asks again if this file changes. To leave without running it,
        close this window.
      </p>
    </section>
  );
}

type StartLine =
  | { type: 'log'; line: string }
  | { type: 'up'; port: number; moved: boolean; note: string | null }
  | { type: 'failed'; message: string; output: string[]; choose?: boolean };

/**
 * Runs the start command, or with `waiting` (TRU-10.10) only waits for the app
 * the person starts themselves, until the signal ends the wait.
 */
function beginStart(
  root: string,
  start: Start,
  onEvent: (event: StartLine) => void,
  waiting?: AbortSignal,
): Promise<void> {
  const self = waiting ? { self: true } : {};
  switch (start.from) {
    case 'draft':
      return stream(
        '/api/start',
        { root, draft: start.draft, ...self },
        onEvent,
        waiting,
      );
    case 'saved':
      return stream('/api/open', { root, ...self }, onEvent, waiting);
    case 'config':
      return stream('/api/confirm', self, onEvent, waiting);
  }
}

function StartingScreen({
  root,
  start,
  initialYourself,
  onChange,
  onBack,
}: {
  root: string;
  start: Start;
  initialYourself: boolean;
  onChange: (draft: Draft, answers: Answer[]) => void;
  onBack: () => void;
}) {
  const [log, setLog] = useState<string[]>([]);
  const [up, setUp] = useState<{ port: number; note: string | null } | null>(
    null,
  );
  const [problem, setProblem] = useState<{
    message: string;
    choose: boolean;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  /** The person starts the app in their own terminal, and Truing only waits. */
  const [yourself, setYourself] = useState(initialYourself);
  const logEnd = useRef<HTMLLIElement>(null);
  const name =
    start.from === 'draft'
      ? start.draft.name
      : (root.split('/').filter(Boolean).at(-1) ?? root);

  useEffect(() => {
    setLog([]);
    setUp(null);
    setProblem(null);
    const onEvent = (event: StartLine): void => {
      if (event.type === 'log') {
        setLog((previous) => [...previous.slice(-200), event.line]);
        return;
      }
      if (event.type === 'up') {
        setUp({ port: event.port, note: event.note });
        return;
      }
      setProblem({ message: event.message, choose: event.choose ?? false });
    };
    const waiting = yourself ? new AbortController() : null;
    beginStart(root, start, onEvent, waiting?.signal).catch(
      (error: unknown) => {
        if (waiting?.signal.aborted) return;
        setProblem({
          message: error instanceof Error ? error.message : String(error),
          choose: false,
        });
      },
    );
    return () => waiting?.abort();
    // Starts once per attempt, not when a parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, attempt]);

  const retry = (self: boolean): void => {
    setYourself(self);
    setAttempt((value) => value + 1);
  };

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [log.length]);

  const change = (): void => {
    if (start.from === 'draft') {
      onChange(start.draft, start.answers);
      return;
    }
    void call<Draft>('/api/saved-draft', { root }).then((draft) =>
      onChange(draft, []),
    );
  };

  let title = yourself ? `Waiting for ${name}` : `Starting ${name}`;
  if (up !== null) title = `Opening ${name}`;
  if (problem) {
    title = problem.choose ? `Couldn't open ${name}` : `${name} didn't start`;
  }

  return (
    <section
      className="setup-panel setup-panel-wide"
      aria-labelledby="start-title"
    >
      <h1 id="start-title">{title}</h1>
      <p className="setup-lead">
        {problem?.message ??
          (up !== null
            ? (up.note ?? `It answered on port ${up.port}.`)
            : yourself
              ? 'Start it in your own terminal. It opens here once it answers.'
              : 'The first start can take a minute while the app compiles.')}
      </p>
      {problem || up !== null ? null : (
        <div className="setup-progress" aria-hidden="true">
          <span />
        </div>
      )}
      <ol className="setup-log" aria-label="What the app printed">
        {log.map((line, index) => (
          <li key={`${index}-${line}`}>{line}</li>
        ))}
        <li ref={logEnd} aria-hidden="true" />
      </ol>
      {problem ? (
        <div className="setup-actions">
          <button
            type="button"
            className="setup-primary"
            onClick={() => retry(yourself)}
          >
            Try again
          </button>
          {yourself ? null : (
            <button
              type="button"
              className="setup-secondary"
              onClick={() => retry(true)}
            >
              Start it myself
            </button>
          )}
          {start.from === 'config' ? null : (
            <button type="button" className="setup-secondary" onClick={change}>
              Change settings
            </button>
          )}
          <button type="button" className="setup-text" onClick={onBack}>
            Choose another project
          </button>
        </div>
      ) : null}
      {yourself && !problem && up === null ? (
        <div className="setup-actions">
          <button
            type="button"
            className="setup-secondary"
            onClick={() => retry(false)}
          >
            Run the start command
          </button>
        </div>
      ) : null}
    </section>
  );
}

type SetupState = {
  from: string;
  reconfigure: string | null;
  confirm: { root: string; text: string } | null;
  review: { root: string; problem: string; draft: Draft } | null;
};

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'connect' });
  const [from, setFrom] = useState('');

  useEffect(() => {
    void call<SetupState>('/api/state').then((state) => {
      setFrom(state.from);
      if (state.reconfigure) {
        setScreen({ name: 'reading', root: state.reconfigure, answers: [] });
      }
      if (state.confirm) setScreen({ name: 'confirm', ...state.confirm });
      if (state.review) {
        setScreen({ name: 'review', ...state.review, answers: [] });
      }
    });
  }, []);

  const toProjects = (): void => setScreen({ name: 'projects', byHand: false });

  const toReview = (root: string, draft: Draft, answers: Answer[]): void =>
    setScreen({ name: 'review', root, draft, answers, problem: null });

  const read = (root: string, byHand: boolean): void => {
    if (!byHand) {
      setScreen({ name: 'reading', root, answers: [] });
      return;
    }
    void call<Draft>('/api/by-hand', { root }).then((draft) =>
      toReview(root, draft, []),
    );
  };

  return (
    <div className="setup-page">
      <header className="setup-header">
        <span className="setup-brand">
          <Mark />
          Truing
        </span>
        <Steps current={stepOf[screen.name]} />
      </header>
      <main className="setup-main">
        {screen.name === 'connect' ? (
          <ConnectScreen
            onContinue={toProjects}
            onByHand={() => setScreen({ name: 'projects', byHand: true })}
          />
        ) : null}
        {screen.name === 'projects' ? (
          <ProjectsScreen
            from={from}
            onRead={(root) => read(root, screen.byHand)}
            onOpen={(root) =>
              setScreen({ name: 'starting', root, start: { from: 'saved' } })
            }
          />
        ) : null}
        {screen.name === 'reading' ? (
          <ReadingScreen
            key={screen.answers.length}
            root={screen.root}
            answers={screen.answers}
            onDone={(draft) => toReview(screen.root, draft, screen.answers)}
            onBack={toProjects}
            onByHand={() => read(screen.root, true)}
          />
        ) : null}
        {screen.name === 'confirm' ? (
          <ConfirmScreen
            root={screen.root}
            text={screen.text}
            onConfirm={() =>
              setScreen({
                name: 'starting',
                root: screen.root,
                start: { from: 'config' },
              })
            }
          />
        ) : null}
        {screen.name === 'review' ? (
          <ReviewScreen
            root={screen.root}
            initial={screen.draft}
            answers={screen.answers}
            problem={screen.problem}
            onStart={(draft, answers, yourself) =>
              setScreen({
                name: 'starting',
                root: screen.root,
                start: { from: 'draft', draft, answers },
                yourself: yourself ?? false,
              })
            }
            onBack={toProjects}
            onReadAgain={(answers) =>
              setScreen({ name: 'reading', root: screen.root, answers })
            }
          />
        ) : null}
        {screen.name === 'starting' ? (
          <StartingScreen
            root={screen.root}
            start={screen.start}
            initialYourself={screen.yourself ?? false}
            onChange={(draft, answers) => toReview(screen.root, draft, answers)}
            onBack={toProjects}
          />
        ) : null}
      </main>
    </div>
  );
}
