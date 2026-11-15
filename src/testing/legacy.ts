import { defaultLegacy, legacy } from '@helpers/legacy/legacy';
import { beforeEach, vi } from 'vitest';

// Backs the localStorage mock with a real store, so Legacy writes can be read back within a test.
export function useLegacyStorage(): Map<string, string> {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.mocked(localStorage.getItem).mockImplementation(
      (key) => store.get(key) ?? null,
    );
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
      store.set(key, value);
    });
    legacy.set(defaultLegacy());
  });
  return store;
}
