import type { TownId } from '@interfaces/content-town';

// Each subsystem gates off its own key here, not a single shared tick field, so a fast one can't starve a slow one's due-check.
export type TownTickSubsystem = 'worker' | 'craft' | 'raid' | 'quest';

export type TownNodeState = {
  // Undefined = not yet activated (crafting/workers/commissions stay inert until the player first visits).
  firstVisitedAtTick?: number;
  lastProcessedTick: Partial<Record<TownTickSubsystem, number>>;
};

export type GameStateTowns = {
  [key: TownId]: TownNodeState;
};
