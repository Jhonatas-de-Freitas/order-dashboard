export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Browsers may refuse storage access (private mode, blocked cookies); then nothing is kept. */
export function browserStorage(kind: 'local' | 'session'): KeyValueStorage | undefined {
  try {
    const storage = kind === 'local' ? window.localStorage : window.sessionStorage;
    storage.getItem('probe');
    return storage;
  } catch {
    return undefined;
  }
}
