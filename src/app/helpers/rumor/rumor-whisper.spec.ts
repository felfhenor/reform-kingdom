import { describe, expect, it } from 'vitest';

import { combatLog } from '@helpers/combat/combat-log';
import { ensureRumor } from '@helpers/content/ensure-rumor';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import { rumorWhisper } from '@helpers/rumor/rumor-whisper';
import type { CollectibleId, RumorId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const relicId = 'relic' as CollectibleId;
const rumor = ensureRumor({
  id: 'relic-rumor' as RumorId,
  name: 'Relic Rumor',
  description: 'Dig under the old oak.',
  subject: { kind: 'Collectible', collectibleId: relicId },
});

describe('rumorWhisper', () => {
  it('logs a hearable rumor as a Founder whisper', () => {
    seedContent([rumor]);
    seedGamestate();

    rumorWhisper();

    expect(combatLog()[0].message).toContain(
      'The Founder whispers: "Dig under the old oak."',
    );
  });

  it('stays silent once nothing is left to hint at', () => {
    seedContent([rumor]);
    seedGamestate((state) => applyCollectibleGrant(state, relicId, 1));

    rumorWhisper();

    expect(combatLog()).toHaveLength(0);
  });
});
