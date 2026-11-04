import {
  messageOf,
  type ModuleSpec,
  type ProbeContext,
  type ProbeDefinition,
} from '../module';
import type { Mode, RuntimeMessage, ToRuntime, View } from '../protocol';

export type ProbeEntry = { module: ModuleSpec; probe: ProbeDefinition };

type Command = (input: unknown) => unknown;

type Running = {
  id: string;
  failed: boolean;
  cleanups: Array<() => void>;
  onMode: Array<(mode: Mode) => void>;
  onView: Array<(view: View) => void>;
  onPick: Array<(event: MouseEvent) => void>;
  onDoubleClick: Array<(event: MouseEvent) => void>;
  onContextMenu: Array<(event: MouseEvent) => void>;
  onEscape: Array<() => unknown>;
  commands: Record<string, Command>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Starts each module's probe in this frame, each on its own: a probe that
 * throws, while starting or in any callback it registered through its
 * context, is stopped and reported, and the others keep running. A command
 * that throws only answers with the error.
 */
export function startProbes(
  entries: readonly ProbeEntry[],
  options: {
    frame: string;
    mode: () => Mode;
    view: () => View;
    send: (message: RuntimeMessage) => void;
  },
) {
  const { frame, send } = options;
  const running = new Map<string, Running>();

  function fail(probe: Running, error: unknown): void {
    if (probe.failed) return;
    probe.failed = true;
    for (const cleanup of probe.cleanups) {
      try {
        cleanup();
      } catch {
        // Already failed; nothing more to stop.
      }
    }
    probe.cleanups = [];
    send({
      type: 'module-failed',
      module: probe.id,
      message: messageOf(error),
    });
  }

  /** Runs a callback of the probe's; a throw, or a rejected promise, fails the probe. */
  function guarded<A extends unknown[]>(
    probe: Running,
    fn: (...args: A) => unknown,
  ): (...args: A) => unknown {
    return (...args) => {
      if (probe.failed) return;
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          result.catch((error: unknown) => fail(probe, error));
        }
        return result;
      } catch (error) {
        fail(probe, error);
      }
    };
  }

  for (const { module, probe: definition } of entries) {
    const probe: Running = {
      id: module.id,
      failed: false,
      cleanups: [],
      onMode: [],
      onView: [],
      onPick: [],
      onDoubleClick: [],
      onContextMenu: [],
      onEscape: [],
      commands: {},
    };
    running.set(module.id, probe);

    const context: ProbeContext<ModuleSpec> = {
      frame,
      mode: options.mode,
      report: (name, payload) => {
        if (probe.failed) return;
        send({ type: 'module-report', module: module.id, name, payload });
      },
      onMode: (callback) => {
        probe.onMode.push(guarded(probe, callback));
      },
      view: options.view,
      onView: (callback) => {
        probe.onView.push(guarded(probe, callback));
      },
      onPick: (callback) => {
        probe.onPick.push(guarded(probe, callback));
      },
      onDoubleClick: (callback) => {
        probe.onDoubleClick.push(guarded(probe, callback));
      },
      onContextMenu: (callback) => {
        probe.onContextMenu.push(guarded(probe, callback));
      },
      onEscape: (callback) => {
        probe.onEscape.push(guarded(probe, callback));
      },
      listen: (type, handler, listenerOptions) => {
        const wrapped = guarded(probe, handler);
        window.addEventListener(type, wrapped, listenerOptions);
        probe.cleanups.push(() =>
          window.removeEventListener(type, wrapped, listenerOptions),
        );
      },
      guard: (fn) => guarded(probe, fn),
    };

    try {
      // The pairing comes from the generated entry; a probe.ts copied from
      // another module would run with the wrong declaration.
      if (definition.part !== 'probe' || definition.module.id !== module.id) {
        throw new Error(
          `probe.ts must export defineProbe(module, …) for "${module.id}".`,
        );
      }
      const handlers: unknown = definition.setup(context);
      const commands =
        isRecord(handlers) && isRecord(handlers.commands)
          ? handlers.commands
          : {};
      for (const [name, command] of Object.entries(commands)) {
        if (typeof command === 'function') {
          probe.commands[name] = (input) => command(input);
        }
      }
    } catch (error) {
      fail(probe, error);
    }
  }

  return {
    /** The modules whose probe is running here, for the hello. */
    running(): string[] {
      return [...running.values()]
        .filter((probe) => !probe.failed)
        .map((probe) => probe.id);
    },

    setMode(mode: Mode): void {
      for (const probe of running.values()) {
        for (const callback of probe.onMode) callback(mode);
      }
    },

    /** The zoom or the Spacing toggle changed. */
    setView(view: View): void {
      for (const probe of running.values()) {
        for (const callback of probe.onView) callback(view);
      }
    },

    /** A click in Select mode, before the guard stops it. */
    pick(event: MouseEvent): void {
      for (const probe of running.values()) {
        for (const callback of probe.onPick) callback(event);
      }
    },

    /** A double-click in Select mode, before the guard stops it. */
    doubleClick(event: MouseEvent): void {
      for (const probe of running.values()) {
        for (const callback of probe.onDoubleClick) callback(event);
      }
    },

    /** A right-click in Select mode, before the guard stops it. */
    contextMenu(event: MouseEvent): void {
      for (const probe of running.values()) {
        for (const callback of probe.onContextMenu) callback(event);
      }
    },

    /** Esc in Select mode, which the shell caught and handed over. True if a probe used it. */
    escape(): boolean {
      let used = false;
      for (const probe of running.values()) {
        for (const callback of probe.onEscape) {
          if (callback() === true) used = true;
        }
      }
      return used;
    },

    async command(
      message: Extract<ToRuntime, { type: 'module-command' }>,
    ): Promise<void> {
      const answer = (value: unknown, error?: string): void =>
        send({ type: 'module-result', id: message.id, value, error });
      const probe = running.get(message.module);
      const command =
        probe && Object.hasOwn(probe.commands, message.name)
          ? probe.commands[message.name]
          : undefined;
      if (!probe || probe.failed || !command) {
        answer(
          null,
          `Module "${message.module}" can't answer ${message.name} in this frame.`,
        );
        return;
      }
      // A command that throws answers with the error (a bad selector from
      // Claude, say); the probe keeps running.
      try {
        answer(await command(message.input));
      } catch (error) {
        answer(null, messageOf(error));
      }
    },
  };
}
