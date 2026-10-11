import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/task/task-events');

import { getEntry } from '@helpers/content/content';
import { exchangedEquipmentItem } from '@helpers/exchange/exchange';
import { stateEquipFromArmory } from '@helpers/hero/character-equipment';
import { characterUnequipToArmory } from '@helpers/hero/character-equipment.ui';
import { charactersReclass } from '@helpers/hero/character-reclass';
import {
  characterCurrentRegalia,
  characterJobRegalias,
  regaliaMissingItems,
} from '@helpers/hero/regalia';
import {
  stateRegaliaCreate,
  stateRegaliaEquip,
  stateRegaliaMigrate,
  stateRegaliaRemove,
  stateRegaliaUpdate,
} from '@helpers/hero/regalia-state';
import { canEquipItem, equippedItems } from '@helpers/item/equipment';
import { applyMaterialDelta } from '@helpers/item/materials';
import { gamestate, updateGamestate } from '@helpers/state-game';
import type {
  Character,
  CharacterId,
  EquipmentContent,
  EquipmentId,
  EquipmentItemId,
  EquipmentSlot,
  GameState,
  RegaliaId,
} from '@interfaces';
import { EquipmentTypeToSlot } from '@interfaces';
import { sortBy } from 'es-toolkit/compat';
import { buildEquipmentItem } from '@/testing/builders';
import { inTick, seedGamestate } from '@/testing/gamestate';
import {
  goldId,
  hatId,
  heavyHelmId,
  mageId,
  randomClause,
  regaliaHero,
  ringId,
  seedRegaliaContent,
  shieldId,
  spearId,
  swordId,
  warriorId,
} from '@/testing/regalia';

const SEEDS = 200;
const OPS_PER_SEED = 80;
const GEAR_IDS = [swordId, shieldId, spearId, hatId, ringId];
const EXCHANGE_IDS = [...GEAR_IDS, heavyHelmId];

// Weighted towards the moves that strand, reshape or remove regalia gear.
const OP_WEIGHTS: Record<string, number> = {
  create: 2,
  equip: 4,
  update: 1,
  remove: 1,
  equipFromArmory: 3,
  unequip: 3,
  sell: 1,
  exchange: 3,
  editOrders: 1,
  reclass: 2,
  reload: 1,
};

type Rand = () => number;
type Op = (rand: Rand, sold: Set<EquipmentItemId>) => string;

// Seeded LCG so a failure reproduces from its seed.
function seededRand(seed: number): Rand {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 2 ** 32;
    return value / 2 ** 32;
  };
}

function pick<T>(rand: Rand, list: T[]): T | undefined {
  return list.length === 0 ? undefined : list[Math.floor(rand() * list.length)];
}

function ownedIds(state: GameState): EquipmentItemId[] {
  return [
    ...state.armory,
    ...state.regalias.vault,
    ...state.world.party.flatMap((c) => equippedItems(c.equipment)),
  ].map((item) => item.id);
}

function mutate(fn: (state: GameState) => void): void {
  inTick(() =>
    updateGamestate((state) => {
      fn(state);
      return state;
    }),
  );
}

function randomHero(rand: Rand): Character {
  return pick(rand, gamestate().world.party)!;
}

let regaliaCounter = 0;

// Guards against a sequence generator that silently stops reaching the interesting paths.
const coverage = { loads: 0, gone: 0, unequippable: 0, displaced: 0 };

const ops: Record<string, Op> = {
  create: (rand) => {
    const hero = randomHero(rand);
    const id = `regalia-${regaliaCounter++}` as RegaliaId;
    mutate((state) => stateRegaliaCreate(state, hero.id, id));
    return `create ${hero.id}`;
  },

  equip: (rand) => {
    const state = gamestate();
    const hero = randomHero(rand);
    const regalia = pick(
      rand,
      characterJobRegalias(state.regalias.entries, hero.id, hero.jobId),
    );
    if (!regalia) return 'equip (none)';

    const missingItems = regaliaMissingItems(regalia, hero, [
      ...state.regalias.vault,
      ...state.armory,
    ]);
    const missing = new Set(missingItems.map((entry) => entry.id));
    missingItems.forEach((entry) => coverage[entry.reason]++);
    coverage.loads++;
    const expected = regalia.equipmentItemIds.filter((id) => !missing.has(id));

    mutate((draft) => stateRegaliaEquip(draft, hero.id, regalia.id));

    const after = gamestate().world.party.find((c) => c.id === hero.id)!;
    expect(sortBy(equippedItems(after.equipment).map((i) => i.id))).toEqual(
      sortBy(expected),
    );
    return `equip ${regalia.id} on ${hero.id}`;
  },

  update: (rand) => {
    const hero = randomHero(rand);
    mutate((state) => stateRegaliaUpdate(state, hero.id));
    return `update ${hero.id}`;
  },

  remove: (rand) => {
    const regalia = pick(rand, gamestate().regalias.entries);
    if (!regalia) return 'remove (none)';
    mutate((state) => stateRegaliaRemove(state, regalia.id));
    return `remove ${regalia.id}`;
  },

  equipFromArmory: (rand) => {
    const hero = randomHero(rand);
    const item = pick(rand, gamestate().armory);
    const content = item
      ? getEntry<EquipmentContent>(item.equipmentId)
      : undefined;
    if (!item || !content || !canEquipItem(hero, content)) {
      return 'equipFromArmory (skip)';
    }

    mutate((state) => {
      const draftItem = state.armory.find((owned) => owned.id === item.id)!;
      stateEquipFromArmory(state, hero.id, draftItem, content);
    });
    return `equipFromArmory ${item.id} on ${hero.id}`;
  },

  unequip: (rand) => {
    const hero = randomHero(rand);
    const slot = pick(
      rand,
      (Object.keys(hero.equipment) as EquipmentSlot[]).filter(
        (s) => !!hero.equipment[s],
      ),
    );
    if (!slot) return 'unequip (none)';
    inTick(() => characterUnequipToArmory(hero.id, slot));
    return `unequip ${slot} from ${hero.id}`;
  },

  sell: (rand, sold) => {
    const item = pick(rand, gamestate().armory);
    if (!item) return 'sell (none)';
    sold.add(item.id);
    mutate((state) => {
      state.armory = state.armory.filter((owned) => owned.id !== item.id);
    });
    return `sell ${item.id}`;
  },

  exchange: (rand) => {
    const state = gamestate();
    const referenced = new Set(
      state.regalias.entries.flatMap((r) => r.equipmentItemIds),
    );
    const regaliaGear = state.armory.filter((owned) =>
      referenced.has(owned.id),
    );
    const item = pick(
      rand,
      rand() < 0.8 && regaliaGear.length > 0 ? regaliaGear : state.armory,
    );
    // Two-handers are what make a regalia's own items collide.
    const target = rand() < 0.5 ? spearId : pick(rand, EXCHANGE_IDS)!;
    if (!item) return 'exchange (none)';
    mutate((state) => {
      const index = state.armory.findIndex((owned) => owned.id === item.id);
      state.armory[index] = exchangedEquipmentItem(state.armory[index], target);
    });
    return `exchange ${item.id} -> ${target}`;
  },

  editOrders: (rand) => {
    const hero = randomHero(rand);
    const orders = rand() < 0.5 ? [] : [randomClause];
    mutate((state) => {
      const draft = state.world.party.find((c) => c.id === hero.id)!;
      draft.combatOrders[draft.jobId] = orders;
    });
    return `editOrders ${hero.id}`;
  },

  reclass: (rand) => {
    const heroes = rand() < 0.5 ? [randomHero(rand)] : gamestate().world.party;
    inTick(
      () =>
        void charactersReclass(
          heroes.map((hero) => ({
            characterId: hero.id,
            jobId: hero.jobId === warriorId ? mageId : warriorId,
          })),
        ),
    );
    heroes.forEach((hero) => expectLoadedRegaliaConsistent(hero.id));
    return `reclass ${heroes.map((h) => h.id).join(',')}`;
  },

  reload: () => {
    mutate(stateRegaliaMigrate);
    return 'reload';
  },
};

// After a reclass loads a regalia, the hero wears exactly its gear minus what it reports missing.
function expectLoadedRegaliaConsistent(characterId: CharacterId): void {
  const state = gamestate();
  const hero = state.world.party.find((c) => c.id === characterId)!;
  const regalia = characterCurrentRegalia(state.regalias.entries, hero);
  if (!regalia) return;

  const missing = new Set(
    regaliaMissingItems(regalia, hero, [
      ...state.regalias.vault,
      ...state.armory,
    ]).map((entry) => entry.id),
  );
  expect(sortBy(equippedItems(hero.equipment).map((i) => i.id))).toEqual(
    sortBy(regalia.equipmentItemIds.filter((id) => !missing.has(id))),
  );
}

function expectConserved(
  initial: EquipmentItemId[],
  sold: Set<EquipmentItemId>,
): void {
  const state = gamestate();
  const owned = ownedIds(state);

  expect(new Set(owned).size).toBe(owned.length);
  expect(sortBy(owned)).toEqual(sortBy(initial.filter((id) => !sold.has(id))));

  const referenced = new Set(
    state.regalias.entries.flatMap((r) => r.equipmentItemIds),
  );
  state.regalias.vault.forEach((item) =>
    expect(referenced.has(item.id)).toBe(true),
  );
}

function expectValidEquipment(): void {
  const state = gamestate();
  const entryIds = new Set(state.regalias.entries.map((r) => r.id));

  state.world.party.forEach((hero) => {
    (Object.keys(hero.equipment) as EquipmentSlot[]).forEach((slot) => {
      const item = hero.equipment[slot];
      if (!item) return;
      const content = getEntry<EquipmentContent>(item.equipmentId)!;
      const slots = EquipmentTypeToSlot[content.type];
      expect(slots).toContain(slot);
      slots.forEach((covered) =>
        expect(hero.equipment[covered]?.id).toBe(item.id),
      );
    });
    Object.values(hero.currentRegaliaIds).forEach((id) =>
      expect(entryIds.has(id!)).toBe(true),
    );
  });
}

function loadout() {
  return {
    Weapon: buildEquipmentItem(swordId),
    Offhand: buildEquipmentItem(shieldId),
    Helmet: buildEquipmentItem(hatId),
  };
}

// Both start as Warriors with a weapon and offhand, so their regalias can hold items that later collide.
function seedWorld(rand: Rand): EquipmentItemId[] {
  const armory = Array.from({ length: 8 }, () =>
    buildEquipmentItem(pick(rand, GEAR_IDS) as EquipmentId),
  );
  const jala = loadout();
  const kim = loadout();

  seedGamestate((state) => {
    state.world.party = [
      regaliaHero(jala),
      regaliaHero(kim, { id: 'Kim' as CharacterId }),
    ];
    state.armory = armory;
    applyMaterialDelta(state, goldId, 1_000_000_000);
  });

  return [...armory, ...Object.values(jala), ...Object.values(kim)].map(
    (item) => item.id,
  );
}

beforeEach(seedRegaliaContent);

describe('regalia item conservation', () => {
  it(
    'never duplicates or loses gear across random operation sequences',
    { timeout: 120_000 },
    () => {
      const names = Object.entries(OP_WEIGHTS).flatMap(([name, weight]) =>
        Array<string>(weight).fill(name),
      );

      for (let seed = 1; seed <= SEEDS; seed++) {
        const rand = seededRand(seed);
        const initial = seedWorld(rand);
        const sold = new Set<EquipmentItemId>();
        const log: string[] = [];

        for (let step = 0; step < OPS_PER_SEED; step++) {
          const name = pick(rand, names)!;
          try {
            log.push(ops[name](rand, sold));
            expectConserved(initial, sold);
            expectValidEquipment();
          } catch (error) {
            throw new Error(
              `seed ${seed}, step ${step}:\n${log.join('\n')}\n${String(error)}`,
            );
          }
        }
      }

      expect(coverage.loads).toBeGreaterThan(1000);
      expect(coverage.gone).toBeGreaterThan(20);
      expect(coverage.unequippable).toBeGreaterThan(10);
      expect(coverage.displaced).toBeGreaterThan(30);
    },
  );
});
