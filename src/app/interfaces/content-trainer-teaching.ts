import type {
  AffixEffectCombatStat,
  AffixEffectGrantSkill,
  AffixEffectResistance,
  AffixEffectStat,
} from '@interfaces/content-affix';
import type { CollectibleId } from '@interfaces/content-collectible';
import type { JobId } from '@interfaces/content-job';
import type { CostItem } from '@interfaces/cost';
import type { Branded, IsContentItem } from '@interfaces/identifiable';

export type TrainerTeachingId = Branded<string, 'TrainerTeachingId'>;

// Same effect shapes as affixes, so gear and training bonuses fold through the same bonus dimensions.
export type TrainerTeachingEffect =
  | AffixEffectStat
  | AffixEffectCombatStat
  | AffixEffectResistance
  | AffixEffectGrantSkill;

export const TrainerTeachingEffectKinds: TrainerTeachingEffect['kind'][] = [
  'Stat',
  'CombatStat',
  'Resistance',
  'GrantSkill',
];

export type TrainerTeachingContent = IsContentItem & {
  id: TrainerTeachingId;
  __type: 'trainerteaching';

  effects: TrainerTeachingEffect[];
  requiredLevel: number;
  costs: CostItem[];

  // Learnable once per hero per listed job; the bonus applies whatever job the hero is.
  jobIds: JobId[];
  requiredCollectibleIds: CollectibleId[];
  // Must already be learned by the same hero for the same job.
  requiredTrainerTeachingIds: TrainerTeachingId[];
};
