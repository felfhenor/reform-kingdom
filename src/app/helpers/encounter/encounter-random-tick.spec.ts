import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/encounter/encounter-random-generate');

import { ensureEncounterRandom } from '@helpers/content/ensure-encounternode';
import { generateEncounterRandomFights } from '@helpers/encounter/encounter-random-generate';
import { encounterRandomProcessTick } from '@helpers/encounter/encounter-random-tick';
import { worldExploreRandomState } from '@helpers/state-game';
import type {
  EncounterRandomFight,
  EncounterRandomId,
  EncounterRandomNodeState,
  GameState,
} from '@interfaces';
import { buildCombat } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { inTick, seedGamestate } from '@/testing/gamestate';
import { abilityJobContent, buildAbilityHero } from '@/testing/job-ability';
import { seedWorldNodes } from '@/testing/world';

const shrine = ensureEncounterRandom({
  id: 'gobslime-shrine' as EncounterRandomId,
  name: 'Gobslime Shrine',
  resetTime: 100,
});
const now = 1000;
const oldFights: EncounterRandomFight[] = [{ level: 1, monsters: [] }];
const newFights: EncounterRandomFight[] = [{ level: 5, monsters: [] }];

function seedShrine(
  generatedAtTick?: number,
  edit: (state: GameState) => void = () => undefined,
): void {
  seedGamestate((state) => {
    state.clock.numTicks = now;
    if (generatedAtTick !== undefined) {
      state.world.exploreRandom[shrine.id] = {
        fights: oldFights,
        generatedAtTick,
        completedThisCycle: true,
      };
    }
    edit(state);
  });
}

function shrineState(): EncounterRandomNodeState | undefined {
  return worldExploreRandomState()[shrine.id];
}

const tick = () => inTick(encounterRandomProcessTick);

beforeEach(() => {
  vi.mocked(generateEncounterRandomFights).mockReturnValue(newFights);
  seedContent([
    shrine,
    ...abilityJobContent('Magician', [['EncounterResetReduction', 1, 0.25]]),
  ]);
  seedWorldNodes([
    { name: shrine.name, type: 'ExploreRandomNode', x: 1 },
    { name: 'Forgotten Shrine', type: 'ExploreRandomNode', x: 2 },
  ]);
});

describe('encounterRandomProcessTick', () => {
  const fresh = {
    fights: newFights,
    generatedAtTick: now,
    completedThisCycle: false,
    resetTime: shrine.resetTime,
  };

  it('generates fights for a node seen for the first time', () => {
    seedShrine();

    tick();

    expect(shrineState()).toEqual(fresh);
  });

  it('regenerates once the reset time has passed, reopening the cycle', () => {
    seedShrine(now - shrine.resetTime + 1);
    tick();
    expect(shrineState()?.fights).toEqual(oldFights);

    seedShrine(now - shrine.resetTime);
    tick();
    expect(shrineState()).toEqual(fresh);
  });

  it('holds off while a fight there is under way, but not one elsewhere', () => {
    const dueAt = now - shrine.resetTime;

    seedShrine(dueAt, (state) => {
      state.world.combat = buildCombat({ encounterRandomId: shrine.id });
    });
    tick();
    expect(shrineState()?.fights).toEqual(oldFights);

    seedShrine(dueAt, (state) => {
      state.world.combat = buildCombat({
        encounterRandomId: 'elsewhere' as EncounterRandomId,
      });
    });
    tick();
    expect(shrineState()).toEqual(fresh);
  });

  describe('with a Magician', () => {
    const magician = buildAbilityHero('Magician', 1);

    it('stores a shortened cycle when the node resets', () => {
      seedShrine(undefined, (state) => (state.world.party = [magician]));

      tick();

      expect(shrineState()?.resetTime).toBe(75);
    });

    it('keeps the shortened cycle after the Magician leaves mid-cycle', () => {
      seedShrine(undefined, (state) => (state.world.party = [magician]));
      tick();
      const generated = shrineState();

      seedGamestate((state) => {
        state.clock.numTicks = now + 75;
        state.world.party = [];
        state.world.exploreRandom[shrine.id] = generated!;
      });
      tick();

      expect(shrineState()).toEqual({
        ...fresh,
        generatedAtTick: now + 75,
        resetTime: shrine.resetTime,
      });
    });
  });

  it("falls back to the content's resetTime for state saved without one", () => {
    seedShrine(now - shrine.resetTime + 1);
    tick();
    expect(shrineState()?.fights).toEqual(oldFights);

    seedShrine(now - shrine.resetTime);
    tick();
    expect(shrineState()).toEqual(fresh);
  });
});
