import { forwardRef, type HTMLAttributes } from 'react';

import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/src/lib/utils';

const alertVariants = cva(
  'relative w-full rounded-md border px-400 py-300 text-sm grid gap-200 [&>svg]:size-4 [&>svg]:translate-y-px [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'bg-grey-200 text-grey-900 border-grey-400',
        info: 'bg-info/10 text-info border-info/30',
        success:
          'bg-success/10 text-success border-success/30 [&>svg]:text-current',
        warning:
          'bg-warning/15 text-yellow-700 border-warning/40 [&>svg]:text-current',
        pending:
          'bg-pending/10 text-pending border-pending/30 [&>svg]:text-current',
        destructive: 'bg-destructive/10 text-destructive border-destructive/30',
        solid: 'bg-primary text-primary-foreground border-transparent',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  ),
);
Alert.displayName = 'Alert';

const AlertTitle = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn('font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertDescription, AlertTitle, alertVariants };
