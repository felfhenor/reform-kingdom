import type { JobId } from '@interfaces/content-job';
import type { TraitId } from '@interfaces/content-trait';
import type { EquipmentBlock } from '@interfaces/equipment';
import type { StatBlock } from '@interfaces/stat';

export type Character = {
  name: string;
  level: number;
  xp: {
    current: number;
    maximum: number;
  };

  jobId: JobId;

  stats: StatBlock;

  equipment: EquipmentBlock;

  traitIds: TraitId[];
}
