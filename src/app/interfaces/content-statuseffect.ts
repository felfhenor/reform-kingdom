import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';

export type StatusEffectId = Branded<string, 'StatusEffectId'>;

export type StatusEffectContent = IsContentItem & {
  id: StatusEffectId;
  __type: 'statuseffect';
};

export type StatusEffect = StatusEffectContent & {
  duration: number;

  creatorStats: StatBlock;
  targetStats: StatBlock;
};
