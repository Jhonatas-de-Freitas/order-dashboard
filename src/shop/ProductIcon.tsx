import {
  Headset,
  Keyboard,
  Laptop,
  Monitor,
  Mouse,
  Package,
  Webcam,
  type LucideIcon,
} from 'lucide-react';
import { cx } from '../lib/cx';

// The catalog has no pictures. The six products every environment starts with get a
// drawing by their id; anything registered later gets the box.
const ICONS: Record<string, LucideIcon> = {
  '11111111-1111-1111-1111-111111111111': Keyboard,
  '22222222-2222-2222-2222-222222222222': Mouse,
  '33333333-3333-3333-3333-333333333333': Monitor,
  '44444444-4444-4444-4444-444444444444': Headset,
  '55555555-5555-5555-5555-555555555555': Laptop,
  '66666666-6666-6666-6666-666666666666': Webcam,
};

export function ProductIcon({ productId, className }: { productId: string; className?: string }) {
  const Icon = ICONS[productId] ?? Package;
  return (
    <span
      aria-hidden
      className={cx(
        'grid size-10 shrink-0 place-items-center rounded-md bg-sunken text-ink-muted',
        className,
      )}
    >
      <Icon strokeWidth={1.75} className="size-5" />
    </span>
  );
}
