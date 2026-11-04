// A shadcn-style primitive for the inspector's tests (TRU-2.1): cva variants,
// asChild through Radix's Slot, and no 'use client', as in shadcn's own.
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva('inline-flex rounded-xl text-label-md', {
  variants: {
    variant: {
      default: 'bg-primary text-background',
      tonal: 'bg-brand-1-500 text-grey-900',
    },
    size: {
      default: 'px-400',
      sm: 'px-100',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp className={buttonVariants({ variant, size, className })} {...props} />
  );
}
