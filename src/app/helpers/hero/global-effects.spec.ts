import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/town/reputation/town-reputation-buff');

import { combatLog } from '@helpers/combat/combat-log';
import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import { ensureOutpost } from '@helpers/content/ensure-outpost';
import { healingTicksForLevel } from '@helpers/hero/character-progress';
import { applyGlobalEffectAdd } from '@helpers/hero/global-effect-state';
import {
  activeGlobalEffects,
  addGlobalEffect,
  globalEffectDurationLabel,
  globalEffectsProcessTick,
  isGlobalEffectActive,
  removeGlobalEffect,
} from '@helpers/hero/global-effects';
import {
  globalEffectsState,
  worldCurrentLocationState,
  worldPartyState,
} from '@helpers/state-game';
import { townReputationBuffSync } from '@helpers/town/reputation/town-reputation-buff';
import { outpostDeathPenaltyMultiplier } from '@helpers/world-node/world-node-outpost';
import type {
  GameState,
  GlobalEffect,
  GlobalEffectId,
  OutpostId,
} from '@interfaces';
import { buildCharacter } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { locationOf, seedWorldNodes } from '@/testing/world';

const healing = ensureGlobalEffect({
  id: 'healing-1' as GlobalEffectId,
  name: 'Healing',
});
const deathsDoor = ensureGlobalEffect({
  id: 'deaths-door-1' as GlobalEffectId,
  name: 'Deaths Door',
});
const blessing = ensureGlobalEffect({
  id: 'blessing' as GlobalEffectId,
  name: 'Blessing',
});
const outpost = ensureOutpost({
  id: 'carrina-outpost' as OutpostId,
  name: 'Carrina Outpost',
});
const now = 100;

function seedEffects(
  effects: { id: GlobalEffectId; expiresAtTick: number }[],
  edit: (state: GameState) => void = () => undefined,
): void {
  seedGamestate((state) => {
    effects.forEach(({ id, expiresAtTick }) =>
      applyGlobalEffectAdd(state, id, expiresAtTick, 0),
    );
    state.clock.numTicks = now;
    edit(state);
  });
}

function effectIds(): GlobalEffectId[] {
  return globalEffectsState().map((effect) => effect.id);
}

function grantedHealingTicks(): number | undefined {
  const effect = globalEffectsState().find(({ id }) => id === healing.id);
  return effect ? effect.expiresAtTick - effect.startTick : undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  seedContent([healing, deathsDoor, blessing, outpost]);
});

describe('activeGlobalEffects / isGlobalEffectActive', () => {
  it('only counts effects that have not yet expired', () => {
    seedEffects([
      { id: healing.id, expiresAtTick: now + 1 },
      { id: blessing.id, expiresAtTick: now },
    ]);

    expect(activeGlobalEffects().map(({ id }) => id)).toEqual([healing.id]);
    expect(isGlobalEffectActive(healing.id)).toBe(true);
    expect(isGlobalEffectActive(blessing.id)).toBe(false);
  });

  it('resolves the effect by name, and is never active for unknown content', () => {
    seedEffects([{ id: healing.id, expiresAtTick: now + 1 }]);

    expect(isGlobalEffectActive('Healing' as GlobalEffectId)).toBe(true);
    expect(isGlobalEffectActive('Unknown' as GlobalEffectId)).toBe(false);
  });
});

describe('addGlobalEffect / removeGlobalEffect', () => {
  it('starts the effect now for the given duration, by id', () => {
    seedEffects([]);

    inTick(() => addGlobalEffect('Healing' as GlobalEffectId, 30));

    expect(globalEffectsState()).toEqual([
      expect.objectContaining({
        id: healing.id,
        startTick: now,
        expiresAtTick: now + 30,
      }),
    ]);
  });

  it('adds nothing for unknown content', () => {
    seedEffects([]);

    inTick(() => addGlobalEffect('Unknown' as GlobalEffectId, 30));

    expect(globalEffectsState()).toEqual([]);
  });

  it('removes only the matching effect', () => {
    seedEffects([
      { id: healing.id, expiresAtTick: now + 1 },
      { id: blessing.id, expiresAtTick: now + 1 },
    ]);

    inTick(() => removeGlobalEffect(healing.id));

    expect(effectIds()).toEqual([blessing.id]);
  });
});

describe('globalEffectsProcessTick', () => {
  const tick = () => inTick(globalEffectsProcessTick);

  it('sweeps out expired effects, leaving active ones', () => {
    seedEffects([
      { id: blessing.id, expiresAtTick: now },
      { id: healing.id, expiresAtTick: now + 1 },
    ]);

    tick();

    expect(effectIds()).toEqual([healing.id]);
  });

  it('heals the party to full once Healing expires', () => {
    const hero = buildCharacter({ name: 'Ada' });
    seedEffects([{ id: healing.id, expiresAtTick: now }], (state) => {
      state.world.party = [{ ...hero, hp: 0, ep: 0 }];
    });

    tick();

    expect(worldPartyState()[0]).toMatchObject({
      hp: hero.stats.Health,
      ep: hero.stats.Energy,
    });
    expect(effectIds()).toEqual([]);
    expect(combatLog()[0].message).toContain('finished healing');
  });

  describe('when Deaths Door expires', () => {
    function seedDeath(edit: (state: GameState) => void = () => undefined) {
      seedEffects([{ id: deathsDoor.id, expiresAtTick: now }], (state) => {
        state.world.party = [buildCharacter({ level: 12 })];
        state.world.currentLocation = { mapName: 'CraggledMire', x: 3, y: 3 };
        edit(state);
      });
    }

    it('recalls the party to the Duchy by default and starts Healing there', () => {
      const { Duchy } = seedWorldNodes([
        { name: 'Duchy', type: 'Kingdom', mapName: 'Carrina', x: 24, y: 24 },
      ]);
      seedDeath();

      tick();

      expect(worldCurrentLocationState()).toEqual(locationOf(Duchy));
      expect(townReputationBuffSync).toHaveBeenCalledWith(
        'CraggledMire',
        'Carrina',
      );
      expect(effectIds()).toEqual([healing.id]);
      expect(grantedHealingTicks()).toBe(
        healingTicksForLevel(worldPartyState()),
      );
    });

    it('recalls to a developed home outpost, which shortens the Healing', () => {
      const nodes = seedWorldNodes([
        { name: 'Duchy', type: 'Kingdom', x: 1 },
        { name: outpost.name, type: 'Outpost', mapName: 'Carrina', x: 2 },
      ]);
      seedDeath((state) => {
        state.world.homeNodeName = outpost.name;
        state.outposts[outpost.name] = { level: 2 };
      });
      const multiplier = outpostDeathPenaltyMultiplier(outpost.name);

      tick();

      expect(multiplier).toBeLessThan(1);
      expect(worldCurrentLocationState()).toEqual(
        locationOf(nodes[outpost.name]),
      );
      expect(grantedHealingTicks()).toBe(
        Math.ceil(healingTicksForLevel(worldPartyState()) * multiplier),
      );
    });

    it('still starts Healing in place when there is no home at all', () => {
      seedWorldNodes([]);
      seedDeath();

      tick();

      expect(worldCurrentLocationState().mapName).toBe('CraggledMire');
      expect(townReputationBuffSync).not.toHaveBeenCalled();
      expect(grantedHealingTicks()).toBe(
        healingTicksForLevel(worldPartyState()),
      );
    });
  });
});

describe('globalEffectDurationLabel', () => {
  const endingIn = (ticks: number): GlobalEffect => ({
    ...healing,
    startTick: 0,
    expiresAtTick: now + ticks,
  });

  it('shows the time left in the largest whole unit, never negative', () => {
    seedEffects([]);

    expect(globalEffectDurationLabel(endingIn(30))).toBe('30s');
    expect(globalEffectDurationLabel(endingIn(60))).toBe('1m');
    expect(globalEffectDurationLabel(endingIn(900))).toBe('15m');
    expect(globalEffectDurationLabel(endingIn(3600))).toBe('1h');
    expect(globalEffectDurationLabel(endingIn(-50))).toBe('0s');
  });
});
