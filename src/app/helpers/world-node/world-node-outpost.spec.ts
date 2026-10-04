import { describe, expect, it } from 'vitest';

import {
  OUTPOST_DEATH_PENALTY_MAX_LEVEL,
  OUTPOST_DEATH_PENALTY_REDUCTION_PER_LEVEL,
  OUTPOST_TELEPORT_LEVEL,
} from '@helpers/config';
import { ensureOutpost } from '@helpers/content/ensure-outpost';
import {
  isOutpostBuilt,
  isOutpostTeleportListed,
  isOutpostTeleportUnlocked,
  outpostDeathPenaltyMultiplier,
  outpostsWithTeleportUnlocked,
  worldNodeOutpostLevel,
} from '@helpers/world-node/world-node-outpost';
import type { GameState, OutpostId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const carrina = 'Carrina Outpost';

function atLevels(levels: Record<string, number>): void {
  seedGamestate((state) => {
    Object.entries(levels).forEach(
      ([nodeName, level]) => (state.outposts[nodeName] = { level }),
    );
  });
}

const atLevel = (level?: number) =>
  atLevels(level === undefined ? {} : { [carrina]: level });

describe('worldNodeOutpostLevel', () => {
  it('reads the stored level, 0 when unbuilt or on a save from before outposts', () => {
    atLevel(3);
    expect(worldNodeOutpostLevel(carrina)).toBe(3);

    atLevel();
    expect(worldNodeOutpostLevel(carrina)).toBe(0);

    seedGamestate((state) => delete (state as Partial<GameState>).outposts);
    expect(worldNodeOutpostLevel(carrina)).toBe(0);
  });
});

describe('isOutpostBuilt', () => {
  it('counts an outpost as built from level 1', () => {
    atLevel(0);
    expect(isOutpostBuilt(carrina)).toBe(false);

    atLevel(1);
    expect(isOutpostBuilt(carrina)).toBe(true);
  });
});

describe('outpostDeathPenaltyMultiplier', () => {
  const reducedBy = (upgrades: number) =>
    1 - upgrades * OUTPOST_DEATH_PENALTY_REDUCTION_PER_LEVEL;

  it('shrinks with each upgrade past the build, down to the cap', () => {
    for (const level of [undefined, 0, 1]) {
      atLevel(level);
      expect(outpostDeathPenaltyMultiplier(carrina)).toBe(1);
    }

    atLevel(2);
    expect(outpostDeathPenaltyMultiplier(carrina)).toBe(reducedBy(1));

    const capped = reducedBy(OUTPOST_DEATH_PENALTY_MAX_LEVEL - 1);
    atLevel(OUTPOST_DEATH_PENALTY_MAX_LEVEL);
    expect(outpostDeathPenaltyMultiplier(carrina)).toBe(capped);

    atLevel(OUTPOST_DEATH_PENALTY_MAX_LEVEL + 5);
    expect(outpostDeathPenaltyMultiplier(carrina)).toBe(capped);
  });

  it('is 1 for a node that isn’t an outpost', () => {
    atLevel(OUTPOST_DEATH_PENALTY_MAX_LEVEL);

    expect(outpostDeathPenaltyMultiplier('Duchy of Carrina')).toBe(1);
  });
});

describe('isOutpostTeleportUnlocked', () => {
  it('unlocks the teleport at its level', () => {
    atLevel();
    expect(isOutpostTeleportUnlocked(carrina)).toBe(false);

    atLevel(OUTPOST_TELEPORT_LEVEL - 1);
    expect(isOutpostTeleportUnlocked(carrina)).toBe(false);

    atLevel(OUTPOST_TELEPORT_LEVEL);
    expect(isOutpostTeleportUnlocked(carrina)).toBe(true);
  });
});

describe('teleport listings', () => {
  const outposts = [
    'Carrina Outpost',
    'Larsian Outpost',
    'Mire Outpost',
    'Hidden Outpost',
  ];

  function seedOutposts(levels: Record<string, number>) {
    seedContent(
      outposts.map((name) =>
        ensureOutpost({
          id: name as OutpostId,
          name,
          hidden: name === 'Hidden Outpost',
        }),
      ),
    );
    const nodes = seedWorldNodes(
      outposts.map((name) => ({ name, type: 'Outpost' })),
    );
    atLevels(levels);
    return nodes;
  }

  it('list built outposts the player can see', () => {
    const nodes = seedOutposts({ 'Carrina Outpost': 1, 'Hidden Outpost': 1 });

    expect(isOutpostTeleportListed(nodes['Carrina Outpost'])).toBe(true);
    expect(isOutpostTeleportListed(nodes['Larsian Outpost'])).toBe(false);
    expect(isOutpostTeleportListed(nodes['Hidden Outpost'])).toBe(false);
  });

  it('offer only listed outposts with the teleport unlocked', () => {
    seedOutposts({
      'Carrina Outpost': OUTPOST_TELEPORT_LEVEL,
      'Larsian Outpost': OUTPOST_TELEPORT_LEVEL - 1,
      'Hidden Outpost': OUTPOST_TELEPORT_LEVEL,
    });

    expect(
      outpostsWithTeleportUnlocked().map((entry) => entry.nodeName),
    ).toEqual(['Carrina Outpost']);
  });
});
