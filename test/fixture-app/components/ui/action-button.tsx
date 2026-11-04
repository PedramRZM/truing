// A primitive whose call site sits in a feature, for the Turbopack check.
import { cva, type VariantProps } from 'class-variance-authority';

const actionButtonVariants = cva('inline-flex rounded-xl', {
  variants: {
    variant: {
      default: 'bg-primary text-background',
      outline: 'gap-300 border px-400',
    },
  },
  defaultVariants: { variant: 'default' },
});

type ActionButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof actionButtonVariants>;

export function ActionButton({
  className,
  variant,
  ...props
}: ActionButtonProps) {
  return (
    <button
      className={actionButtonVariants({ variant, className })}
      {...props}
    />
  );
}
