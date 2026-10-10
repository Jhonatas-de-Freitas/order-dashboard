import { createContext, use, useSyncExternalStore } from 'react';
import type { DemoBackend } from '../api/demo';
import type { Session, User } from './session';

export const SessionContext = createContext<Session | null>(null);

/** Present only in the demo build: lets the visitor switch persona and start over. */
export const DemoContext = createContext<DemoBackend | null>(null);

export const useDemo = () => use(DemoContext);

export function useSession() {
  const session = use(SessionContext);
  if (!session) throw new Error('useSession needs a SessionContext above it');
  const user = useSyncExternalStore(session.subscribe, session.getUser);
  return { user, signIn: session.signIn, signOut: session.signOut };
}

/** For screens that only render behind the sign-in guard. */
export function useUser(): User {
  const { user } = useSession();
  if (!user) throw new Error('useUser was called on a screen that is not behind the sign-in guard');
  return user;
}
