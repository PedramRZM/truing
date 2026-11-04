import * as UI from '@/src/components/ui/button';

import { Button as UIButton } from '../components/ui/button';

export function Aliased() {
  return (
    <>
      <UIButton asChild />
      <UI.Button />
    </>
  );
}
