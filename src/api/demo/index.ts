import type { KeyValueStorage } from '../../lib/storage';
import type { StoreApi } from '../store-api';
import { createDemoApi } from './demo-api';
import { createDemoSession, type DemoSession } from './demo-session';
import { CATALOG, placePastOrders } from './seed';
import { Simulation } from './simulation';

export interface DemoBackend {
  api: StoreApi;
  session: DemoSession;
  /** Throws away everything the visitor did and rebuilds the starting history. */
  restart(): void;
}

/** `storage` keeps the simulation across reloads of the same tab. */
export function startDemo(storage?: KeyValueStorage): DemoBackend {
  const simulation = new Simulation(CATALOG, storage);
  const restart = () => simulation.reset(CATALOG, placePastOrders);
  if (!simulation.restore()) restart();

  const session = createDemoSession(storage);
  return { api: createDemoApi(simulation, session), session, restart };
}
