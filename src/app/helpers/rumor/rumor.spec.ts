import { describe, expect, it } from 'vitest';

import { ensureGathering } from '@helpers/content/ensure-gathernode';
import { ensureRegion } from '@helpers/content/ensure-region';
import { ensureCollectible } from '@helpers/content/ensure-item';
import { ensureRumor } from '@helpers/content/ensure-rumor';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import {
  isRumorHearable,
  isRumorRevealed,
  isRumorSubjectFound,
  rumorPickHearable,
  rumorRevealNodeName,
  rumorsHearable,
  rumorTeaser,
} from '@helpers/rumor/rumor';
import type {
  CollectibleId,
  GatheringId,
  JobId,
  RegionId,
  RumorContent,
  RumorId,
  TrainerTeachingId,
} from '@interfaces';
import { buildCharacter } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const relic = ensureCollectible({
  id: 'relic' as CollectibleId,
  name: 'Relic',
});
const hiddenGlade = ensureGathering({
  id: 'glade' as GatheringId,
  name: 'Hidden Glade',
  hidden: true,
});
const gatedGrove = ensureGathering({
  id: 'grove' as GatheringId,
  name: 'Gated Grove',
  invisibleUntilCollectibleIdsFound: [relic.id],
});
const luck = 'luck' as TrainerTeachingId;

const gladeRumor = ensureRumor({
  id: 'glade-rumor' as RumorId,
  name: 'Glade Rumor',
  description: 'Look east.',
  subject: { kind: 'Node', nodeName: hiddenGlade.name },
});
const groveRumor = ensureRumor({
  id: 'grove-rumor' as RumorId,
  name: 'Grove Rumor',
  subject: { kind: 'Node', nodeName: gatedGrove.name },
});
const relicRumor = ensureRumor({
  id: 'relic-rumor' as RumorId,
  name: 'Relic Rumor',
  subject: { kind: 'Collectible', collectibleId: relic.id },
  requireMapVisit: 'FarMap',
});
const luckRumor = ensureRumor({
  id: 'luck-rumor' as RumorId,
  name: 'Luck Rumor',
  subject: { kind: 'TrainerTeaching', trainerTeachingId: luck },
});

function seedWorld(rumors: RumorContent[] = []): void {
  seedContent([relic, hiddenGlade, gatedGrove, ...rumors]);
  seedWorldNodes([
    { name: hiddenGlade.name, type: 'GatherNode' },
    { name: gatedGrove.name, type: 'GatherNode' },
  ]);
}

describe('isRumorSubjectFound', () => {
  it('finds a hidden node once discovered', () => {
    seedWorld();
    seedGamestate();
    expect(isRumorSubjectFound(gladeRumor.subject)).toBe(false);

    seedGamestate((state) => {
      state.worldDiscoveries[hiddenGlade.name] = { foundAt: 1 };
    });
    expect(isRumorSubjectFound(gladeRumor.subject)).toBe(true);
  });

  it('finds a gated node once its collectible is owned', () => {
    seedWorld();
    seedGamestate();
    expect(isRumorSubjectFound(groveRumor.subject)).toBe(false);

    seedGamestate((state) => applyCollectibleGrant(state, relic.id, 1));
    expect(isRumorSubjectFound(groveRumor.subject)).toBe(true);
    expect(isRumorSubjectFound(relicRumor.subject)).toBe(true);
  });

  it('finds a teaching once any hero has learned it under any job', () => {
    seedWorld();
    seedGamestate((state) => (state.world.party = [buildCharacter()]));
    expect(isRumorSubjectFound(luckRumor.subject)).toBe(false);

    seedGamestate((state) => {
      state.world.party = [
        buildCharacter(),
        buildCharacter({ teachings: { ['other-job' as JobId]: [luck] } }),
      ];
    });
    expect(isRumorSubjectFound(luckRumor.subject)).toBe(true);
  });

  it('never finds a node that is not on any map', () => {
    seedWorld();
    seedGamestate();
    expect(isRumorSubjectFound({ kind: 'Node', nodeName: 'Nowhere' })).toBe(
      false,
    );
  });
});

describe('isRumorHearable', () => {
  it('waits for the required map to be visited', () => {
    seedWorld();
    seedGamestate();
    expect(isRumorHearable(relicRumor)).toBe(false);

    seedGamestate((state) => (state.discoveredMaps['FarMap'] = { foundAt: 1 }));
    expect(isRumorHearable(relicRumor)).toBe(true);
  });

  it('stays hearable after being heard, until its subject is found', () => {
    seedWorld([gladeRumor]);
    seedGamestate();
    expect(rumorPickHearable()).toBe(gladeRumor);
    expect(rumorPickHearable()).toBe(gladeRumor);

    seedGamestate((state) => {
      state.worldDiscoveries[hiddenGlade.name] = { foundAt: 1 };
    });
    expect(isRumorHearable(gladeRumor)).toBe(false);
  });
});

describe('rumorPickHearable', () => {
  it('picks nothing once every subject is found', () => {
    seedWorld([gladeRumor, groveRumor]);
    seedGamestate();
    expect(rumorsHearable()).toEqual([gladeRumor, groveRumor]);

    seedGamestate((state) => {
      state.worldDiscoveries[hiddenGlade.name] = { foundAt: 1 };
      applyCollectibleGrant(state, relic.id, 1);
    });
    expect(rumorPickHearable()).toBeUndefined();
  });
});

describe('rumor reveals', () => {
  it('names the node only for a Node rumor', () => {
    seedWorld([gladeRumor, relicRumor]);
    expect(rumorRevealNodeName(gladeRumor.id)).toBe(hiddenGlade.name);
    expect(rumorRevealNodeName(relicRumor.id)).toBeUndefined();
  });

  it('treats a missing rumor as already revealed', () => {
    seedWorld([gladeRumor]);
    seedGamestate();
    expect(isRumorRevealed(gladeRumor.id)).toBe(false);
    expect(isRumorRevealed('gone' as RumorId)).toBe(true);
  });
});

describe('rumorTeaser', () => {
  it('names the region to search without giving the hint away', () => {
    seedContent([
      ensureRegion({
        id: 'far' as RegionId,
        name: 'Far Reaches',
        mapName: 'FarMap',
      }),
    ]);

    expect(rumorTeaser(relicRumor)).toBe(
      'Word of something hidden in Far Reaches.',
    );
    expect(rumorTeaser(gladeRumor)).toBe('Word of something hidden.');
  });
});
