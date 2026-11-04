import {
  type ReactNode,
  type CSSProperties,
  useState,
  useEffect,
  useEffectEvent,
} from 'react';

import { ChevronDown, LayoutGrid } from 'lucide-react';

import { ICON_STROKE, Marks } from './marks';
import {
  findStep,
  formatValue,
  FURTHER,
  roomOf,
  snapTyped,
  type Step,
  stepBy,
} from './scale';
import { type ScrubEnd, startScrub } from './scrub';
import { TokenMenu } from './token-menu';
import type { TokenRow } from './token-rows';

/** What's being changed and not yet committed: typed text, or a stepped value. */
type Draft =
  { from: 'typed'; text: string } | { from: 'stepped'; value: number };

export type ScaleFieldProps = {
  /** The accessible name: "Padding". */
  name: string;
  /** What shows at its start, and drags to step: an icon or a letter. */
  label: ReactNode;
  value: number;
  /** The values it may write, from `scaleOf` or `stepsOf`. */
  steps: readonly Step[];
  unit?: string;
  /** Live, while a drag or an arrow key is under way. Given the value back on a cancel. */
  onPreview: (value: number) => void;
  /** Once per change: on a drag's release, Enter, leaving the field, or a menu's choice. */
  onCommit: (value: number) => void;
  /** The panel's `notify`: a snap says so. */
  notify: (text: string) => void;
  /** The tokens for its dropdown. No dropdown without them. */
  rows?: readonly TokenRow[];
  /** Offers to create a token (TRU-11.5). */
  onCreate?: () => void;
  /** Overrides what the scale says: a class by hand is off it, whatever its number. */
  off?: boolean;
  /** Where its value comes from, marked at its end and said to a screen reader. */
  from?: { words: string; mark: ReactNode } | null;
  /** What it can be besides a number, chosen from its menu (`rows`): `full`. */
  onWord?: (word: string, commit: boolean) => void;
  /** What shows at 0 when nothing is what 0 means: a max width's None. */
  zeroText?: string;
};

/**
 * A number on the scale: drag its label, press the arrows, or type. Any number
 * can be typed, and one off the scale snaps to the nearest step. Give it a
 * `key` per element, so a new pick starts it afresh.
 */
export function ScaleField({
  name,
  label,
  value,
  steps,
  unit,
  onPreview,
  onCommit,
  notify,
  rows,
  onCreate,
  off: offGiven,
  from = null,
  onWord,
  zeroText,
}: ScaleFieldProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const shown = draft?.from === 'stepped' ? draft.value : value;
  const resting = shown === 0 && zeroText ? zeroText : formatValue(shown);
  const text = draft?.from === 'typed' ? draft.text : resting;
  const step = findStep(steps, shown);

  const settle = (next: number): void => {
    if (next === value) onPreview(value);
    else onCommit(next);
  };

  const commit = (): void => {
    if (!draft) return;
    setDraft(null);
    if (draft.from === 'stepped') {
      settle(draft.value);
      return;
    }
    // An arrow may have moved the preview before the typing began.
    if (draft.text === formatValue(value) || draft.text === zeroText) {
      onPreview(value);
      return;
    }
    const typed = snapTyped(steps, draft.text);
    if (typed.status === 'invalid') {
      onPreview(value);
      notify(`Kept ${formatValue(value)}. Type a number.`);
      return;
    }
    if (typed.status === 'snapped') {
      notify(`Snapped to ${formatValue(typed.value)}`);
    }
    settle(typed.value);
  };

  // A pick can replace this field before a blur reaches it, and a removed input
  // fires none. What's in it is still a change the person made (TRU-4.2).
  const commitWhenGone = useEffectEvent(commit);
  useEffect(() => () => commitWhenGone(), []);

  const cancel = (): void => {
    onPreview(value);
    setDraft(null);
  };

  const stepTo = (by: number): void => {
    const typed = draft?.from === 'typed' ? snapTyped(steps, draft.text) : null;
    const from = typed && typed.status !== 'invalid' ? typed.value : shown;
    const next = stepBy(steps, from, by);
    setDraft({ from: 'stepped', value: next });
    onPreview(next);
  };

  const onLabelPress = (event: React.PointerEvent<HTMLElement>): void => {
    if (event.button !== 0 || steps.length === 0) return;
    event.preventDefault();
    const input = event.currentTarget.parentElement?.querySelector('input');
    let last = value;
    startScrub(event, {
      room: roomOf(steps, value),
      onSteps: (count) => {
        const next = stepBy(steps, value, count);
        if (next === last) return;
        last = next;
        setDraft({ from: 'stepped', value: next });
        onPreview(next);
      },
      onEnd: (end: ScrubEnd) => {
        // A click changed nothing: it keeps what's typed, and goes back to it.
        if (end === 'click') {
          input?.focus();
          return;
        }
        setDraft(null);
        if (end === 'cancel') onPreview(value);
        else settle(last);
      },
    });
  };

  const off = offGiven ?? (!step && steps.length > 0);
  const said = `${unit ? `${resting} ${unit}` : resting}${from ? `, ${from.words}` : ''}`;

  return (
    <div className="field" data-off={off ? 'true' : undefined}>
      <span
        className="field-label"
        aria-hidden="true"
        onPointerDown={onLabelPress}
      >
        {label}
      </span>
      <input
        type="text"
        role="spinbutton"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        aria-label={name}
        aria-valuenow={shown}
        aria-valuemin={steps[0]?.value}
        aria-valuemax={steps.at(-1)?.value}
        aria-valuetext={
          off
            ? `${said}, off the scale`
            : step?.token
              ? `${said}, token ${step.token}`
              : said
        }
        value={text}
        onChange={(event) =>
          setDraft({ from: 'typed', text: event.target.value })
        }
        // The first click takes the whole value; the next places the caret.
        onMouseDown={(event) => {
          if (document.activeElement === event.currentTarget) return;
          event.preventDefault();
          event.currentTarget.focus();
        }}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(event) => {
          const further = event.shiftKey ? FURTHER : 1;
          if (event.key === 'ArrowUp') stepTo(further);
          else if (event.key === 'ArrowDown') stepTo(-further);
          else if (event.key === 'Enter') commit();
          else if (event.key === 'Escape') cancel();
          else return;
          event.preventDefault();
          event.stopPropagation();
        }}
      />
      {unit ? <span className="field-unit">{unit}</span> : null}
      {from ? (
        <span className="field-from" aria-hidden="true" title={from.words}>
          {from.mark}
        </span>
      ) : null}
      {/* The input's own value text says the same to a screen reader. */}
      <span className="field-marks" aria-hidden="true">
        <Marks reading={{ token: step?.token ?? null, off }} />
      </span>
      {rows ? (
        <button
          type="button"
          className="field-drop"
          aria-label={`Choose ${name.toLowerCase()} token`}
          aria-haspopup="listbox"
          aria-expanded={anchor !== null}
          onClick={(event) =>
            setAnchor(
              anchor
                ? null
                : event.currentTarget.closest<HTMLElement>('.field'),
            )
          }
        >
          <ChevronDown
            aria-hidden
            size={12}
            absoluteStrokeWidth
            strokeWidth={ICON_STROKE}
          />
        </button>
      ) : null}
      {anchor && rows ? (
        <TokenMenu
          name={`${name} tokens`}
          anchor={anchor}
          rows={rows}
          current={rows.find((row) => step?.token === row.name)?.key ?? null}
          near={off ? shown : null}
          onCreate={onCreate}
          onPreview={(row) => {
            if (row && row.px === null) onWord?.(row.name, false);
            else onPreview(row?.px ?? value);
          }}
          onClose={() => {
            onPreview(value);
            setAnchor(null);
          }}
          onChoose={(row) => {
            const focusBack = anchor;
            setAnchor(null);
            setDraft(null);
            focusBack.querySelector('input')?.focus();
            if (row.px !== null) settle(row.px);
            else onWord?.(row.name, true);
          }}
        />
      ) : null}
    </div>
  );
}

export type TokenFieldProps = {
  /** The accessible name: "Fill". */
  name: string;
  label?: ReactNode;
  /** What a designer reads: a colour's name, a font. */
  value: string;
  /** A colour to show beside it. */
  swatch?: string;
  /** What it comes to, at the field's end: a colour's hex, beside its name. */
  detail?: string;
  /** The value isn't a token. */
  off?: boolean;
  rows: readonly TokenRow[];
  /** The token in use, by its key. */
  current?: string | null;
  /** What the value is, when it's off the scale: the menu opens at the tokens nearest it. */
  near?: number | string | null;
  onChoose: (row: TokenRow) => void;
  /** The row pointed at or moved to; null once there is none. */
  onPreview?: (row: TokenRow | null) => void;
  /** Offers to create a token (TRU-11.5). */
  onCreate?: () => void;
};

/** A value only a token can set: a font, a colour's name. The whole field opens the menu. */
export function TokenField({
  name,
  label,
  value,
  swatch,
  detail,
  off = false,
  rows,
  current = null,
  near = null,
  onChoose,
  onPreview,
  onCreate,
}: TokenFieldProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <button
        type="button"
        className="field field-button"
        aria-label={`${name} ${value}${off ? ', off the scale' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={anchor !== null}
        data-off={off ? 'true' : undefined}
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
      >
        {label ? (
          <span className="field-label" data-still="true">
            {label}
          </span>
        ) : null}
        {swatch ? (
          <span
            className="inspect-swatch"
            style={{ '--swatch': swatch } as CSSProperties}
            aria-hidden="true"
          />
        ) : null}
        <span className="field-text" title={value}>
          {value}
        </span>
        {detail ? <span className="field-unit">{detail}</span> : null}
        <Marks reading={{ token: null, off }} />
        <ChevronDown
          aria-hidden
          className="field-chevron"
          size={12}
          absoluteStrokeWidth
          strokeWidth={ICON_STROKE}
        />
      </button>
      {anchor ? (
        <TokenMenu
          name={`${name} tokens`}
          anchor={anchor}
          rows={rows}
          current={current}
          near={near}
          onCreate={onCreate}
          onPreview={onPreview}
          onClose={() => {
            onPreview?.(null);
            setAnchor(null);
          }}
          onChoose={(row) => {
            anchor.focus();
            setAnchor(null);
            onChoose(row);
          }}
        />
      ) : null}
    </>
  );
}

/** The token button at a field's end, as beside a colour's value, or an empty section's `+`. */
export function TokenButton({
  name,
  label,
  icon,
  rows,
  current = null,
  near = null,
  onChoose,
  onPreview,
  onCreate,
}: Pick<
  TokenFieldProps,
  'name' | 'rows' | 'current' | 'near' | 'onChoose' | 'onPreview' | 'onCreate'
> & {
  /** Its accessible name, when it isn't "Choose … token". */
  label?: string;
  icon?: ReactNode;
}) {
  const said = label ?? `Choose ${name.toLowerCase()} token`;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <button
        type="button"
        className="tool"
        aria-label={said}
        aria-haspopup="listbox"
        aria-expanded={anchor !== null}
        title={said}
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
      >
        {icon ?? (
          <LayoutGrid
            aria-hidden
            size={16}
            absoluteStrokeWidth
            strokeWidth={ICON_STROKE}
          />
        )}
      </button>
      {anchor ? (
        <TokenMenu
          name={`${name} tokens`}
          anchor={anchor}
          rows={rows}
          current={current}
          near={near}
          onCreate={onCreate}
          onPreview={onPreview}
          onClose={() => {
            onPreview?.(null);
            setAnchor(null);
          }}
          onChoose={(row) => {
            anchor.focus();
            setAnchor(null);
            onChoose(row);
          }}
        />
      ) : null}
    </>
  );
}
