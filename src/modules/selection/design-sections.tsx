import { type CSSProperties, Suspense } from 'react';

import type { PropertyPick, PropertySection } from '../../module';
import { FoldSummary } from '../../shell/controls/fold';
import { Marks } from '../../shell/controls/marks';

import { Place, PropsList, StyleRow } from './code-section';
import { useDesign } from './design-panel';
import { Row, Rows } from './design-rows';
import {
  colourName,
  isClear,
  number,
  shownColour,
  type ShownColour,
} from './design-values';
import {
  FillBody,
  FiltersAdd,
  FiltersBody,
  hasFilters,
  hasInnerShadow,
  hasOutline,
  hasStroke,
  IconBody,
  InnerShadowAdd,
  InnerShadowBody,
  InteractionBody,
  LayoutMore,
  OutlineAdd,
  OutlineBody,
  StrokeAdd,
  StrokeBody,
  TextMore,
} from './effect-sections';
import { designTreeOf } from './layers-panel';
import { FlexBody, GridBody, LayoutBody, SpacingBody } from './layout-sections';
import selection, { type Style } from './module';
import { copy, pathOf, pathTo, type Props } from './panel-shared';
import {
  ComponentControls,
  InstancesSection,
  TextField,
} from './selection-section';
import {
  BlendingBody,
  BorderAdd,
  BorderBody,
  FillAdd,
  hasBorder,
  hasFill,
  hasUnderline,
  RadiusBody,
  shadowOf,
  ShadowAdd,
  ShadowBody,
  TextBody,
  UnderlineAdd,
  UnderlineBody,
} from './style-sections';

type BodyProps = Props & { pick: PropertyPick };

const value = (pick: PropertyPick, name: string): string =>
  pick.own[name] ?? '';

/** A colour at rest, in the app's own light or dark. */
const shownFor = (
  pick: PropertyPick,
  styles: readonly Style[],
  property: RegExp,
  colour: string,
): ShownColour =>
  shownColour(styles, property, colour, value(pick, 'color-scheme') === 'dark');

/** A colour: its swatch, its token's name, and its value beneath. Off the scale, the value alone. */
function ColourRow({
  label,
  shown: { colour, text, reading },
}: {
  label: string;
  shown: ShownColour;
}) {
  return (
    <div className="design-row" data-colour="true">
      <dt>{label}</dt>
      <dd>
        <span
          className="inspect-swatch"
          style={{ '--swatch': colour } as CSSProperties}
          aria-hidden="true"
        />
        <span className="design-value" title={text}>
          {reading.token ? colourName(reading.token) : text}
        </span>
        {reading.off ? <Marks reading={{ token: null, off: true }} /> : null}
        {reading.token ? <span className="design-beneath">{text}</span> : null}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selection: what's picked, its variants and how many there are.

function SelectionBody({
  pick,
  call,
  command,
  notify,
  changes,
  reports,
}: BodyProps) {
  const { picked, inspection, label, outlined, onOutlined } = useDesign();
  if (!picked || !inspection) return null;
  const { component } = inspection;
  const layers = reports.layers[pick.frame];
  const tree = layers ? designTreeOf(layers.nodes) : null;
  const row =
    tree &&
    pathTo(tree.nodes, tree.shownAs.get(picked.id) ?? picked.id)?.at(-1);
  const name = row?.name ?? (pick.kind === 'text' ? 'Text' : 'Frame');

  return (
    <>
      <p className="design-frame">{label}</p>
      {component ? (
        <p className="inspect-component">
          <strong>{component.name}</strong>
          {component.primitive && component.variants.length > 0 ? (
            <span className="inspect-variant">
              {' · '}
              {component.primitive}
            </span>
          ) : null}
          {component.variants.map((variant) => (
            <span key={variant.name} className="inspect-variant">
              {' · '}
              {variant.name} <code>{variant.value}</code>
              {variant.from === 'default' ? (
                <span className="inspect-default"> not set</span>
              ) : null}
            </span>
          ))}
          {component.kind === 'server' ? (
            <span className="inspect-badge">Server Component</span>
          ) : null}
        </p>
      ) : (
        <p className="inspect-component design-name" title={name}>
          <strong>
            <bdi>{name}</bdi>
          </strong>
        </p>
      )}
      {component ? (
        <Suspense fallback={<p className="module-empty">Finding instances…</p>}>
          <InstancesSection
            frame={pick.frame}
            picked={picked}
            call={call}
            command={command}
            outlined={outlined}
            onOutlined={onOutlined}
          />
        </Suspense>
      ) : null}
      <ComponentControls
        frame={pick.frame}
        picked={picked}
        inspection={inspection}
        call={call}
        notify={notify}
        changes={changes}
      />
      {/* What's picked as Text has a Text section, which holds its words. */}
      {pick.kind === 'text' ? null : (
        <TextField
          frame={pick.frame}
          picked={picked}
          call={call}
          notify={notify}
          changes={changes}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Code: today's read-out, word for word, closed by default.

function CodeBody({ pick, call, notify }: BodyProps) {
  const { picked, inspection, label } = useDesign();
  if (!picked || !inspection) return null;
  const { component, owners, styles } = inspection;
  return (
    <div className="design-code">
      <p className="inspect-title">
        <span>{label}</span>
        <code>{`<${picked.tag}>`}</code>
      </p>
      <dl className="module-facts inspect-places">
        <Place
          label="Call site"
          place={inspection.callSite}
          kind="callSite"
          call={call}
        />
        <Place
          label="Definition"
          place={inspection.definition}
          kind="definition"
          call={call}
        />
      </dl>
      {owners.length > 0 ? (
        <details className="inspect-owners">
          <FoldSummary>Owners · {owners.length}</FoldSummary>
          <ol>
            {owners.map((owner, index) => (
              <li key={`${owner.name}-${index}`}>
                <span>{owner.name}</span>
                {owner.at ? (
                  <code className="truncated-path" title={pathOf(owner.at)}>
                    <bdi>{pathOf(owner.at)}</bdi>
                  </code>
                ) : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {component ? (
        <section aria-label="Props">
          <h5 className="inspect-heading">Props</h5>
          <PropsList props={component.props} />
        </section>
      ) : null}
      <section aria-label="Styles">
        <h5 className="inspect-heading">Styles</h5>
        {styles.length === 0 ? (
          <p className="module-empty">No classes.</p>
        ) : (
          <ul className="inspect-styles">
            {styles.map((style) => (
              <StyleRow key={style.className} style={style} notify={notify} />
            ))}
          </ul>
        )}
      </section>
      <div className="design-copy">
        <button
          type="button"
          className="module-action"
          disabled={pick.classes.length === 0}
          onClick={() => {
            copy(picked.classes.join(' '), notify, {
              done: 'Copied the classes',
              failed: "Couldn't copy the classes. Try again.",
            });
          }}
        >
          Copy classes
        </button>
        <button
          type="button"
          className="module-action"
          onClick={() => {
            copy(picked.selector, notify, {
              done: 'Copied the selector',
              failed: "Couldn't copy the selector. Try again.",
            });
          }}
        >
          Copy selector
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nothing picked: the page.

function PageBody({ pick, frames }: BodyProps) {
  const { styles } = useDesign();
  const frame = frames.find((entry) => entry.id === pick.frame);
  const route = frame?.href ? new URL(frame.href).pathname : null;
  const own = value(pick, 'background-color');
  // A body without its own background shows the root's.
  const colour = isClear(own) ? (pick.parent['background-color'] ?? '') : own;
  return (
    <Rows>
      {route ? <Row label="Route">{route}</Row> : null}
      {frame ? (
        <Row label="Viewport">
          {number(String(frame.width))} × {number(String(frame.height))}
        </Row>
      ) : null}
      {isClear(colour) ? null : (
        <ColourRow
          label="Background"
          shown={shownFor(pick, styles, /^background(?:-color)?$/, colour)}
        />
      )}
    </Rows>
  );
}

// ---------------------------------------------------------------------------

/** The module's sections; `PROPERTY_SECTIONS` in `module.ts` sets their order. */
export const DESIGN_SECTIONS: readonly PropertySection<typeof selection>[] = [
  { id: 'selection', title: 'Selection', Body: SelectionBody },
  {
    id: 'layout',
    title: 'Layout',
    Body: (props) => (
      <div className="layout-stack">
        <LayoutBody {...props} />
        <LayoutMore {...props} />
      </div>
    ),
  },
  {
    id: 'flex',
    title: 'Flex',
    applies: (pick) => value(pick, 'display').endsWith('flex'),
    Body: FlexBody,
  },
  {
    id: 'grid',
    title: 'Grid',
    applies: (pick) => value(pick, 'display').endsWith('grid'),
    Body: GridBody,
  },
  { id: 'spacing', title: 'Spacing', Body: SpacingBody },
  { id: 'radius', title: 'Radius', Body: RadiusBody },
  { id: 'blending', title: 'Blending', Body: BlendingBody },
  {
    id: 'fill',
    title: 'Fill',
    empty: (pick) => !hasFill(pick),
    Body: FillBody,
    Add: FillAdd,
  },
  {
    id: 'border',
    title: 'Border',
    empty: (pick) => !hasBorder(pick),
    Body: BorderBody,
    Add: BorderAdd,
  },
  {
    id: 'outline',
    title: 'Outline',
    empty: (pick) => !hasOutline(pick),
    Body: OutlineBody,
    Add: OutlineAdd,
  },
  {
    id: 'icon',
    title: 'Icon',
    applies: (pick) => pick.tag === 'svg',
    Body: IconBody,
  },
  {
    id: 'text',
    title: 'Text',
    applies: (pick) => pick.setsText,
    Body: (props) => (
      <div className="layout-stack">
        <TextBody {...props} />
        <TextMore {...props} />
      </div>
    ),
  },
  {
    id: 'underline',
    title: 'Underline',
    applies: (pick) => pick.setsText,
    empty: (pick) => !hasUnderline(pick),
    Body: UnderlineBody,
    Add: UnderlineAdd,
  },
  {
    id: 'stroke',
    title: 'Stroke',
    empty: (pick) => !hasStroke(pick),
    Body: StrokeBody,
    Add: StrokeAdd,
  },
  {
    id: 'shadow',
    title: 'Shadow',
    empty: (pick) => shadowOf(pick) === null,
    Body: ShadowBody,
    Add: ShadowAdd,
  },
  {
    id: 'inner-shadow',
    title: 'Inner shadow',
    empty: (pick) => !hasInnerShadow(pick),
    Body: InnerShadowBody,
    Add: InnerShadowAdd,
  },
  {
    id: 'filters',
    title: 'Filters',
    empty: (pick) => !hasFilters(pick),
    Body: FiltersBody,
    Add: FiltersAdd,
    addWhenSet: true,
  },
  {
    id: 'interaction',
    title: 'Interaction',
    closed: true,
    Body: InteractionBody,
  },
  { id: 'code', title: 'Code', closed: true, Body: CodeBody },
  { id: 'page', title: 'Page', Body: PageBody },
];
