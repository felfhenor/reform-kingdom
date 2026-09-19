// Spec guardrail: freezing state makes any in-place mutation throw instead of silently breaking reference-equality reactivity.
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }

  return value;
}
