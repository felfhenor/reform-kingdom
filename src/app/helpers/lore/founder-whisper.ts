import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import type { CombatId } from '@interfaces';

export function founderWhisperLog(text: string, combatId?: CombatId): void {
  miscellaneousMessageLog(`*The Founder whispers: "${text}"*`, combatId);
}
