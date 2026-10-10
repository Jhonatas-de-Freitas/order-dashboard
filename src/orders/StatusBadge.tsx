import { Check, CircleDashed, PackageCheck, X, type LucideIcon } from 'lucide-react';
import type { OrderStatus } from '../api/types';
import { cx } from '../lib/cx';
import { useHasChanged } from '../lib/useHasChanged';
import { STATUS } from './status';

const ICONS: Record<OrderStatus, LucideIcon> = {
  PENDING: CircleDashed,
  STOCK_RESERVED: PackageCheck,
  CONFIRMED: Check,
  CANCELLED: X,
};

export function StatusBadge({ status, large }: { status: OrderStatus; large?: boolean }) {
  const { label, tone } = STATUS[status];
  const Icon = ICONS[status];
  const changed = useHasChanged(status);

  return (
    <span
      // Remounting on each status replays the entrance, which is the cue that it changed.
      key={status}
      data-tone={tone}
      className={cx(
        'type-narrow inline-flex items-center gap-1.5 rounded-full bg-tone-soft whitespace-nowrap text-tone',
        large ? 'px-3.5 py-1.5 text-base' : 'px-2.5 py-1 text-sm',
        changed && 'animate-state-in',
      )}
    >
      <Icon aria-hidden strokeWidth={2.5} className={large ? 'size-4' : 'size-3.5'} />
      {label}
    </span>
  );
}
