import { defineServer } from '../../../src/module';
import { tokenRows } from '../../../src/shell/controls/token-rows';
import { loadTokens } from '../../../src/tokens/table';

import controls from './module';

export default defineServer(controls, (ctx) => ({
  ops: {
    tokens: async () => {
      const { manifest } = await loadTokens(ctx.root, ctx.config.tokens ?? '');
      return {
        spacing: tokenRows(manifest.tokens, '--spacing'),
        radius: tokenRows(manifest.tokens, '--radius'),
        colour: tokenRows(manifest.tokens, '--color'),
        font: tokenRows(manifest.tokens, '--font'),
      };
    },
  },
}));
