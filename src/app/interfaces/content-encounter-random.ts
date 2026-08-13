import type { EncounterFight } from '@interfaces/content-encounter';
import type { MonsterId } from '@interfaces/content-monster';
import type { DroppedReward } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type EncounterRandomId = Branded<string, 'EncounterRandomId'>;

export type EncounterRandomLevelRange = {
  min: number;
  max: number;
};

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

    levelRange: EncounterRandomLevelRange;
    encounterRange: EncounterRandomEncounterRange;
    combatantRange: EncounterRandomCombatantRange;

    creaturePool: EncounterRandomPoolMonster[];

    // Always empty as-authored - the actual fights are rolled at runtime
    // (see `generateEncounterRandomFights`) and stored in game state, not
    // here. Kept on the content type for schema/shape parity with
    // `EncounterContent`.
    fights: EncounterFight[];

    completionRewards: DroppedReward[];

    // When true, the node's name/level label and map cursor stay hidden
    // until the player discovers it (see `world-node-discovery.ts`).
    hidden?: boolean;
  };
