import { panels } from 'truing:panels';
import { createRoot } from 'react-dom/client';

import { commandForKey, isEditableTarget } from '../commands';

import { App } from './app';
import { shellCommands } from './commands';
import { createShellStore, type ShellStore } from './store';
import './styles.css';

const store = createShellStore(
  panels.flatMap(({ module }) => module.panel?.view ?? []),
);
store.connect();
listenForShortcuts(store);
// TRU-18.3: Truing's browser brings a frame into view for a capture, then back.
window.__truingCapture = {
  show: (frame, maxSide) => store.showForCapture(frame, maxSide),
  restore: () => store.restoreAfterCapture(),
};

const root = document.getElementById('root');
if (!root) {
  throw new Error('The shell page has no #root element.');
}
createRoot(root).render(<App store={store} />);

/**
 * The shell's keys, from the one list of commands (TRU-2.3). V, I, H and zoom
 * also work with focus inside a frame: the runtime sends those to the server,
 * which tells every frame and the shell.
 */
function listenForShortcuts(shellStore: ShellStore): void {
  // On Linux a middle click pastes the current selection into a field. Here that
  // button pans, and a press on the wheel filled the message box with whatever
  // was last selected. Paste with the keyboard still works.
  window.addEventListener(
    'mouseup',
    (event) => {
      if (event.button === 1 && isEditableTarget(event.target)) {
        event.preventDefault();
      }
    },
    { capture: true },
  );

  // Space held: drag anywhere to pan, as in Figma.
  window.addEventListener('keyup', (event) => {
    if (event.code === 'Space') shellStore.setSpaceHeld(false);
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !isEditableTarget(event.target)) {
      event.preventDefault();
      shellStore.setSpaceHeld(true);
      return;
    }

    const commands = shellCommands(shellStore.getState(), shellStore);
    const id = commandForKey(
      event,
      commands.map((command) => [command.id, command.spec] as const),
    );
    const command = commands.find((candidate) => candidate.id === id);
    if (!command) return;

    // A command that doesn't apply now leaves the key alone: Tab without a
    // pick still moves focus, and Esc reaches an open menu.
    const enabled = command.enabled();
    if (enabled === false) return;
    event.preventDefault();
    void Promise.resolve(enabled).then((ok) => {
      if (ok) return command.run();
    });
  });
}
