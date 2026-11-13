import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/pathfinding/pathfinding-travel');

import {
  CRIMSON_LUCRE_NAME,
  GOLD_COIN_NAME,
  MEMORY_FLUX_NAME,
  REFORGE_REAGENT_NAME,
  TRADER_TOKEN_NAME,
  WORKER_COMBAT_BASE_TICKS,
  WORKER_COMBAT_XP_POWER_WINDOW,
} from '@helpers/config';
import { ensureDroppedReward } from '@helpers/content/ensure-helpers-drops';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureItem } from '@helpers/content/ensure-item';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureWorker } from '@helpers/content/ensure-worker';
import { travelPathFrom } from '@helpers/pathfinding/pathfinding-travel';
import { workerGatherAssignmentIsValid } from '@helpers/worker/worker-assignment';
import {
  isWorkerCombatNodeUnlocked,
  workerCombatGrantsXp,
  workerCombatItemDrops,
  workerCombatUnitTicks,
} from '@helpers/worker/worker-combat';
import { defaultWorkerState } from '@helpers/worker/worker-progression';
import type {
  EncounterId,
  ItemId,
  MonsterId,
  TravelStep,
  WorkerId,
  WorkerStatBlock,
} from '@interfaces';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { seedWorldNodes } from '@/testing/world';

const den = 'Goblin Den';
const goblinId = 'goblin' as MonsterId;
const trophy = ensureItem({ id: 'trophy' as ItemId, name: 'Den Trophy' });
const teeth = ensureItem({ id: 'teeth' as ItemId, name: 'Goblin Teeth' });
const bone = ensureItem({ id: 'bone' as ItemId, name: 'Goblin Bone' });
const rareEye = ensureItem({ id: 'eye' as ItemId, name: 'Goblin Eye' });
const highHorn = ensureItem({ id: 'horn' as ItemId, name: 'Goblin Horn' });
const flux = ensureItem({ id: 'flux' as ItemId, name: MEMORY_FLUX_NAME });
const otherCurrencies = [
  GOLD_COIN_NAME,
  CRIMSON_LUCRE_NAME,
  TRADER_TOKEN_NAME,
  REFORGE_REAGENT_NAME,
].map((name) => ensureItem({ id: name as ItemId, name }));
const path: TravelStep[] = [{ kind: 'Move', mapName: 'TestMap', x: 1, y: 0 }];

function fighter(stats: Partial<WorkerStatBlock> = {}) {
  return ensureWorker({
    id: 'nell' as WorkerId,
    name: 'Nell',
    baseStats: {
      capacity: 3,
      gatherSpeed: 1,
      craftSpeed: 0,
      stamina: 100,
      combatPower: 20,
      combatSpeed: 1,
      ...stats,
    },
  });
}

function seed(worker = fighter()): void {
  seedContent([
    worker,
    trophy,
    teeth,
    bone,
    rareEye,
    highHorn,
    flux,
    ...otherCurrencies,
    ensureMonster({
      id: goblinId,
      name: 'Goblin',
      drops: [
        ensureDroppedReward({ itemId: teeth.id, chance: 50 }),
        ensureDroppedReward({ itemId: rareEye.id, chance: 1 }),
        ensureDroppedReward({ itemId: flux.id, chance: 100 }),
        // Only rolls from level 20, the top edge of the den's range.
        ensureDroppedReward({ itemId: bone.id, chance: 100, minLevel: 20 }),
        ensureDroppedReward({ itemId: highHorn.id, chance: 100, minLevel: 21 }),
      ],
    }),
    ensureMonster({
      id: 'boss' as MonsterId,
      name: 'Goblin Boss',
      drops: [ensureDroppedReward({ itemId: teeth.id, chance: 80 })],
    }),
    ensureEncounter({
      id: 'den' as EncounterId,
      name: den,
      levelRange: { min: 15, max: 20 },
      fights: [
        { monsters: [{ monsterId: goblinId }, { monsterId: goblinId }] },
        { monsters: [{ monsterId: 'boss' as MonsterId }] },
      ],
      completionRewards: [
        ensureDroppedReward({ itemId: trophy.id, chance: 100 }),
      ],
    }),
  ]);
}

function seedProgress(opts: { cleared?: boolean; fought?: boolean } = {}) {
  seedGamestate((state) => {
    state.workers['nell' as WorkerId] = defaultWorkerState();
    [teeth, bone, rareEye, flux].forEach((item) => {
      state.discoveredMaterials[item.id] = { foundAt: 1 };
    });
    if (opts.cleared ?? true)
      state.discoveredMaterials[trophy.id] = { foundAt: 1 };
    if (opts.fought ?? true) {
      state.bestiary[goblinId] = {
        foundAt: 1,
        kills: 1,
        minLevelFound: 15,
        maxLevelFound: 15,
        foundAtNodes: [den],
        analyzed: false,
      };
    }
  });
}

const valid = (itemId: ItemId) =>
  workerGatherAssignmentIsValid('nell' as WorkerId, 1, {
    nodeName: den,
    itemId,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(travelPathFrom).mockReturnValue(path);
  seedWorldNodes([
    { name: 'The Duchy', type: 'Kingdom' },
    { name: den, type: 'ExploreNode' },
    { name: 'Woods', type: 'GatherNode' },
  ]);
  seed();
  seedProgress();
});

describe('workerCombatItemDrops', () => {
  it('keeps level-eligible item drops per monster and drops core currencies', () => {
    const ids = workerCombatItemDrops(den, true).map((drop) => drop.itemId);

    expect(ids).toEqual([teeth.id, rareEye.id, bone.id, teeth.id]);
  });
});

describe('workerCombatUnitTicks', () => {
  it('uses the best chance among the node monsters', () => {
    expect(workerCombatUnitTicks(fighter(), 1, den, teeth.id, true)).toBe(
      WORKER_COMBAT_BASE_TICKS / 0.8,
    );
  });

  it('floors very rare drops and scales with combat speed', () => {
    expect(workerCombatUnitTicks(fighter(), 1, den, rareEye.id, true)).toBe(
      WORKER_COMBAT_BASE_TICKS * 10,
    );
    expect(
      workerCombatUnitTicks(fighter({ combatSpeed: 2 }), 1, den, bone.id, true),
    ).toBe(WORKER_COMBAT_BASE_TICKS / 2);
  });

  it('is undefined for an item the node never drops, or a worker that cannot fight', () => {
    expect(
      workerCombatUnitTicks(fighter(), 1, den, highHorn.id, true),
    ).toBeUndefined();
    expect(
      workerCombatUnitTicks(fighter(), 1, den, flux.id, true),
    ).toBeUndefined();
    expect(
      workerCombatUnitTicks(
        fighter({ combatSpeed: 0 }),
        1,
        den,
        teeth.id,
        true,
      ),
    ).toBeUndefined();
  });
});

describe('isWorkerCombatNodeUnlocked', () => {
  it('needs the node both cleared and fought at', () => {
    expect(isWorkerCombatNodeUnlocked(den)).toBe(true);

    seedProgress({ cleared: false });
    expect(isWorkerCombatNodeUnlocked(den)).toBe(false);

    seedProgress({ fought: false });
    expect(isWorkerCombatNodeUnlocked(den)).toBe(false);
  });

  it('never unlocks a gather node', () => {
    expect(isWorkerCombatNodeUnlocked('Woods')).toBe(false);
  });
});

describe('workerGatherAssignmentIsValid (combat node)', () => {
  it('accepts a discovered drop, including one only at the range edge', () => {
    expect(valid(teeth.id)).toBe(true);
    expect(valid(bone.id)).toBe(true);
  });

  it('rejects currencies, out-of-range drops and an unfought node', () => {
    expect(valid(flux.id)).toBe(false);
    expect(valid(highHorn.id)).toBe(false);

    seedProgress({ fought: false });
    expect(valid(teeth.id)).toBe(false);
  });

  it('needs whole combat power at the top of the node range', () => {
    seed(fighter({ combatPower: 19.9 }));
    expect(valid(teeth.id)).toBe(false);

    seed(fighter({ combatPower: 20 }));
    expect(valid(teeth.id)).toBe(true);
  });

  it('needs the node within stamina', () => {
    vi.mocked(travelPathFrom).mockReturnValue(undefined);
    expect(valid(teeth.id)).toBe(false);
  });
});

describe('workerCombatGrantsXp', () => {
  it('grants XP only while the node is near the worker power', () => {
    const atEdge = fighter({ combatPower: 20 + WORKER_COMBAT_XP_POWER_WINDOW });
    const past = fighter({ combatPower: 21 + WORKER_COMBAT_XP_POWER_WINDOW });

    expect(workerCombatGrantsXp(atEdge, 1, den)).toBe(true);
    expect(workerCombatGrantsXp(past, 1, den)).toBe(false);
  });
});
