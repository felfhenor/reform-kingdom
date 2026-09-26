import { getEntry } from '@helpers/content/content';
import { tradeskillBuildingIn } from '@helpers/crafting/tradeskill';
import { equippedItems } from '@helpers/item/equipment';
import { partyMaxLevel } from '@helpers/item/gathering';
import { townReputationTierForAmount } from '@helpers/town/reputation/town-reputation';
import { characterAllTeachingIds } from '@helpers/trainer/trainer-teaching';
import type {
  EquipmentItem,
  GameState,
  TaskRequirementStateBased,
  TrainerContent,
  TrainerId,
} from '@interfaces';

function partyHasLearnedFromTrainer(
  state: GameState,
  trainerId: TrainerId,
): boolean {
  const trainer = getEntry<TrainerContent>(trainerId);
  if (!trainer) return false;

  return state.world.party.some((character) =>
    characterAllTeachingIds(character).some((teachingId) =>
      trainer.trainerTeachingIds.includes(teachingId),
    ),
  );
}

function ownedEquipmentItems(state: GameState): EquipmentItem[] {
  return [
    ...state.armory,
    ...state.world.party.flatMap((character) =>
      equippedItems(character.equipment),
    ),
  ];
}

function anyEquipmentInfused(state: GameState): boolean {
  return ownedEquipmentItems(state).some((item) =>
    item.infusedItemIds.some((itemId) => !!itemId),
  );
}

// Reads the passed-in state so the load-time retrofit sees the migrated save rather than the live signal.
export function taskStateRequirementSatisfied(
  state: GameState,
  requirement: TaskRequirementStateBased,
): boolean {
  switch (requirement.kind) {
    case 'ReachLevel':
      return partyMaxLevel(state.world.party) >= requirement.level;
    case 'TradeskillLevel':
      return (
        tradeskillBuildingIn(state, requirement.tradeskillId).level >=
        requirement.level
      );
    case 'OwnCollectible':
      return (state.collectibles[requirement.collectibleId]?.quantity ?? 0) > 0;
    case 'LearnTeaching':
      return partyHasLearnedFromTrainer(state, requirement.trainerId);
    case 'RescueWorker':
      return !!state.discoveredWorkers[requirement.workerId];
    case 'DefeatMonster':
      return (
        (state.bestiary[requirement.monsterId]?.kills ?? 0) >=
        requirement.quantity
      );
    case 'ShrineLevel':
      return (
        (state.shrines[requirement.nodeName]?.level ?? 0) >= requirement.level
      );
    case 'TownReputationTier':
      return (
        townReputationTierForAmount(
          state.world.towns[requirement.townId]?.reputation ?? 0,
        ) >= requirement.tier
      );
    case 'VisitTown':
      return (
        state.world.towns[requirement.townId]?.firstVisitedAtTick !== undefined
      );
    case 'InfuseEquipment':
      return anyEquipmentInfused(state);
  }
}
