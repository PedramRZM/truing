// The variants of a primitive, read from its source: every `cva(base,
// config)` call in a file, parsed statically (TRU-1.1 settled that our configs
// are all literals). React only holds the props a component got, so this is
// what tells a variant prop (`variant`, `size`) from any other, and what a
// variant is when it wasn't passed (`defaultVariants`). Runs in Truing's
// Node process, with TypeScript's own parser.
import ts from 'typescript';

export type CvaConfig = {
  /** The variable it is assigned to (`buttonVariants`), if any. */
  name: string | null;
  /** One-based line of the `cva(` call. */
  line: number;
  /** Variant name → value → classes. */
  variants: Record<string, Record<string, string>>;
  defaultVariants: Record<string, string>;
  /** Variants whose classes aren't literals: their values are known, their classes aren't. */
  dynamic: string[];
};

/** What a variant is set to on one element, and where that comes from. */
export type VariantValue = {
  name: string;
  value: string;
  from: 'prop' | 'default';
};

type Scope = ReadonlyMap<string, ts.Expression>;

function keyOf(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  if (ts.isNumericLiteral(name)) return name.text;
  return null;
}

/** A string the expression always evaluates to, through same-file constants; null if it isn't one. */
function staticString(
  node: ts.Expression,
  scope: Scope,
  depth = 0,
): string | null {
  if (depth > 8) return null;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) {
    return staticString(node.expression, scope, depth + 1);
  }
  if (ts.isIdentifier(node)) {
    const value = scope.get(node.text);
    return value ? staticString(value, scope, depth + 1) : null;
  }
  if (ts.isTemplateExpression(node)) {
    let text = node.head.text;
    for (const span of node.templateSpans) {
      const part = staticString(span.expression, scope, depth + 1);
      if (part === null) return null;
      text += part + span.literal.text;
    }
    return text;
  }
  if (ts.isArrayLiteralExpression(node)) {
    const parts = node.elements.map((element) =>
      staticString(element, scope, depth + 1),
    );
    return parts.every((part) => part !== null) ? parts.join(' ') : null;
  }
  return null;
}

function objectEntries(
  node: ts.Expression | undefined,
): Array<[string, ts.Expression]> {
  if (!node || !ts.isObjectLiteralExpression(node)) return [];
  return node.properties.flatMap((property): Array<[string, ts.Expression]> => {
    if (!ts.isPropertyAssignment(property)) return [];
    const key = keyOf(property.name);
    return key === null ? [] : [[key, property.initializer]];
  });
}

function readConfig(
  call: ts.CallExpression,
  file: ts.SourceFile,
  scope: Scope,
): CvaConfig {
  const parent = call.parent;
  const name =
    ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)
      ? parent.name.text
      : null;
  const config = Object.fromEntries(objectEntries(call.arguments[1]));
  const variants: CvaConfig['variants'] = {};
  const dynamic: string[] = [];

  for (const [variant, values] of objectEntries(config.variants)) {
    variants[variant] = {};
    for (const [value, classes] of objectEntries(values)) {
      const text = staticString(classes, scope);
      if (text === null) {
        if (!dynamic.includes(variant)) dynamic.push(variant);
        variants[variant][value] = '';
        continue;
      }
      variants[variant][value] = text.replace(/\s+/g, ' ').trim();
    }
  }

  const defaultVariants: Record<string, string> = {};
  for (const [variant, value] of objectEntries(config.defaultVariants)) {
    if (value.kind === ts.SyntaxKind.TrueKeyword)
      defaultVariants[variant] = 'true';
    else if (value.kind === ts.SyntaxKind.FalseKeyword)
      defaultVariants[variant] = 'false';
    else {
      const text = staticString(value, scope);
      if (text !== null) defaultVariants[variant] = text;
    }
  }

  const line = file.getLineAndCharacterOfPosition(call.getStart(file)).line + 1;
  return { name, line, variants, defaultVariants, dynamic };
}

function isCvaCall(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'cva'
  );
}

export type CvaFile = {
  configs: CvaConfig[];
  /** Which config each component in the file calls: component name → config name. */
  usedBy: Record<string, string>;
};

/** Every `cva()` config in a file, and which component calls which. */
export function parseCvaFile(source: string, fileName: string): CvaFile {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  // Top-level constants, for template literals over them (`${smallChip}`).
  const scope = new Map<string, ts.Expression>();
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer) {
        scope.set(declaration.name.text, declaration.initializer);
      }
    }
  }

  const configs: CvaConfig[] = [];
  const visit = (node: ts.Node): void => {
    if (isCvaCall(node)) configs.push(readConfig(node, file, scope));
    ts.forEachChild(node, visit);
  };
  visit(file);

  // A component uses the config whose variable its body names.
  const names = new Set(
    configs.flatMap((config) => (config.name ? [config.name] : [])),
  );
  const usedBy: Record<string, string> = {};
  const record = (component: string, body: ts.Node): void => {
    const find = (node: ts.Node): string | null => {
      if (ts.isIdentifier(node) && names.has(node.text)) return node.text;
      return ts.forEachChild(node, find) ?? null;
    };
    const used = find(body);
    if (used) usedBy[component] = used;
  };
  for (const statement of file.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      statement.body
    ) {
      record(statement.name.text, statement.body);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          !isCvaCall(declaration.initializer)
        ) {
          record(declaration.name.text, declaration.initializer);
        }
      }
    }
  }

  return { configs, usedBy };
}

/** The config a component uses: the one its body names, else the file's only one. */
export function configFor(file: CvaFile, component: string): CvaConfig | null {
  const used = file.usedBy[component];
  if (used) return file.configs.find((config) => config.name === used) ?? null;
  return file.configs.length === 1 ? (file.configs[0] ?? null) : null;
}

/** Each variant of the config, as the element's props set it or as it defaults. */
export function variantsOf(
  config: CvaConfig,
  props: Readonly<Record<string, unknown>>,
): VariantValue[] {
  return Object.keys(config.variants).flatMap((name): VariantValue[] => {
    const prop = props[name];
    if (
      typeof prop === 'string' ||
      typeof prop === 'boolean' ||
      typeof prop === 'number'
    ) {
      return [{ name, value: String(prop), from: 'prop' }];
    }
    const fallback = config.defaultVariants[name];
    return fallback === undefined
      ? []
      : [{ name, value: fallback, from: 'default' }];
  });
}
