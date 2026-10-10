import type { Session, User } from '../../auth/session';
import type { KeyValueStorage } from '../../lib/storage';
import { ADMIN, ANA } from './seed';

const STORAGE_KEY = 'order-dashboard:persona';
const SIGNED_OUT = 'none';

/** Sign-in without a password: the visitor just picks who to be. */
export interface DemoSession extends Session {
  readonly personas: readonly User[];
  signInAs(user: User): void;
}

export function createDemoSession(storage?: KeyValueStorage): DemoSession {
  const personas = [ANA, ADMIN];
  const listeners = new Set<() => void>();
  const saved = storage?.getItem(STORAGE_KEY);
  let user: User | null =
    saved === SIGNED_OUT ? null : (personas.find((persona) => persona.id === saved) ?? ANA);

  const change = (next: User | null) => {
    if (next?.id === user?.id) return;
    user = next;
    storage?.setItem(STORAGE_KEY, next?.id ?? SIGNED_OUT);
    listeners.forEach((notify) => notify());
  };

  return {
    personas,
    getUser: () => user,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signIn() {
      change(ANA);
      return Promise.resolve();
    },
    signInAs: change,
    signOut: () => change(null),
  };
}
