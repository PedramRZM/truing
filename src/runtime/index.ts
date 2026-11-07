// Truing's runtime. Truing's browser runs this file as an init script
// in every page and frame, before any of the page's own scripts (ADR 0001).
// It does its work only inside a frame of the app whose parent is the shell.
// The core is small: a hello, pings, navigation reports and the Select mode
// guard. Everything else comes from the modules the config lists (TRU-1.6),
// whose probes are bundled in from `truing:probes`.
//
// First of all, bippy's React DevTools hook, so React keeps its owner stacks
// for TRU-2.1. This import installs it in every page Truing's window opens
// (it must exist before any page script runs); it is a passive object that
// records nothing until something reads it.
import 'bippy/install-hook-only';

import { probes } from 'truing:probes';

import { commandForKey, FRAME_ENTRIES, isEditableTarget } from '../commands';
import { TRUING_MARKER } from '../marker.mjs';
import {
  DEFAULT_VIEW,
  FRAME_NAME_PREFIX,
  isCanvasShortcut,
  MODES,
  type Mode,
  parseMessage,
  type RuntimeMessage,
  type Session,
  toRuntimeSchema,
  type View,
} from '../protocol';

import { startProbes } from './probes';

declare const __TRUING_SESSION__: Session;

// The session, token included, lives only in this closure: never on `window`
// and never in the page's markup.
const session = __TRUING_SESSION__;

function boot(): void {
  if (isShellPage()) {
    exposeSessionToShell();
    return;
  }

  if (!isAppFrame()) {
    return;
  }

  const frame = window.name.slice(FRAME_NAME_PREFIX.length);
  const runtime = createRuntime(frame);
  runtime.connect();
}

function isShellPage(): boolean {
  return window.top === window && location.origin === session.shellOrigin;
}

function isAppFrame(): boolean {
  return (
    window.top !== window &&
    location.origin === session.appOrigin &&
    location.ancestorOrigins?.[0] === session.shellOrigin &&
    window.name.startsWith(FRAME_NAME_PREFIX)
  );
}

/** The shell is Truing's own page; it gets the token the same way, from this script. */
function exposeSessionToShell(): void {
  Object.defineProperty(window, '__truingShell', {
    value: Object.freeze({ token: session.token, wsUrl: session.wsUrl }),
    enumerable: false,
    writable: false,
    configurable: false,
  });
}

const BLOCKED_IN_SELECT = [
  'pointerdown',
  'pointerup',
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'auxclick',
  'contextmenu',
  'submit',
  'touchstart',
  'touchend',
  'dragstart',
] as const;

function createRuntime(frame: string): { connect: () => void } {
  let socket: WebSocket | null = null;
  let mode: Mode = MODES.interact;
  let view: View = DEFAULT_VIEW;
  let retryMs = 250;
  let lastHref = '';
  let lastTitle = '';
  const selectCursor = new CSSStyleSheet();
  selectCursor.replaceSync('* { cursor: default !important; }');

  function send(message: RuntimeMessage): void {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }

  // The modules' probes; started last, below.
  let modules: ReturnType<typeof startProbes> | null = null;

  // What the probes say before the socket is open (they start at document
  // start) waits here, and goes right after the hello: every failure, and
  // the latest report of each name, so a chatty probe can't crowd out
  // another module's failure.
  const early = new Map<string, RuntimeMessage>();
  let greeted = false;
  function sendFromModule(message: RuntimeMessage): void {
    if (greeted && socket?.readyState === WebSocket.OPEN) {
      send(message);
      return;
    }
    const key =
      message.type === 'module-report'
        ? `report:${message.module}:${message.name}`
        : `other:${early.size}`;
    early.set(key, message);
  }

  /** Esc in Select mode: the shell leaves Fill if no probe used it. */
  function escapeInFrame(): void {
    if (!modules?.escape()) send({ type: 'shortcut', action: 'leave-fill' });
  }

  function setMode(next: Mode): void {
    const changed = next !== mode;
    mode = next;
    if (changed) modules?.setMode(next);
    // An adopted sheet changes the cursor without touching the app's DOM,
    // which would trip React's hydration checks.
    const sheets = document.adoptedStyleSheets.filter(
      (sheet) => sheet !== selectCursor,
    );
    document.adoptedStyleSheets =
      mode === MODES.select ? [...sheets, selectCursor] : sheets;
  }

  function setView(next: View): void {
    const changed = next.scale !== view.scale || next.spacing !== view.spacing;
    view = next;
    if (changed) modules?.setView(next);
  }

  // Reports where the frame is, whenever the address or the title changed.
  function reportLocation(): void {
    if (location.href === lastHref && document.title === lastTitle) {
      return;
    }

    lastHref = location.href;
    lastTitle = document.title;
    send({
      type: 'location',
      frame,
      href: location.href,
      title: document.title,
    });
  }

  // Next sets the title a moment after a soft navigation.
  function reportSoon(): void {
    reportLocation();
    setTimeout(reportLocation, 300);
    setTimeout(reportLocation, 1200);
  }

  function connect(): void {
    const url = new URL(session.wsUrl);
    url.searchParams.set('role', 'runtime');
    url.searchParams.set('token', session.token);
    socket = new WebSocket(url);

    socket.addEventListener('open', () => {
      retryMs = 250;
      lastHref = location.href;
      lastTitle = document.title;
      send({
        type: 'hello',
        frame,
        href: location.href,
        title: document.title,
        runtime: TRUING_MARKER,
        probes: modules?.running() ?? [],
      });
      greeted = true;
      for (const message of early.values()) send(message);
      early.clear();
    });

    socket.addEventListener('message', (event) => {
      const message = parseMessage(toRuntimeSchema, event.data);
      if (!message) {
        return;
      }

      switch (message.type) {
        case 'welcome':
          setMode(message.mode);
          setView(message.view);
          return;
        case 'mode':
          setMode(message.mode);
          return;
        case 'view':
          setView(message.view);
          return;
        case 'ping':
          send({ type: 'pong', id: message.id });
          return;
        case 'reload':
          location.reload();
          return;
        case 'escape':
          escapeInFrame();
          return;
        case 'module-command':
          void modules?.command(message);
          return;
      }
    });

    // Truing server restarted, or is starting: try again, more slowly each time.
    socket.addEventListener('close', () => {
      socket = null;
      greeted = false;
      setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 5000);
    });
  }

  // Clicking or typing in this frame makes it the one the others follow.
  // Registered before the Select guard, which stops everything after it.
  let lastInteraction = 0;
  const onInteraction = (): void => {
    const now = Date.now();
    if (now - lastInteraction < 500) return;
    lastInteraction = now;
    send({ type: 'interaction', frame });
  };
  window.addEventListener('pointerdown', onInteraction, { capture: true });
  window.addEventListener('keydown', onInteraction, { capture: true });

  // A middle-button drag pans the canvas wherever it starts, as in Figma; it
  // never reaches the app (no autoscroll, no middle-click on a link).
  // Registered before the Select guard, which stops everything after it.
  let dragFrom: { x: number; y: number } | null = null;
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      dragFrom = { x: event.screenX, y: event.screenY };
    },
    { capture: true },
  );
  window.addEventListener(
    'pointermove',
    (event) => {
      if (!dragFrom) return;
      event.stopImmediatePropagation();
      // Screen pixels: the frame itself moves under the pointer as the canvas
      // pans, so positions inside it would drift.
      const dx = event.screenX - dragFrom.x;
      const dy = event.screenY - dragFrom.y;
      dragFrom = { x: event.screenX, y: event.screenY };
      send({ type: 'pan-drag', dx, dy });
    },
    { capture: true },
  );
  const endDrag = (event: PointerEvent): void => {
    if (!dragFrom || event.button !== 1) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    dragFrom = null;
  };
  window.addEventListener('pointerup', endDrag, { capture: true });
  window.addEventListener('pointercancel', () => {
    dragFrom = null;
  });
  window.addEventListener(
    'auxclick',
    (event) => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    { capture: true },
  );

  // Select mode: window capture listeners run before any of the app's own,
  // so clicks never reach it (TRU-1.1).
  for (const type of BLOCKED_IN_SELECT) {
    window.addEventListener(
      type,
      (event) => {
        if (mode !== MODES.select) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        // TRU-14.2: Cmd/Ctrl-click on a link opens it in a frame of its own.
        // The path, not the target: a link in a shadow root is retargeted to its host.
        const link = event
          .composedPath()
          .find(
            (node): node is HTMLAnchorElement =>
              node instanceof HTMLAnchorElement && node.hasAttribute('href'),
          );
        const href = link ? link.href : null;
        if (
          type === 'click' &&
          event instanceof MouseEvent &&
          (event.metaKey || event.ctrlKey) &&
          href
        ) {
          send({ type: 'open-in-frame', frame, href });
          return;
        }
        // The click is the designer picking something: the modules get it.
        if (type === 'click' && event instanceof MouseEvent) {
          modules?.pick(event);
        }
        // A double-click edits text in place (TRU-4.1).
        if (type === 'dblclick' && event instanceof MouseEvent) {
          modules?.doubleClick(event);
        }
        // A right-click picks too, and the shell opens its menu there.
        if (type === 'contextmenu' && event instanceof MouseEvent) {
          modules?.contextMenu(event);
          send({
            type: 'context-menu',
            frame,
            x: event.clientX,
            y: event.clientY,
            ...(href ? { link: href } : {}),
          });
        }
      },
      { capture: true, passive: false },
    );
  }

  // Space and drag pans the canvas, as in Figma. Only in Select mode: in
  // Interact the page is live and Space is the app's (it scrolls).
  let spaceDown = false;
  const onSpace = (event: KeyboardEvent): void => {
    if (event.code !== 'Space' || isEditableTarget(event.target)) {
      return;
    }
    const down = event.type === 'keydown';
    if (down && mode !== MODES.select) {
      return;
    }
    // A Space release we didn't take is the app's (it activates a focused button).
    if (!down && !spaceDown) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (down === spaceDown) {
      return;
    }
    spaceDown = down;
    send({ type: 'pan-key', down });
  };
  window.addEventListener('keydown', onSpace, { capture: true });
  window.addEventListener('keyup', onSpace, { capture: true });
  // Space let go in another window never reaches this one: release it here.
  window.addEventListener('blur', () => {
    if (!spaceDown) return;
    spaceDown = false;
    send({ type: 'pan-key', down: false });
  });

  // Truing's keys pressed with focus in the frame (TRU-2.3's list): V and I,
  // H, and zoom, which Chromium must never apply to the whole window.
  window.addEventListener(
    'keydown',
    (event) => {
      const command = commandForKey(event, FRAME_ENTRIES);
      if (!command) {
        return;
      }
      // Spacing does nothing in Interact, so S is the app's there.
      if (command === 'spacing' && mode === MODES.interact) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (command === 'mode-select' || command === 'mode-interact') {
        send({
          type: 'mode-request',
          mode: command === 'mode-select' ? MODES.select : MODES.interact,
        });
        return;
      }
      if (isCanvasShortcut(command))
        send({ type: 'shortcut', action: command });
    },
    { capture: true },
  );
  window.addEventListener(
    'wheel',
    (event) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      send({
        type: 'wheel-zoom',
        frame,
        // In pixels, whatever the device reports (lines on some mice).
        deltaY: event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY,
        x: event.clientX,
        y: event.clientY,
      });
    },
    { capture: true, passive: false },
  );

  // Esc in Select mode belongs to Truing (it clears a pick), never to
  // the app: an open Dialog stays open while the designer picks inside it.
  // Usually the shell catches it, since the frame rarely has focus here.
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.code !== 'Escape' || mode !== MODES.select) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      escapeInFrame();
    },
    { capture: true },
  );
  // In Interact, Esc is the app's first: only what it left leaves Fill. An app
  // that closes something on Esc marks the event, as Radix does, or has a
  // native layer open, which closes after this.
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Escape' || mode !== MODES.interact) return;
    if (event.defaultPrevented || isEditableTarget(event.target)) return;
    if (document.querySelector('dialog[open], :popover-open')) return;
    send({ type: 'shortcut', action: 'leave-fill' });
  });

  // Navigation inside the app, so the shell's route box follows it.
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function patched(
      this: History,
      ...args: Parameters<History['pushState']>
    ) {
      const result = original.apply(this, args);
      queueMicrotask(reportSoon);
      return result;
    };
  }
  window.addEventListener('popstate', reportSoon);
  window.addEventListener('hashchange', reportSoon);
  window.addEventListener('load', reportSoon);

  // Last: every listener of the core comes before any module's.
  modules = startProbes(probes, {
    frame,
    mode: () => mode,
    view: () => view,
    send: sendFromModule,
  });

  return { connect };
}

// Last, so every declaration above is initialised before it runs.
boot();
