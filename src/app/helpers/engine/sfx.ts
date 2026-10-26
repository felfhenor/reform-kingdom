import { GAME_SFX_MIN_INTERVAL_MS } from '@helpers/config';
import { isPageVisible } from '@helpers/engine/page-visibility';
import type { SFX } from '@interfaces';
import { Subject } from 'rxjs';

const sfx = new Subject<{
  sfx: SFX;
  rate: number;
}>();
export const sfx$ = sfx.asObservable();

const lastGameSFXAt: Partial<Record<SFX, number>> = {};

export function playSFX(sfxName: SFX, shiftIndex: number): void {
  sfx.next({ sfx: sfxName, rate: shiftIndex * 25 });
}

export function playGameSFX(sfxName: SFX): void {
  if (!isPageVisible()) return;

  const now = Date.now();
  if (now - (lastGameSFXAt[sfxName] ?? 0) < GAME_SFX_MIN_INTERVAL_MS) return;

  lastGameSFXAt[sfxName] = now;
  playSFX(sfxName, 0);
}
