// A rebuilt array holding the same elements counts as the same value, so writers can rebuild without churning a slice.
export function isSameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((value, i) => value === b[i])
  );
}

export function isUnchanged<T extends object>(draft: T, existing: T): boolean {
  const keys = new Set([...Object.keys(draft), ...Object.keys(existing)]);
  return [...keys].every((key) =>
    isSameValue(draft[key as keyof T], existing[key as keyof T]),
  );
}
