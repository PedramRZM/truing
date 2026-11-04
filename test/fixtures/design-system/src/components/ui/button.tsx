import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/src/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-300 whitespace-nowrap rounded-md text-button-sm transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        /* Kind=Solid */
        default:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80',
        destructive:
          'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
        success:
          'bg-success text-success-foreground shadow-xs hover:bg-success/90',
        warning:
          'bg-warning text-warning-foreground shadow-xs hover:bg-warning/90',
        neutral: 'bg-grey-800 text-grey-100 shadow-xs hover:bg-grey-700',
        /* Kind=Outline */
        outline:
          'border border-input bg-background shadow-xs hover:bg-input/50',
        'outline-secondary':
          'border border-secondary bg-background text-secondary shadow-xs hover:bg-secondary/10',
        'outline-destructive':
          'border border-destructive bg-background text-destructive shadow-xs hover:bg-destructive/10',
        /* Kind=Tonal */
        tonal:
          'bg-brand-1-100 text-brand-1-700 hover:bg-brand-1-200 active:bg-brand-1-300',
        'tonal-neutral':
          'bg-grey-200 text-grey-700 hover:bg-grey-400 hover:text-grey-700 active:bg-grey-500',
        'tonal-destructive':
          'bg-red-100 text-destructive hover:bg-red-200 active:bg-red-300',
        /* Kind=Text */
        ghost: 'hover:bg-muted hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        /* Figma: XSmall=24, Small=36 (Button/Small 14/20 semibold),
           Large=48 (Button/Medium 16/24 semibold, padding 24, gap 6) */
        xs: 'h-6 gap-200 px-300 text-xs',
        sm: 'h-9 gap-200 px-400',
        default: 'h-10 px-500 py-300 has-[>svg]:px-300',
        lg: 'h-12 gap-200 px-700 text-button-md',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
