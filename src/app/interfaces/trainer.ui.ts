import type { CombatStatBlock } from '@interfaces/combat';
import type {
  CollectibleContent,
  CollectibleId,
} from '@interfaces/content-collectible';
import type { JobContent } from '@interfaces/content-job';
import type { EquipmentSkillContent } from '@interfaces/content-skill';
import type { StatusEffectBlock } from '@interfaces/content-statuseffect';
import type { TrainerTeachingContent } from '@interfaces/content-trainer-teaching';
import type { StatBlock } from '@interfaces/stat';
import type { TrainerTeachingAvailability } from '@interfaces/trainer';

export type TrainerTeachingCollectibleRequirement = {
  collectibleId: CollectibleId;
  content?: CollectibleContent;
  owned: boolean;
};

export type TrainerTeachingPrerequisite = {
  name: string;
  learned: boolean;
};

// One teaching as seen by one hero, shared by the trainer's Visit modal and the hero's Teachings list.
export type TrainerTeachingRow = {
  teaching: TrainerTeachingContent;
  // '???' until learned, or until its trainer is visited and its collectibles are owned.
  displayName: string;
  isRevealed: boolean;
  // '???' until the teaching's trainer has been visited.
  trainerDisplayName: string;
  availability: TrainerTeachingAvailability;
  isLearned: boolean;
  meetsLevel: boolean;
  hasCollectibles: boolean;
  canAfford: boolean;
  collectibles: TrainerTeachingCollectibleRequirement[];
  prerequisites: TrainerTeachingPrerequisite[];
  stats: StatBlock;
  combatStats: CombatStatBlock;
  resistances: StatusEffectBlock;
  grantedSkills: EquipmentSkillContent[];
};

// One job's tab in a hero's Teachings list.
export type TrainerTeachingJobTab = {
  job: JobContent;
  learned: number;
  total: number;
};
