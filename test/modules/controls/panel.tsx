import { type CSSProperties, use, useState } from 'react';

import {
  ArrowDown,
  ArrowRight,
  Scan,
  SquareRoundCorner,
  WrapText,
} from 'lucide-react';

import { definePanel, type PanelProps } from '../../../src/module';
import {
  AlignmentPad,
  type PadDirection,
  type PadValue,
} from '../../../src/shell/controls/alignment-pad';
import {
  ScaleField,
  TokenButton,
  TokenField,
} from '../../../src/shell/controls/field';
import { ICON_STROKE } from '../../../src/shell/controls/marks';
import { SliderField } from '../../../src/shell/controls/slider';
import {
  Checkbox,
  IconToggle,
  Segmented,
} from '../../../src/shell/controls/toggles';
import { stepsOf, type TokenRow } from '../../../src/shell/controls/token-rows';

import controls, { type ControlTokens } from './module';

type Props = PanelProps<typeof controls>;

let tokens: Promise<ControlTokens> | null = null;

const icon = { size: 14, absoluteStrokeWidth: true, strokeWidth: ICON_STROKE };

// A test module brings no stylesheet of its own: the shell's tokens, inline.
const STACK: CSSProperties = {
  display: 'grid',
  gap: 'var(--ds-space-2)',
};
const ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--ds-space-2)',
};
const PREVIEW: CSSProperties = { background: 'var(--ds-track)' };
const PREVIEW_FILL: CSSProperties = {
  display: 'block',
  height: 'var(--ds-control)',
  borderRadius: 'var(--ds-radius)',
  background: 'var(--ds-accent-fill)',
};

/** A number field, and what happened to it: previews and one commit per change. */
function useNumber(start: number) {
  const [value, setValue] = useState(start);
  const [preview, setPreview] = useState(start);
  const [commits, setCommits] = useState(0);
  return {
    value,
    preview,
    commits,
    onPreview: setPreview,
    onCommit: (next: number) => {
      setValue(next);
      setPreview(next);
      setCommits((count) => count + 1);
    },
  };
}

/** The shell's socket opens after the first render; a connected frame says it's open. */
function ControlsPanel(props: Props) {
  if (!props.frames.some((frame) => frame.connected)) {
    return <p className="module-empty">Controls show once a frame loads.</p>;
  }
  return <Controls {...props} />;
}

function Controls({ call, notify }: Props) {
  tokens ??= call('tokens', {});
  const { spacing, radius, colour, font } = use(tokens);
  const spacingSteps = stepsOf(spacing);
  const radiusSteps = stepsOf(radius);

  const padding = useNumber(16);
  const offScale = useNumber(13);
  const corner = useNumber(8);
  const [fill, setFill] = useState<TokenRow | undefined>(
    colour.find((row) => row.name === 'primary') ?? colour[0],
  );
  const [typeface, setTypeface] = useState<TokenRow | undefined>(font[0]);
  const [direction, setDirection] = useState<PadDirection>('row');
  const [align, setAlign] = useState<PadValue>({ x: 'start', y: 'start' });
  const [clip, setClip] = useState(false);
  const [wrap, setWrap] = useState(false);

  return (
    <div style={STACK}>
      <p role="status" aria-label="Padding state">
        Padding {padding.value}, previewing {padding.preview}, committed{' '}
        {padding.commits}
      </p>
      <ScaleField
        name="Padding"
        label={<Scan aria-hidden {...icon} />}
        value={padding.value}
        steps={spacingSteps}
        rows={spacing}
        notify={notify}
        onPreview={padding.onPreview}
        onCommit={padding.onCommit}
      />
      <ScaleField
        name="Margin"
        label="M"
        value={offScale.value}
        steps={spacingSteps}
        rows={spacing}
        notify={notify}
        onPreview={offScale.onPreview}
        onCommit={offScale.onCommit}
      />
      <SliderField
        name="Corners"
        label={<SquareRoundCorner aria-hidden {...icon} />}
        value={corner.value}
        steps={radiusSteps}
        rows={radius}
        notify={notify}
        onPreview={corner.onPreview}
        onCommit={corner.onCommit}
      />
      <div style={ROW}>
        <TokenField
          name="Fill"
          value={fill?.name ?? 'None'}
          swatch={fill?.hex ?? undefined}
          rows={colour}
          current={fill?.key}
          onChoose={setFill}
        />
        <TokenButton
          name="Fill"
          rows={colour}
          current={fill?.key}
          onChoose={setFill}
        />
      </div>
      <TokenField
        name="Second fill"
        value="#3d82f2"
        swatch="#3d82f2"
        off
        rows={colour}
        near="#3d82f2"
        onChoose={setFill}
      />
      <TokenField
        name="Font"
        value={typeface?.name ?? 'None'}
        rows={font}
        current={typeface?.key}
        onChoose={setTypeface}
      />
      <div style={ROW}>
        <AlignmentPad
          name="Alignment"
          value={align}
          direction={direction}
          onChange={setAlign}
        />
        <div style={STACK}>
          <Segmented
            name="Direction"
            value={direction}
            options={[
              {
                value: 'column',
                label: 'Down',
                icon: <ArrowDown aria-hidden {...icon} />,
              },
              {
                value: 'row',
                label: 'Right',
                icon: <ArrowRight aria-hidden {...icon} />,
              },
            ]}
            onChange={setDirection}
          />
          <IconToggle label="Wrap" pressed={wrap} onChange={setWrap}>
            <WrapText aria-hidden {...icon} />
          </IconToggle>
        </div>
      </div>
      <Checkbox label="Clip content" checked={clip} onChange={setClip} />
      {/* Last, so a padding that grows moves no control under the pointer. */}
      <div
        role="img"
        aria-label="Preview"
        style={{
          ...PREVIEW,
          padding: padding.preview,
          borderRadius: corner.preview,
        }}
      >
        <span style={PREVIEW_FILL} />
      </div>
    </div>
  );
}

export default definePanel(controls, { right: ControlsPanel });
