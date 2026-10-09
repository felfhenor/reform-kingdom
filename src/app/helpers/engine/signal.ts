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

export function localStorageSignal<T>(
  localStorageKey: string,
  initialValue: T,
  onLoad?: (value: T) => void,
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
  writableSignal.set = (value: T) => {
    localStorage.setItem(localStorageKey, localStorageSerialize(value));
    originalSet(value);
  };

  writableSignal.update = (updateFn: (value: T) => T) => {
    const value = updateFn(writableSignal());
    localStorage.setItem(localStorageKey, localStorageSerialize(value));
    originalSet(value);
  };

  return writableSignal;
}

export function indexedDbSignal<T>(
  indexedDbKey: string,
  initialValue: T,
  onLoad?: (value: T) => void,
  onError?: (e: unknown) => void,
  onSaveError?: (e: unknown) => void,
): WritableSignal<T> {
  let isInitialized = false;

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

    idbPut(indexedDbKey, value).catch((e) => {
      error('IndexedDbSignal', 'Failed to save value:', e);
      onSaveError?.(e);
    });
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

  return writableSignal;
}
