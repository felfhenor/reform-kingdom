import { t } from '@helpers/i18n/i18n';
import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import type { CombatId } from '@interfaces';

export function founderWhisperLog(text: string, combatId?: CombatId): void {
  miscellaneousMessageLog(
    t('founderWhisper.theFounderWhispers', { text }),
    combatId,
  );
}
