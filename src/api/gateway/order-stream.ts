import type { OrderWatcher } from '../store-api';
import type { OrderSummary } from '../types';
import { eventStreamParser } from './event-stream';
import type { AccessTokens } from './gateway-api';

export interface StreamTiming {
  /** Wait before each new attempt; the last value repeats. */
  retryDelays: readonly number[];
  /** The server sends a keep-alive every 15 s. Longer than this without a byte, it is gone. */
  silenceLimit: number;
}

const DEFAULT_TIMING: StreamTiming = {
  retryDelays: [1_000, 2_000, 5_000, 15_000, 30_000],
  silenceLimit: 45_000,
};

class SessionEnded extends Error {}

/**
 * Keeps `GET /orders/stream` open and reconnects when it drops. While it is down the
 * watcher is told, so the screens can poll instead.
 */
export function watchOrderStream(
  url: string,
  tokens: AccessTokens,
  watcher: OrderWatcher,
  timing: StreamTiming = DEFAULT_TIMING,
): () => void {
  const stop = new AbortController();
  let failures = 0;

  const open = (token: string | null) =>
    fetch(url, {
      headers: {
        Accept: 'text/event-stream',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      cache: 'no-store',
      signal: stop.signal,
    });

  async function listen() {
    let response = await open(await tokens.accessToken());
    if (response.status === 401) {
      const renewed = await tokens.renewAccessToken();
      if (!renewed) throw new SessionEnded();
      response = await open(renewed);
    }
    if (!response.ok || !response.body) throw new Error(`Order stream answered ${response.status}`);

    failures = 0;
    watcher.onConnectionChange?.(true);

    const parse = eventStreamParser(({ type, data }) => {
      if (type !== 'order-updated') return;
      let order: OrderSummary;
      try {
        order = JSON.parse(data) as OrderSummary;
      } catch {
        // One unreadable event is not worth dropping the connection for.
        return;
      }
      watcher.onUpdate(order);
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await readWithin(timing.silenceLimit, reader);
      if (done) return;
      parse(decoder.decode(value, { stream: true }));
    }
  }

  void (async () => {
    while (!stop.signal.aborted) {
      try {
        await listen();
      } catch (error) {
        if (stop.signal.aborted) return;
        if (error instanceof SessionEnded) {
          // No point in retrying: the next poll gets the same 401 and signs the user out.
          watcher.onConnectionChange?.(false);
          return;
        }
      }
      if (stop.signal.aborted) return;
      watcher.onConnectionChange?.(false);
      const delay = timing.retryDelays[Math.min(failures, timing.retryDelays.length - 1)] ?? 0;
      failures += 1;
      await sleep(delay, stop.signal);
    }
  })();

  return () => stop.abort();
}

async function readWithin(limit: number, reader: ReadableStreamDefaultReader<Uint8Array>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const silence = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Order stream went silent')), limit);
  });
  try {
    return await Promise.race([reader.read(), silence]);
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function sleep(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const wake = () => {
      clearTimeout(timer);
      // One sleep per reconnection attempt: left on the signal, the listeners would pile up.
      signal.removeEventListener('abort', wake);
      resolve();
    };
    const timer = setTimeout(wake, milliseconds);
    signal.addEventListener('abort', wake);
  });
}
