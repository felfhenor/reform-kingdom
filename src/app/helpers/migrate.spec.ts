import { describe, expect, it } from 'vitest';

import {
  ensureCollectible,
  ensureEquipment,
  ensureItem,
} from '@helpers/content/ensure-item';
import {
  ensureGatherResult,
  ensureGathering,
} from '@helpers/content/ensure-gathernode';
import { ensureCaravan } from '@helpers/content/ensure-caravan';
import { ensureJob } from '@helpers/content/ensure-job';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureTask } from '@helpers/content/ensure-task';
import { ensureTown } from '@helpers/content/ensure-town';
import { ensureTradeskill } from '@helpers/content/ensure-tradeskill';
import {
  ensureTrainer,
  ensureTrainerTeaching,
} from '@helpers/content/ensure-trainer';
import { tradeskillXpForLevel } from '@helpers/crafting/tradeskill';
import { defaultGameState, defaultTradeskillBuilding } from '@helpers/defaults';
import { characterXpForLevel } from '@helpers/hero/party';
import { migrateGameState } from '@helpers/migrate';
import { gamestate } from '@helpers/state-game';
import type {
  AutoModeState,
  CaravanId,
  Character,
  CollectibleId,
  DecreeClause,
  DecreeClauseId,
  EquipmentId,
  GameState,
  GatheringId,
  ItemId,
  JobId,
  RecipeId,
  TaskId,
  TownId,
  TradeskillId,
  TrainerId,
  TrainerTeachingId,
} from '@interfaces';
import {
  buildCharacter,
  buildCommissionNodeState,
  buildCraftQueueEntry,
  buildEquipmentItem,
  buildTownNodeState,
} from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';
import { locationOf, seedWorldNodes } from '@/testing/world';

const sword = ensureEquipment({
  id: 'sword' as EquipmentId,
  name: 'Sword',
  type: 'Sword',
});
const ore = ensureItem({ id: 'ore' as ItemId, name: 'Ore' });
const ruby = ensureCollectible({ id: 'ruby' as CollectibleId, name: 'Ruby' });
const foundingStone = ensureCollectible({
  id: 'founding-stone' as CollectibleId,
  name: 'Founding Stone',
});
const cloak = ensureRecipe({ id: 'cloak' as RecipeId, name: 'Cloak' });
const smithing = ensureTradeskill({
  id: 'smithing' as TradeskillId,
  name: 'Smithing',
});
const warrior = ensureJob({ id: 'warrior' as JobId, name: 'Warrior' });
const lunge = ensureTrainerTeaching({
  id: 'lunge' as TrainerTeachingId,
  name: 'Lunge',
});
const trainer = ensureTrainer({ id: 'trainer' as TrainerId, name: 'Trainer' });
const content = [sword, ore, ruby, cloak, smithing, warrior, lunge, trainer];

const gone = <T extends string>(id: string) => `gone-${id}` as T;

// Runs the real migration over a save seeded from defaults, as a loaded save would be.
function migrate(edit: (save: GameState) => void): GameState {
  seedGamestate(edit);
  migrateGameState();
  return gamestate();
}

describe('migrateGameState', () => {
  it('drops save entries whose content no longer exists, keeping the rest', () => {
    seedContent(content);

    const migrated = migrate((save) => {
      save.armory = [
        buildEquipmentItem(sword.id),
        buildEquipmentItem(gone('gear')),
      ];
      save.materials = {
        [ore.id]: { quantity: 5, foundAt: 1 },
        [gone<ItemId>('ore')]: { quantity: 2, foundAt: 1 },
      };
      save.discoveredEquipment = {
        [sword.id]: { foundAt: 1 },
        [gone<EquipmentId>('gear')]: { foundAt: 1 },
      };
      save.collectibles = {
        [ruby.id]: { quantity: 1, foundAt: 1 },
        [gone<CollectibleId>('ruby')]: { quantity: 1, foundAt: 1 },
      };
      save.discoveredRecipes = {
        [cloak.id]: { foundAt: 1 },
        [gone<RecipeId>('recipe')]: { foundAt: 1 },
      };
      save.discoveredTrainers = {
        [trainer.id]: { foundAt: 1 },
        [gone<TrainerId>('trainer')]: { foundAt: 1 },
      };
      save.world.party = [
        buildCharacter({
          equipment: {
            ...buildCharacter().equipment,
            Weapon: buildEquipmentItem(sword.id),
            Armor: buildEquipmentItem(gone('gear')),
          },
          teachings: {
            [warrior.id]: [lunge.id, gone<TrainerTeachingId>('teaching')],
          },
        }),
      ];
    });

    expect(migrated.armory.map((item) => item.equipmentId)).toEqual([sword.id]);
    expect(Object.keys(migrated.materials)).toEqual([ore.id]);
    expect(Object.keys(migrated.discoveredEquipment)).toEqual([sword.id]);
    expect(Object.keys(migrated.collectibles)).toEqual([ruby.id]);
    expect(Object.keys(migrated.discoveredRecipes)).toEqual([cloak.id]);
    expect(Object.keys(migrated.discoveredTrainers)).toEqual([trainer.id]);

    const [hero] = migrated.world.party;
    expect(hero.equipment.Weapon?.equipmentId).toBe(sword.id);
    expect(hero.equipment.Armor).toBeUndefined();
    expect(hero.teachings).toEqual({ [warrior.id]: [lunge.id] });
  });

  it('fills in whatever an older save is missing from the current defaults', () => {
    const migrated = migrate((save) => {
      const legacy = save as Partial<GameState>;
      delete legacy.discoveredTrainers;
      delete legacy.workers;
      delete (save.world as Partial<GameState['world']>).autoMode;
    });

    const defaults = defaultGameState();
    expect(migrated.discoveredTrainers).toEqual(defaults.discoveredTrainers);
    expect(migrated.workers).toEqual(defaults.workers);
    expect(migrated.world.autoMode).toEqual(defaults.world.autoMode);
  });

  it('grants the Founding Stone once, without touching one already owned', () => {
    seedContent([foundingStone]);

    expect(migrate(() => {}).collectibles[foundingStone.id]).toEqual({
      quantity: 1,
      foundAt: expect.any(Number),
    });

    const owned = { quantity: 3, foundAt: 1 };
    expect(
      migrate((save) => (save.collectibles[foundingStone.id] = owned))
        .collectibles[foundingStone.id],
    ).toEqual(owned);
  });

  it('rescales hero and tradeskill xp to the current curve, never past it', () => {
    seedContent([smithing]);

    const migrated = migrate((save) => {
      save.world.party = [
        { ...buildCharacter({ level: 5 }), xp: { current: 10, maximum: 1 } },
        { ...buildCharacter({ level: 5 }), xp: { current: 1e9, maximum: 1 } },
      ];
      save.tradeskills[smithing.id] = {
        ...defaultTradeskillBuilding(),
        level: 3,
        xp: { current: 1e9, maximum: 1 },
      };
    });

    const heroMax = characterXpForLevel(5);
    expect(migrated.world.party.map((hero) => hero.xp)).toEqual([
      { current: 10, maximum: heroMax },
      { current: heroMax, maximum: heroMax },
    ]);
    const smithingMax = tradeskillXpForLevel(3);
    expect(migrated.tradeskills[smithing.id].xp).toEqual({
      current: smithingMax,
      maximum: smithingMax,
    });
  });

  it('returns gear reserved by a craft for a removed recipe to the armory', () => {
    seedContent([sword, smithing]);
    const reserved = buildEquipmentItem(sword.id);

    const migrated = migrate((save) => {
      save.tradeskills[smithing.id] = {
        ...defaultTradeskillBuilding(),
        queue: [
          buildCraftQueueEntry({
            recipeId: gone('recipe'),
            reservedEquipment: [reserved],
          }),
        ],
      };
    });

    expect(migrated.tradeskills[smithing.id].queue).toEqual([]);
    expect(migrated.armory).toEqual([reserved]);
  });

  describe('gather-node discoveries', () => {
    const groves = ['Wergen Woods', 'Rocky Outcrop'];
    function seedGroves(): void {
      seedContent([ore]);
      seedWorldNodes(groves.map((name) => ({ name, type: 'GatherNode' })));
    }

    it('are granted for every node to a save with material progress from before visits were tracked', () => {
      seedGroves();

      const migrated = migrate(
        (save) => (save.materials[ore.id] = { quantity: 5, foundAt: 1 }),
      );

      expect(Object.keys(migrated.discoveredGatherNodes)).toEqual(groves);
    });

    it('are left alone for a fresh save or one that already records visits', () => {
      seedGroves();
      expect(migrate(() => {}).discoveredGatherNodes).toEqual({});

      const visited = { 'Wergen Woods': { foundAt: 1 } };
      expect(
        migrate((save) => {
          save.materials[ore.id] = { quantity: 5, foundAt: 1 };
          save.discoveredGatherNodes = visited;
        }).discoveredGatherNodes,
      ).toEqual(visited);
    });
  });

  it('drops GatherMaterial clauses no gather node can satisfy anymore', () => {
    const grove = ensureGathering({
      id: 'woods' as GatheringId,
      name: 'Wergen Woods',
      gatherResults: [
        ensureGatherResult({ items: [{ itemId: ore.id, quantity: 1 }] }),
      ],
    });
    seedContent([ore, grove]);
    seedWorldNodes([{ name: grove.name, type: 'GatherNode' }]);
    const gather = (id: string, materialId: ItemId): DecreeClause => ({
      id: id as DecreeClauseId,
      type: 'GatherMaterial',
      materialId,
      targetQuantity: 10,
      enabled: true,
      failureCount: 0,
    });

    const migrated = migrate(
      (save) =>
        (save.world.autoMode.clauses = [
          gather('kept', ore.id),
          gather('dropped', gone('ore')),
        ]),
    );

    expect(migrated.world.autoMode.clauses.map((clause) => clause.id)).toEqual([
      'kept',
    ]);
  });

  describe('the legacy save-wide risk tolerance', () => {
    const levelUp = {
      id: 'level' as DecreeClauseId,
      type: 'LevelUpParty',
      enabled: true,
      failureCount: 0,
    } as DecreeClause;

    function migrateWith(riskTolerance?: string): AutoModeState {
      return migrate((save) => {
        save.world.autoMode.clauses = [levelUp];
        if (riskTolerance) {
          Object.assign(save.world.autoMode, { riskTolerance });
        }
      }).world.autoMode;
    }

    it('moves onto each risk-aware clause and off Auto Mode itself', () => {
      const autoMode = migrateWith('High');

      expect(autoMode.clauses).toEqual([{ ...levelUp, riskTolerance: 'High' }]);
      expect(autoMode).not.toHaveProperty('riskTolerance');
    });

    it('defaults to Medium for a save without one', () => {
      expect(migrateWith().clauses).toEqual([
        { ...levelUp, riskTolerance: 'Medium' },
      ]);
    });
  });

  it('backfills discovered materials from current stock, keeping known discovery times', () => {
    const copper = ensureItem({ id: 'copper' as ItemId, name: 'Copper' });
    seedContent([ore, copper]);

    const migrated = migrate((save) => {
      save.discoveredMaterials = {
        [ore.id]: { foundAt: 500 },
        [gone<ItemId>('ore')]: { foundAt: 1 },
      };
      save.materials = {
        [ore.id]: { quantity: 5, foundAt: 1000 },
        [copper.id]: { quantity: 3, foundAt: 3000 },
        [gone<ItemId>('stock')]: { quantity: 1, foundAt: 1 },
      };
    });

    expect(migrated.discoveredMaterials).toEqual({
      [ore.id]: { foundAt: 500 },
      [copper.id]: { foundAt: 3000 },
    });
  });

  it('backfills visited maps from the current location and visited nodes, dropping maps that are gone', () => {
    const { Kingdom } = seedWorldNodes([
      { name: 'Kingdom', type: 'Kingdom' },
      { name: 'Field Ruins', type: 'ExploreNode', mapName: 'Eastmarch' },
      { name: 'Far Ruins', type: 'ExploreNode', mapName: 'Farlands' },
    ]);

    const migrated = migrate((save) => {
      save.world.currentLocation = locationOf(Kingdom);
      save.worldDiscoveries['Field Ruins'] = { foundAt: 1 };
      save.discoveredMaps['Gone Map'] = { foundAt: 1 };
    });

    expect(new Set(Object.keys(migrated.discoveredMaps))).toEqual(
      new Set(['Eastmarch', Kingdom.mapName]),
    );
  });

  it('moves a party stranded on an unwalkable tile to the kingdom', () => {
    const { Kingdom } = seedWorldNodes([{ name: 'Kingdom', type: 'Kingdom' }]);

    const migrated = migrate(
      (save) =>
        (save.world.currentLocation = { mapName: 'Gone Map', x: 1, y: 1 }),
    );

    expect(migrated.world.currentLocation).toEqual({
      mapName: Kingdom.mapName,
      x: Kingdom.x,
      y: Kingdom.y,
    });
  });

  it('re-keys tradeskills saved under their old names', () => {
    const blacksmithing = ensureTradeskill({
      id: 'blacksmithing-id' as TradeskillId,
      name: 'Blacksmithing',
    });
    seedContent([blacksmithing]);

    const migrated = migrate(
      (save) =>
        (save.tradeskills = {
          [blacksmithing.name as TradeskillId]: {
            ...defaultTradeskillBuilding(),
            level: 7,
          },
        }),
    );

    expect(Object.keys(migrated.tradeskills)).toEqual([blacksmithing.id]);
    expect(migrated.tradeskills[blacksmithing.id].level).toBe(7);
  });

  it('gives heroes from older saves an empty set of combat orders', () => {
    const migrated = migrate((save) => {
      const hero: Partial<Character> = buildCharacter();
      delete hero.combatOrders;
      save.world.party = [hero as Character];
    });

    expect(migrated.world.party[0].combatOrders).toEqual({});
  });

  it('recomputes global effect sums from what the save still owns', () => {
    const charm = ensureCollectible({
      id: 'charm' as CollectibleId,
      name: 'Charm',
      effects: [{ effectType: 'GlobalCombatItemDropRateBoost', value: 5 }],
    });
    seedContent([charm]);

    const migrated = migrate((save) => {
      save.collectibles = {
        [charm.id]: { quantity: 1, foundAt: 1 },
        [gone<CollectibleId>('charm')]: { quantity: 1, foundAt: 1 },
      };
      save.globalEffectSums.combatItemDropRateBoost = 50;
    });

    expect(migrated.globalEffectSums.combatItemDropRateBoost).toBe(5);
  });

  it('drops world state tied to content that no longer exists', () => {
    const caravan = ensureCaravan({
      id: 'caravan' as CaravanId,
      name: 'Caravan',
    });
    const task = ensureTask({ id: 'task' as TaskId, name: 'Task' });
    const larsia = ensureTown({ id: 'larsia' as TownId, name: 'Larsia' });
    seedContent([caravan, task, larsia]);
    seedWorldNodes([{ name: larsia.name, type: 'NonPlayerKingdom' }]);

    const migrated = migrate((save) => {
      save.world.commissions = {
        [caravan.id]: buildCommissionNodeState(),
        [gone<CaravanId>('caravan')]: buildCommissionNodeState(),
      };
      save.tasks = {
        [task.id]: { progress: 0 },
        [gone<TaskId>('task')]: { progress: 0 },
      };
      save.world.towns = {
        [larsia.id]: buildTownNodeState(),
        [gone<TownId>('town')]: buildTownNodeState(),
      };
      save.world.homeNodeName = 'Gone Town';
    });

    expect(Object.keys(migrated.world.commissions)).toEqual([caravan.id]);
    expect(Object.keys(migrated.tasks)).toEqual([task.id]);
    expect(Object.keys(migrated.world.towns)).toEqual([larsia.id]);
    expect(migrated.world.homeNodeName).toBeUndefined();
  });
});
