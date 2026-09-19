export function dictionaryWith<T extends object, K extends keyof T>(
  dictionary: T,
  key: K,
  value: T[K],
): T {
  return { ...dictionary, [key]: value };
}

export function dictionaryWithout<T extends object>(
  dictionary: T,
  key: keyof T,
): T {
  if (!(key in dictionary)) return dictionary;

  const copy = { ...dictionary };
  delete copy[key];

  return copy;
}
