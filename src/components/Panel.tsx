import { useId, type ReactNode } from 'react';
import { cx } from '../lib/cx';

/** A sheet with a small heading, which also names the region for assistive technology. */
export function Panel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cx('sheet', className)}>
      <h2
        id={id}
        className="type-narrow border-b border-line px-5 py-3 text-sm text-ink-muted sm:px-6"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
