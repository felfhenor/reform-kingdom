import { describe, expect, it } from 'vitest';

import { ensureAstralProjector } from '@helpers/content/ensure-astralprojector';
import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { astralProjectorCast } from '@helpers/kingdom/astral-projector.ui';
import { gamestate } from '@helpers/state-game';
import type { AstralProjectorId, Character, GlobalEffectId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { abilityJobContent, buildAbilityHero } from '@/testing/job-ability';

const now = 100;
const starlight = ensureGlobalEffect({
  id: 'starlight' as GlobalEffectId,
  name: 'Starlight',
});
const starfall = ensureAstralProjector({
  id: 'starfall' as AstralProjectorId,
  name: 'Starfall',
  globalEffectId: starlight.id,
  duration: 100,
});

function castWith(party: Character[]): {
  effectExpiresAt?: number;
  spellExpiresAt?: number;
} {
  seedContent([
    starlight,
    starfall,
    ...abilityJobContent('Magician', [['AstralDurationBoost', 1, 0.25]]),
  ]);
  seedGamestate((state) => {
    state.clock.numTicks = now;
    state.world.party = party;
  });

  inTick(() => astralProjectorCast(starfall.id));

  const state = gamestate();
  return {
    effectExpiresAt: state.globalEffects.find(({ id }) => id === starlight.id)
      ?.expiresAtTick,
    spellExpiresAt: state.activeAstralProjectorSpells.find(
      ({ astralProjectorId }) => astralProjectorId === starfall.id,
    )?.expiresAtTick,
  };
}

describe('astralProjectorCast', () => {
  it('lasts the spell duration without a magician', () => {
    expect(castWith([])).toEqual({
      effectExpiresAt: now + 100,
      spellExpiresAt: now + 100,
    });
  });

  it("stretches both the effect and the spell's expiry by the magician's boost", () => {
    expect(castWith([buildAbilityHero('Magician', 1)])).toEqual({
      effectExpiresAt: now + 125,
      spellExpiresAt: now + 125,
    });
  });
});
