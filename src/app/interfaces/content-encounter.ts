import type { MonsterId } from '@interfaces/content-monster';
import type { DroppedReward } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { LevelRange } from '@interfaces/level-range';
import type { HasDescription, HasMapNodeGating } from '@interfaces/traits';

export type EncounterId = Branded<string, 'EncounterId'>;

export type EncounterFightMonster = {
  monsterId: MonsterId;
};

export type EncounterFight = {
  monsters: EncounterFightMonster[];
};

export type EncounterContent = IsContentItem &
  HasDescription &
  HasMapNodeGating & {
    id: EncounterId;
    __type: 'encounter';

    levelRange: LevelRange;

    fights: EncounterFight[];

    completionRewards: DroppedReward[];

    // Rolled once, ever, per physical node - see
    // world-node-first-time-rewards.ts. Absent/empty means no first-time
    // reward. RP-only by convention (every entry must be a DroppedItemReward
    // pointing at the Insight Crystal item id), enforced by the
    // researchrpgaps validator.
    firstTimeRewards?: DroppedReward[];
  };
