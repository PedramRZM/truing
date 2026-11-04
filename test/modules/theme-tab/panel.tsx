import { definePanel } from '../../../src/module';

import module from './module';

export default definePanel(module, {
  left: () => <p className="module-empty">In the Theme tab.</p>,
});
