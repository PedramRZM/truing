// Where a component is used in the code (TRU-2.2): every JSX tag in the
// project's source that means it, found by following imports rather than by
// matching text, so an aliased import counts and an unrelated component of
// the same name doesn't. A component is named by its module and export, not
// by a pick, so the component gallery (TRU-15.1) and the look-alike finder (TRU-15.2)
// can ask about any component. Runs in Truing's Node process, with
// TypeScript's own parser and module resolution.
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import ts from 'typescript';

import { insideList } from '../../edits/source';

/**
 * A component as the code names it: the file its module resolves to
 * (absolute), and the export path inside it. `['Button']` for a named
 * export, `['default']` for a default one, `['Popover', 'Trigger']` for
 * `<Popover.Trigger>` from `import { Popover } from 'radix-ui'`.
 */
export type ComponentRef = { module: string; path: string[] };

/** One JSX tag that uses the component. */
export type Use = {
  /** Relative to the project root, with forward slashes. */
  file: string;
  /** One-based, columns in UTF-16 units, at the tag's `<`: TRU-1.1's positions. */
  line: number;
  column: number;
  /**
   * Its attributes: the string a literal sets (`variant="tonal"` is
   * `tonal`, a bare `asChild` is `true`), or null when an expression sets
   * it. An attribute that isn't written is absent.
   */
  attributes: Record<string, string | null>;
  /** It spreads props (`{...props}`), so an absent attribute may still be set. */
  spread: boolean;
  /** Written inside a `.map()` callback: one use, drawn once per item. */
  inList: boolean;
};

type ImportBinding = {
  local: string;
  specifier: string;
  /** The export path the local name stands for: `[]` for a namespace import. */
  path: string[];
};

type Tag = Omit<Use, 'file'> & { name: string[] };

/** What a file says about components, read once per version of it. */
type Summary = {
  imports: ImportBinding[];
  /** Names the file declares at its top level (a component it defines). */
  declared: Set<string>;
  /** `const MemoCard = memo(Card)`, `forwardRef(Card)`: the wrapper's name → what it wraps. */
  wraps: Map<string, string>;
  tags: Tag[];
};

const SOURCE_EXTENSIONS = /\.(tsx|ts|jsx|js)$/;
const SKIPPED_FOLDERS = new Set(['node_modules', '.next', 'dist', 'build']);

function tagName(name: ts.JsxTagNameExpression): string[] | null {
  if (ts.isIdentifier(name)) return [name.text];
  if (ts.isPropertyAccessExpression(name)) {
    const left = tagName(name.expression);
    return left ? [...left, name.name.text] : null;
  }
  return null;
}

function attributeValue(
  initializer: ts.JsxAttributeValue | undefined,
): string | null {
  if (!initializer) return 'true';
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (
    ts.isJsxExpression(initializer) &&
    initializer.expression &&
    ts.isStringLiteralLike(initializer.expression)
  ) {
    return initializer.expression.text;
  }
  return null;
}

function declaredNames(statement: ts.Statement): string[] {
  if (
    (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
    statement.name
  ) {
    return [statement.name.text];
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
    );
  }
  return [];
}

const WRAPPERS = new Set(['memo', 'forwardRef']);

/** `memo(B)`, `React.forwardRef(B)`, `memo(B, compare)`: B; else null. */
function wrapped(call: ts.Expression): string | null {
  if (!ts.isCallExpression(call)) return null;
  const callee = ts.isPropertyAccessExpression(call.expression)
    ? call.expression.name
    : call.expression;
  const inner = call.arguments[0];
  if (!ts.isIdentifier(callee) || !WRAPPERS.has(callee.text)) return null;
  return inner && ts.isIdentifier(inner) ? inner.text : null;
}

/**
 * What a name stands for: `const A = memo(B)` is A → B, and a default
 * export is `default` → the name it exports (`export default function
 * Card`, `export default Card`, `export default memo(Card)`).
 */
function wrapsOf(statement: ts.Statement): Array<[string, string]> {
  if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
    const { expression } = statement;
    const name = ts.isIdentifier(expression)
      ? expression.text
      : wrapped(expression);
    return name ? [['default', name]] : [];
  }
  if (
    (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
    statement.name &&
    statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
    )
  ) {
    return [['default', statement.name.text]];
  }
  if (!ts.isVariableStatement(statement)) return [];
  return statement.declarationList.declarations.flatMap(
    (declaration): Array<[string, string]> => {
      const inner = declaration.initializer
        ? wrapped(declaration.initializer)
        : null;
      return ts.isIdentifier(declaration.name) && inner
        ? [[declaration.name.text, inner]]
        : [];
    },
  );
}

function importsOf(statement: ts.Statement): ImportBinding[] {
  if (
    !ts.isImportDeclaration(statement) ||
    !ts.isStringLiteral(statement.moduleSpecifier) ||
    !statement.importClause ||
    statement.importClause.isTypeOnly
  ) {
    return [];
  }
  const specifier = statement.moduleSpecifier.text;
  const clause = statement.importClause;
  const bindings: ImportBinding[] = [];
  if (clause.name) {
    bindings.push({ local: clause.name.text, specifier, path: ['default'] });
  }
  const named = clause.namedBindings;
  if (named && ts.isNamespaceImport(named)) {
    bindings.push({ local: named.name.text, specifier, path: [] });
  } else if (named) {
    for (const element of named.elements) {
      if (element.isTypeOnly) continue;
      bindings.push({
        local: element.name.text,
        specifier,
        path: [(element.propertyName ?? element.name).text],
      });
    }
  }
  return bindings;
}

/** Reads a file's imports, top-level names and JSX tags. */
export function summarize(text: string, fileName: string): Summary {
  const source = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') || fileName.endsWith('.jsx')
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );
  const imports = source.statements.flatMap(importsOf);
  const declared = new Set(source.statements.flatMap(declaredNames));
  const wraps = new Map(source.statements.flatMap(wrapsOf));
  const tags: Tag[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = tagName(node.tagName);
      // Lower-case single names are DOM elements, never components.
      if (name && !(name.length === 1 && /^[a-z]/.test(name[0] ?? ''))) {
        const start = source.getLineAndCharacterOfPosition(
          node.getStart(source),
        );
        const attributes: Record<string, string | null> = {};
        let spread = false;
        for (const property of node.attributes.properties) {
          if (ts.isJsxSpreadAttribute(property)) {
            spread = true;
            continue;
          }
          const key = ts.isIdentifier(property.name)
            ? property.name.text
            : `${property.name.namespace.text}:${property.name.name.text}`;
          attributes[key] = attributeValue(property.initializer);
        }
        tags.push({
          name,
          line: start.line + 1,
          column: start.character + 1,
          attributes,
          spread,
          inList: insideList(node),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { imports, declared, wraps, tags };
}

/** The compiler options module resolution needs, from the nearest tsconfig.json above `dir`. */
function compilerOptionsFor(dir: string): ts.CompilerOptions {
  const file = ts.findConfigFile(dir, ts.sys.fileExists, 'tsconfig.json');
  if (!file) return { moduleResolution: ts.ModuleResolutionKind.Bundler };
  const read = ts.readConfigFile(file, ts.sys.readFile);
  // TypeScript's own parse sets where `paths` are relative to and follows
  // `extends`; a host that lists no files keeps it from walking the project.
  const host: ts.ParseConfigHost = {
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: () => [],
  };
  return ts.parseJsonConfigFileContent(
    read.config ?? {},
    host,
    path.dirname(file),
    undefined,
    file,
  ).options;
}

async function sourceFiles(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const nested = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || SKIPPED_FOLDERS.has(entry.name)) {
          return [];
        }
        return sourceFiles(full);
      }
      if (!SOURCE_EXTENSIONS.test(entry.name) || entry.name.endsWith('.d.ts')) {
        return [];
      }
      return [full];
    }),
  );
  return nested.flat();
}

function samePath(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((part, index) => part === b[index]);
}

/** What a name wraps, through `memo` and `forwardRef`, down to the component itself. */
function unwrapped(name: string, wraps: ReadonlyMap<string, string>): string {
  let at = name;
  for (let step = 0; step < 10; step++) {
    const inner = wraps.get(at);
    if (!inner) return at;
    at = inner;
  }
  return at;
}

export type UsagesIndex = ReturnType<typeof createUsagesIndex>;

/**
 * The project's source as an index of component uses. `source` is the
 * folder searched, relative to `root` (usually `src`). Files are read
 * again only when they change.
 */
export function createUsagesIndex(options: { root: string; source: string }) {
  const sourceDir = path.resolve(options.root, options.source);
  const compilerOptions = compilerOptionsFor(sourceDir);
  const resolutionCache = ts.createModuleResolutionCache(
    options.root,
    (name) => name,
    compilerOptions,
  );
  const summaries = new Map<
    string,
    { mtimeMs: number; text: string; summary: Summary | null }
  >();

  function resolve(specifier: string, fromFile: string): string | null {
    const resolved = ts.resolveModuleName(
      specifier,
      fromFile,
      compilerOptions,
      ts.sys,
      resolutionCache,
    ).resolvedModule?.resolvedFileName;
    return resolved ? path.resolve(resolved) : null;
  }

  /** A file's text, read again when it changed; null if it can't be read. */
  async function entryOf(absolute: string) {
    try {
      const { mtimeMs } = await stat(absolute);
      let entry = summaries.get(absolute);
      if (entry?.mtimeMs !== mtimeMs) {
        entry = {
          mtimeMs,
          text: await readFile(absolute, 'utf8'),
          summary: null,
        };
        summaries.set(absolute, entry);
      }
      return entry;
    } catch {
      return null;
    }
  }

  function summaryOf(
    absolute: string,
    entry: NonNullable<Awaited<ReturnType<typeof entryOf>>>,
  ): Summary {
    entry.summary ??= summarize(entry.text, absolute);
    return entry.summary;
  }

  /** The component a tag name means in a file, through its imports or its own declarations. */
  function refIn(
    absolute: string,
    summary: Summary,
    name: readonly string[],
  ): ComponentRef | null {
    const [local, ...rest] = name;
    if (!local) return null;
    const binding = summary.imports.find((entry) => entry.local === local);
    if (binding) {
      const resolved = resolve(binding.specifier, absolute);
      return resolved
        ? { module: resolved, path: [...binding.path, ...rest] }
        : null;
    }
    if (summary.declared.has(local)) {
      return { module: absolute, path: [...name] };
    }
    return null;
  }

  const relative = (absolute: string): string =>
    path.relative(options.root, absolute).split(path.sep).join('/');

  return {
    /**
     * The component a JSX tag (`Button`, `Dialog.Content`) means in a file of
     * the project (relative to the root); null when the file doesn't import
     * or declare it.
     */
    async resolveTag(file: string, tag: string): Promise<ComponentRef | null> {
      const absolute = path.resolve(options.root, file);
      const entry = await entryOf(absolute);
      if (!entry) return null;
      return refIn(absolute, summaryOf(absolute, entry), tag.split('.'));
    },

    /** Reads every source file once, so the first search doesn't wait on the disk. */
    async warm(): Promise<void> {
      for (const absolute of await sourceFiles(sourceDir)) {
        await entryOf(absolute);
      }
    },

    /** Every use of a component under the source folder, by file and position. */
    async usesOf(ref: ComponentRef): Promise<Use[]> {
      // The component's own file says which of its exports wrap it in
      // `memo` or `forwardRef`: a use of those is a use of it.
      const home = await entryOf(ref.module);
      const wraps =
        home && ref.path.length === 1
          ? summaryOf(ref.module, home).wraps
          : new Map<string, string>();
      const target =
        ref.path.length === 1 && ref.path[0] !== undefined
          ? unwrapped(ref.path[0], wraps)
          : null;
      const names = new Set(
        target === null
          ? []
          : [
              target,
              ...[...wraps.keys()].filter(
                (name) => unwrapped(name, wraps) === target,
              ),
            ],
      );
      const same = (found: ComponentRef): boolean =>
        found.module === ref.module &&
        (target !== null && found.path.length === 1
          ? names.has(found.path[0] ?? '')
          : samePath(found.path, ref.path));
      // A file can only use it if its text names it, or imports a default
      // under a name of its own.
      const needles = target === null ? [ref.path.at(-1)] : [...names];
      const files = await sourceFiles(sourceDir);
      const uses: Use[] = [];
      for (const absolute of files.sort()) {
        const entry = await entryOf(absolute);
        if (!entry) continue;
        const named = needles.some(
          (needle) =>
            needle !== undefined &&
            needle !== 'default' &&
            entry.text.includes(needle),
        );
        if (!named && !needles.includes('default')) continue;
        const summary = summaryOf(absolute, entry);
        for (const { name, ...tag } of summary.tags) {
          const found = refIn(absolute, summary, name);
          if (found && same(found)) {
            uses.push({ file: relative(absolute), ...tag });
          }
        }
      }
      return uses;
    },
  };
}
