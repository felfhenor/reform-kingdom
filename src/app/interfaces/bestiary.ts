import type { MonsterContent } from '@interfaces/content-monster';
import type { DroppedReward } from '@interfaces/droppable';
import type { LevelRange } from '@interfaces/level-range';

export type BestiaryDropEntry = {
  reward: DroppedReward;
  discovered: boolean;
};

export type BestiaryEntry = {
  monster: MonsterContent;
  discovered: boolean;
  kills: number;
  // The actual min/max level the party has fought this monster at -
  // undefined until it's been killed at least once.
  levelRange?: LevelRange;
  // Every distinct location this monster has been killed at.
  foundAtNodes: string[];
  sourceNodeNames: string[];
  drops: BestiaryDropEntry[];
};
