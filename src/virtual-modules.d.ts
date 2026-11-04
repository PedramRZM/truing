// The entries Truing generates at start from the config's module list
// (src/module-loader.ts, probesEntry and panelsEntry); esbuild resolves them.
declare module 'truing:probes' {
  import type { ProbeEntry } from './runtime/probes';

  export const probes: readonly ProbeEntry[];
}

declare module 'truing:panels' {
  import type { ModuleSpec, PanelDefinition } from './module';

  export const panels: ReadonlyArray<{
    module: ModuleSpec;
    panel: PanelDefinition | null;
  }>;
}
