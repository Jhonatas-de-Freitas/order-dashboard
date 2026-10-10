import { Check, Minus, X } from 'lucide-react';
import { cx } from '../lib/cx';
import { formatTime } from '../lib/format';
import { useHasChanged } from '../lib/useHasChanged';
import type { Step, StepState } from './steps';

export function OrderTimeline({ steps }: { steps: Step[] }) {
  return (
    <ol aria-label="Andamento do pedido">
      {steps.map((step, index) => (
        <li key={step.key} data-tone={step.tone} className="relative flex gap-4 pb-7 last:pb-0">
          {index < steps.length - 1 && (
            <span aria-hidden className="absolute top-8 bottom-0 left-[0.9375rem] w-0.5 bg-line">
              <span
                className={cx(
                  'block size-full origin-top bg-tone-solid transition-transform duration-700 ease-settle',
                  step.state === 'done' ? 'scale-y-100' : 'scale-y-0',
                )}
              />
            </span>
          )}
          <Marker state={step.state} />
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p
                className={cx(
                  'font-semibold',
                  (step.state === 'idle' || step.state === 'skipped') && 'text-ink-subtle',
                )}
              >
                {step.title}
              </p>
              {step.at && (
                <time dateTime={step.at} className="text-sm text-ink-muted tabular-nums">
                  {formatTime(step.at)}
                </time>
              )}
            </div>
            {step.detail && <p className="text-sm text-ink-muted">{step.detail}</p>}
            {step.state === 'waiting' && <p className="text-sm text-ink-muted">Aguardando…</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

const MARKER: Record<StepState, string> = {
  done: 'bg-tone-solid text-surface',
  failed: 'bg-tone-solid text-surface',
  waiting: 'animate-waiting border-2 border-tone-solid bg-surface',
  idle: 'border-2 border-line bg-surface',
  skipped: 'border-2 border-dashed border-line-strong bg-surface text-ink-subtle',
};

function Marker({ state }: { state: StepState }) {
  const changed = useHasChanged(state);
  return (
    <span
      key={state}
      aria-hidden
      className={cx(
        'relative grid size-8 shrink-0 place-items-center rounded-full',
        MARKER[state],
        changed && state !== 'waiting' && 'animate-state-in',
      )}
    >
      {state === 'done' && <Check strokeWidth={3} className="size-4" />}
      {state === 'failed' && <X strokeWidth={3} className="size-4" />}
      {state === 'skipped' && <Minus strokeWidth={3} className="size-4" />}
      {state === 'waiting' && <span className="size-2 rounded-full bg-tone-solid" />}
    </span>
  );
}
