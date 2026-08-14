import type { MonsterId } from '@interfaces/content-monster';
import type { DroppedReward } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { LevelRange } from '@interfaces/level-range';
import type { HasDescription } from '@interfaces/traits';

export type EncounterId = Branded<string, 'EncounterId'>;

export type EncounterFightMonster = {
  monsterId: MonsterId;
};

export type EncounterFight = {
  monsters: EncounterFightMonster[];
};

export type EncounterContent = IsContentItem &
  HasDescription & {
    id: EncounterId;
    __type: 'encounter';

    levelRange: LevelRange;

    fights: EncounterFight[];

    completionRewards: DroppedReward[];

    // When true, the node's name/level label and map cursor stay hidden
    // until the player discovers it (see `world-node-discovery.ts`).
    hidden?: boolean;
  };
