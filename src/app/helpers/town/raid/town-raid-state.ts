import { getEntriesByType, getEntry } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import { gamestate } from '@helpers/state-game';
import { townGuardiansForCurrentReputation } from '@helpers/town/town-guardian';
import type {
  MonsterContent,
  MonsterId,
  TownContent,
  TownDefenseAssaulterConfig,
  TownId,
  TownNodeState,
  TownRaidCombatantRow,
  TownRaidTelegraph,
} from '@interfaces';
import { sample } from 'es-toolkit/compat';

// Undefined = no raid currently pending for this town.
export function townRaidTelegraph(
  townId: TownId,
): TownRaidTelegraph | undefined {
  const state = gamestate().world.towns[townId];
  if (!state?.raidTelegraphedAtTick || !state.raidEngageWindowExpiresAtTick) {
    return undefined;
  }

  return {
    telegraphedAtTick: state.raidTelegraphedAtTick,
    engageWindowExpiresAtTick: state.raidEngageWindowExpiresAtTick,
    assaulterMonsterIds: state.raidTelegraphedAssaulterIds ?? [],
  };
}

export function isTownCraftDebuffActive(state: TownNodeState): boolean {
  return (
    state.craftSpeedDebuffExpiresAtTick !== undefined &&
    state.craftSpeedDebuffExpiresAtTick > timerTicksElapsed()
  );
}

// Undefined once the raid-loss craft debuff has expired (or never applied) - lets callers format their own countdown.
export function townCraftDebuffExpiresAtTick(
  townId: TownId,
): number | undefined {
  const state = gamestate().world.towns[townId];
  if (!state || !isTownCraftDebuffActive(state)) return undefined;

  return state.craftSpeedDebuffExpiresAtTick;
}

// Pure content+state scan, no pathfinding - Decree's nearest-town resolution owns that concern.
export function telegraphedRaidTownIds(): TownId[] {
  return getEntriesByType<TownContent>('town')
    .filter((town) => townRaidTelegraph(town.id) !== undefined)
    .map((town) => town.id);
}

// numMonsters random picks from monsterIds (with replacement).
export function raidAssaulterMonsterIds(
  assaulter: TownDefenseAssaulterConfig,
): MonsterId[] {
  if (assaulter.monsterIds.length === 0) return [];

  return Array.from(
    { length: assaulter.numMonsters },
    () => sample(assaulter.monsterIds) as MonsterId,
  );
}

export function raidAssaulterPreview(
  town: TownContent,
): TownRaidCombatantRow[] {
  const monsterIds = townRaidTelegraph(town.id)?.assaulterMonsterIds ?? [];

  const counts = new Map<MonsterId, number>();
  monsterIds.forEach((monsterId) => {
    counts.set(monsterId, (counts.get(monsterId) ?? 0) + 1);
  });

  return [...counts.entries()]
    .map(([monsterId, quantity]) => {
      const monster = getEntry<MonsterContent>(monsterId);
      return monster ? { monster, quantity } : undefined;
    })
    .filter((row): row is TownRaidCombatantRow => !!row);
}

export function raidDefenderPreview(town: TownContent): TownRaidCombatantRow[] {
  return townGuardiansForCurrentReputation(town)
    .map((entry) => {
      const monster = getEntry<MonsterContent>(entry.monsterId);
      return monster ? { monster, quantity: entry.quantity } : undefined;
    })
    .filter((row): row is TownRaidCombatantRow => !!row);
}
