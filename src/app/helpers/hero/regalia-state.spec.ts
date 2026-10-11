import { beforeEach, describe, expect, it } from 'vitest';

import { defaultEquipment } from '@helpers/defaults';
import { regaliaMatchesCharacter } from '@helpers/hero/regalia';
import {
  stateCharacterUnequipForRegalia,
  stateRegaliaLoad,
  stateRegaliaVaultReconcile,
} from '@helpers/hero/regalia-state';
import type { CharacterId, EquipmentSkillId } from '@interfaces';
import { buildCharacter, buildEquipmentItem } from '@/testing/builders';
import {
  buildRegalia,
  hatId,
  heavyHelmId,
  itemIds,
  randomClause,
  regaliaHero,
  regaliaStateWith,
  shieldId,
  spearId,
  swordId,
  seedRegaliaContent,
  warriorId,
} from '@/testing/regalia';

beforeEach(seedRegaliaContent);

describe('stateCharacterUnequipForRegalia', () => {
  it('vaults gear the current regalia references and returns the rest to the armory', () => {
    const sword = buildEquipmentItem(swordId);
    const hat = buildEquipmentItem(hatId);
    const current = buildRegalia([sword.id]);
    const state = regaliaStateWith(
      regaliaHero(
        { Weapon: sword, Helmet: hat },
        { currentRegaliaIds: { [warriorId]: current.id } },
      ),
      [current],
    );

    stateCharacterUnequipForRegalia(state, 'Jala' as CharacterId);

    expect(itemIds(state.regalias.vault)).toEqual([sword.id]);
    expect(itemIds(state.armory)).toEqual([hat.id]);
    expect(state.world.party[0].equipment).toEqual(defaultEquipment());
  });

  it('returns everything to the armory without a current regalia', () => {
    const sword = buildEquipmentItem(swordId);
    const state = regaliaStateWith(regaliaHero({ Weapon: sword }), [
      buildRegalia([sword.id]),
    ]);

    stateCharacterUnequipForRegalia(state, 'Jala' as CharacterId);

    expect(state.regalias.vault).toEqual([]);
    expect(itemIds(state.armory)).toEqual([sword.id]);
  });
});

describe('stateRegaliaLoad', () => {
  it('equips from the vault and armory, applies orders and burst, and becomes current', () => {
    const sword = buildEquipmentItem(swordId);
    const shield = buildEquipmentItem(shieldId);
    const saved = buildRegalia([sword.id, shield.id], {
      combatOrders: [randomClause],
      burstSkillIds: ['burst' as EquipmentSkillId],
    });
    const state = regaliaStateWith(regaliaHero(), [saved], (s) => {
      s.regalias.vault = [sword];
      s.armory = [shield];
    });

    stateRegaliaLoad(state, 'Jala' as CharacterId, saved);

    const loaded = state.world.party[0];
    expect(loaded.equipment.Weapon?.id).toBe(sword.id);
    expect(loaded.equipment.Offhand?.id).toBe(shield.id);
    expect(loaded.combatOrders[warriorId]).toEqual([randomClause]);
    expect(loaded.burstSkills[warriorId]).toEqual(['burst']);
    expect(loaded.currentRegaliaIds[warriorId]).toBe(saved.id);
    expect(state.armory).toEqual([]);
    expect(state.regalias.vault).toEqual([]);
    expect(regaliaMatchesCharacter(saved, loaded)).toBe(true);
  });

  it('fills every slot a two-hander occupies', () => {
    const spear = buildEquipmentItem(spearId);
    const saved = buildRegalia([spear.id]);
    const state = regaliaStateWith(regaliaHero(), [saved], (s) => {
      s.regalias.vault = [spear];
    });

    stateRegaliaLoad(state, 'Jala' as CharacterId, saved);

    const { equipment } = state.world.party[0];
    expect(equipment.Weapon?.id).toBe(spear.id);
    expect(equipment.Offhand?.id).toBe(spear.id);
  });

  it('leaves gear it cannot equip in the armory, never taking from another hero', () => {
    const helm = buildEquipmentItem(heavyHelmId);
    const borrowed = buildEquipmentItem(swordId);
    const saved = buildRegalia([helm.id, borrowed.id]);
    const kim = buildCharacter({
      id: 'Kim' as CharacterId,
      jobId: warriorId,
      equipment: { ...defaultEquipment(), Weapon: borrowed },
    });
    const state = regaliaStateWith(regaliaHero(), [saved], (s) => {
      s.world.party.push(kim);
      s.regalias.vault = [helm];
    });

    stateRegaliaLoad(state, 'Jala' as CharacterId, saved);

    expect(state.world.party[0].equipment).toEqual(defaultEquipment());
    expect(state.world.party[1].equipment.Weapon?.id).toBe(borrowed.id);
    expect(itemIds(state.armory)).toEqual([helm.id]);
  });
});

describe('stateRegaliaVaultReconcile', () => {
  it('returns vault gear no regalia references to the armory', () => {
    const sword = buildEquipmentItem(swordId);
    const hat = buildEquipmentItem(hatId);
    const state = regaliaStateWith(
      regaliaHero(),
      [buildRegalia([sword.id])],
      (s) => {
        s.regalias.vault = [sword, hat];
      },
    );

    stateRegaliaVaultReconcile(state);

    expect(itemIds(state.regalias.vault)).toEqual([sword.id]);
    expect(itemIds(state.armory)).toEqual([hat.id]);
  });
});
