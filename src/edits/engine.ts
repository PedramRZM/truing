// The direct engine (TRU-4.1): writes the mechanical changes a designer stages
// as exact source edits, with no model. The recipe is the one from the
// research (element-to-source-react19.md §Writing a change back): parse,
// find the node by its position, splice the characters with MagicString,
// merge classes with the repo's tailwind-merge, then the repo's Prettier.
// What it can't write exactly it routes to Claude, with the reason.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import MagicString from 'magic-string';
import ts from 'typescript';

import type { TruingConfig } from '../config';
import { matchesGlob } from '../globs.mjs';
import type { ApplyOutcome, Edit, Scope } from '../module';
import { configFor, parseCvaFile } from '../modules/selection/cva';

import {
  editLiteral,
  mergeList,
  type Literal,
  type Merge,
  overrides,
  projectMerge,
} from './classes';
import { NOT_WRITTEN } from './messages';
import {
  attributeInsertAt,
  attributeOf,
  attributeValue,
  cvaCallOf,
  entryHolding,
  insideList,
  isPlainString,
  type Jsx,
  jsxAt,
  offsetOf,
  parseSource,
  passesClassName,
  stringsIn,
  tagOf,
} from './source';

/** Why a change goes to Claude, in the words the tray shows. */
export const REASONS = {
  notWritable: 'the file is outside the UI files Truing may change',
  noElement: 'the code moved since the page loaded, so reload and redo it',
  list: 'the element is drawn from a list, so the change applies to every item',
  runtimeClass: 'class is built at runtime',
  conditionalClass: 'class comes from a condition',
  notHere: 'class is written inside the component',
  runtimeText: 'text is built at runtime',
  mixedText: 'text sits among other elements',
  textDiffers: 'the text in the code differs from the page',
  runtimeVariant: 'variant is set at runtime',
  noConfig: "Truing can't read this component's variants",
  runtimeCvaClasses: "the variant's classes are built at runtime",
  variantAtSize: 'a variant change at one size only needs restructuring',
  noClassName: 'the component may not take a className; this needs a prop',
  textAtSize: 'a text change at one size only needs restructuring',
} as const;

export type Plan =
  | { status: 'direct'; files: Array<{ file: string; hash: string }> }
  | {
      status: 'claude';
      reason: string;
      files: Array<{ file: string; hash: string }>;
    };

/** Thrown when an edit can't be written exactly: the change goes to Claude. */
class NeedsClaude extends Error {}

export function hashOf(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

type Prettier = {
  format: (text: string, options: Record<string, unknown>) => Promise<string>;
  resolveConfig: (file: string) => Promise<Record<string, unknown> | null>;
};

/** The project's own Prettier, from its root; null when it has none. */
export async function loadPrettier(root: string): Promise<Prettier | null> {
  try {
    const resolved = createRequire(path.join(root, 'package.json')).resolve(
      'prettier',
    );
    const loaded = (await import(pathToFileURL(resolved).href)) as Prettier & {
      default?: Prettier;
    };
    return loaded.default ?? loaded;
  } catch {
    return null;
  }
}

/** The file an edit changes. */
function targetOf(edit: Edit): string {
  return edit.kind === 'cva' ? edit.file : edit.at.file;
}

/** Every file an edit reads: the variant's definition too, which says what variants exist. */
function filesOf(edit: Edit): string[] {
  return edit.kind === 'variant'
    ? [edit.at.file, edit.definition]
    : [targetOf(edit)];
}

export type EditEngine = ReturnType<typeof createEditEngine>;

export function createEditEngine(options: {
  root: string;
  config: Pick<TruingConfig, 'writable' | 'tailwindMerge'>;
  /** Tests pass their own; by default the project's. */
  prettier?: Prettier | null;
}) {
  const { root, config } = options;
  let merge: Merge | null = null;
  const mergeOf = (): Merge =>
    (merge ??= projectMerge(root, config.tailwindMerge));
  let prettier: Promise<Prettier | null> | null =
    options.prettier === undefined ? null : Promise.resolve(options.prettier);

  /** A project path Truing may write: inside the root, in `include`, not in `exclude`. */
  function writable(file: string): boolean {
    const normal = path.posix.normalize(file);
    if (path.isAbsolute(normal) || normal.startsWith('..')) return false;
    const { include, exclude } = config.writable;
    return (
      include.some((glob) => matchesGlob(normal, glob)) &&
      !exclude.some((glob) => matchesGlob(normal, glob))
    );
  }

  async function read(file: string): Promise<string> {
    return readFile(path.join(root, file), 'utf8');
  }

  /** The element at a position, or why there isn't one to write. */
  function elementAt(
    source: ts.SourceFile,
    text: string,
    at: { line: number; column: number },
    tag?: string,
    list = false,
  ): Jsx {
    const offset = offsetOf(text, at.line, at.column);
    const node = offset === null ? null : jsxAt(source, offset);
    // A line added above it moves the code without changing the page: the
    // position then names another element.
    if (!node || (tag !== undefined && tagOf(node) !== tag)) {
      throw new NeedsClaude(REASONS.noElement);
    }
    if (insideList(node) && !list) throw new NeedsClaude(REASONS.list);
    return node;
  }

  function literalOf(
    node: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral,
    text: string,
  ): Literal {
    const start = node.getStart() + 1;
    const inner = text.slice(start, node.end - 1);
    // An escape would make the offsets lie about the characters.
    if (inner.includes('\\')) throw new NeedsClaude(REASONS.runtimeClass);
    return { inner, start };
  }

  /** The removals not found and not overridden by an addition: they come from elsewhere. */
  function checkRemovals(
    edit: { add: readonly string[]; remove: readonly string[] },
    found: readonly string[],
  ): void {
    for (const name of edit.remove) {
      if (found.includes(name)) continue;
      if (edit.add.some((added) => overrides(mergeOf(), name, added))) continue;
      throw new NeedsClaude(REASONS.notHere);
    }
  }

  function writeClasses(
    ms: MagicString,
    text: string,
    source: ts.SourceFile,
    edit: Extract<Edit, { kind: 'classes' }>,
  ): void {
    const node = elementAt(source, text, edit.at, edit.tag, edit.list);
    const attribute = attributeOf(node, 'className');
    if (!attribute) {
      // A component's own JSX decides whether it passes a className on.
      if (/^[A-Z]|\./.test(tagOf(node)) && !edit.takesClassName) {
        throw new NeedsClaude(REASONS.noClassName);
      }
      checkRemovals(edit, []);
      ms.appendLeft(
        attributeInsertAt(node),
        ` className="${edit.add.join(' ')}"`,
      );
      return;
    }
    const value = attributeValue(attribute);
    if (value && isPlainString(value)) {
      const literal = literalOf(value, text);
      const found = editLiteral(ms, literal, edit, mergeOf());
      checkRemovals(edit, found);
      const current = literal.inner.split(/\s+/).filter(Boolean);
      // `className=""` says nothing, so the last class takes the attribute with it.
      if (mergeList(current, edit, mergeOf()).length === 0) {
        ms.remove(attribute.getFullStart(), attribute.getEnd());
      }
      return;
    }
    if (
      value &&
      ts.isCallExpression(value) &&
      ts.isIdentifier(value.expression) &&
      value.expression.text === 'cn'
    ) {
      writeCn(ms, text, source, value, edit);
      return;
    }
    // `className={navItem({ tone })}`: the cva call's base string in this file.
    const config =
      value && ts.isCallExpression(value) && ts.isIdentifier(value.expression)
        ? cvaCallOf(source, value.expression.text)
        : null;
    if (config) {
      writeCn(ms, text, source, config, edit);
      return;
    }
    throw new NeedsClaude(REASONS.runtimeClass);
  }

  /**
   * `cn('base', cond && 'x', className)`: the unconditional strings are
   * edited; the additions go in the last one before the pass-through
   * `className` (last wins), or in a new string inserted there.
   */
  function writeCn(
    ms: MagicString,
    text: string,
    source: ts.SourceFile,
    call: ts.CallExpression,
    edit: Extract<Edit, { kind: 'classes' }>,
  ): void {
    const args = [...call.arguments];
    // The consumer's className, passed straight on or inside another call
    // (`buttonVariants({ variant, size, className })`): ours go before it.
    const passThrough = args.findIndex((arg) => passesClassName(arg));
    const before = passThrough === -1 ? args : args.slice(0, passThrough);
    const plain = before.filter(isPlainString);
    const target = plain.at(-1) ?? null;

    // `tones[tone]`: the entry holding what's removed says which case the element
    // is. Writing it changes every element of that case (TRU-4.5).
    const entry = entryHolding(source, args, edit.remove);
    if (entry) {
      const found = editLiteral(ms, literalOf(entry, text), edit, mergeOf());
      checkRemovals(edit, found);
      return;
    }

    // A removal or an override that lives in a condition can't be spliced.
    const conditional = args.filter(
      (arg) => !isPlainString(arg) && arg !== args[passThrough],
    );
    for (const arg of conditional) {
      const classes = stringsIn(arg).flatMap((value) => value.split(/\s+/));
      const touched = classes.some(
        (name) =>
          edit.remove.includes(name) ||
          edit.add.some((added) => overrides(mergeOf(), name, added)),
      );
      if (touched) throw new NeedsClaude(REASONS.conditionalClass);
    }

    const found: string[] = [];
    for (const arg of args.filter(isPlainString)) {
      found.push(
        ...editLiteral(
          ms,
          literalOf(arg, text),
          edit,
          mergeOf(),
          arg === target,
        ),
      );
    }
    checkRemovals(edit, found);
    if (target || edit.add.length === 0) return;

    const quote = "'";
    const insert = `${quote}${edit.add.join(' ')}${quote}`;
    const next = args[passThrough];
    const last = args.at(-1);
    if (next) {
      ms.appendLeft(next.getStart(), `${insert}, `);
    } else if (last) {
      // After the last argument, not the list: a trailing comma stays last.
      ms.appendLeft(last.end, `, ${insert}`);
    } else {
      ms.appendLeft(call.arguments.end, insert);
    }
  }

  function writeCva(
    ms: MagicString,
    text: string,
    source: ts.SourceFile,
    edit: Extract<Edit, { kind: 'cva' }>,
  ): void {
    const config = configFor(parseCvaFile(text, edit.file), edit.component);
    if (!config) throw new NeedsClaude(REASONS.noConfig);
    const isConfigCall = (node: ts.Node): node is ts.CallExpression =>
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'cva' &&
      source.getLineAndCharacterOfPosition(node.getStart()).line + 1 ===
        config.line;
    const find = (node: ts.Node): ts.CallExpression | undefined =>
      isConfigCall(node) ? node : ts.forEachChild(node, find);
    const found = find(source);
    const property = (
      node: ts.Node | undefined,
      key: string,
    ): ts.Expression | null => {
      if (!node || !ts.isObjectLiteralExpression(node)) return null;
      for (const entry of node.properties) {
        if (!ts.isPropertyAssignment(entry)) continue;
        const name = entry.name;
        const text =
          ts.isIdentifier(name) ||
          ts.isStringLiteralLike(name) ||
          ts.isNumericLiteral(name)
            ? name.text
            : null;
        if (text === key) return entry.initializer;
      }
      return null;
    };
    const classes = property(
      property(
        property(found?.arguments[1], 'variants') ?? undefined,
        edit.variant,
      ) ?? undefined,
      edit.value,
    );
    if (!classes) throw new NeedsClaude(REASONS.noConfig);
    if (!isPlainString(classes))
      throw new NeedsClaude(REASONS.runtimeCvaClasses);
    const removed = editLiteral(ms, literalOf(classes, text), edit, mergeOf());
    checkRemovals(edit, removed);
  }

  async function writeVariant(
    ms: MagicString,
    text: string,
    source: ts.SourceFile,
    edit: Extract<Edit, { kind: 'variant' }>,
    definition: string,
  ): Promise<void> {
    const config = configFor(
      parseCvaFile(definition, edit.definition),
      edit.component,
    );
    if (!config) throw new NeedsClaude(REASONS.noConfig);
    const values = Object.hasOwn(config.variants, edit.name)
      ? config.variants[edit.name]
      : undefined;
    if (!values) {
      throw new NeedsClaude(`the component has no ${edit.name} variant`);
    }
    if (!Object.hasOwn(values, edit.value)) {
      throw new NeedsClaude(
        `“${edit.value}” isn't one of its ${edit.name} variants`,
      );
    }
    const node = elementAt(source, text, edit.at, edit.tag, edit.list);
    const attribute = attributeOf(node, edit.name);
    if (!attribute) {
      ms.appendLeft(attributeInsertAt(node), ` ${edit.name}="${edit.value}"`);
      return;
    }
    const value = attributeValue(attribute);
    if (!value || !isPlainString(value))
      throw new NeedsClaude(REASONS.runtimeVariant);
    ms.overwrite(value.getStart() + 1, value.end - 1, edit.value);
  }

  function writeText(
    ms: MagicString,
    text: string,
    source: ts.SourceFile,
    edit: Extract<Edit, { kind: 'text' }>,
  ): void {
    const node = elementAt(source, text, edit.at, edit.tag);
    if (!ts.isJsxElement(node)) throw new NeedsClaude(REASONS.runtimeText);
    const children = [...node.children];
    const words = children.filter(
      (child) => !(ts.isJsxText(child) && child.containsOnlyTriviaWhiteSpaces),
    );
    const only = words[0];
    if (words.length !== 1 || !only) {
      throw new NeedsClaude(
        words.some((child) => ts.isJsxExpression(child))
          ? REASONS.runtimeText
          : REASONS.mixedText,
      );
    }
    if (!ts.isJsxText(only)) {
      throw new NeedsClaude(
        ts.isJsxExpression(only) ? REASONS.runtimeText : REASONS.mixedText,
      );
    }
    const raw = text.slice(only.pos, only.end);
    if (squash(decode(raw)) !== squash(edit.before)) {
      throw new NeedsClaude(REASONS.textDiffers);
    }
    const lead = /^\s*/.exec(raw)?.[0].length ?? 0;
    const trail = /\s*$/.exec(raw)?.[0].length ?? 0;
    ms.overwrite(only.pos + lead, only.end - trail, escapeText(edit.after));
  }

  /** Splices one edit into a file's text; throws NeedsClaude when it can't. */
  async function splice(
    edit: Edit,
    text: string,
    read: (file: string) => Promise<string>,
  ): Promise<string> {
    const file = targetOf(edit);
    const source = parseSource(text, file);
    const ms = new MagicString(text);
    switch (edit.kind) {
      case 'classes':
        writeClasses(ms, text, source, edit);
        break;
      case 'cva':
        writeCva(ms, text, source, edit);
        break;
      case 'variant':
        await writeVariant(ms, text, source, edit, await read(edit.definition));
        break;
      case 'text':
        writeText(ms, text, source, edit);
        break;
    }
    return ms.toString();
  }

  /** Where in its file an edit sits: edits are spliced from the end, so earlier positions hold. */
  function positionOf(edit: Edit, text: string): number {
    if (edit.kind === 'cva') return -1;
    return offsetOf(text, edit.at.line, edit.at.column) ?? -1;
  }

  async function format(file: string, text: string): Promise<string> {
    prettier ??= loadPrettier(root);
    const loaded = await prettier;
    if (!loaded) return text;
    const absolute = path.join(root, file);
    const resolved = (await loaded.resolveConfig(absolute)) ?? {};
    return loaded.format(text, { ...resolved, filepath: absolute });
  }

  return {
    writable,

    /**
     * Whether an edit can be written directly, against the files as they
     * are now, and their hashes for the check at Apply.
     */
    async plan(edit: Edit, scope: Scope): Promise<Plan> {
      const names = filesOf(edit);
      const files: Array<{ file: string; hash: string }> = [];
      const texts = new Map<string, string>();
      for (const file of names) {
        if (!writable(file) && file === targetOf(edit)) {
          return { status: 'claude', reason: REASONS.notWritable, files };
        }
        let text: string;
        try {
          text = await read(file);
        } catch {
          return { status: 'claude', reason: REASONS.noElement, files };
        }
        texts.set(file, text);
        files.push({ file, hash: hashOf(text) });
      }
      if (scope !== 'all' && edit.kind === 'variant') {
        return { status: 'claude', reason: REASONS.variantAtSize, files };
      }
      if (scope !== 'all' && edit.kind === 'text') {
        return { status: 'claude', reason: REASONS.textAtSize, files };
      }
      try {
        await splice(
          edit,
          texts.get(targetOf(edit)) ?? '',
          async (file) => texts.get(file) ?? read(file),
        );
        return { status: 'direct', files };
      } catch (error) {
        if (error instanceof NeedsClaude) {
          return { status: 'claude', reason: error.message, files };
        }
        throw error;
      }
    },

    /**
     * Writes direct changes, all or none. Every file is checked against the
     * hash it had when the change was staged; each file's edits are spliced
     * from its end, formatted with the project's Prettier, and only then
     * are the files written.
     */
    async write(
      changes: ReadonlyArray<{
        id: string;
        edit: Edit;
        files: ReadonlyArray<{ file: string; hash: string }>;
      }>,
    ): Promise<ApplyOutcome[]> {
      const failed = (id: string, message: string): ApplyOutcome => ({
        id,
        result: { status: 'failed', message },
      });
      const notWritten = (except: string, message: string): ApplyOutcome[] =>
        changes.map((change) =>
          change.id === except
            ? failed(change.id, message)
            : failed(change.id, NOT_WRITTEN),
        );

      const texts = new Map<string, string>();
      for (const change of changes) {
        if (!writable(targetOf(change.edit))) {
          return notWritten(
            change.id,
            `${targetOf(change.edit)} isn't a UI file Truing may change.`,
          );
        }
        for (const { file, hash } of change.files) {
          let text = texts.get(file);
          if (text === undefined) {
            try {
              text = await read(file);
            } catch {
              return notWritten(
                change.id,
                `${file} is gone. Reload, then redo the change.`,
              );
            }
            texts.set(file, text);
          }
          if (hashOf(text) !== hash) {
            return notWritten(
              change.id,
              `${file} was edited after you made this change. Reload, then redo it.`,
            );
          }
        }
      }

      const byFile = new Map<string, Array<(typeof changes)[number]>>();
      for (const change of changes) {
        const file = targetOf(change.edit);
        byFile.set(file, [...(byFile.get(file) ?? []), change]);
      }

      const output = new Map<string, string>();
      for (const [file, edits] of byFile) {
        const original = texts.get(file) ?? (await read(file));
        const ordered = [...edits].sort(
          (a, b) => positionOf(b.edit, original) - positionOf(a.edit, original),
        );
        let text = original;
        for (const change of ordered) {
          try {
            text = await splice(
              change.edit,
              text,
              async (other) => texts.get(other) ?? read(other),
            );
          } catch (error) {
            const message =
              error instanceof NeedsClaude
                ? `Couldn't write a change to ${file}: ${error.message}. Tick Let Claude do this on it.`
                : String(error);
            return notWritten(change.id, message);
          }
        }
        try {
          output.set(file, await format(file, text));
        } catch (error) {
          const first = edits[0];
          return notWritten(
            first?.id ?? '',
            `Prettier couldn't format ${file}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      for (const [file, text] of output) {
        await writeFile(path.join(root, file), text);
      }
      return changes.map((change) => ({
        id: change.id,
        result: { status: 'applied' },
      }));
    },
  };
}

function squash(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** JSX text as the page shows it: the entities React decodes. */
function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, name: string) => {
    if (name.startsWith('#x') || name.startsWith('#X'))
      return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith('#'))
      return String.fromCodePoint(parseInt(name.slice(1), 10));
    return ENTITIES[name] ?? whole;
  });
}

/** Text written as JSX text: one line, with `{ } < >` and entity-like `&` as expressions. */
export function escapeText(text: string): string {
  return text
    .replace(/\s*\n\s*/g, ' ')
    .replace(/[{}<>]|&(?=#?\w+;)/g, (character) => `{'${character}'}`);
}
