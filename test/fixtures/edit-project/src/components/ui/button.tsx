import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const shared = 'shadow-sm';

const buttonVariants = cva('inline-flex items-center gap-200', {
  variants: {
    variant: {
      solid: 'bg-primary text-white',
      'tonal-neutral': 'bg-neutral-100 text-neutral-900',
      raised: `${shared} bg-white`,
    },
    size: {
      sm: 'h-8 px-300',
      lg: 'h-10 px-400',
    },
  },
  defaultVariants: { variant: 'solid', size: 'sm' },
});

export function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
