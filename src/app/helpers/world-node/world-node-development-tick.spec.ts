import { beforeEach, describe, expect, it } from 'vitest';

import { combatLog } from '@helpers/combat/combat-log';
import { ensureGathering } from '@helpers/content/ensure-gathernode';
import { ensureOutpost } from '@helpers/content/ensure-outpost';
import {
  ensureShrine,
  ensureShrineLevel,
} from '@helpers/content/ensure-shrine';
import { gamestate } from '@helpers/state-game';
import {
  worldNodeDevelopmentTicksRemaining,
  worldNodeDevelopmentTimerText,
} from '@helpers/world-node/world-node-development-state';
import { worldNodeDevelopmentProcessTick } from '@helpers/world-node/world-node-development-tick';
import type { GameState, GatheringId, OutpostId, ShrineId } from '@interfaces';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { captureNotifications } from '@/testing/notify';
import { seedWorldNodes } from '@/testing/world';

const now = 1000;
const level = { costs: [], developTime: 300 };

const woods = ensureGathering({
  id: 'woods' as GatheringId,
  name: 'Wergen Woods',
  levels: [level, level],
});
const shrine = ensureShrine({
  id: 'shrine' as ShrineId,
  name: 'Shrine of the Founder',
  levels: [ensureShrineLevel(level)],
});
const outpost = ensureOutpost({
  id: 'outpost' as OutpostId,
  name: 'Carrina Outpost',
  levels: [level, level],
});

function seed(edit: (state: GameState) => void): void {
  seedGamestate((state) => {
    state.clock.numTicks = now;
    edit(state);
  });
}

const tick = () => inTick(worldNodeDevelopmentProcessTick);

beforeEach(() => {
  seedContent([woods, shrine, outpost]);
  seedWorldNodes([
    { name: woods.name, type: 'GatherNode', x: 1 },
    { name: shrine.name, type: 'Shrine', x: 2 },
    { name: outpost.name, type: 'Outpost', x: 3 },
  ]);
});

describe('worldNodeDevelopmentProcessTick', () => {
  it('leaves a development alone until its completion tick', () => {
    seed((state) => {
      state.gatherNodeLevels[woods.name] = {
        level: 1,
        developCompletesAtTick: now + 1,
      };
    });

    tick();

    expect(gamestate().gatherNodeLevels[woods.name]).toEqual({
      level: 1,
      developCompletesAtTick: now + 1,
    });
    expect(worldNodeDevelopmentTicksRemaining(woods.name)).toBe(1);
    expect(worldNodeDevelopmentTimerText(woods.name)).toBe('00:01');
  });

  it('raises every due node by one level and clears its timer', () => {
    seed((state) => {
      state.gatherNodeLevels[woods.name] = {
        level: 1,
        developCompletesAtTick: now,
      };
      state.shrines[shrine.name] = { level: 0, developCompletesAtTick: now };
    });

    tick();

    expect(gamestate().gatherNodeLevels[woods.name]).toEqual({ level: 2 });
    expect(gamestate().shrines[shrine.name]).toEqual({ level: 1 });
    expect(worldNodeDevelopmentTimerText(woods.name)).toBeUndefined();
  });

  it('announces completion, calling an outpost +1 "built"', () => {
    const notifications = captureNotifications();
    seed((state) => {
      state.outposts[outpost.name] = { level: 0, developCompletesAtTick: now };
      state.gatherNodeLevels[woods.name] = {
        level: 0,
        developCompletesAtTick: now - 5,
      };
    });

    tick();

    expect(notifications.map(({ message }) => message)).toEqual([
      'Wergen Woods has been developed to +1.',
      'Carrina Outpost has been built.',
    ]);
    expect(combatLog().map((entry) => entry.message)).toContain(
      '**Carrina Outpost** has been built.',
    );
  });

  it('does nothing when no development is pending', () => {
    seed((state) => {
      state.shrines[shrine.name] = { level: 1 };
    });
    const before = gamestate();

    tick();

    expect(gamestate()).toBe(before);
  });
});
