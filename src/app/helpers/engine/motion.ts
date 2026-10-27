import { computed, signal } from '@angular/core';
import { getOption } from '@helpers/state-options';

const systemPrefersReducedMotion = signal(false);
export const isMotionReducedBySystem = systemPrefersReducedMotion.asReadonly();

export function motionSystemPreferenceSet(prefersReduced: boolean): void {
  systemPrefersReducedMotion.set(prefersReduced);
}

// Options from before this key existed are undefined until the migration merges defaults in.
export const isMotionReduced = computed(() => {
  const preference = getOption('motionPreference') ?? 'system';
  return preference === 'system'
    ? systemPrefersReducedMotion()
    : preference === 'reduced';
});
