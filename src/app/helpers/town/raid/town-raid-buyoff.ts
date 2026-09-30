import { spendCommissionRequirements } from '@helpers/commission/commission-turn-in';
import { goldCoinId } from '@helpers/item/materials';
import { worldTownsState } from '@helpers/state-game';
import { raidTelegraphClear } from '@helpers/town/raid/town-raid-defense';
import type {
  CommissionRequirement,
  GameState,
  TownContent,
  TownId,
  TownRaidBuyoffKind,
} from '@interfaces';

function raidTributeCost(
  town: TownContent,
  assaulterCount: number,
): CommissionRequirement[] {
  const gold = Math.ceil(
    town.defense.buyoff.tributeGoldScalar *
      assaulterCount *
      town.defense.assaulter.level.max,
  );

  return gold > 0 ? [{ itemId: goldCoinId(), quantity: gold }] : [];
}

function raidFortifyCost(
  town: TownContent,
  assaulterCount: number,
): CommissionRequirement[] {
  return town.defense.buyoff.fortifyMaterials
    .map((material) => ({
      itemId: material.itemId,
      quantity: Math.ceil(material.quantityPerAssaulter * assaulterCount),
    }))
    .filter((requirement) => requirement.quantity > 0);
}

// Scaled off the assaulters actually telegraphed; empty when no raid is pending or the town offers no such option.
export function raidBuyoffCost(
  town: TownContent,
  kind: TownRaidBuyoffKind,
  state?: GameState,
): CommissionRequirement[] {
  const towns = state ? state.world.towns : worldTownsState();
  const assaulterCount =
    towns[town.id]?.raidTelegraphedAssaulterIds?.length ?? 0;
  if (assaulterCount === 0) return [];

  return kind === 'Tribute'
    ? raidTributeCost(town, assaulterCount)
    : raidFortifyCost(town, assaulterCount);
}

// Starts the normal raid cooldown, but skips the loss penalties.
export function applyRaidBuyoff(
  state: GameState,
  townId: TownId,
  cost: CommissionRequirement[],
  currentTick: number,
): void {
  const target = state.world.towns[townId];
  if (!target) return;

  spendCommissionRequirements(state, cost);
  target.lastRaidResolvedAtTick = currentTick;
  raidTelegraphClear(state, townId, currentTick);
}
