import { gamestate, updateGamestate } from '@helpers/state-game';
import type { CommissionRequirement, GameState, MonsterId } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

function hasUnsatisfiedRequirement(
  requirements: CommissionRequirement[],
  monsterId: MonsterId,
): boolean {
  return requirements.some(
    (requirement) =>
      'monsterId' in requirement &&
      requirement.monsterId === monsterId &&
      requirement.progress < requirement.quantity,
  );
}

function hasMatchingKill(state: GameState, monsterId: MonsterId): boolean {
  const caravanMatch = Object.values(state.world.commissions).some(
    (nodeState) =>
      !nodeState.completed &&
      hasUnsatisfiedRequirement(nodeState.requirements, monsterId),
  );
  if (caravanMatch) return true;

  return Object.values(state.world.towns).some((town) =>
    town.commissionSlots.some((slot) =>
      hasUnsatisfiedRequirement(slot.requirements, monsterId),
    ),
  );
}

function incrementProgress(
  requirements: CommissionRequirement[],
  monsterId: MonsterId,
  count: number,
): void {
  requirements.forEach((requirement) => {
    if (!('monsterId' in requirement) || requirement.monsterId !== monsterId) {
      return;
    }

    requirement.progress = clamp(
      requirement.progress + count,
      0,
      requirement.quantity,
    );
  });
}

// Kill-quest commissions can be rolled by either system, so both need updating.
function incrementKillProgress(
  state: GameState,
  monsterId: MonsterId,
  count: number,
): void {
  Object.values(state.world.commissions).forEach((nodeState) => {
    if (nodeState.completed) return;
    incrementProgress(nodeState.requirements, monsterId, count);
  });

  Object.values(state.world.towns).forEach((town) => {
    town.commissionSlots.forEach((slot) =>
      incrementProgress(slot.requirements, monsterId, count),
    );
  });
}

// Skips updateGamestate unless a commission actually needs this kill - called on every combat victory in the game.
export function commissionRecordMonsterKill(
  monsterId: MonsterId,
  count = 1,
): void {
  if (!hasMatchingKill(gamestate(), monsterId)) return;

  updateGamestate((state) => {
    incrementKillProgress(state, monsterId, count);
    return state;
  });
}
