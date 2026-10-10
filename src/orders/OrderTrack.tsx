import { Fragment } from 'react';
import type { OrderStatus } from '../api/types';
import { cx } from '../lib/cx';
import { STATUS } from './status';
import { summarySteps, type StepState } from './steps';

const STOP: Record<StepState, string> = {
  done: 'bg-tone-solid',
  failed: 'bg-tone-solid',
  waiting: 'animate-waiting border-2 border-tone-solid bg-surface',
  idle: 'border-2 border-line bg-surface',
  skipped: 'border-2 border-line bg-surface',
};

/**
 * The order's path in miniature: received, stock, payment, outcome. Decorative next to
 * the status badge, which carries the same information in words.
 */
export function OrderTrack({
  order,
}: {
  order: { status: OrderStatus; totalAmount: number | null };
}) {
  const steps = summarySteps(order);

  return (
    <span aria-hidden data-tone={STATUS[order.status].tone} className="inline-flex items-center">
      {steps.map((state, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span className="h-0.5 w-4 bg-line">
              <span
                className={cx(
                  'block h-full origin-left bg-tone-solid transition-transform duration-500 ease-settle',
                  state === 'idle' ? 'scale-x-0' : 'scale-x-100',
                )}
              />
            </span>
          )}
          <span
            className={cx(
              'grid size-2.5 place-items-center rounded-full transition-colors duration-300',
              STOP[state],
            )}
          >
            {state === 'failed' && (
              <svg viewBox="0 0 10 10" className="size-2.5 text-surface">
                <path d="M3 3l4 4M7 3l-4 4" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            )}
          </span>
        </Fragment>
      ))}
    </span>
  );
}
