import { mapValues } from 'es-toolkit/compat';
import { isDraft } from 'immer';

export function dictionaryWith<T extends object, K extends keyof T>(
  dictionary: T,
  key: K,
  value: T[K],
): T {
  // Mutates a draft argument in place (and returns it) - spreading one would create a proxy per entry.
  if (isDraft(dictionary)) {
    dictionary[key] = value;
    return dictionary;
  }

  return { ...dictionary, [key]: value };
}

// Returns the same dictionary when every mapped value keeps its reference, so an all-no-op update doesn't change the dict.
export function dictionaryMapValues<K extends string, V>(
  dictionary: Record<K, V>,
  fn: (value: V) => V,
): Record<K, V> {
  const keys = Object.keys(dictionary) as K[];
  const mapped = mapValues(dictionary, fn) as Record<K, V>;

  return keys.some((key) => mapped[key] !== dictionary[key])
    ? mapped
    : dictionary;
}

export function dictionaryWithout<T extends object>(
  dictionary: T,
  key: keyof T,
): T {
  if (!(key in dictionary)) return dictionary;

  if (isDraft(dictionary)) {
    delete dictionary[key];
    return dictionary;
  }

  const copy = { ...dictionary };
  delete copy[key];

  return copy;
}
