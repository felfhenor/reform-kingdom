import type { EncounterFight } from '@interfaces/content-encounter';
import type { MonsterId } from '@interfaces/content-monster';
import type { DroppedReward } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { LevelRange } from '@interfaces/level-range';
import type { HasDescription, HasMapNodeGating } from '@interfaces/traits';

export type EncounterRandomId = Branded<string, 'EncounterRandomId'>;

export type EncounterRandomEncounterRange = {
  min: number;
  max: number;
};

export type EncounterRandomCombatantRange = {
  min: number;
  max: number;
};

export type EncounterRandomPoolMonster = {
  monsterId: MonsterId;
  weight: number;
};

export type EncounterRandomContent = IsContentItem &
  HasDescription &
  HasMapNodeGating & {
    id: EncounterRandomId;
    __type: 'encounterrandom';

    // Ticks between regenerations of this node's fights.
    resetTime: number;

    levelRange: LevelRange;
    encounterRange: EncounterRandomEncounterRange;
    combatantRange: EncounterRandomCombatantRange;

    creaturePool: EncounterRandomPoolMonster[];

    // Always empty as-authored; fights are rolled at runtime (see generateEncounterRandomFights) and stored in game state.
    fights: EncounterFight[];

    completionRewards: DroppedReward[];

    // Rolled once, ever, per physical node - see
    // world-node-first-time-rewards.ts. Absent/empty means no first-time
    // reward. RP-only by convention, enforced by the researchrpgaps
    // validator.
    firstTimeRewards?: DroppedReward[];
  };
