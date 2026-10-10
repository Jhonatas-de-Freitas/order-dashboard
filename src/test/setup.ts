import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(cleanup);

// The indicators screen is loaded on demand; on a busy machine that import alone can
// take longer than the default second.
configure({ asyncUtilTimeout: 5000 });

// Browser APIs the screens use that jsdom does not have.
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList;

window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', NoopObserver);
vi.stubGlobal('ResizeObserver', NoopObserver);
