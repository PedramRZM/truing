// What the one list of commands shows (TRU-2.3): the `?` sheet, and the status
// line that confirms a copy. The context menu is in context-menu.tsx.
import { Fragment } from 'react';

import { X } from 'lucide-react';

import { CORE_GROUPS, GESTURES } from '../commands';

import { KEYS, SHEET_ID, shellCommands } from './commands';
import type { ShellState, ShellStore } from './store';

type ViewProps = { state: ShellState; store: ShellStore };

// ---------------------------------------------------------------------------
// The `?` sheet: every command and gesture, by group.

export function ShortcutsSheet({ state, store }: ViewProps) {
  const commands = shellCommands(state, store);
  const groups = [
    ...CORE_GROUPS,
    ...new Set(
      commands
        .map((command) => command.group)
        .filter((group) => !(CORE_GROUPS as readonly string[]).includes(group)),
    ),
  ];

  return (
    <dialog
      id={SHEET_ID}
      className="sheet"
      aria-labelledby="sheet-title"
      // Closes on a click outside it too, not only on Esc.
      {...{ closedby: 'any' }}
    >
      <header className="sheet-header">
        <h2 id="sheet-title">Keyboard shortcuts</h2>
        <form method="dialog">
          <button type="submit" className="tool" aria-label="Close">
            <X aria-hidden size={16} />
          </button>
        </form>
      </header>
      <div className="sheet-body">
        {groups.map((group) => {
          const rows = [
            ...commands
              .filter(
                (command) =>
                  command.group === group && command.spec.keys?.length,
              )
              .map((command) => ({
                id: command.id,
                title: command.spec.title,
                how: KEYS.keys(command.spec.keys),
              })),
            ...GESTURES.filter((gesture) => gesture.group === group).map(
              (gesture) => ({
                id: gesture.title,
                title: gesture.title,
                how: gesture.how(KEYS),
              }),
            ),
          ];
          if (rows.length === 0) return null;
          return (
            <section key={group} aria-labelledby={`sheet-${group}`}>
              <h3 id={`sheet-${group}`} className="menu-heading">
                {group}
              </h3>
              <dl className="sheet-list">
                {rows.map((row) => (
                  <Fragment key={row.id}>
                    <dt>{row.title}</dt>
                    <dd>
                      <kbd className="key">{row.how}</kbd>
                    </dd>
                  </Fragment>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// The status line: one short confirmation at a time, read out by screen readers.

export function Notice({ state }: { state: ShellState }) {
  return (
    <p className="notice" role="status">
      {state.notice ? (
        // A new node per notice, so the same text twice is read twice.
        <span key={state.notice.id}>
          {state.notice.text}
          {state.notice.action ? (
            <button
              type="button"
              className="notice-action"
              onClick={state.notice.action.run}
            >
              {state.notice.action.label}
            </button>
          ) : null}
        </span>
      ) : null}
    </p>
  );
}
