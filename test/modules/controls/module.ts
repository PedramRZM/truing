import * as z from 'zod/mini';

import { defineModule } from '../../../src/module';
import type { TokenRow } from '../../../src/shell/controls/token-rows';

export type ControlTokens = {
  spacing: TokenRow[];
  radius: TokenRow[];
  colour: TokenRow[];
  font: TokenRow[];
};

/**
 * Every control of TRU-3.9 on the project's real tokens, until TRU-4.2 and TRU-4.3 put
 * them in the panel: the controls' e2e fixture, and a place to try them
 * (`TRUING_CONTROLS=1 truing`). It writes nothing.
 */
export default defineModule({
  id: 'controls',
  title: 'Controls',
  panel: { docks: ['right'] },
  server: {
    ops: {
      tokens: {
        input: z.object({}),
        output: z.custom<ControlTokens>(),
      },
    },
  },
});
