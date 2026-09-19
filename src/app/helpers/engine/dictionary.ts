export function dictionaryWithout<T extends object>(
  dictionary: T,
  key: keyof T,
): T {
  if (!(key in dictionary)) return dictionary;

  const copy = { ...dictionary };
  delete copy[key];

  return copy;
}
