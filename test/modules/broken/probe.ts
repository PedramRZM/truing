import { defineProbe } from '../../../src/module';

import broken from './module';

export const PROBE_ERROR = 'Broken on purpose, in its probe.';

export default defineProbe(broken, () => {
  throw new Error(PROBE_ERROR);
});
