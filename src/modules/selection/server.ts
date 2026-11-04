import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import ts from 'typescript';

import { launchEditorUrl } from '../../adapters/next';
import {
  jsxAt,
  offsetOf,
  parseSource,
  takesClassName,
} from '../../edits/source';
import {
  type ChangeElement,
  defineServer,
  type DraftChange,
  type Edit,
  messageOf,
  type SourceAt,
  type StagedChange,
} from '../../module';
import { spacingRows } from '../../shell/controls/token-rows';
import { loadTokens, type TokenTable } from '../../tokens/table';

import {
  configFor,
  type CvaConfig,
  type CvaFile,
  parseCvaFile,
  variantsOf,
} from './cva';
import {
  applyRule,
  inProject,
  type Paths,
  projectPath,
  type Rule,
  stylesOf,
  tagAt,
} from './inspect';
import { scopeReason } from './layout-classes';
import selection, {
  type Inspection,
  type InstancesView,
  type Link,
  type Selection,
  type Style,
  type UsagesView,
} from './module';
import { decideReach, type ReachDecision } from './reach';
import {
  changesToSpread,
  editAt,
  oneAloneReason,
  placeKey,
  placeOfEdit,
} from './similar-plan';
import { isSpacingRoot, type SpacingClass } from './spacing-tokens';
import { styleTokens } from './style-classes';
import { createUsagesIndex } from './usages';

type Identity = NonNullable<Selection['identity']>;

/** Why a change has no direct path when the inspector found no place for it. */
const PLACE_UNKNOWN = "the element's place in the code isn't known";

function foundAt(place: Inspection['definition']): SourceAt | null {
  return place.status === 'found' ? place.at : null;
}

/** Text for a tray label: trimmed, and cut at 24 characters. */
function quote(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const cut = [...trimmed];
  return `“${cut.length > 24 ? `${cut.slice(0, 23).join('')}…` : trimmed}”`;
}

export default defineServer(selection, (ctx) => {
  const paths: Paths = {
    root: ctx.root,
    appDir: path.resolve(ctx.root, ctx.config.app.dir ?? '.'),
    // A path no file starts with, when the project has no primitives folder.
    primitives: ctx.config.primitives?.replace(/\/?$/, '/') ?? '\0',
  };
  const appOrigin = `http://localhost:${ctx.config.app.port}`;

  // The token table loads on the first inspect: about a second on a large stylesheet.
  let tokens: Promise<TokenTable | null> | null = null;
  const tokenTable = (): Promise<TokenTable | null> => {
    const stylesheet = ctx.config.tokens;
    if (!stylesheet) return Promise.resolve(null);
    tokens ??= loadTokens(ctx.root, stylesheet).catch((error: unknown) => {
      tokens = null;
      throw error;
    });
    return tokens;
  };

  // Source files and their cva configs, read again when a file changes.
  const sources = new Map<
    string,
    { mtimeMs: number; text: string; cva: CvaFile | null }
  >();
  async function sourceOf(
    file: string,
  ): Promise<{ text: string; cva: () => CvaFile } | null> {
    const absolute = path.join(ctx.root, file);
    try {
      const { mtimeMs } = await stat(absolute);
      let entry = sources.get(file);
      if (entry?.mtimeMs !== mtimeMs) {
        entry = { mtimeMs, text: await readFile(absolute, 'utf8'), cva: null };
        sources.set(file, entry);
      }
      const known = entry;
      return {
        text: known.text,
        cva: () => (known.cva ??= parseCvaFile(known.text, file)),
      };
    } catch {
      return null;
    }
  }

  /** A link's component as its JSX names it, else as React does. */
  async function nameOf(link: Link): Promise<string> {
    if (!link.at || link.at.ignored) return link.name;
    const source = await sourceOf(projectPath(link.at.file, paths));
    const tag = source
      ? tagAt(source.text, link.at.line, link.at.column)
      : null;
    return tag ?? link.name;
  }

  /** The cva config the definition's component reads, if it has one. */
  async function cvaConfigOf(rule: Rule): Promise<CvaConfig | null> {
    const primitiveName = rule.primitive ? await nameOf(rule.primitive) : null;
    const definitionFile =
      rule.definition.status === 'found' ? rule.definition.at.file : null;
    const source = definitionFile ? await sourceOf(definitionFile) : null;
    return source && primitiveName
      ? configFor(source.cva(), primitiveName)
      : null;
  }

  /** The component the call site names, or null. */
  function componentName(rule: Rule): Promise<string | null> {
    return rule.component ? nameOf(rule.component) : Promise.resolve(null);
  }

  /** Classes as the tokens they read. */
  async function stylesFor(classes: readonly string[]): Promise<Style[]> {
    const table = await tokenTable();
    if (!table) return [];
    return stylesOf(classes, {
      lookup: (className) => table.tokenForClass(className),
      css: (className) =>
        table.designSystem.candidatesToCss([className])[0] ?? null,
    });
  }

  async function inspect(picked: Selection): Promise<Inspection> {
    const rule = applyRule(picked, paths);
    const styles = await stylesFor(picked.classes);

    let component: Inspection['component'] = null;
    const name = await componentName(rule);
    if (rule.component && rule.component.kind !== 'host' && name) {
      const { kind, props } = rule.component;
      // The variant is on the component that renders the definition's JSX,
      // which another component may wrap (a SidebarTrigger around a Button).
      const primitive = rule.primitive;
      const primitiveName = primitive ? await nameOf(primitive) : null;
      const config = await cvaConfigOf(rule);
      const values =
        !primitive || primitive.props.status === 'none'
          ? {}
          : primitive.props.values;
      component = {
        name,
        kind,
        primitive: primitiveName !== name ? primitiveName : null,
        variants: config
          ? variantsOf(config, values).map((variant) => ({
              ...variant,
              options: Object.keys(config.variants[variant.name] ?? {}),
            }))
          : [],
        props,
      };
    }

    return {
      tag: picked.tag,
      component,
      callSite: rule.callSite,
      definition: rule.definition,
      owners: rule.owners,
      styles,
    };
  }

  /** Names an element's component in the frame's hover and pick labels, as the inspector names it. */
  function label(frame: string, element: Selection): void {
    const rule = applyRule(element, paths);
    void componentName(rule)
      .then((component) =>
        ctx.command(frame, 'label', { id: element.id, component }),
      )
      .catch(() => {});
  }

  /** The classes that read a spacing token with a length, for the frame's labels. */
  async function spacingClasses(
    classes: readonly string[],
  ): Promise<SpacingClass[]> {
    if (classes.length === 0) return [];
    const table = await tokenTable();
    if (!table) return [];
    return classes.flatMap((className): SpacingClass[] => {
      const lookup = table.tokenForClass(className);
      if (lookup.status !== 'token' || !isSpacingRoot(lookup.root)) return [];
      const px = lookup.token.light.px;
      return px === undefined ? [] : [{ className, root: lookup.root, px }];
    });
  }

  /** Sends an element's spacing classes to its frame; apart from `label`, so a name never waits for the token table. */
  function spacing(
    frame: string,
    id: number,
    classes: readonly string[],
  ): void {
    void spacingClasses(classes)
      .then((found) => ctx.command(frame, 'spacing', { id, classes: found }))
      .catch(() => {});
  }

  /** The pick in a frame, if it is still the element the panel means. */
  function pickIn(frame: string, id: number): Selection {
    const picked = ctx.reports('selected')[frame];
    if (!picked || picked.id !== id) {
      throw new Error('That element is no longer picked. Pick it again.');
    }
    return picked;
  }

  // Each frame's last two picks: a new pick commits a field's unfinished
  // change, which arrives just after the report that ended it (TRU-4.2).
  const picks = new Map<
    string,
    { now: Selection | null; last: Selection | null }
  >();

  function notePick(frame: string, picked: Selection | null): void {
    const known = picks.get(frame);
    const moved = known?.now?.id !== picked?.id;
    picks.set(frame, {
      now: picked,
      last: moved ? (known?.now ?? known?.last ?? null) : (known?.last ?? null),
    });
  }

  /** The pick a change is for: the one now, or the one a new pick has just replaced. */
  function changingPick(frame: string, id: number): Selection {
    const known = picks.get(frame);
    if (known?.last?.id === id && known.now?.id !== id) return known.last;
    return pickIn(frame, id);
  }

  // ---------------------------------------------------------------------
  // Instances and uses (TRU-2.2).

  const usagesIndex = createUsagesIndex({
    root: ctx.root,
    source: ctx.config.source ?? 'src',
  });
  usagesIndex
    .warm()
    .catch((error: unknown) =>
      ctx.log(`couldn't read the source for uses: ${messageOf(error)}`),
    );

  /** The variants instances can differ by: the cva config's, when the component is the one that reads it. */
  async function variantNamesOf(
    rule: Rule,
    inspection: Inspection,
  ): Promise<{ names: string[]; config: CvaConfig | null }> {
    if (!inspection.component || inspection.component.primitive) {
      return { names: [], config: null };
    }
    const config = await cvaConfigOf(rule);
    return { names: config ? Object.keys(config.variants) : [], config };
  }

  /** Each variant as set, or its default when it isn't; null when code sets it. */
  function withDefaults(
    names: readonly string[],
    config: CvaConfig | null,
    set: Readonly<Record<string, string | null>>,
    unknownWhenAbsent = false,
  ): Record<string, string | null> {
    const values: Record<string, string | null> = {};
    for (const name of names) {
      if (name in set) values[name] = set[name] ?? null;
      else if (unknownWhenAbsent) values[name] = null;
      else values[name] = config?.defaultVariants[name] ?? null;
    }
    return values;
  }

  async function instancesIn(
    frame: string,
    picked: Selection,
  ): Promise<InstancesView | null> {
    const rule = applyRule(picked, paths);
    const inspection = await inspect(picked);
    if (!rule.component || !inspection.component) return null;
    const link = picked.chain.indexOf(rule.component);
    if (link === -1) return null;
    const { names, config } = await variantNamesOf(rule, inspection);
    const groups = await ctx.command(frame, 'instances', {
      id: picked.id,
      link,
      props: names,
    });
    if (!groups) return null;
    return {
      component: inspection.component.name,
      variants: names,
      groups: groups.map((group) => ({
        at: group.at ? inProject(group.at, paths) : null,
        instances: group.instances.map((instance) => ({
          ...instance,
          props: withDefaults(names, config, instance.props),
        })),
      })),
    };
  }

  async function usagesFor(picked: Selection): Promise<UsagesView | null> {
    const rule = applyRule(picked, paths);
    const inspection = await inspect(picked);
    const { component, callSite } = inspection;
    if (!component || callSite.status !== 'found') return null;
    const ref = await usagesIndex.resolveTag(callSite.at.file, component.name);
    if (!ref) return null;
    const { names, config } = await variantNamesOf(rule, inspection);
    const uses = await usagesIndex.usesOf(ref);
    return {
      component: component.name,
      uses: uses.map((use) => ({
        file: use.file,
        line: use.line,
        column: use.column,
        // A spread may set what isn't written: then it isn't known.
        variants: withDefaults(names, config, use.attributes, use.spread),
        inList: use.inList,
      })),
    };
  }

  /** How many uses the component has in the code; null when it can't be told. */
  async function usageCount(picked: Selection): Promise<number | null> {
    try {
      return (await usagesFor(picked))?.uses.length ?? null;
    } catch (error) {
      ctx.log(`couldn't count the uses: ${messageOf(error)}`);
      return null;
    }
  }

  // What each frame's edits are for, as its panel chose; a new pick starts at this use.
  const reaches = new Map<string, { id: number; reach: 'use' | 'component' }>();
  function reachIn(frame: string, id: number): 'use' | 'component' {
    const chosen = reaches.get(frame);
    return chosen?.id === id ? chosen.reach : 'use';
  }

  /** Where an edit may be written, given the scope the frame's panel chose. */
  async function routeByReach(
    frame: string,
    picked: Selection,
    component: string | null,
    writesInside: boolean,
  ): Promise<ReachDecision> {
    return decideReach({
      component,
      usages: component ? await usageCount(picked) : null,
      chosen: reachIn(frame, picked.id),
      writesInside,
    });
  }

  /**
   * One staged change per element and property: a new one replaces the
   * last, and the page's own value undoes it.
   */
  function unstage(picked: Selection, property: string): StagedChange | null {
    return unstageAt(picked, property, null);
  }

  /** The same, for one scope only: Tablet's padding doesn't replace every size's. */
  function unstageAt(
    picked: Selection,
    property: string,
    scope: StagedChange['scope'] | null,
  ): StagedChange | null {
    let replaced: StagedChange | null = null;
    for (const change of ctx.changes.list()) {
      if (
        change.module === 'selection' &&
        change.property === property &&
        change.element?.selector === picked.selector &&
        change.element.href === picked.href &&
        (scope === null ||
          JSON.stringify(change.scope) === JSON.stringify(scope))
      ) {
        replaced ??= change;
        ctx.changes.remove(change.id);
      }
    }
    return replaced;
  }

  /** The element as a staged change records it. */
  function changeElement(
    picked: Selection,
    inspection: Inspection,
  ): ChangeElement {
    return {
      tag: picked.tag,
      href: picked.href,
      selector: picked.selector,
      classes: picked.classes,
      callSite: foundAt(inspection.callSite),
      definition: foundAt(inspection.definition),
      component: inspection.component
        ? {
            name: inspection.component.name,
            variants: inspection.component.variants.map(({ name, value }) => ({
              name,
              value,
            })),
          }
        : null,
    };
  }

  /** The JSX at a place passes a consumer's `className` on, so one at its use reaches it. */
  async function passesClassNameOn(at: SourceAt): Promise<boolean> {
    const source = await sourceOf(at.file);
    if (!source) return false;
    const offset = offsetOf(source.text, at.line, at.column);
    if (offset === null) return false;
    const node = jsxAt(parseSource(source.text, at.file), offset);
    return node !== null && takesClassName(node);
  }

  /** The JSX at a place holds only literal text: the words are written there. */
  async function holdsLiteralText(at: SourceAt): Promise<boolean> {
    const source = await sourceOf(at.file);
    if (!source) return false;
    const offset = offsetOf(source.text, at.line, at.column);
    if (offset === null) return false;
    const node = jsxAt(parseSource(source.text, at.file), offset);
    return (
      node !== null &&
      ts.isJsxElement(node) &&
      node.children.length > 0 &&
      node.children.every((child) => ts.isJsxText(child))
    );
  }

  /** Stages new text for the pick, from the inspector's field or an edit in place. */
  async function stageText(
    frame: string,
    id: number,
    text: string,
    /** What it said before an edit in place; the pick may already show the typed text. */
    known?: string,
  ): Promise<{ id: string | null }> {
    const picked = pickIn(frame, id);
    // A staged edit shows on the page: the code still says what it said first.
    const replaced = unstage(picked, 'text');
    const before = replaced?.before[0]?.value ?? known ?? picked.text;
    if (before === null) {
      throw new Error('This element holds more than text.');
    }
    if (text === before) return { id: null };
    const inspection = await inspect(picked);
    const definition = foundAt(inspection.definition);
    // A primitive's JSX renders {children}: the words are at the call site.
    const own = definition && !definition.file.startsWith(paths.primitives);
    const at = own ? definition : foundAt(inspection.callSite);
    // The element's own JSX is its tag; a call site is the component's.
    const tag = own ? picked.tag : inspection.component?.name;
    const component = inspection.component?.name ?? null;
    // Written inside the component when its own render wrote that JSX; an
    // asChild Button's text is in the JSX that uses it.
    const rule = applyRule(picked, paths);
    // Text from a prop (`<h2>{title}</h2>`) is set at each use, not inside.
    const inside =
      Boolean(own) &&
      definition !== null &&
      rule.component !== null &&
      rule.primitive === rule.component &&
      (await holdsLiteralText(definition));
    const { reach, claude } = await routeByReach(
      frame,
      picked,
      component,
      inside,
    );
    const everywhere =
      reach.kind === 'component' && component ? ` in every ${component}` : '';
    const change = await ctx.stage({
      label: `Text: ${quote(before)} → ${quote(text)}`,
      intent: `Change the text "${before.trim()}" to "${text.trim()}"${everywhere}.`,
      viewport: { frame, width: picked.width },
      reach,
      element: changeElement(picked, inspection),
      property: 'text',
      before: [{ value: before, token: null }],
      after: [{ value: text, token: null }],
      write:
        at && !claude
          ? {
              by: 'edit',
              edit: { kind: 'text', at, tag, before, after: text },
            }
          : null,
      reason: claude ?? (at ? undefined : PLACE_UNKNOWN),
    });
    return { id: change.id };
  }

  /** Where a change to the pick's classes is written, and why Claude if it can't be. */
  async function placeOfClasses(
    frame: string,
    picked: Selection,
    inspection: Inspection,
  ): Promise<{
    reach: ReachDecision['reach'];
    at: SourceAt | null;
    tag: string | undefined;
    atUse: boolean;
    takes: boolean;
    claude: string | null;
  }> {
    const definition = foundAt(inspection.definition);
    const callSite = foundAt(inspection.callSite);
    const inPrimitive = definition?.file.startsWith(paths.primitives) ?? false;
    const inside = {
      at: definition,
      tag: inPrimitive ? undefined : picked.tag,
      atUse: false,
    };
    const { component } = inspection;
    if (!component) {
      return { ...inside, reach: { kind: 'use' }, takes: false, claude: null };
    }
    // A package's component (a lucide icon, next/link) has no JSX of ours: what
    // it's given at its use is all there is, and they take a className.
    const passes = definition ? await passesClassNameOn(definition) : true;
    const { reach, claude } = await routeByReach(
      frame,
      picked,
      component.name,
      reachIn(frame, picked.id) === 'component' || !passes,
    );
    if (reach.kind === 'use' && !claude) {
      return {
        reach,
        at: callSite,
        tag: component.name,
        atUse: true,
        // A wrapper's own JSX isn't the definition, so it's not known what it passes on.
        takes: passes && !component.primitive,
        claude: null,
      };
    }
    let why = claude;
    if (reach.kind === 'component' && component.primitive) {
      why = `the value is set inside ${component.name}`;
    } else if (reach.kind === 'component' && component.variants.length > 0) {
      why = `${component.name}'s variants can override this`;
    }
    return { ...inside, reach, takes: false, claude: why };
  }

  // ---------------------------------------------------------------------
  // Elements like the pick (TRU-4.5).

  /** The elements like a pick, by where each is written, so one place is one edit. */
  async function similarPlaces(frame: string, picked: Selection) {
    const others =
      (await ctx.command(frame, 'similar', { id: picked.id })) ?? [];
    const groups = new Map<string, Selection[]>();
    for (const other of others) {
      const { definition, callSite } = applyRule(other, paths);
      const place = JSON.stringify([definition, callSite, other.tag]);
      groups.set(place, [...(groups.get(place) ?? []), other]);
    }
    const placed = await Promise.all(
      [...groups.values()].map(async (group) => {
        const first = group[0];
        if (!first) return [];
        const inspection = await inspect(first);
        const place = await placeOfClasses(frame, first, inspection);
        return [{ group, first, inspection, place }];
      }),
    );
    return { others, places: placed.flat() };
  }
  type SimilarPlace = Awaited<
    ReturnType<typeof similarPlaces>
  >['places'][number];

  /** Where an edit of this kind is written for an element: a variant is always at its use. */
  function placeForEdit(edit: Edit, entry: SimilarPlace): SourceAt | null {
    return edit.kind === 'variant'
      ? foundAt(entry.inspection.callSite)
      : entry.place.at;
  }

  /** Stages a change again, as the engine needs to plan it anew. */
  async function restage(
    change: StagedChange,
    next: {
      edit: Edit;
      reach: StagedChange['reach'];
      also?: readonly string[];
      intent: string;
      reason?: string;
    },
  ): Promise<StagedChange> {
    ctx.changes.remove(change.id);
    return ctx.stage({
      label: change.label,
      intent: next.intent,
      viewport: change.viewport,
      scope: change.scope,
      reach: next.reach,
      element: change.element && {
        ...change.element,
        also: next.also ? [...next.also] : undefined,
      },
      property: change.property,
      before: change.before,
      after: change.after,
      write: { by: 'edit', edit: next.edit },
      reason: next.reason ?? scopeReason(change.scope) ?? undefined,
    });
  }

  /** The change on every element like the pick: one edit per place in the code. */
  async function spreadToAll(
    picked: Selection,
    change: StagedChange,
    others: readonly Selection[],
    places: readonly SimilarPlace[],
  ): Promise<string> {
    const edit = change.write?.by === 'edit' ? change.write.edit : null;
    const here = edit && placeOfEdit(edit);
    if (!edit || !here) return change.id;
    const sameEdit = places.filter((entry) => {
      const at = placeForEdit(edit, entry);
      return at !== null && placeKey(at) === placeKey(here);
    });
    const also = sameEdit.flatMap(({ group }) =>
      group.map((other) => other.selector),
    );
    let leader = change;
    if (also.length > 0 && edit.kind !== 'cva' && edit.kind !== 'text') {
      const name = change.element?.component?.name;
      // Written inside a component, the one edit changes it wherever it's used.
      const inside =
        edit.kind === 'classes' && name !== undefined && edit.tag !== name;
      leader = await restage(change, {
        edit: { ...edit, list: true },
        also,
        intent: `${change.intent} On all ${others.length + 1} like it on the page.`,
        reach: inside
          ? {
              kind: 'component',
              component: name,
              usages: await usageCount(picked),
            }
          : { kind: 'list', items: also.length + 1 },
      });
    }
    await Promise.all(
      places
        .filter((entry) => !sameEdit.includes(entry))
        .map(async (entry) => {
          const { group, first, inspection, place } = entry;
          const at = placeForEdit(edit, entry);
          const written =
            at &&
            editAt(edit, {
              at,
              tag:
                edit.kind === 'variant'
                  ? inspection.component?.name
                  : place.tag,
              takes: place.takes,
              classes: first.classes,
            });
          if (!written) return;
          await ctx.stage({
            label: change.label,
            intent: `${change.intent} On this one too, like the first.`,
            viewport: change.viewport,
            scope: change.scope,
            reach: { kind: 'similar', of: leader.id },
            element: {
              ...changeElement(first, inspection),
              also: group.slice(1).map((other) => other.selector),
            },
            property: change.property,
            before: change.before,
            after: change.after,
            write: {
              by: 'edit',
              // Each place may draw a list of its own.
              edit:
                written.kind !== 'cva' &&
                written.kind !== 'text' &&
                group.length > 1
                  ? { ...written, list: true }
                  : written,
            },
            reason:
              scopeReason(change.scope) ??
              (edit.kind === 'classes' ? place.claude : null) ??
              undefined,
          });
        }),
    );
    return leader.id;
  }

  /** This one alone: where one place draws them all, only Claude can tell it apart. */
  async function keepToOne(
    change: StagedChange,
    places: readonly SimilarPlace[],
    total: number,
  ): Promise<string> {
    const edit = change.write?.by === 'edit' ? change.write.edit : null;
    const here = edit && placeOfEdit(edit);
    if (!edit || !here) return change.id;
    const shared = places.some((entry) => {
      const at = placeForEdit(edit, entry);
      return at !== null && placeKey(at) === placeKey(here);
    });
    if (!shared) return change.id;
    const kept = await restage(change, {
      edit,
      intent: `${change.intent} On this one only, not the others like it.`,
      reach: change.reach,
      reason: oneAloneReason(total),
    });
    return kept.id;
  }

  // The latest preview asked for: a slower, older one is dropped.
  let previewing = 0;

  /** What showing another of a variant's values takes: its classes for the current value's. */
  async function variantDraft(
    frame: string,
    id: number,
    name: string,
    value: string,
  ): Promise<DraftChange | null> {
    const picked = changingPick(frame, id);
    const config = await cvaConfigOf(applyRule(picked, paths));
    const values =
      config && Object.hasOwn(config.variants, name)
        ? config.variants[name]
        : undefined;
    const { component } = await inspect(picked);
    const now = component?.variants.find((entry) => entry.name === name)?.value;
    if (!values || now === undefined) return null;
    const classes = (of: string): string[] =>
      (values[of] ?? '').split(' ').filter(Boolean);
    const { href, selector } = picked;
    return {
      element: { href, selector, classes: picked.classes },
      add: classes(value),
      remove: classes(now),
    };
  }

  // The last pick in each frame, so it comes back after the frame reloads.
  const remembered = new Map<string, { href: string; identity: Identity }>();

  return {
    ops: {
      inspect: async ({ frame, id }) => {
        const picked = ctx.reports('selected')[frame];
        if (!picked || picked.id !== id) return null;
        return inspect(picked);
      },
      styles: ({ classes }) => stylesFor(classes),
      source: async ({ frame, id }) => {
        const chain = await ctx.command(frame, 'chain', { id });
        if (!chain) return null;
        const { callSite, definition } = applyRule(
          { chain, react: true },
          paths,
        );
        if (callSite.status === 'found') return callSite.at;
        return definition.status === 'found' ? definition.at : null;
      },
      open: async (at) => {
        const response = await fetch(
          launchEditorUrl(appOrigin, {
            ...at,
            file: path.join(ctx.root, at.file),
          }),
        );
        if (response.status === 404) {
          throw new Error(`${at.file} isn't in the project any more.`);
        }
        if (!response.ok) {
          throw new Error(
            "Next couldn't open your editor. Set EDITOR or REACT_EDITOR for pnpm dev, or copy the path instead.",
          );
        }
        return { opened: true };
      },
      'stage-variant': async ({ frame, id, name, value }) => {
        previewing += 1;
        const picked = pickIn(frame, id);
        const inspection = await inspect(picked);
        const { component } = inspection;
        const variant = component?.variants.find(
          (entry) => entry.name === name,
        );
        if (!component || !variant) {
          throw new Error(`This element has no ${name} variant.`);
        }
        unstage(picked, `variant ${name}`);
        if (value === variant.value) {
          ctx.changes.preview(null);
          return { id: null };
        }
        const callSite = foundAt(inspection.callSite);
        const definition = foundAt(inspection.definition);
        // A variant is written at each use, never inside the component.
        const { reach, claude } = await routeByReach(
          frame,
          picked,
          component.name,
          false,
        );
        let reason: string | undefined;
        if (!callSite || !definition) reason = PLACE_UNKNOWN;
        // A wrapper (a SidebarTrigger around a Button) sets the variant in its own code.
        else if (component.primitive) {
          reason = `the variant is set inside ${component.name}`;
        } else if (claude) reason = claude;
        const everywhere = reach.kind === 'component' ? ' on every use' : '';
        const change = await ctx.stage({
          label: `${component.name} ${name}: ${variant.value} → ${value}`,
          intent: `Set ${component.name}'s ${name} variant to ${value}${everywhere}.`,
          viewport: { frame, width: picked.width },
          reach,
          element: changeElement(picked, inspection),
          property: `variant ${name}`,
          before: [{ value: variant.value, token: null }],
          after: [{ value, token: null }],
          write:
            callSite && definition && !reason
              ? {
                  by: 'edit',
                  edit: {
                    kind: 'variant',
                    at: callSite,
                    tag: component.name,
                    definition: definition.file,
                    component: component.primitive ?? component.name,
                    name,
                    value,
                  },
                }
              : null,
          reason,
        });
        ctx.changes.preview(null);
        return { id: change.id };
      },
      'stage-text': ({ frame, id, text }) => stageText(frame, id, text),
      'layout-tokens': async () => {
        const table = await tokenTable();
        return {
          spacing: spacingRows(table?.manifest.tokens ?? []),
        };
      },
      'style-tokens': async () => {
        const table = await tokenTable();
        return styleTokens(table?.manifest.tokens ?? []);
      },
      'preview-variant': async ({ frame, id, name, value }) => {
        previewing += 1;
        const mine = previewing;
        const shown = await variantDraft(frame, id, name, value).catch(
          () => null,
        );
        // The pointer has moved on while this was read.
        if (mine === previewing) ctx.changes.preview(shown);
        return shown !== null;
      },
      'preview-classes': ({ frame, id, add, remove }) => {
        previewing += 1;
        if (add.length === 0 && remove.length === 0) {
          ctx.changes.preview(null);
          return true;
        }
        try {
          const { href, selector, classes } = changingPick(frame, id);
          ctx.changes.preview({
            element: { href, selector, classes },
            add,
            remove,
          });
          return true;
        } catch {
          // The pointer outlived the pick: there's nothing to show it on.
          ctx.changes.preview(null);
          return false;
        }
      },
      'stage-classes': async (input) => {
        const { frame, id, property, scope, label, intent } = input;
        // A preview still on its way is older than this.
        previewing += 1;
        try {
          const picked = changingPick(frame, id);
          // One staged change per element, property and scope.
          const replaced = unstageAt(picked, property, scope);
          for (const other of input.replaces ?? []) {
            unstageAt(picked, other, scope);
          }
          const before = replaced?.before[0] ?? input.before;
          // Nothing to write is the page's own value too: Hide, then Show.
          const nothing = input.add.length === 0 && input.remove.length === 0;
          // The same value by another token is a change: it's what a token swap is for.
          const same =
            input.after.value === before.value &&
            input.after.token === before.token;
          if (nothing || same) return { id: null };
          const inspection = await inspect(picked);
          const place = await placeOfClasses(frame, picked, inspection);
          // At a use the class is written in the component, out of reach: override it.
          const add =
            place.atUse && input.add.length === 0 && input.clearWith
              ? [input.clearWith]
              : input.add;
          const everywhere =
            place.reach.kind === 'component'
              ? ` Do it in every ${place.reach.component}.`
              : '';
          const change = await ctx.stage({
            label,
            intent: `${intent}${everywhere}`,
            viewport: { frame, width: picked.width },
            scope,
            reach: place.reach,
            element: changeElement(picked, inspection),
            property,
            before: [before],
            after: [input.after],
            write: place.at
              ? {
                  by: 'edit',
                  edit: {
                    kind: 'classes',
                    at: place.at,
                    tag: place.tag,
                    add,
                    // At a use, a class overrides what it replaces, which is written
                    // elsewhere. With nothing to add, the removal must be found there.
                    remove: place.atUse && add.length > 0 ? [] : input.remove,
                    takesClassName: place.takes,
                  },
                }
              : null,
            reason:
              scopeReason(scope) ??
              place.claude ??
              (place.at ? undefined : PLACE_UNKNOWN),
          });
          return { id: change.id };
        } finally {
          ctx.changes.preview(null);
        }
      },
      similar: async ({ frame, id }) => {
        const picked = ctx.reports('selected')[frame];
        if (!picked || picked.id !== id) return { ids: [] };
        const others = await ctx.command(frame, 'similar', { id });
        return { ids: (others ?? []).map((other) => other.id) };
      },
      'preview-similar': async ({ frame, id, on }) => {
        previewing += 1;
        const mine = previewing;
        if (!on) {
          ctx.changes.preview(null);
          return true;
        }
        const picked = pickIn(frame, id);
        const others =
          (await ctx.command(frame, 'similar', { id: picked.id })) ?? [];
        const edits = changesToSpread(ctx.changes.list(), picked).flatMap(
          (change) =>
            change.write?.by === 'edit' && change.write.edit.kind === 'classes'
              ? [change.write.edit]
              : [],
        );
        if (mine !== previewing || edits.length === 0) return false;
        ctx.changes.preview({
          element: {
            href: picked.href,
            selector: [picked, ...others]
              .map((element) => element.selector)
              .join(', '),
            classes: picked.classes,
          },
          add: edits.flatMap((edit) => edit.add),
          remove: edits.flatMap((edit) => edit.remove),
        });
        return true;
      },
      'spread-similar': async ({ frame, id, to }) => {
        previewing += 1;
        ctx.changes.preview(null);
        const picked = pickIn(frame, id);
        const { others, places } = await similarPlaces(frame, picked);
        const settled: string[] = [];
        for (const change of changesToSpread(ctx.changes.list(), picked)) {
          settled.push(
            to === 'all'
              ? await spreadToAll(picked, change, others, places)
              : await keepToOne(change, places, others.length + 1),
          );
        }
        return { settled };
      },
      'stage-intent': async (input) => {
        const { frame, id, property, label, intent, reason, after } = input;
        const picked = changingPick(frame, id);
        const replaced = unstage(picked, property);
        const inspection = await inspect(picked);
        const change = await ctx.stage({
          label,
          intent,
          viewport: { frame, width: picked.width },
          element: changeElement(picked, inspection),
          property,
          before: replaced ? replaced.before : [],
          after: [after],
          write: null,
          reason,
        });
        return { id: change.id };
      },
      instances: ({ frame, id }) => {
        const picked = ctx.reports('selected')[frame];
        if (!picked || picked.id !== id) return Promise.resolve(null);
        return instancesIn(frame, picked);
      },
      usages: ({ frame, id }) => {
        const picked = ctx.reports('selected')[frame];
        if (!picked || picked.id !== id) return Promise.resolve(null);
        return usagesFor(picked);
      },
      reach: ({ frame, id, reach }) => {
        pickIn(frame, id);
        reaches.set(frame, { id, reach });
        return { reach };
      },
    },
    onReport: (name, payload, frame) => {
      if (name === 'edited') {
        const { id, text, before } = payload as {
          id: number;
          text: string;
          before: string;
        };
        stageText(frame, id, text, before).catch((error: unknown) =>
          ctx.log(`couldn't stage the text: ${String(error)}`),
        );
        return;
      }
      if (name === 'hovered') {
        const { id, chain, classes } = payload as {
          id: number;
          chain: Link[];
          classes: string[];
        };
        spacing(frame, id, classes);
        label(frame, {
          id,
          href: '',
          identity: null,
          tag: '',
          classes: [],
          selector: '',
          react: true,
          text: null,
          width: 0,
          chain,
        });
        return;
      }
      if (name === 'selected') {
        const picked = payload as Selection | null;
        notePick(frame, picked);
        // The pick's label names its component as the hover's does.
        if (picked) {
          label(frame, picked);
          spacing(frame, picked.id, picked.classes);
        }
        if (picked?.identity) {
          remembered.set(frame, {
            href: picked.href,
            identity: picked.identity,
          });
        } else {
          remembered.delete(frame);
        }
        return;
      }
      // The first tree after a reload: the page is up, so the pick can come back.
      if (name !== 'layers' || ctx.reports('selected')[frame]) return;
      const wanted = remembered.get(frame);
      const { href } = payload as { href: string };
      if (!wanted || wanted.href !== href) return;
      ctx.command(frame, 'restore', wanted.identity).catch(() => {});
    },
  };
});
