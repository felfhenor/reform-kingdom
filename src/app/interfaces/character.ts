import type { Branded } from '@interfaces/identifiable';
import type { JobId } from '@interfaces/content-job';
import type { TraitId } from '@interfaces/content-trait';
import type { EquipmentBlock } from '@interfaces/equipment';
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

  hp: number;
  ep: number;
  stats: StatBlock;

  equipment: EquipmentBlock;

  traitIds: TraitId[];
}
