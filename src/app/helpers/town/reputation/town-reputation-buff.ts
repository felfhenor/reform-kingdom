import { getEntriesByType, getEntry } from '@helpers/content/content';
import { timerTicksElapsed } from '@helpers/engine/timer';
import {
  applyGlobalEffectRemove,
  globalEffectEffectsDescription,
} from '@helpers/hero/global-effect-state';
import { updateGamestate } from '@helpers/state-game';
import { townReputationTierForAmount } from '@helpers/town/reputation/town-reputation';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  GlobalEffect,
  GlobalEffectContent,
  GlobalEffectEffect,
  TownContent,
  TownReputationBuffTier,
} from '@interfaces';

// Indefinite (~100 years of ticks) - removed explicitly on leaving the town's map, not by expiry. Avoids overflow from adding Number.MAX_SAFE_INTEGER to an already-large currentTick.
const REGIONAL_BUFF_DURATION_TICKS = 60 * 60 * 24 * 365 * 100;

// Flattens a tier's authored stat blocks into GlobalEffectEffect entries, skipping un-authored (zero) values.
export function townReputationBuffEffects(
  tier: TownReputationBuffTier,
): GlobalEffectEffect[] {
  const effects: GlobalEffectEffect[] = [];

  (Object.keys(tier.stats) as (keyof typeof tier.stats)[]).forEach((stat) => {
    if (tier.stats[stat] === 0) return;
    effects.push({ effectType: 'GainStats', stat, value: tier.stats[stat] });
  });

  (Object.keys(tier.combatStats) as (keyof typeof tier.combatStats)[]).forEach(
    (combatStat) => {
      if (tier.combatStats[combatStat] === 0) return;
      effects.push({
        effectType: 'GainCombatStat',
        combatStat,
        value: tier.combatStats[combatStat],
      });
    },
  );

  (
    Object.keys(
      tier.debuffResistances,
    ) as (keyof typeof tier.debuffResistances)[]
  ).forEach((tag) => {
    if (tier.debuffResistances[tag] === 0) return;
    effects.push({
      effectType: 'DebuffResistanceTag',
      tag,
      value: tier.debuffResistances[tag],
    });
  });

  return effects;
}

// Real, authored content (id/name/sprite/description) - only `effects` is computed per-tier at runtime.
function townReputationBuffEffect(
  town: TownContent,
  tier: TownReputationBuffTier,
  currentTick: number,
): GlobalEffect | undefined {
  const content = getEntry<GlobalEffectContent>(
    town.reputation.buff.globalEffectId,
  );
  if (!content) return undefined;

  const effects = townReputationBuffEffects(tier);

  return {
    ...content,
    effects,
    extendedDescription: globalEffectEffectsDescription(effects),
    startTick: currentTick,
    expiresAtTick: currentTick + REGIONAL_BUFF_DURATION_TICKS,
  };
}

// Regional, not per-tile: a town's buff is active while the party is anywhere on the
// same map its node sits on.
export function townReputationBuffSync(
  previousMapName: string,
  currentMapName: string,
): void {
  if (previousMapName === currentMapName) return;

  const towns = getEntriesByType<TownContent>('town');
  const currentTick = timerTicksElapsed();

  updateGamestate((state) => {
    towns.forEach((town) => {
      const buffId = town.reputation.buff.globalEffectId;
      applyGlobalEffectRemove(state, buffId);

      const node = worldNodeByName(town.name);
      if (!node || node.mapName !== currentMapName) return;

      const reputation = state.world.towns[town.id]?.reputation ?? 0;
      const tier = townReputationTierForAmount(reputation);
      const tierConfig = town.reputation.buff.tiers.find(
        (t) => t.tier === tier,
      );
      const effect = tierConfig
        ? townReputationBuffEffect(town, tierConfig, currentTick)
        : undefined;
      if (effect) state.globalEffects.push(effect);
    });

    return state;
  });
}

// Re-derives every town's buff from scratch against `currentMapName` - used on game load,
// where currentLocationSet (the normal sync hook) never runs.
export function townReputationBuffReconcile(currentMapName: string): void {
  townReputationBuffSync('', currentMapName);
}
