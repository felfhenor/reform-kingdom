import { defaultHeroRunStats } from '@helpers/defaults';
import type {
  CharacterId,
  Combat,
  Combatant,
  GameState,
  HeroRunStats,
  RunStatsHit,
} from '@interfaces';
import { maxBy } from 'es-toolkit/compat';

// Collected during a round and committed with it, so a round that throws and replays is never counted twice.
let pending: Partial<Record<CharacterId, HeroRunStats>> = {};

export function runStatsCombatBegin(): void {
  pending = {};
}

function partyHeroId(
  combat: Combat,
  combatant: Combatant,
): CharacterId | undefined {
  const isHero = combat.heroes.some((hero) => hero.id === combatant.id);
  return isHero && !combatant.summonerId
    ? (combatant.id as CharacterId)
    : undefined;
}

// A hero's summon acts for its owner; enemies, enemy summons and town guardians credit nobody.
export function runStatsCreditHeroId(
  combat: Combat,
  combatant: Combatant,
): CharacterId | undefined {
  const ownId = partyHeroId(combat, combatant);
  if (ownId || !combatant.summonerId) return ownId;

  const owner = combat.heroes.find((hero) => hero.id === combatant.summonerId);
  return owner ? partyHeroId(combat, owner) : undefined;
}

function bump(
  heroId: CharacterId | undefined,
  edit: (stats: HeroRunStats) => void,
): void {
  if (!heroId) return;
  edit((pending[heroId] ??= defaultHeroRunStats()));
}

function recordDamageDealt(
  heroId: CharacterId | undefined,
  target: Combatant,
  hit: RunStatsHit,
): void {
  const { hpDelta, died } = hit.change;
  if (hpDelta <= 0 || !target.isEnemy) return;

  bump(heroId, (stats) => {
    stats.damageDealt += hpDelta;
    if (hit.isCriticalHit) stats.crits += 1;
    if (died && !target.summonerId) stats.kills += 1;
    if (hit.skillFamily && hpDelta > (stats.biggestHit?.amount ?? 0)) {
      stats.biggestHit = { amount: hpDelta, skillFamily: hit.skillFamily };
    }
  });
}

function recordDamageReceived(
  heroId: CharacterId | undefined,
  hit: RunStatsHit,
): void {
  const { hpDelta, absorbed, died } = hit.change;
  bump(heroId, (stats) => {
    if (hpDelta > 0) stats.damageTaken += hpDelta;
    stats.damageBlocked += absorbed + (hit.prevented ?? 0);
    if (died) stats.deaths += 1;
  });
}

export function runStatsRecordHit(
  combat: Combat,
  source: Combatant | undefined,
  target: Combatant,
  hit: RunStatsHit,
): void {
  const creditId =
    hit.creditHeroId ??
    (source ? runStatsCreditHeroId(combat, source) : undefined);

  recordDamageDealt(creditId, target, hit);
  if (hit.change.hpDelta < 0) {
    bump(creditId, (stats) => (stats.healing += -hit.change.hpDelta));
  }
  recordDamageReceived(partyHeroId(combat, target), hit);
}

export function runStatsRecordSkillUse(
  combat: Combat,
  combatant: Combatant,
  skillFamily: string,
): void {
  bump(runStatsCreditHeroId(combat, combatant), (stats) => {
    stats.skillUses[skillFamily] = (stats.skillUses[skillFamily] ?? 0) + 1;
  });
}

export function runStatsRecordStatusApplied(
  combat: Combat,
  caster: Combatant,
): void {
  bump(runStatsCreditHeroId(combat, caster), (stats) => {
    stats.statusEffectsApplied += 1;
  });
}

const HERO_COUNTERS = [
  'kills',
  'damageDealt',
  'damageTaken',
  'deaths',
  'healing',
  'crits',
  'statusEffectsApplied',
  'damageBlocked',
  'fights',
] as const;

// Counts add up and the biggest hit keeps the larger of the two; neither input is changed.
export function runStatsMergeHero(
  into: HeroRunStats,
  from: HeroRunStats,
): HeroRunStats {
  const merged: HeroRunStats = { ...into, skillUses: { ...into.skillUses } };
  HERO_COUNTERS.forEach((key) => (merged[key] += from[key]));
  Object.entries(from.skillUses).forEach(([family, uses]) => {
    merged.skillUses[family] = (merged.skillUses[family] ?? 0) + uses;
  });
  merged.biggestHit = maxBy(
    [into.biggestHit, from.biggestHit].filter((hit) => !!hit),
    (hit) => hit.amount,
  );
  return merged;
}

export function runStatsCombatFlush(state: GameState): void {
  (Object.keys(pending) as CharacterId[]).forEach((heroId) => {
    const stats = pending[heroId];
    if (!stats) return;

    state.runStats.heroes[heroId] = runStatsMergeHero(
      state.runStats.heroes[heroId] ?? defaultHeroRunStats(),
      stats,
    );
  });
  pending = {};
}
