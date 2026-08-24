import type { MonsterId } from '@interfaces/content-monster';
import type { DroppedReward } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { LevelRange } from '@interfaces/level-range';
import type { HasDescription } from '@interfaces/traits';
import type { WorldNodeHideable } from '@interfaces/world-nodes';

export type EncounterId = Branded<string, 'EncounterId'>;

export type EncounterFightMonster = {
  monsterId: MonsterId;
};

export type EncounterFight = {
  monsters: EncounterFightMonster[];
};

export type EncounterContent = IsContentItem &
  HasDescription &
  WorldNodeHideable & {
    id: EncounterId;
    __type: 'encounter';

    levelRange: LevelRange;

    fights: EncounterFight[];

    completionRewards: DroppedReward[];
  };
