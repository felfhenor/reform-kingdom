import type { MonsterId } from '@interfaces/content-monster';
import type { DropHasChance, DropItem, DropRange } from '@interfaces/droppable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type EncounterId = Branded<string, 'EncounterId'>;

export type EncounterLevelRange = {
  min: number;
  max: number;
};

export type EncounterFightMonster = {
  monsterId: MonsterId;
};

export type EncounterFight = {
  monsters: EncounterFightMonster[];
};

export type EncounterFinishReward = DropRange & DropItem & DropHasChance;

export type EncounterContent = IsContentItem &
  HasDescription & {
    id: EncounterId;
    __type: 'encounter';

    levelRange: EncounterLevelRange;

    fights: EncounterFight[];

    completionRewards: EncounterFinishReward[];
  };
