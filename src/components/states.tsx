import { TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';
import { describeError } from '../lib/errors';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <span className={cx('block animate-skeleton rounded-sm bg-line', className)} />;
}

/** Wraps the placeholder of a region that is still loading, so it is announced once. */
export function Loading({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-label={label}>
      {children}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { title, message } = describeError(error);
  return (
    <div role="alert" className="flex flex-col items-start gap-3 px-5 py-8 sm:px-6">
      <TriangleAlert aria-hidden className="size-6 text-ink-muted" />
      <div>
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-ink-muted">{message}</p>
      </div>
      <Button onClick={onRetry}>Tentar de novo</Button>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 px-5 py-8 sm:px-6">
      <Icon aria-hidden className="size-6 text-ink-muted" />
      <div>
        <p className="text-lg font-semibold">{title}</p>
        {children && <p className="max-w-[60ch] text-ink-muted">{children}</p>}
      </div>
      {action}
    </div>
  );
}
