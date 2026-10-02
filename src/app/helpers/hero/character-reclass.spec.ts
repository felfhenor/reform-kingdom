import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/task/task-events');

import { RECLASS_GOLD_PER_LEVEL } from '@helpers/config';
import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureJob } from '@helpers/content/ensure-job';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import {
  characterJobLevel,
  characterReclass,
  characterReclassCost,
  charactersReclass,
} from '@helpers/hero/character-reclass';
import {
  characterStatsForLevel,
  characterXpForLevel,
} from '@helpers/hero/party';
import { applyMaterialDelta } from '@helpers/item/materials';
import { armoryState, gamestate, worldPartyState } from '@helpers/state-game';
import { taskEventLevelReached } from '@helpers/task/task-events';
import type {
  Character,
  CharacterId,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  GameState,
  IsContentItem,
  ItemId,
  JobContent,
  JobId,
} from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { buildCharacter, buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const explorerId = 'job-explorer' as JobId;
const warriorId = 'job-warrior' as JobId;
const goldId = 'gold-coin' as ItemId;
const cloakId = 'cloak' as EquipmentId;
const hatId = 'hat' as EquipmentId;
const swordId = 'sword' as EquipmentId;
const spearId = 'spear' as EquipmentId;
const shieldId = 'shield' as EquipmentId;

const gear = (id: EquipmentId, type: EquipmentContent['type'], Strength = 0) =>
  ensureEquipment({
    id,
    name: id,
    type,
    baseStats: { ...defaultStats(), Strength },
  });

function seedJobs(warrior: Partial<JobContent> = {}): void {
  const content: IsContentItem[] = [
    ensureItem({ id: goldId, name: 'Gold Coin' }),
    gear(cloakId, 'Cloth Armor'),
    gear(hatId, 'Hat'),
    gear(swordId, 'Sword', 10),
    gear(spearId, 'Spear', 3),
    gear(shieldId, 'Shield', 2),
    ensureJob({
      id: explorerId,
      name: 'Explorer',
      baseStats: { ...defaultStats(), Health: 100, Energy: 25 },
      statsPerLevel: { ...defaultStats(), Health: 10, Energy: 5 },
    }),
    ensureJob({
      id: warriorId,
      name: 'Warrior',
      baseStats: { ...defaultStats(), Health: 150, Energy: 20, Strength: 15 },
      statsPerLevel: { ...defaultStats(), Health: 10 },
      statPriority: [{ stat: 'Strength', multiplier: 1 }],
      ...warrior,
    }),
  ];
  seedContent(content);
}

function hero(name: string, overrides: Partial<Character> = {}): Character {
  return buildCharacter({
    id: name as CharacterId,
    name,
    jobId: explorerId,
    equipment: {
      ...defaultEquipment(),
      Armor: buildEquipmentItem(cloakId),
      Helmet: buildEquipmentItem(hatId),
    },
    ...overrides,
  });
}

function seedWorld(
  party: Character[],
  gold = 100_000,
  armory: EquipmentItem[] = [],
): void {
  seedGamestate((state: GameState) => {
    state.world.party = party;
    state.armory = armory;
    applyMaterialDelta(state, goldId, gold);
  });
}

function reclassed(index = 0): Character {
  return worldPartyState()[index];
}

beforeEach(() => {
  vi.clearAllMocks();
  seedJobs();
});

describe('characterJobLevel / characterReclassCost', () => {
  const jala = hero('Jala', {
    level: 10,
    jobProgress: {
      [warriorId]: { level: 7, xp: { current: 0, maximum: 1 } },
    },
  });

  it('resumes the active job at the current level, a held job at its saved level, else 1', () => {
    expect(characterJobLevel(jala, explorerId)).toBe(10);
    expect(characterJobLevel(jala, warriorId)).toBe(7);
    expect(characterJobLevel(jala, 'job-unheld' as JobId)).toBe(1);
  });

  it('prices the reclass by the level of the job being entered', () => {
    expect(characterReclassCost(jala, warriorId)).toBe(
      7 * RECLASS_GOLD_PER_LEVEL,
    );
    expect(characterReclassCost(jala, 'job-unheld' as JobId)).toBe(
      RECLASS_GOLD_PER_LEVEL,
    );
  });
});

describe('characterReclass', () => {
  it('switches job at level 1 with stats, hp and ep recomputed for the new job', async () => {
    seedJobs({ equippableTypes: [] });
    seedWorld([hero('Jala', { level: 10 })]);

    await characterReclass('Jala' as CharacterId, warriorId);

    const stats = characterStatsForLevel(warriorId, 1, defaultEquipment(), []);
    expect(reclassed()).toMatchObject({
      jobId: warriorId,
      level: 1,
      xp: { current: 0, maximum: characterXpForLevel(1) },
      stats,
      hp: stats.Health,
      ep: stats.Energy,
      equipment: defaultEquipment(),
    });
  });

  it('moves the old gear to the armory, after anything already there', async () => {
    seedJobs({ equippableTypes: [] });
    const jala = hero('Jala');
    const existing = buildEquipmentItem(swordId);
    seedWorld([jala], 100_000, [existing]);

    await characterReclass(jala.id, warriorId);

    expect(armoryState()).toEqual([
      existing,
      jala.equipment.Armor,
      jala.equipment.Helmet,
    ]);
  });

  it('saves the outgoing job and restores it when reclassing back', async () => {
    const jala = hero('Jala', {
      level: 10,
      xp: { current: 50, maximum: characterXpForLevel(10) },
    });
    seedWorld([jala]);

    await characterReclass(jala.id, warriorId);
    expect(reclassed().jobProgress[explorerId]).toEqual({
      level: 10,
      xp: jala.xp,
    });

    await characterReclass(jala.id, explorerId);
    expect(reclassed()).toMatchObject({
      level: 10,
      xp: jala.xp,
      stats: characterStatsForLevel(explorerId, 10, defaultEquipment(), []),
    });
    expect(reclassed().jobProgress[explorerId]).toBeUndefined();
    expect(reclassed().jobProgress[warriorId]).toEqual({
      level: 1,
      xp: { current: 0, maximum: characterXpForLevel(1) },
    });
  });

  it('spends gold for the target level, leaving everything untouched if unaffordable', async () => {
    seedWorld([hero('Jala')], RECLASS_GOLD_PER_LEVEL - 1);
    const before = gamestate();

    await characterReclass('Jala' as CharacterId, warriorId);
    expect(gamestate()).toBe(before);

    seedWorld([hero('Jala')], RECLASS_GOLD_PER_LEVEL);
    await characterReclass('Jala' as CharacterId, warriorId);
    expect(reclassed().jobId).toBe(warriorId);
    expect(gamestate().materials[goldId]).toBeUndefined();
  });

  it('leaves other party members alone', async () => {
    const spoorle = hero('Spoorle');
    seedWorld([hero('Jala'), spoorle]);

    await characterReclass('Jala' as CharacterId, warriorId);

    expect(reclassed(1)).toEqual(spoorle);
  });
});

describe('charactersReclass (batch)', () => {
  it('reclasses every pick, then reports them', async () => {
    seedWorld([hero('Jala'), hero('Spoorle')]);
    const events = captureAnalyticsEvents();

    await charactersReclass([
      { characterId: 'Jala' as CharacterId, jobId: warriorId },
      { characterId: 'Spoorle' as CharacterId, jobId: warriorId },
    ]);

    expect(worldPartyState().map((c) => c.jobId)).toEqual([
      warriorId,
      warriorId,
    ]);
    expect(events).toEqual([
      'Hero:Reclass:Start:Warrior',
      'Hero:Reclass:Start:Warrior',
      'Hero:Reclass:Start',
    ]);
    expect(taskEventLevelReached).toHaveBeenCalledWith(1);
  });

  it('shares one gold pool, so a later pick is skipped once earlier ones spend it', async () => {
    seedWorld([hero('Jala'), hero('Spoorle')], RECLASS_GOLD_PER_LEVEL);
    const events = captureAnalyticsEvents();

    await charactersReclass([
      { characterId: 'Jala' as CharacterId, jobId: warriorId },
      { characterId: 'Spoorle' as CharacterId, jobId: warriorId },
    ]);

    expect(worldPartyState().map((c) => c.jobId)).toEqual([
      warriorId,
      explorerId,
    ]);
    expect(events).toEqual([
      'Hero:Reclass:Start:Warrior',
      'Hero:Reclass:Start',
    ]);
  });

  it('reports nothing when no pick could be afforded', async () => {
    seedWorld([hero('Jala')], 0);
    const events = captureAnalyticsEvents();

    await charactersReclass([
      { characterId: 'Jala' as CharacterId, jobId: warriorId },
    ]);

    expect(events).toEqual([]);
    expect(taskEventLevelReached).not.toHaveBeenCalled();
  });
});

describe('auto-optimizing the new loadout', () => {
  async function reclassWith(
    equippableTypes: JobContent['equippableTypes'],
    ...armory: EquipmentItem[]
  ): Promise<Character> {
    seedJobs({ equippableTypes });
    seedWorld([hero('Jala')], 100_000, armory);
    await characterReclass('Jala' as CharacterId, warriorId);
    return reclassed();
  }

  it('equips the best fitting armory item and counts it in the new stats', async () => {
    const sword = buildEquipmentItem(swordId);

    const jala = await reclassWith(['Sword'], sword);

    expect(jala.equipment.Weapon).toEqual(sword);
    expect(armoryState()).not.toContainEqual(sword);
    expect(jala.stats.Strength).toBe(15 + 10);
  });

  it('equips a two-hander into every slot it fills', async () => {
    const spear = buildEquipmentItem(spearId);

    const jala = await reclassWith(['Spear'], spear);

    expect(jala.equipment.Weapon).toEqual(spear);
    expect(jala.equipment.Offhand).toEqual(spear);
  });

  it('prefers a one-hander plus shield over a weaker two-hander, keeping the loser', async () => {
    const [sword, spear, shield] = [swordId, spearId, shieldId].map((id) =>
      buildEquipmentItem(id),
    );

    const jala = await reclassWith(
      ['Sword', 'Spear', 'Shield'],
      spear,
      sword,
      shield,
    );

    expect(jala.equipment.Weapon).toEqual(sword);
    expect(jala.equipment.Offhand).toEqual(shield);
    expect(armoryState()).toContainEqual(spear);
  });

  it('equips nothing when no armory item fits, or the new job no longer exists', async () => {
    const sword = buildEquipmentItem(swordId);
    expect((await reclassWith([], sword)).equipment).toEqual(
      defaultEquipment(),
    );

    seedWorld([hero('Jala')], 100_000, [sword]);
    await characterReclass('Jala' as CharacterId, 'gone' as JobId);
    expect(reclassed().equipment).toEqual(defaultEquipment());
    expect(armoryState()).toContainEqual(sword);
  });
});
