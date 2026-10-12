import { beforeEach, describe, expect, it } from 'vitest';

import { ensureOutpost } from '@helpers/content/ensure-outpost';
import { applyMaterialDelta } from '@helpers/item/materials';
import { worldNodeDevelopmentBegin } from '@helpers/world-node/world-node-development-state';
import type { GameState, ItemId, OutpostId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const gold = 'gold' as ItemId;
const now = 500;
const outpost = ensureOutpost({
  id: 'outpost' as OutpostId,
  name: 'Carrina Outpost',
  levels: [
    { costs: [{ itemId: gold, required: 100 }], developTime: 300 },
    { costs: [{ itemId: gold, required: 200 }], developTime: 600 },
  ],
});

function stateWith(goldOwned: number, edit?: (state: GameState) => void) {
  return seedGamestate((state) => {
    state.clock.numTicks = now;
    applyMaterialDelta(state, gold, goldOwned);
    edit?.(state);
  });
}

// Seeded state is frozen in dev, so mutate a copy like an Immer draft would.
const begin = (state: GameState) =>
  worldNodeDevelopmentBegin(structuredClone(state), outpost.name, outpost);

beforeEach(() => {
  seedContent([outpost]);
  seedWorldNodes([{ name: outpost.name, type: 'Outpost', x: 1 }]);
});

describe('worldNodeDevelopmentBegin', () => {
  it('pays the next level cost and stamps the completion tick without leveling yet', () => {
    const draft = structuredClone(stateWith(150));

    expect(worldNodeDevelopmentBegin(draft, outpost.name, outpost)).toBe(1);
    expect(draft.outposts[outpost.name]).toEqual({
      level: 0,
      developCompletesAtTick: now + 300,
    });
    expect(draft.materials[gold]?.quantity).toBe(50);
  });

  it('refuses a second start while one is already pending', () => {
    const draft = structuredClone(stateWith(1000));

    worldNodeDevelopmentBegin(draft, outpost.name, outpost);
    expect(worldNodeDevelopmentBegin(draft, outpost.name, outpost)).toBe(0);
    expect(draft.materials[gold]?.quantity).toBe(900);
  });

  it('refuses when unaffordable or already at max level', () => {
    expect(begin(stateWith(99))).toBe(0);
    expect(
      begin(
        stateWith(1000, (state) => {
          state.outposts[outpost.name] = { level: 2 };
        }),
      ),
    ).toBe(0);
  });
});
