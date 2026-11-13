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
  // Unlocks the stats/skills sections and the combat tooltip details.
  analyzed: boolean;
  analyzeKillsRemaining: number;
  kills: number;
  // The actual min/max level the party has fought (killed or analyzed) this monster at; undefined until then.
  levelRange?: LevelRange;
  // Every distinct location this monster has been killed or analyzed at.
  foundAtNodes: string[];
  sourceNodeNames: string[];
  drops: BestiaryDropEntry[];
};
