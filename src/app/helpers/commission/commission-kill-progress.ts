import { dictionaryMapValues } from '@helpers/engine/dictionary';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  CommissionNodeState,
  CommissionRequirement,
  GameState,
  MonsterId,
  TownNodeState,
} from '@interfaces';
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

function requirementWithKillProgress(
  requirement: CommissionRequirement,
  monsterId: MonsterId,
  count: number,
): CommissionRequirement {
  if (!('monsterId' in requirement) || requirement.monsterId !== monsterId) {
    return requirement;
  }

  const progress = clamp(requirement.progress + count, 0, requirement.quantity);
  return progress === requirement.progress
    ? requirement
    : { ...requirement, progress };
}

// Returns the same array when no requirement changes, so untouched commissions keep their references.
function requirementsWithKillProgress(
  requirements: CommissionRequirement[],
  monsterId: MonsterId,
  count: number,
): CommissionRequirement[] {
  const updated = requirements.map((requirement) =>
    requirementWithKillProgress(requirement, monsterId, count),
  );

  return updated.some((requirement, i) => requirement !== requirements[i])
    ? updated
    : requirements;
}

function commissionNodeWithKillProgress(
  nodeState: CommissionNodeState,
  monsterId: MonsterId,
  count: number,
): CommissionNodeState {
  if (nodeState.completed) return nodeState;

  const requirements = requirementsWithKillProgress(
    nodeState.requirements,
    monsterId,
    count,
  );
  return requirements === nodeState.requirements
    ? nodeState
    : { ...nodeState, requirements };
}

function townNodeWithKillProgress(
  town: TownNodeState,
  monsterId: MonsterId,
  count: number,
): TownNodeState {
  const commissionSlots = town.commissionSlots.map((slot) => {
    const requirements = requirementsWithKillProgress(
      slot.requirements,
      monsterId,
      count,
    );
    return requirements === slot.requirements
      ? slot
      : { ...slot, requirements };
  });

  return commissionSlots.some((slot, i) => slot !== town.commissionSlots[i])
    ? { ...town, commissionSlots }
    : town;
}

// Kill-quest commissions can be rolled by either system, so both need updating.
function incrementKillProgress(
  state: GameState,
  monsterId: MonsterId,
  count: number,
): void {
  state.world.commissions = dictionaryMapValues(
    state.world.commissions,
    (nodeState) => commissionNodeWithKillProgress(nodeState, monsterId, count),
  );
  state.world.towns = dictionaryMapValues(state.world.towns, (town) =>
    townNodeWithKillProgress(town, monsterId, count),
  );
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
