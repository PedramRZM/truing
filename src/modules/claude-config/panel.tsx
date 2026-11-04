import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { ArrowLeft, ChevronRight, Plus, TriangleAlert } from 'lucide-react';

import { definePanel, messageOf, type PanelProps } from '../../module';

import claudeConfig, { type ClaudeConfig, type ConfigItem } from './module';
import { type Opened, Viewer, type ViewerHandle } from './viewer';

type Props = PanelProps<typeof claudeConfig>;

const SOURCE_LABEL = {
  project: null,
  local: 'This computer',
  personal: 'Yours',
  truing: 'This truing',
  other: null,
  outside: null,
} as const satisfies Record<ConfigItem['source'], string | null>;

/** A row for a file just made, until the list reads again. */
function emptyListed(name: string): ConfigItem {
  return {
    name,
    source: 'project',
    path: null,
    note: null,
    description: null,
    body: null,
    missing: false,
    editable: false,
  };
}

/** Claude Code reports `none` when it runs on the person's own plan. */
function signInText({
  apiKeySource,
  loggedIn,
}: NonNullable<ClaudeConfig['claude']>): string {
  if (loggedIn === false) return 'Signed out';
  if (apiKeySource === 'none') return 'Your Claude plan';
  return apiKeySource === 'unknown' ? 'Unknown' : `API key (${apiKeySource})`;
}

function sameItem(a: ConfigItem, b: ConfigItem | undefined): boolean {
  return (
    b !== undefined &&
    a.name === b.name &&
    a.path === b.path &&
    a.note === b.note &&
    a.body === b.body
  );
}

type ListProps = {
  /** What's open in the viewer, marked in the list. */
  current: ConfigItem | undefined;
  onOpen: (item: ConfigItem) => void;
};

function ItemRow({ item, current, onOpen }: ListProps & { item: ConfigItem }) {
  const whose = item.missing ? 'Not loaded' : SOURCE_LABEL[item.source];
  const note = [whose, item.note].filter(Boolean).join(' · ');
  const hover = [item.name, item.description, item.note, item.path]
    .filter(Boolean)
    .join('\n');
  const content = (
    <>
      <span className="claude-row-name">{item.name}</span>
      {note ? <span className="claude-row-note">{note}</span> : null}
    </>
  );

  return (
    <li>
      {item.path !== null || item.body !== null ? (
        <button
          type="button"
          className="claude-row"
          title={hover}
          aria-current={sameItem(item, current) ? 'true' : undefined}
          onClick={() => onOpen(item)}
        >
          {content}
        </button>
      ) : (
        <div className="claude-row" title={hover}>
          {content}
        </div>
      )}
    </li>
  );
}

function ItemList({
  items,
  ...list
}: ListProps & { items: readonly ConfigItem[] }) {
  return (
    <ul className="claude-list">
      {items.map((item, index) => (
        <ItemRow key={`${item.name}-${index}`} item={item} {...list} />
      ))}
    </ul>
  );
}

/** DESIGN.md's Fold, at the end of a section's title, with how many it holds. */
function FoldTitle({ title, count }: { title: string; count: number }) {
  return (
    <summary className="fold claude-fold">
      <span className="claude-fold-title">{title}</span>
      <span className="claude-count">{count}</span>
      <ChevronRight aria-hidden size={16} className="fold-chevron" />
    </summary>
  );
}

function Group({
  title,
  items,
  open = false,
  mono = false,
  emptyText = 'None',
  ...list
}: ListProps & {
  title: string;
  items: readonly ConfigItem[];
  open?: boolean;
  /** Its notes are paths. */
  mono?: boolean;
  emptyText?: string;
}) {
  const own = items.filter((item) => item.source !== 'outside');
  const outside = items.filter((item) => item.source === 'outside');

  if (items.length === 0) {
    return (
      <div className="claude-group claude-group-empty">
        <span>{title}</span>
        <span>{emptyText}</span>
      </div>
    );
  }

  return (
    <details className="claude-group" data-mono={mono} open={open}>
      <FoldTitle title={title} count={items.length} />
      {own.length > 0 ? <ItemList items={own} {...list} /> : null}
      {outside.length > 0 && own.length > 0 ? (
        <details className="claude-outside">
          <FoldTitle title="Outside this project" count={outside.length} />
          <ItemList items={outside} {...list} />
        </details>
      ) : null}
      {outside.length > 0 && own.length === 0 ? (
        <ItemList items={outside} {...list} />
      ) : null}
    </details>
  );
}

function Failure({ what, message }: { what: string; message: string | null }) {
  return (
    <div className="module-failed" role="status">
      <TriangleAlert aria-hidden size={16} className="module-failed-icon" />
      <p>{what}</p>
      {message ? <p className="module-error">{message}</p> : null}
    </div>
  );
}

/** Names a new rule or skill of the designer's own. */
function NewFile({
  kind,
  onCreate,
  onCancel,
}: {
  kind: 'rule' | 'skill';
  onCreate: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  function create(): void {
    const name = field.current?.value.trim() ?? '';
    if (!name) return;
    setProblem(null);
    onCreate(name).catch((error: unknown) => setProblem(messageOf(error)));
  }

  return (
    <div className="claude-new">
      <input
        ref={field}
        className="claude-new-name"
        aria-label={`Name of the new ${kind}`}
        placeholder="cancel-buttons"
        autoFocus
        onKeyDown={(event) => {
          if (event.key === 'Enter') create();
          if (event.key === 'Escape') {
            event.stopPropagation();
            onCancel();
          }
        }}
      />
      <button type="button" className="module-action" onClick={onCancel}>
        Cancel
      </button>
      <button type="button" className="changes-apply" onClick={create}>
        Create
      </button>
      {problem ? <p className="claude-new-problem">{problem}</p> : null}
    </div>
  );
}

function ClaudeConfigPanel({ call, showRightView }: Props) {
  const [config, setConfig] = useState<ClaudeConfig | null>(null);
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [fresh, setFresh] = useState(false);
  const [adding, setAdding] = useState<'rule' | 'skill' | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const viewer = useRef<ViewerHandle>(null);

  /** TRU-5.3: what's being written isn't lost to opening something else. */
  function replaceViewer(then: () => void): void {
    if (viewer.current) viewer.current.leave(then);
    else then();
  }

  function check(): void {
    setChecking(true);
    setFailure(null);
    call('check', {})
      .then(setConfig, (error: unknown) => setFailure(messageOf(error)))
      .finally(() => setChecking(false));
  }

  const onFirstShown = useEffectEvent(() => {
    // Quick, so the list shows while Claude answers; its answer wins.
    call('files', {}).then(
      (files) => setConfig((current) => current ?? files),
      (error: unknown) => setFailure(messageOf(error)),
    );
    check();
  });

  // The panel stays mounted behind its tab, and asking Claude starts a process,
  // so it asks the first time the tab shows.
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      onFirstShown();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  async function createFile(
    kind: 'rule' | 'skill',
    name: string,
  ): Promise<void> {
    const { path } = await call('create', { kind, name });
    const { text } = await call('file', { path });
    setAdding(null);
    replaceViewer(() => {
      setFresh(true);
      setOpened({
        item: { ...emptyListed(name), path, editable: true },
        text,
        error: null,
      });
    });
    check();
  }

  async function saveFile(text: string, base: string): Promise<void> {
    const path = opened?.item.path;
    if (!path) return;
    await call('save', { path, text, base });
    setOpened((current) => current && { ...current, text });
    check();
  }

  async function removeFile(): Promise<void> {
    const path = opened?.item.path;
    if (!path) return;
    await call('remove', { path });
    setOpened(null);
    check();
  }

  function open(item: ConfigItem): void {
    replaceViewer(() => {
      setFresh(false);
      if (item.path === null) {
        setOpened({ item, text: item.body, error: null });
        return;
      }
      setOpened({ item, text: null, error: null });
      call('file', { path: item.path }).then(
        ({ text }) => setOpened({ item, text, error: null }),
        (error: unknown) =>
          setOpened({ item, text: null, error: messageOf(error) }),
      );
    });
  }

  const problem = failure ?? config?.problem ?? null;
  const claude = config?.claude ?? null;
  const list = { current: opened?.item, onOpen: open };
  // Asking keeps the facts' place, so the list under them doesn't jump.
  const asking = checking && !claude;
  // Skills, agents and the rest stay Claude's word when only its hook failed.
  const source = claude
    ? 'Instruction files come from the project, not from Claude Code.'
    : "This list comes from the project's files.";
  const fromClaudeEmpty = claude ? 'None' : 'Unknown';

  return (
    <div ref={root} className="claude-config" data-stale={checking && !asking}>
      <button
        type="button"
        className="module-action claude-back"
        onClick={() => showRightView('claude')}
      >
        <ArrowLeft aria-hidden size={16} />
        Back to chat
      </button>
      {claude || asking ? (
        <dl className="module-facts" role={asking ? 'status' : undefined}>
          <dt>Claude Code</dt>
          <dd>{claude?.version ?? 'Asking…'}</dd>
          <dt>Model</dt>
          <dd>{claude?.model}</dd>
          <dt>Sign-in</dt>
          <dd>{claude && signInText(claude)}</dd>
        </dl>
      ) : null}
      {problem && !checking ? (
        <Failure
          what={
            config?.confirmed && !failure
              ? 'Claude Code needs a step from you.'
              : "Couldn't confirm this list."
          }
          message={problem}
        />
      ) : null}
      {config && !config.confirmed && !checking ? (
        <p className="module-empty">{source}</p>
      ) : null}
      {config?.agentsMdMissing && !checking ? (
        <p className="claude-note">
          <TriangleAlert aria-hidden size={16} />
          <span>
            Claude doesn&apos;t load AGENTS.md. Run Truing&apos;s setup, or add
            @AGENTS.md to CLAUDE.md.
          </span>
        </p>
      ) : null}
      {config?.unreadable.map((file) => (
        <Failure
          key={file}
          what={`Couldn't read ${file}.`}
          message="Fix it to list its hooks and permissions."
        />
      ))}
      {config ? (
        <>
          <Group
            title="Loaded in every session"
            items={config.instructions}
            open
            {...list}
          />
          <Group
            title="Loaded for matching files"
            items={config.onDemand}
            mono
            {...list}
          />
          <Group title="Skills" items={config.skills} {...list} />
          <div className="claude-add">
            {/* TRU-5.3: not "Yours", which marks personal files in these lists. */}
            <span>This project</span>
            <button
              type="button"
              className="module-action"
              onClick={() => setAdding('rule')}
            >
              <Plus aria-hidden size={16} />
              New rule
            </button>
            <button
              type="button"
              className="module-action"
              onClick={() => setAdding('skill')}
            >
              <Plus aria-hidden size={16} />
              New skill
            </button>
          </div>
          {adding ? (
            <NewFile
              key={adding}
              kind={adding}
              onCreate={(name) => createFile(adding, name)}
              onCancel={() => setAdding(null)}
            />
          ) : null}
          <Group title="Agents" items={config.agents} {...list} />
          <Group title="Hooks" items={config.hooks} {...list} />
          <Group title="Permissions" items={config.permissions} {...list} />
          <Group
            title="MCP servers"
            items={config.mcpServers}
            emptyText={fromClaudeEmpty}
            {...list}
          />
          <Group
            title="Plugins"
            items={config.plugins}
            emptyText={fromClaudeEmpty}
            {...list}
          />
          <p className="module-empty claude-sources">
            Rules for matching files, hooks and permissions come from the
            project&apos;s files and this truing.
          </p>
        </>
      ) : null}
      {config || failure ? (
        <button
          type="button"
          className="module-action"
          disabled={checking}
          onClick={check}
        >
          Check again
        </button>
      ) : null}
      {opened ? (
        <Viewer
          key={opened.item.path ?? opened.item.name}
          ref={viewer}
          opened={opened}
          startEditing={fresh}
          onClose={() => setOpened(null)}
          onSave={saveFile}
          onRemove={removeFile}
        />
      ) : null}
    </div>
  );
}

export default definePanel(claudeConfig, { right: ClaudeConfigPanel });
