const DB_NAME = 'gamestorage';
const STORE_NAME = 'gamestate';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | undefined;

export function idbIsAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function idbOpen(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
  });

  // A failed open is retried on the next call instead of being cached forever.
  dbPromise.catch(() => (dbPromise = undefined));

  return dbPromise;
}

function idbRequest<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return idbOpen().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction([STORE_NAME], mode);
        const request = run(transaction.objectStore(STORE_NAME));

        // Resolving on transaction completion (not request success) means the write is durable.
        transaction.oncomplete = () => resolve(request.result as T);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      }),
  );
}

export function idbGet<T>(key: string): Promise<T | undefined> {
  return idbRequest<T | undefined>('readonly', (store) => store.get(key));
}

export async function idbPut<T>(key: string, value: T): Promise<void> {
  await idbRequest('readwrite', (store) => store.put(value, key));
}
