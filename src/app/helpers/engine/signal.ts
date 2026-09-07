import type { WritableSignal } from '@angular/core';
import { signal } from '@angular/core';
import { error } from '@helpers/engine/logging';

export function localStorageSignal<T>(
  localStorageKey: string,
  initialValue: T,
  onLoad?: (value: T) => void,
): WritableSignal<T> {
  const storedValueRaw = localStorage.getItem(localStorageKey);
  if (storedValueRaw) {
    try {
      initialValue = JSON.parse(storedValueRaw);
      onLoad?.(initialValue);
    } catch {
      error(
        'LocalStorageSignal',
        'Failed to parse stored value for key:',
        localStorageKey,
      );
    }
  } else {
    localStorage.setItem(localStorageKey, JSON.stringify(initialValue));
  }

  const writableSignal = signal(initialValue);

  const originalSet = writableSignal.set;
  writableSignal.set = (value: T) => {
    localStorage.setItem(localStorageKey, JSON.stringify(value));
    originalSet(value);
  };

  writableSignal.update = (updateFn: (value: T) => T) => {
    const value = updateFn(writableSignal());
    localStorage.setItem(localStorageKey, JSON.stringify(value));
    originalSet(value);
  };

  return writableSignal;
}

export function indexedDbSignal<T>(
  indexedDbKey: string,
  initialValue: T,
  onLoad?: (value: T) => void,
): WritableSignal<T> {
  const DB_NAME = 'gamestorage';
  const STORE_NAME = 'gamestate';
  const DB_VERSION = 1;

  let db: IDBDatabase | null = null;
  let isInitialized = false;

  const writableSignal = signal(initialValue);

  const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      if (db) {
        resolve(db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        error('IndexedDbSignal', 'Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };
    });
  };

  const loadFromDB = async (): Promise<void> => {
    // Not an error - just no IndexedDB in this environment (e.g. scripts/analyze-*, scripts/validate-*).
    if (typeof indexedDB === 'undefined') {
      isInitialized = true;
      return;
    }

    try {
      const database = await initDB();
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(indexedDbKey);

      return new Promise((resolve) => {
        request.onsuccess = () => {
          if (request.result !== undefined) {
            try {
              const loadedValue = request.result;
              writableSignal.set(loadedValue);
              onLoad?.(loadedValue);
            } catch {
              error(
                'IndexedDbSignal',
                'Failed to parse stored value for key:',
                indexedDbKey,
              );
            }
          } else {
            saveToDBSync(initialValue);
          }

          onLoad?.(initialValue);
          isInitialized = true;
          resolve();
        };

        request.onerror = () => {
          error(
            'IndexedDbSignal',
            'Failed to load value for key:',
            indexedDbKey,
            request.error,
          );
          isInitialized = true;
          resolve();
        };
      });
    } catch (e) {
      error('IndexedDbSignal', 'Failed to initialize database:', e);
      isInitialized = true;
    }
  };

  const saveToDBSync = (value: T): void => {
    if (!isInitialized || typeof indexedDB === 'undefined') return;

    saveToDB(value).catch((e) => {
      error('IndexedDbSignal', 'Failed to save value:', e);
    });
  };

  const saveToDB = async (value: T): Promise<void> => {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, indexedDbKey);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };

  const originalSet = writableSignal.set;
  writableSignal.set = (value: T) => {
    originalSet(value);
    saveToDBSync(value);
  };

  writableSignal.update = (updateFn: (value: T) => T) => {
    const value = updateFn(writableSignal());
    originalSet(value);
    saveToDBSync(value);
  };

  loadFromDB();

  return writableSignal;
}
