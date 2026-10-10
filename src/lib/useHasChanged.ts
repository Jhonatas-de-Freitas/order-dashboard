import { useState } from 'react';

/**
 * `true` from the first time `value` differs from what it was on mount. Lets a mark
 * animate when the data changes under it, but not when the page first renders.
 */
export function useHasChanged<T>(value: T): boolean {
  const [initial] = useState(value);
  const [changed, setChanged] = useState(false);
  if (!changed && value !== initial) setChanged(true);
  return changed;
}
