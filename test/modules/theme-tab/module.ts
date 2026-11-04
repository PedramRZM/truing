import { defineModule } from '../../../src/module';

/** Asks for the left panel's Theme tab: the tabs' fixture (TRU-3.4). */
export default defineModule({
  id: 'theme-tab',
  title: 'Theme fixture',
  panel: { docks: ['left'], tab: 'theme' },
});
