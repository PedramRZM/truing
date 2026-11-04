import { defineModule } from '../../../src/module';

/** Throws in its probe and in its panel: the isolation tests' fixture. */
export default defineModule({
  id: 'broken',
  title: 'Broken',
  probe: {},
  panel: { docks: ['right'] },
});
