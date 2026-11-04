import { useSyncExternalStore } from 'react';

import { Canvas } from './canvas';
import { CanvasBar } from './canvas-bar';
import { Notice, ShortcutsSheet } from './command-views';
import { ContextMenu } from './context-menu';
import { Docks } from './docks';
import { Rail } from './rail';
import type { ShellStore } from './store';

type AppProps = {
  store: ShellStore;
};

export function App({ store }: AppProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState);

  return (
    <div
      className="truing"
      data-left={state.docks.left}
      data-right={state.docks.right}
      data-right-view={state.rightView}
      data-chrome={state.chromeHidden ? 'hidden' : 'shown'}
    >
      <Canvas state={state} store={store} />
      <Docks state={state} store={store} />
      <Rail state={state} store={store} />
      <CanvasBar state={state} store={store} />
      <Notice state={state} />
      <ContextMenu state={state} store={store} />
      <ShortcutsSheet state={state} store={store} />
    </div>
  );
}
