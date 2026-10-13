import { describe, expect, it } from 'vitest';

import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import {
  ensureShrine,
  ensureShrineLevel,
} from '@helpers/content/ensure-shrine';
import { shrinePray } from '@helpers/world-node/world-node-shrine.ui';
import { globalEffectsState } from '@helpers/state-game';
import type { Character, GlobalEffectId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { abilityJobContent, buildAbilityHero } from '@/testing/job-ability';
import { locationOf, seedWorldNodes } from '@/testing/world';

const node = "Founder's Shrine";
const wisdom = ensureGlobalEffect({
  id: 'wisdom' as GlobalEffectId,
  name: 'Wisdom',
  isShrineBuff: true,
});
const shrine = ensureShrine({
  name: node,
  levels: [
    ensureShrineLevel({ globalEffectId: wisdom.id, globalEffectDuration: 100 }),
  ],
});

function prayWith(party: Character[]): number | undefined {
  seedContent([
    wisdom,
    shrine,
    ...abilityJobContent('Healer', [['ShrineDurationBoost', 1, 0.25]]),
  ]);
  const entries = seedWorldNodes([{ name: node, type: 'Shrine' }]);
  seedGamestate((state) => {
    state.world.party = party;
    state.world.currentLocation = locationOf(entries[node]);
    state.shrines[node] = { level: 1 };
  });

  inTick(() => shrinePray(node));

  return globalEffectsState().find(({ id }) => id === wisdom.id)?.expiresAtTick;
}

describe('shrinePray', () => {
  it('lasts the tier duration without a healer', () => {
    expect(prayWith([])).toBe(100);
  });

  it("stretches the buff by the healer's boost", () => {
    expect(prayWith([buildAbilityHero('Healer', 1)])).toBe(125);
  });
});
