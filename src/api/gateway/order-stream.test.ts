import { describe, expect, it, vi } from 'vitest';
import { sleep } from './order-stream';

/** A signal that keeps count of the abort listeners still attached to it. */
function countedSignal() {
  const stop = new AbortController();
  const attached = new Set<unknown>();
  const { signal } = stop;
  const add = signal.addEventListener.bind(signal);
  const remove = signal.removeEventListener.bind(signal);
  vi.spyOn(signal, 'addEventListener').mockImplementation((type, listener, options) => {
    attached.add(listener);
    add(type, listener, options);
  });
  vi.spyOn(signal, 'removeEventListener').mockImplementation((type, listener, options) => {
    attached.delete(listener);
    remove(type, listener, options);
  });
  return { stop, signal, attached };
}

describe('wait between attempts', () => {
  it('leavesNothingOnTheSignalWhenTheTimeRunsOut', async () => {
    const { signal, attached } = countedSignal();

    for (let attempt = 0; attempt < 5; attempt += 1) await sleep(1, signal);

    expect(attached.size).toBe(0);
  });

  it('wakesUpAtOnceWhenTheWatcherLeaves', async () => {
    const { stop, signal, attached } = countedSignal();
    const started = Date.now();

    const waiting = sleep(60_000, signal);
    stop.abort();
    await waiting;

    expect(Date.now() - started).toBeLessThan(1_000);
    expect(attached.size).toBe(0);
  });
});
