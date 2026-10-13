import type { EncounterFightMonster } from '@interfaces/content-encounter';
import type { EncounterRandomId } from '@interfaces/content-encounter-random';

export type EncounterRandomFight = {
  level: number;
  monsters: EncounterFightMonster[];
};

export type EncounterRandomNodeState = {
  fights: EncounterRandomFight[];
  generatedAtTick: number;
  completedThisCycle: boolean;
  // This cycle's length, fixed when it was generated (EncounterResetReduction shortens it); falls back to the content's resetTime for older saves.
  resetTime?: number;
};

export type GameStateExploreRandom = {
  [key: EncounterRandomId]: EncounterRandomNodeState;
};
