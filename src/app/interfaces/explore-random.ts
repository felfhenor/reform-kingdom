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
};

export type GameStateExploreRandom = {
  [key: EncounterRandomId]: EncounterRandomNodeState;
};
