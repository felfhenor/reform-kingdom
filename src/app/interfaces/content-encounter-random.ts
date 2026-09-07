import type { EncounterFight } from '@interfaces/content-encounter';
import type { MonsterId } from '@interfaces/content-monster';
import type { DroppedReward } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { LevelRange } from '@interfaces/level-range';
import type { HasDescription } from '@interfaces/traits';
import type { WorldNodeHideable } from '@interfaces/world-nodes';

export type EncounterRandomId = Branded<string, 'EncounterRandomId'>;

export type EncounterRandomPoolMonster = {
  monsterId: MonsterId;
  weight: number;
};

export type EncounterRandomContent = IsContentItem &
  HasDescription &
  WorldNodeHideable & {
    id: EncounterRandomId;
    __type: 'encounterrandom';

    // Ticks between regenerations of this node's fights.
    resetTime: number;

    levelRange: LevelRange;
    encounterRange: LevelRange;
    combatantRange: LevelRange;

    creaturePool: EncounterRandomPoolMonster[];

    fights: EncounterFight[];

    completionRewards: DroppedReward[];
  };
