import { describe, expect, it } from 'vitest';
import { omit } from 'es-toolkit';

import { seedContent } from '@/testing/content';
import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { pruneInvalidGlobalEffects } from '@helpers/hero/global-effect-prune';
import type { GlobalEffect, GlobalEffectId } from '@interfaces';

const haste = ensureGlobalEffect({
  id: 'haste' as GlobalEffectId,
  name: 'Haste',
  hideDuration: true,
  effects: [{ effectType: 'GlobalGoldGainMultiplier', value: 10 }],
});

const active = (effect: Partial<GlobalEffect>): GlobalEffect => ({
  ...haste,
  startTick: 0,
  expiresAtTick: 100,
  ...effect,
});

describe('pruneInvalidGlobalEffects', () => {
  it('gives an effect saved without effects the content ones', () => {
    seedContent([haste]);
    const legacy = omit(active({}), ['effects', 'hideDuration']);
    const [pruned] = pruneInvalidGlobalEffects([legacy as GlobalEffect]);

    expect(pruned.effects).toEqual(haste.effects);
    expect(pruned.hideDuration).toBe(haste.hideDuration);
  });

  it('keeps effects already saved, since they may be scaled', () => {
    seedContent([haste]);
    const scaled = [
      { effectType: 'GlobalGoldGainMultiplier' as const, value: 30 },
    ];

    expect(
      pruneInvalidGlobalEffects([active({ effects: scaled })])[0].effects,
    ).toEqual(scaled);
  });

  it('drops effects whose content no longer exists', () => {
    seedContent([haste]);

    expect(
      pruneInvalidGlobalEffects([
        active({}),
        active({ id: 'gone' as GlobalEffectId }),
      ]).map((effect) => effect.id),
    ).toEqual([haste.id]);
  });
});
