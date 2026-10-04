import { describe, expect, it } from 'vitest';

import { ensureEncounterRandom } from '@helpers/content/ensure-encounternode';
import {
  encounterRandomIsAvailable,
  encounterRandomState,
  encounterRandomTicksUntilReset,
  encounterRandomTimerLabel,
} from '@helpers/encounter/encounter-random';
import { formatDuration } from '@helpers/engine/timer';
import type { EncounterRandomId, EncounterRandomNodeState } from '@interfaces';
import { seedGamestate } from '@/testing/gamestate';

const shrineId = 'gobslime-shrine' as EncounterRandomId;
const shrine = (resetTime = 3600) =>
  ensureEncounterRandom({ id: shrineId, resetTime });

const nodeState = (
  overrides: Partial<EncounterRandomNodeState> = {},
): EncounterRandomNodeState => ({
  fights: [{ level: 1, monsters: [] }],
  generatedAtTick: 0,
  completedThisCycle: false,
  ...overrides,
});

const atTick = (numTicks: number) =>
  seedGamestate((state) => (state.clock.numTicks = numTicks));

describe('encounterRandomState', () => {
  it('reads the node’s state, if it has any', () => {
    const rolled = nodeState();
    seedGamestate((state) => (state.world.exploreRandom[shrineId] = rolled));

    expect(encounterRandomState(shrineId)).toEqual(rolled);
    expect(encounterRandomState('other' as EncounterRandomId)).toBeUndefined();
  });
});

describe('encounterRandomTicksUntilReset', () => {
  it('counts down from generation, between 0 and the full reset time', () => {
    atTick(100);
    expect(
      encounterRandomTicksUntilReset(
        shrine(100),
        nodeState({ generatedAtTick: 40 }),
      ),
    ).toBe(40);

    atTick(500);
    expect(encounterRandomTicksUntilReset(shrine(100), nodeState())).toBe(0);

    atTick(0);
    expect(
      encounterRandomTicksUntilReset(
        shrine(100),
        nodeState({ generatedAtTick: 50 }),
      ),
    ).toBe(100);

    expect(encounterRandomTicksUntilReset(shrine(1800), undefined)).toBe(1800);
  });
});

describe('encounterRandomIsAvailable', () => {
  it('needs rolled fights not yet cleared this cycle', () => {
    expect(encounterRandomIsAvailable(shrine(), nodeState())).toBe(true);
    expect(encounterRandomIsAvailable(shrine(), undefined)).toBe(false);
    expect(
      encounterRandomIsAvailable(shrine(), nodeState({ fights: [] })),
    ).toBe(false);
    expect(
      encounterRandomIsAvailable(
        shrine(),
        nodeState({ completedThisCycle: true }),
      ),
    ).toBe(false);
  });
});

describe('encounterRandomTimerLabel', () => {
  it('formats the time left until the reset', () => {
    atTick(100);

    expect(
      encounterRandomTimerLabel(
        shrine(1800),
        nodeState({ generatedAtTick: 40 }),
      ),
    ).toBe(formatDuration(1800 - 60));
  });
});
