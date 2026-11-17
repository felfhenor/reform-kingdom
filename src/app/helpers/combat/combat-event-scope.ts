import type { CombatEventScope } from '@interfaces';

const WORLD_SCOPE: CombatEventScope = { keyPrefix: '', muted: false };

// Only ever set for a synchronous stretch, so real fights stepping between sim chunks keep their own events.
let current = WORLD_SCOPE;

export function combatEventKey(combatantId: string): string {
  return current.keyPrefix + combatantId;
}

export function combatEventsMuted(): boolean {
  return current.muted;
}

export function combatEventScopeRun<T>(
  scope: CombatEventScope,
  fn: () => T,
): T {
  const previous = current;
  current = scope;
  try {
    return fn();
  } finally {
    current = previous;
  }
}
