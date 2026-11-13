import type { MonsterId } from '@interfaces/content-monster';
import type { HasCombatBackground } from '@interfaces/combat-background';
import type { DroppedReward } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { LevelRange } from '@interfaces/level-range';
import type { HasDescription } from '@interfaces/traits';
import type { WorldNodeHideable } from '@interfaces/world-nodes';

export type EncounterId = Branded<string, 'EncounterId'>;

export type EncounterFightMonster = {
  monsterId: MonsterId;
};

export type EncounterFight = {
  monsters: EncounterFightMonster[];
  // The Founder's whisper, logged when this fight is won; empty for none.
  postFightWhisper?: string;
  // Seconds before the next fight starts.
  postFightDelay?: number;
};

export type EncounterContent = IsContentItem &
  HasDescription &
  WorldNodeHideable &
  HasCombatBackground & {
    id: EncounterId;
    __type: 'encounter';

    levelRange: LevelRange;

    fights: EncounterFight[];

    completionRewards: DroppedReward[];
  };
