import { Link2, TriangleAlert } from 'lucide-react';

/** The rail's 16 px icons draw a 1.33 px stroke; smaller ones match it. */
export const ICON_STROKE = 4 / 3;

/** The small marks after a value: linked to a token, or off the scale. */
export function Marks({
  reading,
}: {
  reading: { token: string | null; off: boolean };
}) {
  return (
    <>
      {reading.token ? (
        <span
          className="design-mark"
          role="img"
          aria-label={`Token ${reading.token}`}
          title={reading.token}
        >
          <Link2
            aria-hidden
            size={12}
            absoluteStrokeWidth
            strokeWidth={ICON_STROKE}
          />
        </span>
      ) : null}
      {reading.off ? (
        <span
          className="design-mark"
          role="img"
          aria-label="Off the scale"
          title="Off the scale"
        >
          <TriangleAlert
            aria-hidden
            size={12}
            absoluteStrokeWidth
            strokeWidth={ICON_STROKE}
          />
        </span>
      ) : null}
    </>
  );
}
