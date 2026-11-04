import { defineModule } from '../../../src/module';

/** Adds to the properties panel, and adds one that throws: the contract's fixture (TRU-3.8). */
export default defineModule({
  id: 'property-section',
  title: 'Property fixture',
  panel: { docks: ['left'], tab: 'theme' },
});
