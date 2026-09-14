import type { TownStockEntry } from '@interfaces/town-state';

// Pre-computed display state for one stock row - keeps helper-call derivations out of the component.
export type TownStockRow = {
  index: number;
  entry: TownStockEntry;
  price?: number;
  // A town's shop stock is always single rolled equipment instances - "can I afford one", not a quantity range.
  affordable: boolean;
  // Pre-formatted time left before this entry cycles out - undefined when the town has expiration disabled.
  expiresIn?: string;
};
