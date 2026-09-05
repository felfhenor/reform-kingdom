import { gamestate, updateGamestate } from '@helpers/state-game';
import type { CommissionNodeState, GameState, MonsterId } from '@interfaces';
import { clamp } from 'es-toolkit/compat';

function hasUnsatisfiedKillRequirement(
  nodeState: CommissionNodeState,
  monsterId: MonsterId,
): boolean {
  if (nodeState.completed) return false;

  return nodeState.requirements.some(
    (requirement) =>
      'monsterId' in requirement &&
      requirement.monsterId === monsterId &&
      requirement.progress < requirement.quantity,
  );
}

function incrementKillProgress(
  state: GameState,
  monsterId: MonsterId,
  count: number,
): void {
  Object.values(state.world.commissions).forEach((nodeState) => {
    if (nodeState.completed) return;

    nodeState.requirements.forEach((requirement) => {
      if (!('monsterId' in requirement) || requirement.monsterId !== monsterId) {
        return;
      }

      requirement.progress = clamp(
        requirement.progress + count,
        0,
        requirement.quantity,
      );
    });
  });
}

// Skips updateGamestate unless a commission actually needs this kill - called on every combat victory in the game.
export function commissionRecordMonsterKill(
  monsterId: MonsterId,
  count = 1,
): void {
  const hasMatch = Object.values(gamestate().world.commissions).some(
    (nodeState) => hasUnsatisfiedKillRequirement(nodeState, monsterId),
  );
  if (!hasMatch) return;

  updateGamestate((state) => {
    incrementKillProgress(state, monsterId, count);
    return state;
  });
}
