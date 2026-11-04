import { useState } from 'react';

import { ScaleField, type ScaleFieldProps } from './field';
import { formatValue, nearestStep } from './scale';

/**
 * A slider beside a number, both on one scale. The slider moves along the
 * scale's steps rather than its values, so 8 to 12 is as far as 96 to 180. A
 * value off the scale rests the slider at its nearest step.
 */
export function SliderField(props: ScaleFieldProps) {
  const { name, value, steps, onPreview, onCommit } = props;
  const [moving, setMoving] = useState<number | null>(null);
  // What the number beside it is previewing, so the thumb follows a scrub.
  const [following, setFollowing] = useState<number | null>(null);
  const shown = moving ?? value;
  const nearest = nearestStep(steps, moving ?? following ?? value);
  const index = nearest ? steps.indexOf(nearest) : 0;

  const release = (): void => {
    if (moving === null) return;
    setMoving(null);
    if (moving === value) onPreview(value);
    else onCommit(moving);
  };

  return (
    <div className="control-slider">
      <input
        type="range"
        className="control-range"
        aria-label={name}
        aria-valuetext={formatValue(shown)}
        min={0}
        max={Math.max(0, steps.length - 1)}
        value={index}
        onChange={(event) => {
          const next = steps[Number(event.target.value)]?.value;
          if (next === undefined) return;
          setMoving(next);
          onPreview(next);
        }}
        onPointerUp={release}
        onKeyUp={release}
        onBlur={release}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || moving === null) return;
          event.stopPropagation();
          setMoving(null);
          onPreview(value);
        }}
      />
      <ScaleField
        {...props}
        value={shown}
        onPreview={(next) => {
          setFollowing(next === value ? null : next);
          onPreview(next);
        }}
        onCommit={(next) => {
          setFollowing(null);
          onCommit(next);
        }}
      />
    </div>
  );
}
