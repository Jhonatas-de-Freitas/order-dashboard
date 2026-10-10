export type Role = 'customer' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  roles: Role[];
}

/** Who is signed in. Lives outside React so the data layer can read it too. */
export interface Session {
  getUser: () => User | null;
  subscribe: (listener: () => void) => () => void;
  signIn: () => void;
  signOut: () => void;
}

export function isAdmin(user: User | null): boolean {
  return user?.roles.includes('admin') ?? false;
}

export const roleLabel = (user: User) => (isAdmin(user) ? 'Administrador' : 'Cliente');
