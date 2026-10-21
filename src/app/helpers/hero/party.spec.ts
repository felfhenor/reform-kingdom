import { beforeEach, describe, expect, it } from 'vitest';

import {
  CHARACTER_MAX_LEVEL,
  CHARACTER_XP_END,
  CHARACTER_XP_START,
} from '@helpers/config';
import { ensureAffix } from '@helpers/content/ensure-affix';
import { ensureEquipment } from '@helpers/content/ensure-item';
import { ensureJob } from '@helpers/content/ensure-job';
import { ensureSkillTreeNode } from '@helpers/content/ensure-skilltreenode';
import { ensureTrainerTeaching } from '@helpers/content/ensure-trainer';
import { defaultEquipment, defaultStats } from '@helpers/defaults';
import {
  affixEffectsStatsPerLevel,
  characterRecalculateStats,
  characterStats,
  characterStatsForLevel,
  characterXpForLevel,
  createCharacter,
  isPartyAtFullEnergy,
  isPartyAtFullHealth,
  partyAffixEffects,
  partyGatherYieldBonuses,
  pruneInvalidPartyEquipment,
} from '@helpers/hero/party';
import { trainerTeachingEffects } from '@helpers/trainer/trainer-teaching';
import type {
  AffixId,
  Character,
  EquipmentBlock,
  EquipmentId,
  JobId,
  SkillTreeNodeId,
  TradeskillId,
  TrainerTeachingId,
} from '@interfaces';
import { buildCharacter, buildEquipmentItem } from '@/testing/builders';
import { seedContent } from '@/testing/content';
import { buildEffectNode, heroLearning } from '@/testing/skill-tree';
import { seedGamestate } from '@/testing/gamestate';

const jobId = 'job-explorer' as JobId;
const cloak = ensureEquipment({
  id: 'cloak' as EquipmentId,
  name: 'Cloak of Adventuring',
  type: 'Cloth Armor',
});
const starterHat = ensureEquipment({
  id: 'starter-hat' as EquipmentId,
  name: 'Hat of Adventuring',
  type: 'Hat',
});
const job = ensureJob({
  id: jobId,
  name: 'Explorer',
  baseStats: { ...defaultStats(), Health: 100, Energy: 25, Strength: 5 },
  statsPerLevel: { ...defaultStats(), Health: 10, Strength: 0.5 },
  starterEquipmentIds: [cloak.id, starterHat.id],
});
const sword = ensureEquipment({
  id: 'sword' as EquipmentId,
  name: 'Sword',
  type: 'Sword',
  baseStats: { ...defaultStats(), Strength: 5, Health: 50 },
});
const cursedRing = ensureEquipment({
  id: 'cursed-ring' as EquipmentId,
  name: 'Cursed Ring',
  type: 'Ring',
  baseStats: { ...defaultStats(), Strength: -50, Health: -1000 },
});
const trinket = ensureEquipment({
  id: 'trinket' as EquipmentId,
  name: 'Trinket',
  type: 'Trinket',
  gatherYieldBonuses: [
    { tradeskillId: 'woodworking' as TradeskillId, value: 1 },
  ],
});
const mighty = ensureAffix({
  id: 'affix-str' as AffixId,
  name: 'of Strength',
  effects: [{ kind: 'Stat', stat: 'Strength', value: 3 }],
});

const drill = ensureTrainerTeaching({
  id: 'drill' as TrainerTeachingId,
  name: 'Drill',
  effects: [{ kind: 'Stat', stat: 'Strength', value: 2 }],
});

function withGear(equipment: Partial<EquipmentBlock>): EquipmentBlock {
  return { ...defaultEquipment(), ...equipment };
}

function hero(overrides: Partial<Character> = {}): Character {
  return buildCharacter({ jobId, ...overrides });
}

const baseContent = [
  job,
  cloak,
  starterHat,
  sword,
  cursedRing,
  trinket,
  mighty,
  drill,
];

beforeEach(() => {
  seedContent(baseContent);
});

describe('characterXpForLevel', () => {
  it('climbs from the starting to the final requirement, in round tens, faster as it goes', () => {
    const xp = Array.from({ length: CHARACTER_MAX_LEVEL }, (_, i) =>
      characterXpForLevel(i + 1),
    );
    const gaps = xp.slice(1).map((value, i) => value - xp[i]);

    expect(xp[0]).toBe(CHARACTER_XP_START);
    expect(xp.at(-1)).toBe(CHARACTER_XP_END);
    expect(xp.every((value) => value % 10 === 0)).toBe(true);
    expect(gaps.at(-1)).toBeGreaterThan(gaps[0]);
  });
});

describe('characterStatsForLevel', () => {
  it('grows the job stats per level and adds gear flat on top', () => {
    const stats = characterStatsForLevel(
      jobId,
      3,
      withGear({ Weapon: buildEquipmentItem(sword.id) }),
      [],
    );

    expect(stats.Health).toBe(100 + 10 * 2 + 50);
    expect(stats.Strength).toBe(5 + 0.5 * 2 + 5);
  });

  it('floors every stat at 1, even with crippling gear or an unknown job', () => {
    const cursed = characterStatsForLevel(
      jobId,
      1,
      withGear({ Ring: buildEquipmentItem(cursedRing.id) }),
      [],
    );
    expect(cursed.Strength).toBe(1);
    expect(cursed.Health).toBe(1);

    const unknown = characterStatsForLevel(
      'gone' as JobId,
      1,
      defaultEquipment(),
      [],
    );
    expect(Object.values(unknown).every((value) => value === 1)).toBe(true);
  });

  it('is what characterStats reports for the hero, teachings from every job included', () => {
    const jala = hero({
      teachings: { ['job-other' as JobId]: [drill.id] },
    });

    expect(characterStats({ ...jala, level: 3 })).toEqual(
      characterStatsForLevel(
        jobId,
        3,
        jala.equipment,
        trainerTeachingEffects([drill.id]),
      ),
    );
    expect(characterStats(jala).Strength).toBe(5 + 2);
  });

  it('adds StatPerLevel to job growth, so it covers every level already gained', () => {
    const effects = [
      { kind: 'StatPerLevel', stat: 'Strength', value: 0.25 } as const,
    ];

    expect(
      characterStatsForLevel(jobId, 1, defaultEquipment(), effects).Strength,
    ).toBe(5);
    expect(
      characterStatsForLevel(jobId, 5, defaultEquipment(), effects).Strength,
    ).toBe(5 + (0.5 + 0.25) * 4);
  });

  it('includes learned node effects in characterStats', () => {
    const grant = buildEffectNode('grant', [
      { kind: 'StatPerLevel', stat: 'Strength', value: 1 },
    ]);
    seedContent([...baseContent, grant]);
    const jala = heroLearning(hero({ level: 3 }), grant);

    expect(characterStats(jala).Strength).toBe(5 + (0.5 + 1) * 2);
  });
});

describe('createCharacter', () => {
  it('starts at level 1 with full pools, wearing its job starter gear', () => {
    const jala = createCharacter('Jala', jobId);

    expect(jala).toMatchObject({
      name: 'Jala',
      jobId,
      level: 1,
      xp: { current: 0, maximum: characterXpForLevel(1) },
      hp: jala.stats.Health,
      ep: jala.stats.Energy,
    });
    expect(jala.stats).toEqual(
      characterStatsForLevel(jobId, 1, jala.equipment, []),
    );
    expect(jala.equipment).toEqual(
      withGear({
        Armor: expect.objectContaining({ equipmentId: cloak.id }),
        Helmet: expect.objectContaining({ equipmentId: starterHat.id }),
      }),
    );
  });

  it("starts with its job's default tree nodes, their effects in its stats", () => {
    const strike = ensureSkillTreeNode({
      id: 'strike' as SkillTreeNodeId,
      name: 'Explorer: Strike',
      jobId,
      default: true,
      effects: [{ kind: 'Stat', stat: 'Strength', value: 3 }],
    });
    seedContent([ensureJob({ ...job, treeVersion: 3 }), strike]);
    const jala = createCharacter('Jala', jobId);

    expect(jala).toMatchObject({
      skillTreeNodes: { [jobId]: [strike.id] },
      skillTreeVersions: { [jobId]: 3 },
    });
    expect(jala.stats.Strength).toBe(job.baseStats.Strength + 3);
  });

  it('starts with its job default Combat Orders', () => {
    const condition = { type: 'Always' } as const;
    const action = { type: 'CastSkillFamily', family: 'Analyze' } as const;
    seedContent([
      ensureJob({ ...job, defaultCombatOrders: [{ condition, action }] }),
    ]);

    expect(createCharacter('Jala', jobId).combatOrders).toEqual({
      [jobId]: [{ id: expect.any(String), enabled: true, condition, action }],
    });
  });

  it('equips its job starter gear into every slot the item fills', () => {
    const bow = ensureEquipment({
      id: 'bow' as EquipmentId,
      name: 'Bow',
      type: 'Bow',
    });
    seedContent([ensureJob({ ...job, starterEquipmentIds: [bow.id] }), bow]);

    const { equipment } = createCharacter('Jala', jobId);

    expect(equipment.Weapon).toEqual(
      expect.objectContaining({ equipmentId: bow.id }),
    );
    expect(equipment.Offhand).toBe(equipment.Weapon);
  });

  it('starts empty-handed when the starter gear is not in content', () => {
    seedContent([job]);

    expect(createCharacter('Jala', jobId).equipment).toEqual(
      defaultEquipment(),
    );
  });
});

describe('characterRecalculateStats', () => {
  it('clamps current hp/ep to the recomputed maximums', () => {
    const recalculated = characterRecalculateStats(
      hero({ hp: 99_999, ep: 99_999 }),
    );

    expect(recalculated.hp).toBe(recalculated.stats.Health);
    expect(recalculated.ep).toBe(recalculated.stats.Energy);
  });
});

describe('pruneInvalidPartyEquipment', () => {
  it('drops gear no longer in content per hero, recomputing stats and clamping hp', () => {
    const armed = withGear({
      Weapon: buildEquipmentItem(sword.id),
      Armor: buildEquipmentItem(cloak.id),
    });
    const jala = hero({ equipment: armed });
    const spoorle = hero({
      equipment: withGear({ Armor: buildEquipmentItem(cloak.id) }),
    });
    seedContent([job, cloak]);

    const [prunedJala, prunedSpoorle] = pruneInvalidPartyEquipment([
      jala,
      spoorle,
    ]);

    expect(prunedJala.equipment).toEqual(withGear({ Armor: armed.Armor }));
    expect(prunedJala.stats.Health).toBe(jala.stats.Health - 50);
    expect(prunedJala.hp).toBe(prunedJala.stats.Health);
    expect(prunedSpoorle.equipment).toEqual(spoorle.equipment);
  });
});

describe('party-wide reads', () => {
  function seedParty(...party: Character[]): void {
    seedGamestate((state) => (state.world.party = party));
  }

  it('is at full health/energy only while every hero is', () => {
    const full = hero();
    seedParty(full, full);
    expect(isPartyAtFullHealth()).toBe(true);
    expect(isPartyAtFullEnergy()).toBe(true);

    seedParty(full, { ...full, hp: full.hp - 1 });
    expect(isPartyAtFullHealth()).toBe(false);
    expect(isPartyAtFullEnergy()).toBe(true);

    seedParty(full, { ...full, ep: full.ep - 1 });
    expect(isPartyAtFullHealth()).toBe(true);
    expect(isPartyAtFullEnergy()).toBe(false);
  });

  it('collects affix effects and gather yield bonuses from every hero’s gear', () => {
    seedParty(
      hero({
        equipment: withGear({
          Weapon: buildEquipmentItem(sword.id, { affixIds: [mighty.id] }),
        }),
      }),
      hero({ equipment: withGear({ Ring: buildEquipmentItem(trinket.id) }) }),
    );

    expect(partyAffixEffects()).toEqual(mighty.effects);
    expect(partyGatherYieldBonuses()).toEqual(trinket.gatherYieldBonuses);
  });
});

describe('affixEffectsStatsPerLevel', () => {
  it('sums per-level effects by stat and ignores flat stats', () => {
    const perLevel = affixEffectsStatsPerLevel([
      { kind: 'StatPerLevel', stat: 'Strength', value: 0.1 },
      { kind: 'StatPerLevel', stat: 'Strength', value: 0.05 },
      { kind: 'Stat', stat: 'Agility', value: 5 },
    ]);

    expect(perLevel.Strength).toBeCloseTo(0.15);
    expect(perLevel.Agility).toBe(0);
  });
});
