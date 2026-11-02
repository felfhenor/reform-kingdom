import type { RemembranceCategory } from '@interfaces/remembrance';

export type RemembranceRow = RemembranceCategory & {
  percent: number;
  isComplete: boolean;
};
