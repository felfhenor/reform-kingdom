import type { CombatOrderClause } from '@interfaces/combat-order';
import type { JobId } from '@interfaces/content-job';
import type { EquipmentBlock } from '@interfaces/equipment';
import type { Branded } from '@interfaces/identifiable';
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

  hp: number;
  ep: number;
  stats: StatBlock;

  equipment: EquipmentBlock;
};
