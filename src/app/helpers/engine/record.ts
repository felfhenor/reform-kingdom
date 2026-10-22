export function recordPrune<T extends object>(
  record: T,
  keep: (key: Extract<keyof T, string>) => boolean,
): T {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) =>
      keep(key as Extract<keyof T, string>),
    ),
  ) as T;
}
