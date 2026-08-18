import type { EncounterFight } from '@interfaces/content-encounter';
import type { MonsterId } from '@interfaces/content-monster';
import type { DroppedReward } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { LevelRange } from '@interfaces/level-range';
import type { HasDescription } from '@interfaces/traits';

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
  HasDescription & {
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

    // When true, name/level label and map cursor stay hidden until discovered (see world-node-discovery.ts).
    hidden?: boolean;
  };
