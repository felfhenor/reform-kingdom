import type { CombatOrderClause } from '@interfaces/combat-order';
import type { JobId } from '@interfaces/content-job';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type { SkillTreeNodeId } from '@interfaces/content-skilltreenode';
import type { TrainerTeachingId } from '@interfaces/content-trainer-teaching';
import type { EquipmentBlock } from '@interfaces/equipment';
import type { HeroEffect } from '@interfaces/hero-effect';
import type { Branded } from '@interfaces/identifiable';
import type { RegaliaId } from '@interfaces/regalia';
import type { StatBlock } from '@interfaces/stat';

export type CharacterId = Branded<string, 'CharacterId'>;

export type JobProgress = {
  level: number;
  xp: {
    current: number;
    maximum: number;
  };
};

export type Character = {
  id: CharacterId;
  name: string;
  level: number;
  xp: {
    current: number;
    maximum: number;
  };

  jobId: JobId;
  // Level/xp snapshots for jobs other than the current one, keyed by job id,
  // so reclassing back to a previously-held job restores its progress.
  jobProgress: Partial<Record<JobId, JobProgress>>;
  // Combat Orders rule lists, keyed by job id, so switching jobs and back
  // restores the orders configured for that job.
  combatOrders: Partial<Record<JobId, CombatOrderClause[]>>;
  // Trainer teachings, bought once per job; every job's teachings apply regardless of the current job.
  teachings: Partial<Record<JobId, TrainerTeachingId[]>>;
  // Learned skill tree nodes per job; an oath stores its chosen option.
  skillTreeNodes: Partial<Record<JobId, SkillTreeNodeId[]>>;
  // The job's treeVersion each tree was built against; an older one resets to the defaults on load.
  skillTreeVersions: Partial<Record<JobId, number>>;
  // Chosen special skills, keyed by job id; a specific skill rather than a family so any learned tier can be picked.
  burstSkills: Partial<Record<JobId, EquipmentSkillId[]>>;
  // The regalia last loaded for each job, re-equipped when reclassing back into that job.
  currentRegaliaIds: Partial<Record<JobId, RegaliaId>>;
  // Granted by debug helpers to try effects before any content grants them.
  debugEffects?: HeroEffect[];

  hp: number;
  ep: number;
  stats: StatBlock;

  equipment: EquipmentBlock;
};

// Everything a hero's stats and skills are derived from - spread over a hero to preview a change, e.g. `{ ...character, level }`.
export type CharacterStatSource = Pick<
  Character,
  | 'jobId'
  | 'level'
  | 'equipment'
  | 'teachings'
  | 'skillTreeNodes'
  | 'debugEffects'
>;

export type CharacterXpGain = {
  characterId: CharacterId;
  xp: number;
  leveledUp: boolean;
};

// One hero's chosen new job, as batched by the reclass modal so a multi-hero
// "Reclass All" applies (and prices) every swap within a single state update.
export type CharacterReclassPick = {
  characterId: CharacterId;
  jobId: JobId;
};
