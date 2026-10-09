import { beforeEach, describe, expect, it } from 'vitest';

import { combatLog } from '@helpers/combat/combat-log';
import { MAX_ACTIVE_ASTRAL_PROJECTOR_SPELLS } from '@helpers/config';
import { ensureAstralProjector } from '@helpers/content/ensure-astralprojector';
import { applyCollectibleGrant } from '@helpers/item/collectibles';
import { applyMaterialDelta } from '@helpers/item/materials';
import {
  astralProjectorProcessTick,
  astralProjectorSpellToBeOverwritten,
  isAstralProjectorCastable,
  pruneInvalidActiveAstralProjectorSpells,
} from '@helpers/kingdom/astral-projector';
import { gamestate } from '@helpers/state-game';
import type {
  AstralProjectorId,
  CollectibleId,
  GameState,
  GameStateActiveAstralProjectorSpell,
  ItemId,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { captureNotifications } from '@/testing/notify';

const orbId = 'star-orb' as CollectibleId;
const dustId = 'star-dust' as ItemId;
const now = 100;

const starfall = ensureAstralProjector({
  id: 'starfall' as AstralProjectorId,
  name: 'Starfall',
  requiredCollectibles: [{ collectibleId: orbId }],
  requiredMaterials: [{ itemId: dustId, quantity: 5 }],
});
const moonrise = ensureAstralProjector({
  id: 'moonrise' as AstralProjectorId,
  name: 'Moonrise',
});

function cast(
  astralProjectorId: AstralProjectorId,
  startedAtTick: number,
  expiresAtTick = startedAtTick + 60,
): GameStateActiveAstralProjectorSpell {
  return { astralProjectorId, startedAtTick, expiresAtTick };
}

function seed(edit: (state: GameState) => void = () => undefined): void {
  seedGamestate((state) => {
    state.clock.numTicks = now;
    edit(state);
  });
}

const tick = () => inTick(astralProjectorProcessTick);

function logMessages(): string[] {
  return combatLog().map((entry) => entry.message);
}

beforeEach(() => {
  seedContent([starfall, moonrise]);
});

describe('isAstralProjectorCastable', () => {
  it('needs every required collectible found and enough of every material', () => {
    seed((state) => applyMaterialDelta(state, dustId, 5));
    expect(isAstralProjectorCastable(starfall)).toBe(false);

    seed((state) => {
      applyCollectibleGrant(state, orbId, 1);
      applyMaterialDelta(state, dustId, 4);
    });
    expect(isAstralProjectorCastable(starfall)).toBe(false);

    seed((state) => {
      applyCollectibleGrant(state, orbId, 1);
      applyMaterialDelta(state, dustId, 5);
    });
    expect(isAstralProjectorCastable(starfall)).toBe(true);
  });

  it('is castable with no requirements at all', () => {
    seed();

    expect(isAstralProjectorCastable(moonrise)).toBe(true);
  });
});

describe('astralProjectorSpellToBeOverwritten', () => {
  const others = Array.from(
    { length: MAX_ACTIVE_ASTRAL_PROJECTOR_SPELLS - 1 },
    (_, i) => cast(`other-${i}` as AstralProjectorId, 10 + i),
  );

  it('names the oldest active spell once every slot is taken by others', () => {
    seed((state) => {
      state.activeAstralProjectorSpells = [...others, cast(starfall.id, 0)];
    });

    expect(astralProjectorSpellToBeOverwritten(moonrise.id)).toEqual(starfall);
  });

  it('evicts nothing while a slot is free, or when recasting the oldest spell', () => {
    seed((state) => (state.activeAstralProjectorSpells = others.slice(1)));
    expect(astralProjectorSpellToBeOverwritten(moonrise.id)).toBeUndefined();

    seed((state) => {
      state.activeAstralProjectorSpells = [...others, cast(starfall.id, 0)];
    });
    expect(astralProjectorSpellToBeOverwritten(starfall.id)).toBeUndefined();
  });
});

describe('astralProjectorProcessTick', () => {
  it('unlocks a spell once its collectibles are found, announcing it only once', () => {
    seed();
    const notifications = captureNotifications();

    tick();
    expect(gamestate().discoveredAstralProjectorSpells).toEqual({
      [moonrise.id]: { foundAt: expect.any(Number) },
    });

    seed((state) => {
      applyCollectibleGrant(state, orbId, 1);
      state.discoveredAstralProjectorSpells[moonrise.id] = { foundAt: 1 };
    });
    tick();
    tick();

    expect(
      gamestate().discoveredAstralProjectorSpells[starfall.id],
    ).toBeDefined();
    expect(notifications.map((n) => n.message)).toEqual([
      expect.stringContaining('Moonrise'),
      expect.stringContaining('Starfall'),
    ]);
  });

  it('fades out spells once they reach their expiry, logging it', () => {
    seed((state) => {
      state.discoveredAstralProjectorSpells[moonrise.id] = { foundAt: 1 };
      state.activeAstralProjectorSpells = [
        cast(starfall.id, 0, now),
        cast(moonrise.id, 0, now + 1),
      ];
    });

    tick();

    expect(gamestate().activeAstralProjectorSpells).toEqual([
      cast(moonrise.id, 0, now + 1),
    ]);
    expect(logMessages()).toEqual([expect.stringContaining('Starfall')]);
  });
});

describe('pruning', () => {
  it('drops active spells no longer in content', () => {
    seedContent([starfall]);

    expect(
      pruneInvalidActiveAstralProjectorSpells([
        cast(starfall.id, 0),
        cast(moonrise.id, 0),
      ]),
    ).toEqual([cast(starfall.id, 0)]);
  });
});
