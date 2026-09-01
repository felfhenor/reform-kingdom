import { rngUniform } from '@helpers/rng';

// U^(1/n) samples the same distribution as "max of n uniform rolls" (CDF
// y^n) in one RNG call; n=2 baseline, +1 effective die per 10 Luck.
function mitigationDiceEquivalent(luck: number): number {
  return Math.max(2 + luck / 10, 1);
}

export function combatDamageMitigationRoll(
  ceiling: number,
  luck: number,
): number {
  const diceEquivalent = mitigationDiceEquivalent(luck);
  return ceiling * rngUniform() ** (1 / diceEquivalent);
}

// Mean of U^(1/n) is n/(n+1) - lets analysis tooling report expected
// mitigation without actually rolling.
export function combatDamageMitigationExpectedValue(
  ceiling: number,
  luck: number,
): number {
  const diceEquivalent = mitigationDiceEquivalent(luck);
  return ceiling * (diceEquivalent / (diceEquivalent + 1));
}
