import { createContext, use } from 'react';
import type { StoreApi } from './store-api';

export const ApiContext = createContext<StoreApi | null>(null);

export function useApi(): StoreApi {
  const api = use(ApiContext);
  if (!api) throw new Error('useApi needs an ApiContext above it');
  return api;
}
