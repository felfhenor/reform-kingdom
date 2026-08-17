// Must be imported before any `@helpers`/`@interfaces` module. Real
// `@angular/common` classes carry `@Injectable()` decorators whose static
// initializers JIT-compile on first import - loading `@angular/compiler`
// up front is what Angular's own error message recommends to avoid the
// "needs to be compiled using the JIT compiler" crash outside a CLI build.
import '@angular/compiler';

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

class FakeIDBRequest {
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onupgradeneeded: (() => void) | null = null;
  result: unknown = undefined;
  error: unknown = undefined;
}

// `state-game.ts` calls `indexedDbSignal('gamestate', ...)` at module load
// time, so `indexedDB` must exist as *something* non-throwing before that
// import happens. The simulator never reads a saved game back, so this only
// needs to satisfy the shape `signal.ts` calls against - it doesn't need to
// actually persist anything.
function createFakeIndexedDb(): IDBFactory {
  const open = () => {
    const request = new FakeIDBRequest();
    request.result = {
      transaction: () => ({
        objectStore: () => ({
          get: () => {
            const getRequest = new FakeIDBRequest();
            queueMicrotask(() => getRequest.onsuccess?.());
            return getRequest;
          },
          put: () => {
            const putRequest = new FakeIDBRequest();
            queueMicrotask(() => putRequest.onsuccess?.());
            return putRequest;
          },
        }),
      }),
      objectStoreNames: { contains: () => false },
      createObjectStore: () => {},
    };
    queueMicrotask(() => request.onsuccess?.());
    return request;
  };

  return { open } as unknown as IDBFactory;
}

function installHeadlessShims(): void {
  const g = globalThis as unknown as {
    window: unknown;
    localStorage: unknown;
    indexedDB: unknown;
    document: unknown;
  };

  g.window = globalThis;
  g.localStorage = new MemoryStorage();
  g.indexedDB = createFakeIndexedDb();
  // `hidden: true` so `isPageVisible()` (helpers/ui.ts) reads "not visible" -
  // the simulator has no real page, so notifications it would trigger
  // (worldNodeDiscover's "You discovered X!" toast, etc.) should no-op
  // rather than throw `document is not defined`.
  g.document = { hidden: true };
}

// Runs on import so `import './shims'` alone (before any `@helpers` import)
// is sufficient - `state-game.ts` reaches for `indexedDB` as soon as it's
// first imported, so this can't wait for an explicit call from `run.ts`.
installHeadlessShims();

// `updateGamestate` (state-game.ts) yields via `schedulerYield()` (a
// `setTimeout(resolve, 0)` macrotask) before committing when called outside
// a `gamestateTickStart`/`gamestateTickEnd` bracket, and most one-off setup
// mutators (`setParty`, `setupFinish`, etc.) don't return/await that promise
// - so the caller has nothing to await. Call this after such setup calls to
// let the pending write land before reading `gamestate()` again.
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function silenceDebugLogging(): void {
  console.debug = () => {};
}
