// Finding things in a source file by the positions the inspector gives
// (TRU-1.1): one-based lines and columns, the column in UTF-16 units and
// pointing at a JSX element's `<`. Parsed with TypeScript's own parser, the
// one cva.ts uses, so Truing has a single parser.
import ts from 'typescript';

export type Jsx = ts.JsxElement | ts.JsxSelfClosingElement;

export function parseSource(text: string, file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/** The offset of a one-based line and column; lines split on `\n`, as the inspector's do. */
export function offsetOf(
  text: string,
  line: number,
  column: number,
): number | null {
  let start = 0;
  for (let at = 1; at < line; at += 1) {
    const next = text.indexOf('\n', start);
    if (next === -1) return null;
    start = next + 1;
  }
  const end = text.indexOf('\n', start);
  const length = (end === -1 ? text.length : end) - start;
  if (column < 1 || column - 1 > length) return null;
  return start + column - 1;
}

/** The JSX element whose `<` is at `offset`, or null. */
export function jsxAt(file: ts.SourceFile, offset: number): Jsx | null {
  let found: Jsx | null = null;
  const visit = (node: ts.Node): void => {
    if (found || offset < node.getStart(file) || offset >= node.end) return;
    if (
      (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.getStart(file) === offset
    ) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

export function openingOf(
  node: Jsx,
): ts.JsxOpeningElement | ts.JsxSelfClosingElement {
  return ts.isJsxElement(node) ? node.openingElement : node;
}

/** The tag as the JSX writes it: `p`, `Button`, `Dialog.Title`. */
export function tagOf(node: Jsx): string {
  return openingOf(node).tagName.getText();
}

/** The attribute written as `name=…` on the element, or null. */
export function attributeOf(node: Jsx, name: string): ts.JsxAttribute | null {
  for (const property of openingOf(node).attributes.properties) {
    if (
      ts.isJsxAttribute(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === name
    ) {
      return property;
    }
  }
  return null;
}

/** Where a new attribute goes: after the last one, or after the tag's name. */
export function attributeInsertAt(node: Jsx): number {
  return openingOf(node).attributes.end;
}

/** A plain string: `'a b'`, `"a b"` or `` `a b` `` with no `${}`. */
export function isPlainString(
  node: ts.Node,
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

/** The value an attribute is set to, through `{…}`: `"x"` and `{'x'}` are both the string. */
export function attributeValue(attribute: ts.JsxAttribute): ts.Node | null {
  const value = attribute.initializer;
  if (!value) return null;
  if (ts.isJsxExpression(value)) return value.expression ?? null;
  return value;
}

/** The element is drawn inside a `.map()` (or `.flatMap()`) callback: one JSX, many items. */
export function insideList(node: ts.Node): boolean {
  for (let at = node.parent; at; at = at.parent) {
    const call = at.parent;
    if (
      (ts.isArrowFunction(at) || ts.isFunctionExpression(at)) &&
      call &&
      ts.isCallExpression(call) &&
      call.arguments.some((argument) => argument === at) &&
      ts.isPropertyAccessExpression(call.expression) &&
      ['map', 'flatMap'].includes(call.expression.name.text)
    ) {
      return true;
    }
  }
  return false;
}

/** The `const name = …` at a file's top level, its initializer. */
function constOf(file: ts.SourceFile, name: string): ts.Expression | null {
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === name &&
        declaration.initializer
      ) {
        return declaration.initializer;
      }
    }
  }
  return null;
}

/** `const name = cva('base', …)` in this file, the call; null when it's anything else. */
export function cvaCallOf(
  file: ts.SourceFile,
  name: string,
): ts.CallExpression | null {
  const value = constOf(file, name);
  return value &&
    ts.isCallExpression(value) &&
    ts.isIdentifier(value.expression) &&
    value.expression.text === 'cva'
    ? value
    : null;
}

/**
 * Among `cn(...)`'s arguments, `tones[tone]` on a const object in this file: the
 * one string of it holding every class to remove. Null when there's no such
 * argument, nothing to remove (nothing says which case it is), or two match.
 */
export function entryHolding(
  file: ts.SourceFile,
  args: readonly ts.Expression[],
  remove: readonly string[],
): ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | null {
  if (remove.length === 0) return null;
  const holding = args.flatMap((arg) => {
    if (!ts.isElementAccessExpression(arg)) return [];
    if (!ts.isIdentifier(arg.expression)) return [];
    const object = constOf(file, arg.expression.text);
    if (!object || !ts.isObjectLiteralExpression(object)) return [];
    return object.properties.flatMap((entry) => {
      if (!ts.isPropertyAssignment(entry)) return [];
      const value = entry.initializer;
      if (!isPlainString(value)) return [];
      const classes = value.text.split(/\s+/);
      return remove.every((name) => classes.includes(name)) ? [value] : [];
    });
  });
  return holding.length === 1 ? (holding[0] ?? null) : null;
}

/** Every plain string inside a node, for telling "in a condition" from "not here". */
export function stringsIn(node: ts.Node): string[] {
  const found: string[] = [];
  const visit = (child: ts.Node): void => {
    if (isPlainString(child)) found.push(child.text);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
}

/** An argument that is, or carries, the consumer's `className`. */
export function passesClassName(node: ts.Node): boolean {
  if (ts.isIdentifier(node)) return node.text === 'className';
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text === 'className';
  }
  if (ts.isShorthandPropertyAssignment(node)) {
    return node.name.text === 'className';
  }
  return ts.forEachChild(node, passesClassName) ?? false;
}

/**
 * The JSX passes a consumer's `className` on, so a `className` at its call site
 * reaches this element: its own `className` carries it, or with none of its own,
 * a spread of props does. A literal beside a spread decides nothing, as which
 * wins depends on their order, so it counts as not passing.
 */
export function takesClassName(node: Jsx): boolean {
  const own = attributeOf(node, 'className');
  if (own) {
    return own.initializer !== undefined && passesClassName(own.initializer);
  }
  return openingOf(node).attributes.properties.some((entry) =>
    ts.isJsxSpreadAttribute(entry),
  );
}
