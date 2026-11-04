import { cn } from '@/src/lib/utils';
import { cva } from 'class-variance-authority';

const tones = {
  info: 'bg-gradient-to-r from-brand-1-500 to-brand-2-500',
  error: 'bg-destructive',
};

const tab = cva('flex px-300', {
  variants: { tone: { active: 'text-primary', inactive: 'text-grey-700' } },
});

export function Toast({ tone, on }: { tone: 'info' | 'error'; on: boolean }) {
  return (
    <div id="toast" className={cn('w-full', tones[tone])}>
      <span id="tab" className={tab({ tone: on ? 'active' : 'inactive' })}>
        Hello
      </span>
    </div>
  );
}
