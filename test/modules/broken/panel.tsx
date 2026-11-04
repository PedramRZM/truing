import { definePanel } from '../../../src/module';

import broken from './module';

export const PANEL_ERROR = 'Broken on purpose, in its panel.';

export default definePanel(broken, {
  right: function BrokenPanel() {
    throw new Error(PANEL_ERROR);
  },
});
