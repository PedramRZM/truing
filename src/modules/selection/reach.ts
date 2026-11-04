// Which code an edit is for (TRU-2.2): code at the
// use is this use, code inside the component is every use. When the scope the
// designer chose and where the code is written disagree, the edit goes to
// Claude with the reason. A component with one use has nothing to choose.
import type { Reach } from '../../module';

export type ReachDecision = {
  reach: Reach;
  /** Why it needs Claude, or null when the engine can write it. */
  claude: string | null;
};

export function decideReach(input: {
  /** The pick's component, as written at its call site; null for none. */
  component: string | null;
  /** Its uses in the code; null when they couldn't be counted. */
  usages: number | null;
  /** What the designer chose for this pick. */
  chosen: 'use' | 'component';
  /** The edit writes the component's own JSX, not the JSX that uses it. */
  writesInside: boolean;
}): ReachDecision {
  const { component, usages, writesInside } = input;
  if (!component) return { reach: { kind: 'use' }, claude: null };
  const single = usages !== null && usages <= 1;
  const chosen = single ? (writesInside ? 'component' : 'use') : input.chosen;
  if (chosen === 'component') {
    return {
      reach: { kind: 'component', component, usages },
      claude: writesInside ? null : `it is set where each ${component} is used`,
    };
  }
  return {
    reach: { kind: 'use' },
    claude: writesInside
      ? `it is written inside ${component}, so one use can't change alone`
      : null,
  };
}
