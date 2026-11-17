import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/task/task-events');
vi.mock('@helpers/engine/page-visibility', () => ({
  isPageVisible: () => true,
}));

import {
  colosseumCreateFight,
  colosseumGearPool,
  colosseumPartyFromSetup,
} from '@helpers/colosseum/colosseum';
import {
  COLOSSEUM_LIVE_EVENT_SCOPE,
  colosseumBatchSummarize,
  colosseumFightOutcome,
  colosseumRunOne,
} from '@helpers/colosseum/colosseum-run';
import { colosseumSetupPrune } from '@helpers/colosseum/colosseum-setup';
import { combatantDamageEvents } from '@helpers/combat/combat-damage-events';
import { combatStep } from '@helpers/combat/combat';
import { combatEventScopeRun } from '@helpers/combat/combat-event-scope';
import {
  combatLog,
  combatLogReset,
  combatSimulationLog,
} from '@helpers/combat/combat-log';
import { COLOSSEUM_MAX_ROUNDS } from '@helpers/config';
import { ensureEncounter } from '@helpers/content/ensure-encounternode';
import { ensureEquipment } from '@helpers/content/ensure-item';
import { ensureJob } from '@helpers/content/ensure-job';
import { ensureMonster } from '@helpers/content/ensure-monster';
import {
  ensureEquipmentSkillTechnique,
  ensureSkill,
} from '@helpers/content/ensure-skill';
import { ensureSkillTreeNode } from '@helpers/content/ensure-skilltreenode';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import { legacy } from '@helpers/legacy/legacy';
import { gamestate } from '@helpers/state-game';
import type {
  Character,
  CharacterId,
  ColosseumRunResult,
  EncounterId,
  EquipmentId,
  EquipmentSkillId,
  JobId,
  MonsterId,
  SkillTreeNodeId,
} from '@interfaces';
import { captureAnalyticsEvents } from '@/testing/analytics';
import { buildCharacter, buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { seedGamestate } from '@/testing/gamestate';

const warriorId = 'job-warrior' as JobId;
const rangerId = 'job-ranger' as JobId;
const bowId = 'bow' as EquipmentId;
const swordId = 'sword' as EquipmentId;

const attack = ensureSkill({
  id: 'Attack' as EquipmentSkillId,
  name: 'Attack',
  family: 'Attack',
  epCost: 0,
  usesPerCombat: -1,
  techniques: [
    ensureEquipmentSkillTechnique({
      attributes: ['DamagesTarget'],
      targetType: 'Enemies',
      targetBehaviors: [{ behavior: 'NotZeroHealth' }],
      damageScaling: { ...defaultStats(), Strength: 1 },
      accuracy: 100,
      combatMessage: '{{ combatant.name }} attacks.',
    }),
  ],
});
const job = (id: JobId, name: string, types: ('Bow' | 'Sword')[]) =>
  ensureJob({
    id,
    name,
    baseStats: { ...defaultStats(), Health: 200, Energy: 20, Strength: 30 },
    equippableTypes: types,
  });
const rat = ensureMonster({
  id: 'rat' as MonsterId,
  name: 'Rat',
  baseStats: { ...defaultStats(), Health: 5 },
});
const arena = ensureEncounter({
  id: 'arena' as EncounterId,
  name: 'Arena',
  levelRange: { min: 1, max: 1 },
  fights: [
    { monsters: [{ monsterId: rat.id }] },
    { monsters: [{ monsterId: rat.id }, { monsterId: rat.id }] },
  ],
});
const rangerNode = ensureSkillTreeNode({
  id: 'ranger-aim' as SkillTreeNodeId,
  name: 'Ranger: Aim',
  jobId: rangerId,
  default: true,
});

const bow = buildEquipmentItem(bowId);
const sword = buildEquipmentItem(swordId);

function hero(name: string, overrides: Partial<Character> = {}): Character {
  return buildCharacter({
    id: name as CharacterId,
    name,
    jobId: warriorId,
    ...overrides,
  });
}

beforeEach(() => {
  seedContent([
    attack,
    job(warriorId, 'Warrior', ['Sword']),
    job(rangerId, 'Ranger', ['Bow']),
    ensureEquipment({ id: bowId, name: 'Bow', type: 'Bow' }),
    ensureEquipment({ id: swordId, name: 'Sword', type: 'Sword' }),
    rat,
    arena,
    rangerNode,
  ]);
  combatLogReset();
  combatSimulationLog.set([]);
  combatantDamageEvents.set([]);
});

describe('colosseumGearPool', () => {
  it('lists each owned item once, a two-hander included', () => {
    const archer = hero('Ana', {
      equipment: { ...defaultEquipment(), Weapon: bow, Offhand: bow },
    });

    const pool = colosseumGearPool([archer], [sword]);
    expect(pool.map((item) => item.id)).toEqual([bow.id, sword.id]);
  });
});

describe('colosseumPartyFromSetup', () => {
  const pick = (itemId: typeof sword.id, equipmentId: EquipmentId) => ({
    itemId,
    equipmentId,
  });

  it('keeps real ids, refills a downed hero and recalculates for new gear', () => {
    const real = hero('Bo', { hp: 0 });
    seedGamestate((state) => (state.world.party = [real]));
    const setup = {
      heroes: [
        {
          characterId: real.id,
          equipment: { Weapon: pick(sword.id, swordId) },
        },
      ],
    };

    const [sim] = colosseumPartyFromSetup([real], setup, [sword]);
    expect(sim.id).toBe(real.id);
    expect(sim.equipment.Weapon?.id).toBe(sword.id);
    expect(sim.hp).toBe(sim.stats.Health);
    expect(sim.hp).toBeGreaterThan(0);
  });

  it('gives an item to the hero who picked it, taking it off the real wearer', () => {
    const wearer = hero('Ce', {
      equipment: { ...defaultEquipment(), Weapon: sword },
    });
    const picker = hero('Da');
    seedGamestate((state) => (state.world.party = [wearer, picker]));
    const setup = {
      heroes: [
        {
          characterId: picker.id,
          equipment: { Weapon: pick(sword.id, swordId) },
        },
      ],
    };

    const [simWearer, simPicker] = colosseumPartyFromSetup(
      [wearer, picker],
      setup,
      [],
    );
    expect(simPicker.equipment.Weapon?.id).toBe(sword.id);
    expect(simWearer.equipment.Weapon).toBeUndefined();
  });

  it("drops gear in a slot its type can't fill, or that the new job can't wear", () => {
    const real = hero('Ed', {
      equipment: { ...defaultEquipment(), Weapon: sword },
    });
    seedGamestate((state) => (state.world.party = [real]));
    const misslotted = {
      heroes: [
        {
          characterId: real.id,
          equipment: { Helmet: pick(sword.id, swordId) },
        },
      ],
    };
    const reclassed = { heroes: [{ characterId: real.id, jobId: rangerId }] };

    expect(
      colosseumPartyFromSetup([real], misslotted, [])[0].equipment.Helmet,
    ).toBeUndefined();
    const ranger = colosseumPartyFromSetup([real], reclassed, [])[0];
    expect(ranger.jobId).toBe(rangerId);
    expect(ranger.equipment.Weapon).toBeUndefined();
    expect(gamestate().world.party[0]).toEqual(real);
  });
});

describe('colosseumSetupPrune', () => {
  it('names sold gear and unvisited places, and drops unknown heroes and foreign tree nodes', () => {
    const real = hero('Di');
    const setup = {
      encounterId: arena.id,
      heroes: [
        {
          characterId: real.id,
          equipment: { Weapon: { itemId: sword.id, equipmentId: swordId } },
          skillTreeNodes: [rangerNode.id],
        },
        { characterId: 'gone' as CharacterId, jobId: rangerId },
      ],
    };
    seedGamestate((state) => (state.world.party = [real]));

    const { setup: pruned, dropped } = colosseumSetupPrune(setup, [real], []);
    expect(pruned.encounterId).toBeUndefined();
    expect(pruned.heroes.map((edit) => edit.characterId)).toEqual([real.id]);
    expect(pruned.heroes[0].equipment).toEqual({});
    expect(pruned.heroes[0].skillTreeNodes).toBeUndefined();
    expect(dropped).toEqual([
      'Sword (no longer owned)',
      '1 skill tree node on Di',
      'Arena (not visited)',
    ]);
  });
});

describe('colosseum runs', () => {
  it('calls a fight that runs past the round cap a stalemate', () => {
    const real = hero('Ed');
    seedGamestate((state) => (state.world.party = [real]));
    const combat = colosseumCreateFight([real], arena.id, 0, {
      manual: false,
      quiet: true,
    });

    expect(combat && colosseumFightOutcome(combat)).toBeUndefined();
    expect(
      combat &&
        colosseumFightOutcome({ ...combat, rounds: COLOSSEUM_MAX_ROUNDS }),
    ).toBe('Stalemate');
  });

  it('plays whole encounters without touching the game, the adventure log, Legacy or analytics', async () => {
    const party = [hero('Fa'), hero('Gu')];
    seedGamestate((state) => (state.world.party = party));
    const sim = colosseumPartyFromSetup(party, { heroes: [] }, []);
    const before = structuredClone(gamestate());
    const legacyBefore = structuredClone(legacy());
    const events = captureAnalyticsEvents();

    const results = Array.from({ length: 20 }, () =>
      colosseumRunOne(sim, arena.id),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(results.every((result) => result?.outcome === 'Won')).toBe(true);
    expect(results[0]?.heroes[party[0].id]?.damageDealt).toBeGreaterThan(0);
    expect(gamestate()).toEqual(before);
    expect(legacy()).toEqual(legacyBefore);
    expect(combatLog()).toEqual([]);
    expect(combatantDamageEvents()).toEqual([]);
    expect(events).toEqual([]);
  });
});

describe('live colosseum fights', () => {
  it('log to the sim log and key status events apart from the world', () => {
    const real = hero('Ib');
    seedGamestate((state) => (state.world.party = [real]));
    const [sim] = colosseumPartyFromSetup([real], { heroes: [] }, []);
    const combat = colosseumCreateFight([sim], arena.id, 0, {
      manual: false,
      quiet: false,
    });

    combatEventScopeRun(
      COLOSSEUM_LIVE_EVENT_SCOPE,
      () => combat && combatStep(combat),
    );
    expect(combatLog()).toEqual([]);
    expect(combatSimulationLog().length).toBeGreaterThan(0);
    expect(combatantDamageEvents().length).toBeGreaterThan(0);
    expect(
      combatantDamageEvents().every((e) =>
        e.combatantId.startsWith('colosseum:'),
      ),
    ).toBe(true);
  });
});

describe('colosseumBatchSummarize', () => {
  it('averages per run and counts losses on the fight they happened', () => {
    const id = 'Ha' as CharacterId;
    const run = (
      outcome: ColosseumRunResult['outcome'],
      fightIndex: number,
      damageDealt: number,
    ): ColosseumRunResult => ({
      outcome,
      rounds: 10,
      fightIndex,
      heroes: { [id]: { ...emptyStats(), damageDealt, deaths: 1 } },
    });

    const summary = colosseumBatchSummarize(
      [run('Won', 1, 30), run('Lost', 1, 10), run('Stalemate', 0, 20)],
      2,
      [id],
    );
    expect(summary).toMatchObject({
      runs: 3,
      wins: 1,
      stalemates: 1,
      averageRounds: 10,
      averageHeroDeaths: 1,
      lossesByFight: [1, 1],
    });
    expect(summary.winRate).toBeCloseTo(1 / 3);
    expect(summary.heroes[0].damageDealt).toBe(20);
  });
});

function emptyStats() {
  return {
    kills: 0,
    damageDealt: 0,
    damageTaken: 0,
    deaths: 0,
    healing: 0,
    crits: 0,
    statusEffectsApplied: 0,
    damageBlocked: 0,
    fights: 0,
    skillUses: {},
  };
}
