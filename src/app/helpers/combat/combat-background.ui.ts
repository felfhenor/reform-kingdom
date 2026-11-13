import { environment } from '@environments/environment';
import { getEntry } from '@helpers/content/content';
import type {
  Combat,
  CombatBackground,
  EncounterContent,
  EncounterRandomContent,
  HasCombatBackground,
  TownContent,
} from '@interfaces';
import { COMBAT_BACKGROUNDS } from '@interfaces';

// Production ships the webps built by `npm run build:combatbg`.
export function combatBackgroundURL(background: CombatBackground): string {
  return environment.production
    ? `art/combatbg/${background}.webp`
    : `asset/combatbg/${background}.png`;
}

export function combatBackgroundURLs(): string[] {
  return COMBAT_BACKGROUNDS.map(combatBackgroundURL);
}

export function combatBackgroundSource(
  combat: Combat,
): HasCombatBackground | undefined {
  return (
    getEntry<EncounterContent>(combat.encounterId ?? '') ??
    getEntry<EncounterRandomContent>(combat.encounterRandomId ?? '') ??
    getEntry<TownContent>(combat.raidTownId ?? '')
  );
}
