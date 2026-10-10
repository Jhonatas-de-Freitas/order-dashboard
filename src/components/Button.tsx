import type { ComponentProps } from 'react';
import { cx } from '../lib/cx';

type Variant = 'primary' | 'secondary' | 'quiet';
type Size = 'md' | 'sm';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-action text-action-ink hover:bg-action-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:bg-sunken',
  quiet: 'text-ink-muted hover:bg-sunken hover:text-ink',
};

const SIZES: Record<Size, string> = {
  md: 'h-10 px-4 text-base',
  sm: 'h-8 px-3 text-sm',
};

/** Also for links that should look like a button. */
export const buttonClass = (variant: Variant = 'secondary', size: Size = 'md') =>
  cx(
    'type-narrow inline-flex shrink-0 items-center justify-center gap-2 rounded-md whitespace-nowrap transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
  );

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={cx(buttonClass(variant, size), className)} {...props} />;
}
