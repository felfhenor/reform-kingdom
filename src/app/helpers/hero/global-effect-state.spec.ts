import type { GlobalEffectEffect } from '@interfaces';
import { describe, expect, it } from 'vitest';

import { globalEffectEffectsDescription } from '@helpers/hero/global-effect-state';

describe('globalEffectEffectsDescription', () => {
  it('renders every effect type as a comma-joined "Label: +N[%]" string', () => {
    const effects: GlobalEffectEffect[] = [
      { effectType: 'GainStats', stat: 'Strength', value: 5 },
      { effectType: 'GainCombatStat', combatStat: 'reviveChance', value: 2 },
      { effectType: 'GainCombatStat', combatStat: 'agroValue', value: 3 },
      { effectType: 'GlobalXPGainMultiplier', value: 0.1 },
      { effectType: 'DebuffResistance', value: 10 },
      { effectType: 'DebuffResistanceTag', tag: 'Accuracy', value: 5 },
    ];

    expect(globalEffectEffectsDescription(effects)).toBe(
      'Strength: +5, Revive Chance: +2%, Aggro: +3, XP Gain: +10%, All Debuff Resist: +10%, Accuracy Down Resist: +5%',
    );
  });

  it('returns an empty string for an empty effect list', () => {
    expect(globalEffectEffectsDescription([])).toBe('');
  });
});
