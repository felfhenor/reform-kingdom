import type { FFRect } from '@ff/interfaces/ff-input';
import { getEntry } from '@helpers/content/content';
import { error } from '@helpers/engine/logging';
import { legacy } from '@helpers/legacy/legacy';
import type { AchievementContent, WindowWithSteamBridge } from '@interfaces';

function steamBridge() {
  return (window as WindowWithSteamBridge).reformElectron;
}

export async function steamAchievementsActivate(
  names: string[],
): Promise<string[]> {
  return (await steamBridge()?.steamAchievementsActivate?.(names)) ?? [];
}

export async function steamInputType(): Promise<string | undefined> {
  return await steamBridge()?.steamInputType?.();
}

export function steamCanShowKeyboard(): boolean {
  return !!steamBridge()?.steamShowKeyboard;
}

// Steam positions the keyboard in device pixels, so CSS px are scaled by zoom and DPI.
export async function steamShowKeyboard(field: FFRect): Promise<boolean> {
  const scale = window.devicePixelRatio;
  return (
    (await steamBridge()?.steamShowKeyboard?.(
      field.left * scale,
      field.top * scale,
      (field.right - field.left) * scale,
      (field.bottom - field.top) * scale,
    )) ?? false
  );
}

export async function steamAchievementClear(name: string): Promise<boolean> {
  return (await steamBridge()?.steamAchievementClear?.(name)) ?? false;
}

// Re-sends every unlock, so ones earned while Steam was closed (or in the browser) catch up.
export function steamAchievementsSync(): void {
  const names = Object.keys(legacy().achievements ?? {})
    .map((id) => getEntry<AchievementContent>(id)?.steamId ?? '')
    .filter((name) => name !== '');
  if (names.length === 0) return;

  steamAchievementsActivate(names).catch((e) =>
    error('Steam', 'Could not sync achievements:', e),
  );
}
