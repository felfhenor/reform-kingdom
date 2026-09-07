import {
  RARITY_PRIORITY,
  type CommissionRequirementEntry,
  type DropRarity,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

export function commissionRarity(
  requirements: CommissionRequirementEntry[],
): DropRarity {
  return sortBy(
    requirements.map((requirement) => {
      return requirement.content?.rarity ?? 'Common';
    }),
    (rarity) => RARITY_PRIORITY[rarity],
  )[0];
}
