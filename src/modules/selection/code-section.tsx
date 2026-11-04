import { type CSSProperties, Fragment, type ReactNode } from 'react';

import { PathArrow } from '../../shell/controls/fold';

import type { Inspection, PropsViewPayload, Style } from './module';
import {
  ABSENT,
  copy,
  MODIFIER,
  pathOf,
  type Props,
  SourceActions,
} from './panel-shared';

/** A class, a token or a value in a style row: a click copies it. */
function Copyable({
  text,
  notify,
  children,
}: {
  text: string;
  notify: Props['notify'];
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="inspect-copy"
      aria-label={`Copy ${text}`}
      title="Copy"
      onClick={(event) => {
        const button = event.currentTarget;
        copy(
          text,
          notify,
          {
            done: `Copied ${text}`,
            failed: `Couldn't copy. Press ${MODIFIER}+C to copy it.`,
          },
          // Selected, so the keys copy it where the clipboard API couldn't.
          () => getSelection()?.selectAllChildren(button),
        );
      }}
    >
      {children}
    </button>
  );
}

export function Place({
  label,
  place,
  kind,
  call,
}: {
  label: string;
  place: Inspection['callSite'];
  kind: 'callSite' | 'definition';
  call: Props['call'];
}) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        {place.status === 'found' ? (
          <span className="inspect-place">
            <code className="truncated-path" title={pathOf(place.at)}>
              <bdi>{pathOf(place.at)}</bdi>
            </code>
            <SourceActions at={place.at} call={call} />
          </span>
        ) : (
          <span className="inspect-absent">{ABSENT[place.reason][kind]}</span>
        )}
      </dd>
    </>
  );
}

export function PropsList({ props }: { props: PropsViewPayload }) {
  if (props.status === 'none') {
    return <p className="module-empty">Not available for this component.</p>;
  }
  const entries = Object.entries(props.values).filter(
    ([name]) => name !== 'children',
  );
  return (
    <>
      {props.status === 'snapshot' ? (
        <p className="module-empty">Props as the server sent them.</p>
      ) : null}
      {entries.length === 0 ? (
        <p className="module-empty">No props.</p>
      ) : (
        <dl className="module-facts inspect-props">
          {entries.map(([name, value]) => (
            <Fragment key={name}>
              <dt>{name}</dt>
              <dd>
                <code>
                  {typeof value === 'object' && value !== null
                    ? value.kind
                    : JSON.stringify(value)}
                </code>
              </dd>
            </Fragment>
          ))}
        </dl>
      )}
    </>
  );
}

const HEX = /^#[\da-f]{3,8}$/i;

/** The colour itself, before its hex; the hex beside it is what a screen reader reads. */
export function Swatch({ value }: { value: string }) {
  if (!HEX.test(value)) return null;
  return (
    <span
      className="inspect-swatch"
      style={{ '--swatch': value } as CSSProperties}
      aria-hidden="true"
    />
  );
}

export function StyleRow({
  style,
  notify,
}: {
  style: Style;
  notify: Props['notify'];
}) {
  const property = style.properties.join(', ') || '—';
  const prefix =
    style.variants.length > 0 ? `${style.variants.join(':')}:` : '';
  const className = (
    <Copyable text={style.className} notify={notify}>
      <code>{style.className}</code>
    </Copyable>
  );
  if (style.status !== 'token') {
    return (
      <li className="inspect-style" data-token="false">
        <span className="inspect-property">{property}</span>
        {className}
      </li>
    );
  }
  const path = [style.token, ...style.through];
  return (
    <li className="inspect-style">
      <span className="inspect-property">
        {prefix}
        {property}
      </span>
      <span>
        {className}
        {path.map((name) => (
          <Fragment key={name}>
            <PathArrow />
            <Copyable text={name} notify={notify}>
              <code>{name}</code>
            </Copyable>
          </Fragment>
        ))}
        <span className="inspect-value">
          {' · '}
          <Copyable text={style.light} notify={notify}>
            <Swatch value={style.light} />
            {style.light}
          </Copyable>
          {style.dark ? (
            <>
              {' · dark '}
              <Copyable text={style.dark} notify={notify}>
                <Swatch value={style.dark} />
                {style.dark}
              </Copyable>
            </>
          ) : null}
        </span>
      </span>
    </li>
  );
}
