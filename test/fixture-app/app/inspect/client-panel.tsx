'use client';

import { useState } from 'react';

import * as Dialog from '@radix-ui/react-dialog';
import { Popover, Select } from 'radix-ui';

import { Button } from '../../components/ui/button';

const ITEMS = ['Alpha', 'Beta', 'Gamma'];

/** A client component: cva Buttons, an asChild Button, a mapped list, and the three Radix overlays. */
export function ClientPanel() {
  const [presses, setPresses] = useState(0);
  const press = (): void => setPresses((count) => count + 1);

  return (
    <section aria-label="Client panel">
      <Button variant="tonal" onClick={press}>
        Pressed {presses} times
      </Button>
      <Button asChild>
        <a href="#details">Read the details</a>
      </Button>
      <ul aria-label="Items">
        {ITEMS.map((item) => (
          <li key={item} className="px-100">
            {item}
          </li>
        ))}
      </ul>
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <Button>Open the dialog</Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Content aria-describedby={undefined}>
            <Dialog.Title>Fixture dialog</Dialog.Title>
            <Button variant="tonal" size="sm" onClick={press}>
              Inside the dialog
            </Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button>Open the popover</Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content aria-label="Fixture popover">
            <Button size="sm" onClick={press}>
              Inside the popover
            </Button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Select.Root defaultValue="one">
        <Select.Trigger aria-label="Fixture select">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Content>
            <Select.Viewport>
              <Select.Item value="one">
                <Select.ItemText>One</Select.ItemText>
              </Select.Item>
              <Select.Item value="two">
                <Select.ItemText>Two</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </section>
  );
}
