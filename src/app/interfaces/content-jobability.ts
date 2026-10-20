import type { HasSprite } from '@interfaces/artable';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type JobAbilityId = Branded<string, 'JobAbilityId'>;

export type JobAbilityType =
  | 'RestoreHealthOOC'
  | 'RestoreEnergyOOC'
  | 'ShrineDurationBoost'
  | 'CommissionReputationBoost'
  | 'AstralDurationBoost'
  | 'EncounterResetReduction'
  | 'OnPathTravelSpeed'
  | 'Intimidation'
  | 'OffPathTravelSpeed'
  | 'Ambush'
  | 'GatherYieldLuck'
  | 'EquipmentDropRateBoost'
  | 'ItemDropRateBoost'
  | 'SkillRepeatChance'
  | 'CoverThreshold'
  | 'DebuffPotency';

export type JobAbilityContent = IsContentItem &
  HasDescription &
  HasSprite & {
    id: JobAbilityId;

    // Decides what the ability does, which stat it reads and how it stacks across the party.
    type: JobAbilityType;
  };
