import type { AstralProjectorId } from '@interfaces/content-astralprojector';
import type { CollectibleId } from '@interfaces/content-collectible';
import type { ItemId } from '@interfaces/content-item';
import type { MonsterId } from '@interfaces/content-monster';
import type { RecipeId } from '@interfaces/content-recipe';
import type { TownId } from '@interfaces/content-town';
import type { TradeskillId } from '@interfaces/content-tradeskill';
import type { TrainerId } from '@interfaces/content-trainer';
import type { WorkerId } from '@interfaces/content-worker';
import type { ItemQuantity } from '@interfaces/cost';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { HasDescription } from '@interfaces/traits';

export type TaskId = Branded<string, 'TaskId'>;

export type TaskRequirementGatherItem = {
  kind: 'GatherItem';
  nodeName: string;
  itemId: ItemId;
  quantity: number;
};

export type TaskRequirementCraftRecipe = {
  kind: 'CraftRecipe';
  recipeId: RecipeId;
  quantity: number;
};

export type TaskRequirementClearEncounter = {
  kind: 'ClearEncounter';
  nodeName: string;
  quantity: number;
};

export type TaskRequirementReachLevel = {
  kind: 'ReachLevel';
  level: number;
};

export type TaskRequirementTradeskillLevel = {
  kind: 'TradeskillLevel';
  tradeskillId: TradeskillId;
  level: number;
};

export type TaskRequirementOwnCollectible = {
  kind: 'OwnCollectible';
  collectibleId: CollectibleId;
};

// Met when any hero, under any job, has learned any teaching this trainer offers.
export type TaskRequirementLearnTeaching = {
  kind: 'LearnTeaching';
  trainerId: TrainerId;
};

export type TaskRequirementRescueWorker = {
  kind: 'RescueWorker';
  workerId: WorkerId;
};

export type TaskRequirementCastAstralSpell = {
  kind: 'CastAstralSpell';
  astralProjectorId: AstralProjectorId;
  quantity: number;
};

// Reads the bestiary's lifetime kill count, so kills from before the task existed still count.
export type TaskRequirementDefeatMonster = {
  kind: 'DefeatMonster';
  monsterId: MonsterId;
  quantity: number;
};

export type TaskRequirementShrineLevel = {
  kind: 'ShrineLevel';
  nodeName: string;
  level: number;
};

export type TaskRequirementTownReputationTier = {
  kind: 'TownReputationTier';
  townId: TownId;
  tier: number;
};

export type TaskRequirementVisitTown = {
  kind: 'VisitTown';
  townId: TownId;
};

export type TaskRequirementInfuseEquipment = {
  kind: 'InfuseEquipment';
};

export type TaskRequirementFulfillCommission = {
  kind: 'FulfillCommission';
  quantity: number;
};

// Progress for these is counted by event hooks rather than read from state.
export type TaskRequirementCounter =
  | TaskRequirementGatherItem
  | TaskRequirementCraftRecipe
  | TaskRequirementClearEncounter
  | TaskRequirementCastAstralSpell
  | TaskRequirementFulfillCommission;

export type TaskRequirementStateBased =
  | TaskRequirementReachLevel
  | TaskRequirementTradeskillLevel
  | TaskRequirementOwnCollectible
  | TaskRequirementLearnTeaching
  | TaskRequirementRescueWorker
  | TaskRequirementDefeatMonster
  | TaskRequirementShrineLevel
  | TaskRequirementTownReputationTier
  | TaskRequirementVisitTown
  | TaskRequirementInfuseEquipment;

export type TaskRequirement =
  TaskRequirementCounter | TaskRequirementStateBased;

export const TaskRequirementCounterKinds: TaskRequirementCounter['kind'][] = [
  'GatherItem',
  'CraftRecipe',
  'ClearEncounter',
  'CastAstralSpell',
  'FulfillCommission',
];

export type TaskContent = IsContentItem &
  HasDescription & {
    id: TaskId;
    __type: 'task';

    // Sort key for the task list; spaced out so new tasks can slot in between.
    order: number;
    requirement: TaskRequirement;
    rewards: ItemQuantity[];
  };
