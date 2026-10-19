import { beforeEach, describe, expect, it } from 'vitest';

import { REGALIA_NAME_MAX_LENGTH } from '@helpers/config';
import {
  characterCurrentRegalia,
  characterJobRegalias,
  pruneInvalidCurrentRegaliaIds,
  pruneInvalidRegalias,
  regaliaAppliedCharacter,
  regaliaMatchesCharacter,
  regaliaMissingItems,
  regaliaNameClean,
  regaliaSnapshot,
} from '@helpers/hero/regalia';
import type {
  CharacterId,
  EquipmentId,
  EquipmentItemId,
  EquipmentSkillId,
  JobId,
  RegaliaId,
} from '@interfaces';
import { buildEquipmentItem } from '@/testing/builders';
import {
  buildRegalia,
  heavyHelmId,
  hatId,
  itemIds,
  mageId,
  randomClause,
  regaliaHero,
  seedRegaliaContent,
  shieldId,
  spearId,
  swordId,
  warriorId,
} from '@/testing/regalia';

beforeEach(seedRegaliaContent);

describe('regaliaSnapshot / regaliaMatchesCharacter', () => {
  it('snapshots unique gear, the current job orders and burst skill, then matches', () => {
    const spear = buildEquipmentItem(spearId);
    const character = regaliaHero(
      { Weapon: spear, Offhand: spear },
      {
        combatOrders: { [warriorId]: [randomClause] },
        burstSkills: { [warriorId]: ['burst' as EquipmentSkillId] },
      },
    );

    const snapshot = regaliaSnapshot(character, 'r' as RegaliaId, 'Name');

    expect(snapshot).toMatchObject({
      jobId: warriorId,
      equipmentItemIds: [spear.id],
      combatOrders: [randomClause],
      burstSkillIds: ['burst'],
    });
    expect(regaliaMatchesCharacter(snapshot, character)).toBe(true);
  });

  it('treats unconfigured orders and an empty list as the same', () => {
    const character = regaliaHero({}, { combatOrders: {} });
    expect(regaliaMatchesCharacter(buildRegalia([]), character)).toBe(true);
  });

  it('stops matching once gear, orders or burst skill change', () => {
    const sword = buildEquipmentItem(swordId);
    const saved = buildRegalia([sword.id]);

    expect(regaliaMatchesCharacter(saved, regaliaHero({ Weapon: sword }))).toBe(
      true,
    );
    expect(regaliaMatchesCharacter(saved, regaliaHero())).toBe(false);
    expect(
      regaliaMatchesCharacter(
        saved,
        regaliaHero(
          { Weapon: sword },
          { combatOrders: { [warriorId]: [randomClause] } },
        ),
      ),
    ).toBe(false);
    expect(
      regaliaMatchesCharacter(
        saved,
        regaliaHero(
          { Weapon: sword },
          { burstSkills: { [warriorId]: ['burst' as EquipmentSkillId] } },
        ),
      ),
    ).toBe(false);
  });
});

describe('characterJobRegalias / characterCurrentRegalia', () => {
  it('filters by hero and job, and resolves the current job pointer', () => {
    const own = buildRegalia([]);
    const otherJob = buildRegalia([], { id: 'b' as RegaliaId, jobId: mageId });
    const otherHero = buildRegalia([], {
      id: 'c' as RegaliaId,
      characterId: 'Kim' as CharacterId,
    });
    const entries = [own, otherJob, otherHero];

    expect(
      characterJobRegalias(entries, 'Jala' as CharacterId, warriorId),
    ).toEqual([own]);
    expect(
      characterCurrentRegalia(
        entries,
        regaliaHero({}, { currentRegaliaIds: { [warriorId]: own.id } }),
      ),
    ).toBe(own);
    expect(characterCurrentRegalia(entries, regaliaHero())).toBeUndefined();
  });
});

describe('regaliaMissingItems', () => {
  it('flags gear that is gone, or present but no longer equippable', () => {
    const sword = buildEquipmentItem(swordId);
    const shield = buildEquipmentItem(shieldId);
    const helm = buildEquipmentItem(heavyHelmId);
    const sold = buildEquipmentItem(hatId);

    const missing = regaliaMissingItems(
      buildRegalia([sword.id, shield.id, helm.id, sold.id]),
      regaliaHero({ Weapon: sword }),
      [shield, helm],
    );

    expect(missing).toEqual([
      { id: helm.id, reason: 'unequippable' },
      { id: sold.id, reason: 'gone' },
    ]);
  });

  it('flags an item a later item in the regalia pushes out of its slots', () => {
    // A sword exchanged into a two-handed spear keeps its id, so it now collides with the shield.
    const exchanged = buildEquipmentItem(spearId);
    const shield = buildEquipmentItem(shieldId);

    expect(
      regaliaMissingItems(
        buildRegalia([exchanged.id, shield.id]),
        regaliaHero(),
        [exchanged, shield],
      ),
    ).toEqual([{ id: exchanged.id, reason: 'displaced' }]);
  });

  it('flags every item a later two-hander pushes out', () => {
    const sword = buildEquipmentItem(swordId);
    const shield = buildEquipmentItem(shieldId);
    const spear = buildEquipmentItem(spearId);

    expect(
      regaliaMissingItems(
        buildRegalia([sword.id, shield.id, spear.id]),
        regaliaHero(),
        [sword, shield, spear],
      ),
    ).toEqual([
      { id: sword.id, reason: 'displaced' },
      { id: shield.id, reason: 'displaced' },
    ]);
  });

  it('ignores gone or unequippable items when working out displacement', () => {
    const spear = buildEquipmentItem(spearId);
    const shield = buildEquipmentItem(shieldId);

    expect(
      regaliaMissingItems(buildRegalia([spear.id, shield.id]), regaliaHero(), [
        shield,
      ]),
    ).toEqual([{ id: spear.id, reason: 'gone' }]);
  });
});

describe('regaliaAppliedCharacter', () => {
  it('swaps in the regalia gear and burst skill, leaving the rest of the hero alone', () => {
    const worn = buildEquipmentItem(hatId);
    const sword = buildEquipmentItem(swordId);
    const shield = buildEquipmentItem(shieldId);
    const character = regaliaHero(
      { Helmet: worn },
      { burstSkills: { [mageId]: ['other' as EquipmentSkillId] } },
    );

    const applied = regaliaAppliedCharacter(
      buildRegalia([sword.id, shield.id], {
        burstSkillIds: ['burst' as EquipmentSkillId],
      }),
      character,
      [sword, shield],
    );

    expect(applied.equipment).toMatchObject({
      Helmet: undefined,
      Weapon: sword,
      Offhand: shield,
    });
    expect(applied.burstSkills).toEqual({
      [mageId]: ['other'],
      [warriorId]: ['burst'],
    });
    expect(applied.name).toBe(character.name);
  });

  it('leaves out gear that is missing or displaced', () => {
    const sword = buildEquipmentItem(swordId);
    const shield = buildEquipmentItem(shieldId);
    const spear = buildEquipmentItem(spearId);
    const helm = buildEquipmentItem(heavyHelmId);

    const applied = regaliaAppliedCharacter(
      buildRegalia([
        sword.id,
        shield.id,
        spear.id,
        helm.id,
        'gone' as EquipmentItemId,
      ]),
      regaliaHero(),
      [sword, shield, spear, helm],
    );

    expect(applied.equipment).toMatchObject({
      Weapon: spear,
      Offhand: spear,
      Helmet: undefined,
    });
  });
});

describe('regaliaNameClean', () => {
  it('trims, caps at the max length, and falls back when blank', () => {
    expect(regaliaNameClean('  Tank  ', 'x')).toBe('Tank');
    expect(
      regaliaNameClean('a'.repeat(REGALIA_NAME_MAX_LENGTH + 10), 'x'),
    ).toHaveLength(REGALIA_NAME_MAX_LENGTH);
    expect(regaliaNameClean('   ', 'Fallback')).toBe('Fallback');
  });
});

describe('pruneInvalidRegalias / pruneInvalidCurrentRegaliaIds', () => {
  it('drops regalias for missing heroes or jobs, dedupes gear and drops unknown burst skills', () => {
    const sword = buildEquipmentItem(swordId);
    const kept = buildRegalia([sword.id, sword.id], {
      burstSkillIds: ['missing-skill' as EquipmentSkillId],
    });
    const goneHero = buildRegalia([], {
      id: 'b' as RegaliaId,
      characterId: 'Nobody' as CharacterId,
    });
    const goneJob = buildRegalia([], {
      id: 'c' as RegaliaId,
      jobId: 'job-removed' as JobId,
    });
    const removedGear = buildEquipmentItem('removed-gear' as EquipmentId);

    const pruned = pruneInvalidRegalias(
      { entries: [kept, goneHero, goneJob], vault: [sword, removedGear] },
      [regaliaHero()],
    );

    expect(pruned.entries).toEqual([
      {
        ...kept,
        equipmentItemIds: [sword.id],
        burstSkillIds: [],
        skillTreeVersion: 1,
      },
    ]);
    expect(itemIds(pruned.vault)).toEqual([sword.id]);
  });

  it('clears current pointers to regalias that no longer exist or belong to another job', () => {
    const kept = buildRegalia([]);
    expect(
      pruneInvalidCurrentRegaliaIds(
        { [warriorId]: kept.id, [mageId]: kept.id },
        [kept],
      ),
    ).toEqual({ [warriorId]: kept.id });
  });
});
