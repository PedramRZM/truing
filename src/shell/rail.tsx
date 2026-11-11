import type { ReactNode } from 'react';

import {
  Eye,
  Hand,
  MousePointer2,
  Ruler,
  SquareDashedMousePointer,
} from 'lucide-react';

import { type CommandSpec, CORE_COMMANDS } from '../commands';
import { MODES } from '../protocol';

import { KEYS } from './commands';
import type { ShellState, ShellStore } from './store';

type RailProps = {
  state: ShellState;
  store: ShellStore;
};

/**
 * Tools only, between the left panel and the canvas (TRU-3.5). A new tool is one
 * more RailTool here: the column makes the room. With the left panel closed
 * the rail floats, which the CSS decides from Truing's data-left.
 */
export function Rail({ state, store }: RailProps) {
  // The hand sits on top of the mode, so while it's on it is the current tool.
  const current = (mode: ShellState['mode']) =>
    state.mode === mode && !state.handTool;

  // In a landmark, like the canvas and the docks.
  return (
    <aside aria-label="Tools">
      <div
        className="rail"
        role="toolbar"
        aria-label="Truing"
        aria-orientation="vertical"
      >
        <div className="rail-group" role="group" aria-label="Mode">
          <RailTool
            command={CORE_COMMANDS['mode-select']}
            pressed={current(MODES.select)}
            onClick={() => store.setMode(MODES.select)}
          >
            <MousePointer2 aria-hidden size={16} />
          </RailTool>
          <RailTool
            command={CORE_COMMANDS['mode-interact']}
            pressed={current(MODES.interact)}
            onClick={() => store.setMode(MODES.interact)}
          >
            <Eye aria-hidden size={16} />
          </RailTool>
        </div>
        <RailTool
          command={CORE_COMMANDS['hand-tool']}
          pressed={state.handTool}
          onClick={() => store.runShortcut('hand-tool')}
        >
          <Hand aria-hidden size={16} />
        </RailTool>

        <span className="rail-separator" aria-hidden />

        <RailTool
          command={CORE_COMMANDS.spacing}
          pressed={state.spacing && state.mode === MODES.select}
          // It works on hover in Select mode. Its tooltip says so.
          disabled={state.mode !== MODES.select}
          onClick={() => store.runShortcut('spacing')}
        >
          <Ruler aria-hidden size={16} />
        </RailTool>
        {/* #80: off at start, so the outlines don't cover a change being judged. */}
        <RailTool
          command={CORE_COMMANDS.outlines}
          pressed={state.outlines && state.mode === MODES.select}
          disabled={state.mode !== MODES.select}
          onClick={() => store.runShortcut('outlines')}
        >
          <SquareDashedMousePointer aria-hidden size={16} />
        </RailTool>
      </div>
    </aside>
  );
}

type RailToolProps = {
  command: CommandSpec;
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

function RailTool({
  command,
  pressed,
  disabled,
  onClick,
  children,
}: RailToolProps) {
  return (
    <button
      type="button"
      className="tool"
      aria-pressed={pressed}
      disabled={disabled}
      aria-keyshortcuts={KEYS.aria(command.keys)}
      aria-label={command.title}
      title={KEYS.tooltip(command)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
