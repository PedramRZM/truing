import { TriangleAlert } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

import { definePanel, messageOf, type PanelProps } from '../../module';

import settings, { type Field, type Values, type View } from './module';

type Props = PanelProps<typeof settings>;
type Saved = Extract<View, { kind: 'saved' }>;

const lines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

function Setting({
  id,
  label,
  field,
  hint,
  saved,
  reading,
  onReadAgain,
  children,
}: {
  id: string;
  label: string;
  field: Field;
  hint?: string;
  saved: Saved;
  reading: Field | null;
  onReadAgain: (field: Field, label: string) => void;
  children: ReactNode;
}) {
  const reason = saved.yours.includes(field)
    ? 'You set this.'
    : saved.evidence[field];
  return (
    <div className="settings-field">
      <div className="settings-field-head">
        <label htmlFor={id}>{label}</label>
        <button
          type="button"
          className="settings-read"
          disabled={reading !== null}
          aria-label={`Read again: ${label}`}
          onClick={() => onReadAgain(field, label)}
        >
          {reading === field ? 'Reading…' : 'Read again'}
        </button>
      </div>
      {children}
      {hint ? <p className="settings-hint">{hint}</p> : null}
      {reason ? <p className="settings-hint">{reason}</p> : null}
    </div>
  );
}

function SettingsPanel({ call, notify, rightView }: Props) {
  const [view, setView] = useState<View | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [reading, setReading] = useState<Field | null>(null);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const showing = rightView === 'settings';

  // Once: it comes back to unsaved edits and to what Claude read, so it keeps them.
  useEffect(() => {
    if (!showing || view) return;
    let current = true;
    call('read', {})
      .then((next) => {
        if (!current) return;
        setView(next);
        setValues(next.kind === 'saved' ? next.values : null);
      })
      .catch((error: unknown) => {
        if (current) setProblem(messageOf(error));
      });
    return () => {
      current = false;
    };
  }, [call, showing, view]);

  if (view?.kind === 'file') {
    return (
      <p className="settings-note">
        This project keeps its settings in <code>{view.file}</code>. Change them
        there.
      </p>
    );
  }
  if (view?.kind === 'none') {
    return (
      <p className="settings-note">
        This project has no saved settings. Reopen Truing to set it up.
      </p>
    );
  }
  if (!view || !values) {
    return problem ? (
      <p className="settings-note" role="alert">
        {problem}
      </p>
    ) : (
      <p className="settings-note">Loading settings…</p>
    );
  }

  const update = (change: Partial<Values>): void => {
    setOutcome(null);
    setProblem(null);
    setValues({ ...values, ...change });
  };

  async function readAgain(field: Field, label: string): Promise<void> {
    setReading(field);
    try {
      const answer = await call('readAgain', { field });
      setProblem(null);
      setValues((current) => current && { ...current, ...answer.values });
      const { evidence } = answer;
      if (evidence) {
        setView((current) =>
          current?.kind === 'saved'
            ? {
                ...current,
                evidence: { ...current.evidence, [field]: evidence },
                yours: current.yours.filter((name) => name !== field),
              }
            : current,
        );
      }
      const isNew = Object.entries(answer.values).some(
        ([key, value]) =>
          JSON.stringify(value) !==
          JSON.stringify(values?.[key as keyof Values]),
      );
      setOutcome(
        isNew
          ? `${label}: Claude read a new value. Save to keep it.`
          : `${label}: Claude read the same value.`,
      );
    } catch (error) {
      notify(messageOf(error), { stays: true });
    } finally {
      setReading(null);
    }
  }

  const newCommand = values.devCommand !== view.values.devCommand;
  const changed = JSON.stringify(values) !== JSON.stringify(view.values);

  async function save(current: Values): Promise<void> {
    setSaving(true);
    try {
      const { reopen, tokensDropped } = await call('save', {
        values: current,
        confirmedCommand: newCommand ? current.devCommand : null,
      });
      const next = await call('read', {});
      setView(next);
      if (next.kind === 'saved') setValues(next.values);
      setProblem(null);
      setOutcome(
        tokensDropped
          ? "Saved. Truing couldn't read the token stylesheet, so the field is empty."
          : reopen.length > 0
            ? `Saved. Reopen Truing to use these: ${reopen.join(', ')}.`
            : 'Saved. In use from your next change or message.',
      );
    } catch (error) {
      setOutcome(null);
      setProblem(messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  const shared = { saved: view, reading, onReadAgain: readAgain } as const;
  const list = (id: string, value: string[], change: (v: string[]) => void) => (
    <textarea
      id={id}
      className="settings-input"
      rows={3}
      spellCheck={false}
      value={value.join('\n')}
      onChange={(event) => change(event.target.value.split('\n'))}
      onBlur={(event) => change(lines(event.target.value))}
    />
  );
  const text = (
    id: string,
    value: string | null,
    change: (v: string) => void,
  ) => (
    <input
      id={id}
      className="settings-input"
      spellCheck={false}
      value={value ?? ''}
      onChange={(event) => change(event.target.value)}
    />
  );

  return (
    <form
      className="settings"
      aria-label="Project settings"
      onSubmit={(event) => event.preventDefault()}
    >
      <Setting
        {...shared}
        id="settings-command"
        label="Start command"
        field="devCommand"
      >
        <textarea
          id="settings-command"
          className="settings-input"
          rows={2}
          spellCheck={false}
          value={values.devCommand}
          onChange={(event) =>
            update({ devCommand: event.target.value.replace(/\n/g, ' ') })
          }
        />
      </Setting>

      <fieldset className="settings-choice">
        <legend>What Truing and Claude may change</legend>
        <label>
          <input
            type="radio"
            name="settings-access"
            checked={!values.fullAccess}
            onChange={() => update({ fullAccess: false })}
          />
          Only listed files
        </label>
        <label>
          <input
            type="radio"
            name="settings-access"
            checked={values.fullAccess}
            onChange={() => update({ fullAccess: true })}
          />
          The whole project
        </label>
        {values.fullAccess ? (
          <p className="settings-hint">
            Includes server code and what runs when the project opens, so use it
            on a project you trust. Tests, secret files, Git&apos;s files and
            Claude Code&apos;s settings stay off limits.
          </p>
        ) : null}
      </fieldset>
      {values.fullAccess ? null : (
        <>
          <Setting
            {...shared}
            id="settings-include"
            label="Allowed files"
            field="writable"
            hint="One pattern per line."
          >
            {list('settings-include', values.writableInclude, (next) =>
              update({ writableInclude: next }),
            )}
          </Setting>
          <div className="settings-field">
            <label htmlFor="settings-exclude">Files that stay off limits</label>
            {list('settings-exclude', values.writableExclude, (next) =>
              update({ writableExclude: next }),
            )}
            <p className="settings-hint">One pattern per line.</p>
          </div>
        </>
      )}

      <Setting
        {...shared}
        id="settings-checks"
        label="Checks Claude may run without asking"
        field="checks"
        hint="One command per line."
      >
        {list('settings-checks', values.checks, (next) =>
          update({ checks: next }),
        )}
      </Setting>
      <Setting
        {...shared}
        id="settings-drop-env"
        label="Variables Claude's sessions don't get"
        field="dropEnv"
        hint="One name per line."
      >
        {list('settings-drop-env', values.dropEnv, (next) =>
          update({ dropEnv: next }),
        )}
      </Setting>

      <Setting
        {...shared}
        id="settings-name"
        label="Project name"
        field="name"
        hint="Earlier chats stay under the old name."
      >
        {text('settings-name', values.name, (next) => update({ name: next }))}
      </Setting>
      <Setting
        {...shared}
        id="settings-framework"
        label="Framework"
        field="framework"
      >
        {text('settings-framework', values.framework.name, (next) =>
          update({ framework: { ...values.framework, name: next } }),
        )}
      </Setting>
      <Setting
        {...shared}
        id="settings-port"
        label="Port"
        field="port"
        hint="Leave empty to follow what the start command prints."
      >
        <input
          id="settings-port"
          className="settings-input"
          inputMode="numeric"
          value={values.port ?? ''}
          onChange={(event) => {
            const typed = event.target.value.replace(/\D/g, '');
            update({ port: typed ? Number(typed) : null });
          }}
        />
      </Setting>
      <Setting
        {...shared}
        id="settings-route"
        label="First page"
        field="startRoute"
      >
        {text('settings-route', values.startRoute, (next) =>
          update({ startRoute: next }),
        )}
      </Setting>
      <Setting
        {...shared}
        id="settings-app-dir"
        label="App folder"
        field="appDir"
        hint="Leave empty if the app is at the top of the project."
      >
        {text('settings-app-dir', values.appDir, (next) =>
          update({ appDir: next || null }),
        )}
      </Setting>
      <Setting
        {...shared}
        id="settings-source"
        label="Code folder"
        field="source"
      >
        {text('settings-source', values.source, (next) =>
          update({ source: next }),
        )}
      </Setting>
      <Setting
        {...shared}
        id="settings-primitives"
        label="Components folder"
        field="primitives"
      >
        {text('settings-primitives', values.primitives, (next) =>
          update({ primitives: next || null }),
        )}
      </Setting>
      <Setting
        {...shared}
        id="settings-tokens"
        label="Token stylesheet"
        field="tokens"
      >
        {text('settings-tokens', values.tokens, (next) =>
          update({ tokens: next || null }),
        )}
      </Setting>
      <Setting
        {...shared}
        id="settings-merge"
        label="tailwind-merge groups file"
        field="tailwindMerge"
      >
        {text('settings-merge', values.tailwindMerge, (next) =>
          update({ tailwindMerge: next || null }),
        )}
      </Setting>

      <p className="settings-hint">
        Last saved {new Date(view.savedAt).toLocaleString()}
      </p>
      <div className="settings-foot">
        {newCommand ? (
          <div className="settings-warning" role="status">
            <TriangleAlert aria-hidden size={16} />
            <p>
              Truing runs this on your computer each time you open this project.
              Check that you trust it.
            </p>
          </div>
        ) : null}
        {problem ? (
          <p className="settings-problem" role="alert">
            {problem}
          </p>
        ) : null}
        {outcome ? (
          <p className="settings-outcome" role="status">
            {outcome}
          </p>
        ) : null}
        <button
          type="button"
          className="module-action settings-save"
          onClick={() =>
            void save({
              ...values,
              writableInclude: lines(values.writableInclude.join('\n')),
              writableExclude: lines(values.writableExclude.join('\n')),
              checks: lines(values.checks.join('\n')),
              dropEnv: lines(values.dropEnv.join('\n')),
            })
          }
          disabled={!changed || saving || reading !== null}
        >
          {newCommand ? 'Save new command' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export default definePanel(settings, { right: SettingsPanel });
