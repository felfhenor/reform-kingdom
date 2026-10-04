import { beforeEach, describe, expect, it } from 'vitest';

import { OUTPOST_TELEPORT_LEVEL } from '@helpers/config';
import { ensureOutpost } from '@helpers/content/ensure-outpost';
import { outpostCanTeleport } from '@helpers/world-node/world-node-outpost-teleport';
import type { GameState, OutpostId, WorldNodeEntry } from '@interfaces';
import { buildCombat } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { locationOf, seedWorldNodes } from '@/testing/world';

const names = ['Carrina Outpost', 'Larsian Outpost', 'Hidden Outpost'];
let carrina: WorldNodeEntry;
let larsian: WorldNodeEntry;
let hidden: WorldNodeEntry;

function seedTeleports(edit?: (state: GameState) => void): void {
  seedGamestate((state) => {
    state.world.currentLocation = locationOf(carrina);
    names.forEach(
      (name) => (state.outposts[name] = { level: OUTPOST_TELEPORT_LEVEL }),
    );
    edit?.(state);
  });
}

beforeEach(() => {
  seedContent(
    names.map((name) =>
      ensureOutpost({
        id: name as OutpostId,
        name,
        hidden: name === 'Hidden Outpost',
      }),
    ),
  );
  ({
    'Carrina Outpost': carrina,
    'Larsian Outpost': larsian,
    'Hidden Outpost': hidden,
  } = seedWorldNodes(names.map((name) => ({ name, type: 'Outpost' }))));
});

describe('outpostCanTeleport', () => {
  it('allows a jump between two unlocked outposts while standing at the source', () => {
    seedTeleports();

    expect(outpostCanTeleport(carrina, larsian)).toBe(true);
  });

  it('refuses a jump to the outpost the party is at, or to one it can’t see', () => {
    seedTeleports();

    expect(outpostCanTeleport(carrina, carrina)).toBe(false);
    expect(outpostCanTeleport(carrina, hidden)).toBe(false);
  });

  it('needs the teleport unlocked at both ends', () => {
    seedTeleports(
      (state) =>
        (state.outposts['Larsian Outpost'] = {
          level: OUTPOST_TELEPORT_LEVEL - 1,
        }),
    );
    expect(outpostCanTeleport(carrina, larsian)).toBe(false);

    seedTeleports(
      (state) =>
        (state.outposts['Carrina Outpost'] = {
          level: OUTPOST_TELEPORT_LEVEL - 1,
        }),
    );
    expect(outpostCanTeleport(carrina, larsian)).toBe(false);
  });

  it('needs the party standing at the source and free to travel', () => {
    seedTeleports(
      (state) => (state.world.currentLocation = locationOf(larsian)),
    );
    expect(outpostCanTeleport(carrina, larsian)).toBe(false);

    seedTeleports((state) => (state.world.combat = buildCombat()));
    expect(outpostCanTeleport(carrina, larsian)).toBe(false);
  });
});
