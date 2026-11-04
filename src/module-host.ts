import { z } from 'zod';
import * as zm from 'zod/mini';

import type { TruingConfig } from './config';
import { createEditEngine, type EditEngine } from './edits/engine';
import { NOT_WRITTEN } from './edits/messages';
import {
  type ApplyOutcome,
  type ApplyResult,
  applyResultSchema,
  type ChangesControl,
  changeSchemas,
  type DraftChange,
  messageOf,
  type ModuleSpec,
  type Reach,
  type Route,
  type Schema,
  type ScreenshotControl,
  STAGED_CHANGE_VERSION,
  type StagedChange,
  type StageInput,
} from './module';
import { importServerPart, type LoadedModule } from './module-loader';
import type {
  ModuleFailure,
  ReportEntry,
  RuntimeMessage,
  ShellMessage,
  StateEntry,
  ToRuntime,
  ToShell,
} from './protocol';

/** How the host reaches the shells and the frames; Truing server provides it. */
export type Bus = {
  toShells: (message: ToShell) => void;
  /** False if no runtime is connected in that frame. */
  toRuntime: (frame: string, message: ToRuntime) => boolean;
};

/** A Claude tool as an MCP server lists it (TRU-12.1 serves this list). */
export type ToolInfo = {
  name: string;
  module: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

/** A tool's answer, MCP-shaped: text content, or an error Claude can read. */
export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

type Handler = (input: unknown) => unknown;
const handler = z.custom<Handler>((value) => typeof value === 'function');
const handlerGroup = z.record(z.string(), handler).optional();

/** What a server part's setup returns, checked once at start. */
const handlersSchema = z.object({
  ops: handlerGroup,
  direct: handlerGroup,
  tools: handlerGroup,
  onClose: z
    .custom<() => void | Promise<void>>((value) => typeof value === 'function')
    .optional(),
  onReport: z
    .custom<(name: string, payload: unknown, frame: string) => void>(
      (value) => typeof value === 'function',
    )
    .optional(),
});
type Handlers = z.infer<typeof handlersSchema>;

type Pending = {
  frame: string;
  output: Schema;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export type ModuleHostOptions = {
  modules: readonly LoadedModule[];
  root: string;
  config: TruingConfig;
  log?: (line: string) => void;
  /** How long a frame's probe has to answer a command. */
  commandTimeoutMs?: number;
  /** The direct engine; the tests pass their own. */
  engine?: EditEngine;
};

/** The route's reason when the designer chose "Let Claude do this". */
export const REQUESTED_REASON = 'you asked Claude to do this';

export type ModuleHost = ReturnType<typeof createModuleHost>;

/**
 * A record's own entry, never one inherited from Object.prototype: names
 * come from the frames and the shell, and "toString" must find nothing.
 */
function own<T>(
  record: Record<string, T> | undefined,
  key: string,
): T | undefined {
  return record && Object.hasOwn(record, key) ? record[key] : undefined;
}

/** Parses with a module's schema; an error message a person or Claude can act on. */
function parse(
  schema: Schema,
  value: unknown,
  what: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const parsed = zm.safeParse(schema, value);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }
  const issues = parsed.error.issues
    .map((issue) =>
      issue.path.length > 0
        ? `${issue.path.join('.')}: ${issue.message}`
        : issue.message,
    )
    .join('; ');
  return { ok: false, error: `Invalid ${what}: ${issues}` };
}

/**
 * The server side of every module: runs each server part, checks every
 * payload against the module's schemas, relays commands between the shell
 * and the frames, and keeps the latest reports, the failures and the change
 * set. Created empty when no modules are listed.
 */
export function createModuleHost(options: ModuleHostOptions) {
  const { modules, root, config } = options;
  const log = options.log ?? (() => {});
  const timeoutMs = options.commandTimeoutMs ?? 5000;
  const byId = new Map(modules.map((loaded) => [loaded.spec.id, loaded]));
  const handlers = new Map<string, Handlers>();
  /** module → report name → frame → payload */
  const reports = new Map<string, Map<string, Map<string, unknown>>>();
  /** frame → the modules whose probe runs there */
  const probes = new Map<string, Set<string>>();
  /** module → name → what its server part last published */
  const published = new Map<string, Map<string, unknown>>();
  let failures: ModuleFailure[] = [];
  let changes: StagedChange[] = [];
  let browser: ScreenshotControl | null = null;
  // Everything that writes source takes its turn here.
  let writes: Promise<unknown> = Promise.resolve();
  let writing = 0;
  const pending = new Map<number, Pending>();
  let bus: Bus | null = null;
  let nextId = 0;
  let nextChange = 0;
  const engine = options.engine ?? createEditEngine({ root, config });

  const toShells = (message: ToShell): void => bus?.toShells(message);

  function exclusive<T>(job: () => Promise<T>): Promise<T> {
    writing += 1;
    const run = writes.then(job).finally(() => {
      writing -= 1;
    });
    // A job that failed tells its caller; the next one still runs.
    writes = run.catch(() => {});
    return run;
  }

  function publishState(id: string, name: string, value: unknown): void {
    const spec = own(module(id).spec.server?.state, name);
    if (!spec) {
      throw new Error(`Module "${id}" declares no state "${name}".`);
    }
    const parsed = parse(spec, value, `state ${name}`);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    const byName = published.get(id) ?? new Map<string, unknown>();
    published.set(id, byName);
    byName.set(name, parsed.value);
    toShells({ type: 'module-state', module: id, name, value: parsed.value });
  }

  /** Reads through whichever browser Truing connected; tests have none. */
  const screenshot: ScreenshotControl = {
    element: (frame, selector) =>
      browser
        ? browser.element(frame, selector)
        : Promise.reject(new Error('No browser is connected.')),
    frame: (frame) =>
      browser
        ? browser.frame(frame)
        : Promise.reject(new Error('No browser is connected.')),
  };

  function fail(failure: ModuleFailure): void {
    failures = [
      ...failures.filter(
        (other) =>
          !(
            other.module === failure.module &&
            other.part === failure.part &&
            other.frame === failure.frame
          ),
      ),
      failure,
    ];
    toShells({ type: 'module-failed', failure });
  }

  function forgetFrame(frame: string): void {
    probes.delete(frame);
    let hadReports = false;
    for (const byName of reports.values()) {
      for (const byFrame of byName.values()) {
        if (byFrame.delete(frame)) hadReports = true;
      }
    }
    failures = failures.filter(
      (failure) => !(failure.part === 'probe' && failure.frame === frame),
    );
    // The shells hold what they were sent: a pick on a page that's gone isn't one.
    if (hadReports) toShells({ type: 'module-frame-reset', frame });
    for (const [id, entry] of pending) {
      if (entry.frame !== frame) continue;
      clearTimeout(entry.timer);
      pending.delete(id);
      entry.reject(
        new Error(`The ${frame} frame reloaded before it answered.`),
      );
    }
  }

  function framesOf(module: string): string[] {
    return [...probes]
      .filter(([, running]) => running.has(module))
      .map(([frame]) => frame);
  }

  function reportsOf(module: string, name: string): Record<string, unknown> {
    return Object.fromEntries(reports.get(module)?.get(name) ?? []);
  }

  function module(id: string): LoadedModule {
    const loaded = byId.get(id);
    if (!loaded) {
      throw new Error(`No module "${id}" is loaded.`);
    }
    return loaded;
  }

  /** The server part's handlers, or why there are none. */
  function running(id: string): Handlers {
    const loaded = module(id);
    const own = handlers.get(id);
    if (own) {
      return own;
    }
    const failure = failures.find(
      (entry) => entry.module === id && entry.part === 'server',
    );
    throw new Error(
      failure
        ? `Module "${id}" didn't start: ${failure.message}`
        : `Module "${loaded.spec.id}" has no server part.`,
    );
  }

  function command(
    id: string,
    frame: string,
    name: string,
    input: unknown,
  ): Promise<unknown> {
    try {
      const spec = own(module(id).spec.probe?.commands, name);
      if (!spec) {
        throw new Error(`Module "${id}" has no probe command "${name}".`);
      }
      const parsed = parse(spec.input, input, `input for ${name}`);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }
      if (!probes.get(frame)?.has(id)) {
        throw new Error(`Module "${id}" isn't running in the ${frame} frame.`);
      }
      nextId += 1;
      const callId = nextId;
      const sent = bus?.toRuntime(frame, {
        type: 'module-command',
        id: callId,
        module: id,
        name,
        input: parsed.value,
      });
      if (!sent) {
        throw new Error(`The ${frame} frame isn't connected.`);
      }
      return new Promise((resolve, reject) => {
        pending.set(callId, {
          frame,
          output: spec.output,
          resolve,
          reject,
          timer: setTimeout(() => {
            pending.delete(callId);
            reject(new Error(`The ${frame} frame didn't answer ${name}.`));
          }, timeoutMs),
        });
      });
    } catch (error) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  async function callOp(
    id: string,
    op: string,
    input: unknown,
  ): Promise<unknown> {
    const spec = own(module(id).spec.server?.ops, op);
    if (!spec) {
      throw new Error(`Module "${id}" has no op "${op}".`);
    }
    const run = own(running(id).ops, op);
    if (!run) {
      throw new Error(`Module "${id}" has no handler for op "${op}".`);
    }
    const parsed = parse(spec.input, input, `input for ${op}`);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }
    const output = parse(
      spec.output,
      await run(parsed.value),
      `output of ${op}`,
    );
    if (!output.ok) {
      throw new Error(`Module "${id}": ${output.error}`);
    }
    return output.value;
  }

  /** The route each change would take if the designer hadn't asked for Claude. */
  const planned = new Map<string, Route>();
  const listeners: Array<(list: readonly StagedChange[]) => void> = [];
  let applying = false;
  let draft: DraftChange | null = null;

  function publish(): void {
    toShells({ type: 'changes', changes });
    tellListeners();
  }

  function tellListeners(): void {
    for (const listener of listeners) {
      try {
        listener(changes);
      } catch (error) {
        log(`[truing] a change listener failed: ${messageOf(error)}`);
      }
    }
  }

  async function stage(
    id: string,
    input: StageInput<ModuleSpec>,
  ): Promise<StagedChange> {
    const scope = input.scope ?? 'all';
    let write: StagedChange['write'] = null;
    let route: Route;
    let files: StagedChange['files'] = [];
    if (input.write?.by === 'op') {
      const { op } = input.write;
      const spec = own(module(id).spec.server?.direct, op);
      if (!spec) {
        throw new Error(`Module "${id}" has no direct operation "${op}".`);
      }
      const parsed = parse(spec.input, input.write.input, `input for ${op}`);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }
      write = { by: 'op', op, input: parsed.value };
      route = { by: 'direct' };
    } else if (input.write?.by === 'edit') {
      const parsed = changeSchemas.edit.safeParse(input.write.edit);
      if (!parsed.success) {
        throw new Error(`Invalid edit: ${parsed.error.message}`);
      }
      write = { by: 'edit', edit: parsed.data };
      const plan = await engine.plan(parsed.data, scope);
      files = plan.files;
      if (input.reason) {
        route = { by: 'claude', reason: input.reason, requested: false };
      } else if (plan.status === 'direct') {
        route = { by: 'direct' };
      } else {
        route = { by: 'claude', reason: plan.reason, requested: false };
      }
    } else {
      if (!input.reason) {
        throw new Error(
          'A change with nothing to write needs a reason for Claude.',
        );
      }
      route = { by: 'claude', reason: input.reason, requested: false };
    }

    // A cva edit changes the component, whatever the module said.
    const reach: Reach =
      write?.by === 'edit' &&
      write.edit.kind === 'cva' &&
      input.reach?.kind !== 'component'
        ? { kind: 'component', component: write.edit.component, usages: null }
        : (input.reach ?? { kind: 'use' });

    nextChange += 1;
    const changeId = `${id}-${nextChange}`;
    planned.set(changeId, route);
    const entry = changeSchemas.stagedChange.parse({
      version: STAGED_CHANGE_VERSION,
      id: changeId,
      module: id,
      label: input.label,
      intent: input.intent,
      viewport: input.viewport,
      scope,
      reach,
      element: input.element ?? null,
      property: input.property,
      before: input.before ?? [],
      after: input.after ?? [],
      write,
      route: input.claude ? requested(route) : route,
      files,
    });
    changes = [...changes, entry];
    publish();
    return entry;
  }

  /** "Let Claude do this": Claude, whatever the engine could do. */
  function requested(route: Route): Route {
    return route.by === 'claude'
      ? { ...route, requested: true }
      : { by: 'claude', reason: REQUESTED_REASON, requested: true };
  }

  function removeChange(changeId: string): void {
    // What followed it onto elements like it goes with it (TRU-4.5).
    const going = (entry: StagedChange): boolean =>
      entry.id === changeId ||
      (entry.reach.kind === 'similar' && entry.reach.of === changeId);
    for (const entry of changes) {
      if (going(entry)) planned.delete(entry.id);
    }
    changes = changes.filter((entry) => !going(entry));
    publish();
  }

  async function setClaude(
    changeId: string,
    claude: boolean,
  ): Promise<StagedChange> {
    const change = changes.find((entry) => entry.id === changeId);
    const route = planned.get(changeId);
    if (!change || !route) {
      throw new Error(`No staged change "${changeId}".`);
    }
    const next = { ...change, route: claude ? requested(route) : route };
    changes = changes.map((entry) => (entry.id === changeId ? next : entry));
    publish();
    return next;
  }

  /** Runs one of a module's own direct operations. */
  async function runOp(change: StagedChange): Promise<ApplyResult> {
    const { write } = change;
    if (write?.by !== 'op') {
      return { status: 'failed', message: 'Not a direct operation.' };
    }
    try {
      const run = own(running(change.module).direct, write.op);
      if (!run) {
        throw new Error(
          `Module "${change.module}" has no handler for direct operation "${write.op}".`,
        );
      }
      const parsed = applyResultSchema.safeParse(await run(write.input));
      return parsed.success
        ? parsed.data
        : {
            status: 'failed',
            message: `Module "${change.module}": ${write.op} returned no apply result.`,
          };
    } catch (error) {
      return { status: 'failed', message: messageOf(error) };
    }
  }

  /**
   * Apply: the engine's edits all or none, then the modules' own
   * operations. Claude's changes stay staged until TRU-12.2 sends them.
   */
  async function applyAll(): Promise<ApplyOutcome[]> {
    if (applying) {
      throw new Error('Apply is already running.');
    }
    applying = true;
    if (writing > 0) {
      toShells({
        type: 'notice',
        text: 'Claude is working. Apply runs when it finishes.',
      });
    }
    try {
      return await exclusive(writeDirectChanges);
    } finally {
      applying = false;
    }
  }

  async function writeDirectChanges(): Promise<ApplyOutcome[]> {
    const outcomes: ApplyOutcome[] = [];
    const edits = changes.flatMap((change) =>
      change.route.by === 'direct' && change.write?.by === 'edit'
        ? [{ id: change.id, edit: change.write.edit, files: change.files }]
        : [],
    );
    const written = edits.length > 0 ? await engine.write(edits) : [];
    outcomes.push(...written);
    const editsFailed = written.some(
      (outcome) => outcome.result.status !== 'applied',
    );
    for (const change of changes) {
      if (change.route.by === 'claude') {
        outcomes.push({
          id: change.id,
          result: { status: 'needs-claude', reason: change.route.reason },
        });
      } else if (change.write?.by === 'op') {
        outcomes.push({
          id: change.id,
          result: editsFailed
            ? {
                status: 'failed',
                message: NOT_WRITTEN,
              }
            : await runOp(change),
        });
      }
    }
    const applied = new Set(
      outcomes
        .filter((outcome) => outcome.result.status === 'applied')
        .map((outcome) => outcome.id),
    );
    if (applied.size > 0) {
      for (const id of applied) planned.delete(id);
      changes = changes.filter((entry) => !applied.has(entry.id));
      publish();
    }
    return outcomes;
  }

  const changesControl: ChangesControl = {
    list: () => changes,
    onChange: (callback) => {
      listeners.push(callback);
    },
    preview: (next) => {
      if (next === draft) return;
      draft = next;
      tellListeners();
    },
    draft: () => draft,
    remove: removeChange,
    discard: () => {
      planned.clear();
      changes = [];
      publish();
    },
    setClaude,
    apply: applyAll,
  };

  async function startServerPart(loaded: LoadedModule): Promise<void> {
    const id = loaded.spec.id;
    try {
      const definition = await importServerPart(loaded);
      const returned: unknown = await definition.setup({
        root,
        config,
        log: (line) => log(`[${id}] ${line}`),
        frames: () => framesOf(id),
        reports: (name) => reportsOf(id, name),
        command: (frame, name, input) => command(id, frame, name, input),
        stage: (change) => stage(id, change),
        changes: changesControl,
        publish: (name, value) => publishState(id, name, value),
        exclusive,
        screenshot,
      });
      const parsed = handlersSchema.safeParse(returned ?? {});
      if (!parsed.success) {
        throw new Error('server.ts setup must return its handlers.');
      }
      const missing = [
        ...Object.keys(loaded.spec.server?.ops ?? {})
          .filter((name) => !own(parsed.data.ops, name))
          .map((name) => `op "${name}"`),
        ...Object.keys(loaded.spec.server?.direct ?? {})
          .filter((name) => !own(parsed.data.direct, name))
          .map((name) => `direct operation "${name}"`),
        ...Object.keys(loaded.spec.claude?.tools ?? {})
          .filter((name) => !own(parsed.data.tools, name))
          .map((name) => `tool "${name}"`),
      ];
      if (missing.length > 0) {
        throw new Error(`server.ts has no handler for ${missing.join(', ')}.`);
      }
      handlers.set(id, parsed.data);
    } catch (error) {
      log(`[truing] module ${id} didn't start: ${messageOf(error)}`);
      fail({
        module: id,
        part: 'server',
        frame: null,
        message: messageOf(error),
      });
    }
  }

  function onReport(
    frame: string,
    message: Extract<RuntimeMessage, { type: 'module-report' }>,
  ): void {
    const loaded = byId.get(message.module);
    const spec = own(loaded?.spec.probe?.reports, message.name);
    if (!spec) {
      return;
    }
    const parsed = parse(spec, message.payload, `report ${message.name}`);
    if (!parsed.ok) {
      log(`[truing] module ${message.module}: ${parsed.error}`);
      return;
    }
    const byName = reports.get(message.module) ?? new Map();
    reports.set(message.module, byName);
    const byFrame = byName.get(message.name) ?? new Map<string, unknown>();
    byName.set(message.name, byFrame);
    byFrame.set(frame, parsed.value);
    if (!loaded?.spec.probe?.serverOnly?.includes(message.name)) {
      toShells({
        type: 'module-report',
        module: message.module,
        frame,
        name: message.name,
        payload: parsed.value,
      });
    }
    try {
      handlers
        .get(message.module)
        ?.onReport?.(message.name, parsed.value, frame);
    } catch (error) {
      log(`[truing] module ${message.module} onReport: ${messageOf(error)}`);
    }
  }

  function onResult(
    frame: string,
    message: Extract<RuntimeMessage, { type: 'module-result' }>,
  ): void {
    const entry = pending.get(message.id);
    // Only the frame that was asked can answer.
    if (!entry || entry.frame !== frame) {
      return;
    }
    pending.delete(message.id);
    clearTimeout(entry.timer);
    if (message.error !== undefined) {
      entry.reject(new Error(message.error));
      return;
    }
    const output = parse(entry.output, message.value, 'answer');
    if (!output.ok) {
      entry.reject(new Error(output.error));
      return;
    }
    entry.resolve(output.value);
  }

  return {
    /** The ids of the listed modules, in config order. */
    ids: modules.map((loaded) => loaded.spec.id),

    /** Runs every server part's setup. A part that throws is failed; the rest still start. */
    async start(): Promise<void> {
      for (const loaded of modules) {
        if (loaded.server) await startServerPart(loaded);
      }
    },

    connect(next: Bus): void {
      bus = next;
    },

    onRuntimeHello(frame: string, running: readonly string[]): void {
      forgetFrame(frame);
      probes.set(frame, new Set(running.filter((id) => byId.has(id))));
    },

    onRuntimeGone(frame: string): void {
      forgetFrame(frame);
    },

    probesIn(frame: string): string[] {
      return [...(probes.get(frame) ?? [])];
    },

    onRuntimeMessage(
      frame: string,
      message: Extract<
        RuntimeMessage,
        { type: 'module-report' | 'module-result' | 'module-failed' }
      >,
    ): void {
      switch (message.type) {
        case 'module-report':
          onReport(frame, message);
          return;
        case 'module-result':
          onResult(frame, message);
          return;
        case 'module-failed':
          if (!byId.has(message.module)) return;
          probes.get(frame)?.delete(message.module);
          fail({
            module: message.module,
            part: 'probe',
            frame,
            message: message.message,
          });
          return;
      }
    },

    /** A panel's call or command; the answer goes back to the shell that asked. */
    onShellMessage(
      message: Extract<
        ShellMessage,
        { type: 'module-call' | 'module-command' }
      >,
      reply: (message: ToShell) => void,
    ): void {
      const answer =
        message.type === 'module-call'
          ? Promise.resolve().then(() =>
              callOp(message.module, message.op, message.input),
            )
          : command(message.module, message.frame, message.name, message.input);
      answer.then(
        (value) => reply({ type: 'module-result', id: message.id, value }),
        (error: unknown) =>
          reply({
            type: 'module-result',
            id: message.id,
            value: null,
            error: messageOf(error),
          }),
      );
    },

    /** What a shell that just connected needs. */
    snapshot(): {
      reports: ReportEntry[];
      failures: ModuleFailure[];
      changes: StagedChange[];
      state: StateEntry[];
    } {
      const entries: ReportEntry[] = [];
      for (const [moduleId, byName] of reports) {
        const serverOnly = byId.get(moduleId)?.spec.probe?.serverOnly;
        for (const [name, byFrame] of byName) {
          if (serverOnly?.includes(name)) continue;
          for (const [frame, payload] of byFrame) {
            entries.push({ module: moduleId, frame, name, payload });
          }
        }
      }
      const state = [...published].flatMap(([moduleId, byName]) =>
        [...byName].map(([name, value]) => ({ module: moduleId, name, value })),
      );
      return { reports: entries, failures, changes, state };
    },

    failures: (): readonly ModuleFailure[] => failures,

    /** Truing's browser, once its window is open. */
    connectBrowser(next: ScreenshotControl): void {
      browser = next;
    },

    call: callOp,
    command,

    /** The Claude tools of every module that started; TRU-12.1 serves them over MCP. */
    tools: {
      list(): ToolInfo[] {
        return modules.flatMap((loaded) =>
          handlers.has(loaded.spec.id)
            ? Object.entries(loaded.spec.claude?.tools ?? {}).map(
                ([name, tool]) => ({
                  name,
                  module: loaded.spec.id,
                  description: tool.description,
                  inputSchema: zm.toJSONSchema(tool.input),
                }),
              )
            : [],
        );
      },

      async call(name: string, input: unknown): Promise<ToolResult> {
        const error = (text: string): ToolResult => ({
          content: [{ type: 'text', text }],
          isError: true,
        });
        const owner = modules.find(
          (loaded) =>
            handlers.has(loaded.spec.id) &&
            own(loaded.spec.claude?.tools, name) !== undefined,
        );
        const tool = own(owner?.spec.claude?.tools, name);
        const run = owner && own(handlers.get(owner.spec.id)?.tools, name);
        if (!owner || !tool || !run) {
          return error(`No tool "${name}".`);
        }
        const parsed = parse(tool.input, input ?? {}, `input for ${name}`);
        if (!parsed.ok) {
          return error(parsed.error);
        }
        try {
          const value = await run(parsed.value);
          return {
            content: [
              {
                type: 'text',
                text:
                  typeof value === 'string'
                    ? value
                    : JSON.stringify(value ?? null),
              },
            ],
          };
        } catch (thrown) {
          return error(messageOf(thrown));
        }
      },
    },

    changes: changesControl,

    async close(): Promise<void> {
      for (const entry of pending.values()) {
        clearTimeout(entry.timer);
        entry.reject(new Error('Truing closed.'));
      }
      pending.clear();
      await Promise.all(
        [...handlers].map(async ([id, part]) => {
          try {
            await part.onClose?.();
          } catch (error) {
            log(`[truing] module ${id} onClose: ${messageOf(error)}`);
          }
        }),
      );
    },
  };
}
