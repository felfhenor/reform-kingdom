import type { WritableSignal } from '@angular/core';
import { signal } from '@angular/core';
import {
  SAVEFILE_READ_ATTEMPTS,
  SAVEFILE_RETRY_DELAY_MS,
} from '@helpers/config';
import { idbGet, idbIsAvailable, idbPut } from '@helpers/engine/idb';
import { error } from '@helpers/engine/logging';
import { delay } from 'es-toolkit';

// JSON.stringify(undefined) is undefined, which setItem would coerce to an unparseable "undefined".
function localStorageSerialize<T>(value: T): string {
  return value === undefined ? '' : JSON.stringify(value);
}

function localStorageDeserialize<T>(raw: string): T {
  // "undefined" is a legacy value written before empty-string serialization.
  return raw === '' || raw === 'undefined'
    ? (undefined as T)
    : (JSON.parse(raw) as T);
}

// Persists a value that changes often (e.g. many times a tick) at most once per delay; pending writes flush when the page is hidden or unloaded.
function deferredLocalStorageWriter<T>(
  localStorageKey: string,
  delayMs: number,
  read: () => T,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    localStorage.setItem(localStorageKey, localStorageSerialize(read()));
  };

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flush();
    });
  }

  return () => {
    if (timer !== undefined) return;
    timer = setTimeout(flush, delayMs);
  };
}

export function localStorageSignal<T>(
  localStorageKey: string,
  initialValue: T,
  onLoad?: (value: T) => void,
  options?: { persistDelayMs?: number },
): WritableSignal<T> {
  const storedValueRaw = localStorage.getItem(localStorageKey);
  if (storedValueRaw !== null) {
    try {
      initialValue = localStorageDeserialize<T>(storedValueRaw);
      onLoad?.(initialValue);
    } catch {
      error(
        'LocalStorageSignal',
        'Failed to parse stored value for key:',
        localStorageKey,
      );
    }
  } else {
    localStorage.setItem(localStorageKey, localStorageSerialize(initialValue));
  }

  const writableSignal = signal(initialValue);
  const originalSet = writableSignal.set;

  const persistDelayMs = options?.persistDelayMs ?? 0;
  const schedulePersist =
    persistDelayMs > 0
      ? deferredLocalStorageWriter(
          localStorageKey,
          persistDelayMs,
          writableSignal,
        )
      : undefined;

  writableSignal.set = (value: T) => {
    if (schedulePersist) {
      originalSet(value);
      schedulePersist();
      return;
    }

    localStorage.setItem(localStorageKey, localStorageSerialize(value));
    originalSet(value);
  };

  writableSignal.update = (updateFn: (value: T) => T) => {
    writableSignal.set(updateFn(writableSignal()));
  };

  return writableSignal;
}

export function indexedDbSignal<T>(
  indexedDbKey: string,
  initialValue: T,
  onLoad?: (value: T) => void,
  onError?: (e: unknown) => void,
  onSaveError?: (e: unknown) => void,
): WritableSignal<T> & { flush: () => Promise<boolean> } {
  let isInitialized = false;
  // IndexedDB commits writes in order, so the newest one landing means every earlier one has too.
  let pendingWrite: Promise<boolean> = Promise.resolve(true);

  const writableSignal = signal(initialValue);
  const originalSet = writableSignal.set;

  const readWithRetry = async (): Promise<T | undefined> => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await idbGet<T>(indexedDbKey);
      } catch (e) {
        error('IndexedDbSignal', `Load attempt ${attempt} failed:`, e);
        if (attempt >= SAVEFILE_READ_ATTEMPTS) throw e;
        await delay(SAVEFILE_RETRY_DELAY_MS);
      }
    }
  };

  const loadFromDB = async (): Promise<void> => {
    // Not an error - just no IndexedDB in this environment (e.g. scripts/analyze-*, scripts/validate-*).
    if (!idbIsAvailable()) {
      isInitialized = true;
      return;
    }

    try {
      const loadedValue = await readWithRetry();
      if (loadedValue !== undefined) originalSet(loadedValue);
      isInitialized = true;
      onLoad?.(loadedValue ?? initialValue);
    } catch (e) {
      isInitialized = true;
      onError?.(e);
    }
  };

  const saveToDBSync = (value: T): void => {
    if (!isInitialized || !idbIsAvailable()) return;

    pendingWrite = idbPut(indexedDbKey, value).then(
      () => true,
      (e: unknown) => {
        error('IndexedDbSignal', 'Failed to save value:', e);
        onSaveError?.(e);
        return false;
      },
    );
  };

  writableSignal.set = (value: T) => {
    originalSet(value);
    saveToDBSync(value);
  };

  writableSignal.update = (updateFn: (value: T) => T) => {
    const value = updateFn(writableSignal());
    originalSet(value);
    saveToDBSync(value);
  };

  void loadFromDB();

  return Object.assign(writableSignal, { flush: () => pendingWrite });
}
