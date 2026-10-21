import type {
  CollectibleContent,
  CollectibleId,
} from '@interfaces/content-collectible';
import type { JobContent } from '@interfaces/content-job';
import type { EquipmentSkillContent } from '@interfaces/content-skill';
import type { EffectStatSummary } from '@interfaces/equipment-bonus';
import type { TrainerTeachingContent } from '@interfaces/content-trainer-teaching';
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
export type TrainerTeachingRow = EffectStatSummary & {
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
  grantedSkills: EquipmentSkillContent[];
};

// One job's tab in a hero's Teachings list.
export type TrainerTeachingJobTab = {
  job: JobContent;
  learned: number;
  total: number;
};
