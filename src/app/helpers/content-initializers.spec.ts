import { ensureContent } from '@helpers/content-initializers';
import type {
  EncounterContent,
  EquipmentSkillContent,
  GatheringContent,
  JobContent,
  MonsterContent,
  RecipeContent,
  StatusEffectContent,
} from '@interfaces';
import { describe, expect, it } from 'vitest';

describe('ensureContent', () => {
  describe('monster', () => {
    it('fills in defaults for malformed drop and skill entries', () => {
      const result = ensureContent({
        __type: 'monster',
        id: 'goblin',
        name: 'Goblin',
        drops: [
          { itemId: 'gold', min: 1, max: 5, multiplierPerLevel: 2, chance: 0.5 },
          { equipmentId: 'rusty-sword', chance: 0.1 },
          {},
        ],
        skills: [{ skillId: 'bite' }, {}],
      } as unknown as MonsterContent);

      expect(result.drops).toEqual([
        { itemId: 'gold', min: 1, max: 5, multiplierPerLevel: 2, chance: 0.5 },
        { equipmentId: 'rusty-sword', chance: 0.1 },
        { itemId: 'UNKNOWN', min: 0, max: 0, multiplierPerLevel: 1, chance: 0 },
      ]);
      expect(result.skills).toEqual([
        { skillId: 'bite' },
        { skillId: 'UNKNOWN' },
      ]);
    });

    it('returns an empty array when drops/skills are missing entirely', () => {
      const result = ensureContent({
        __type: 'monster',
        id: 'goblin',
        name: 'Goblin',
      } as unknown as MonsterContent);

      expect(result.drops).toEqual([]);
      expect(result.skills).toEqual([]);
    });
  });

  describe('encounter', () => {
    it('validates nested fight monsters and completion rewards', () => {
      const result = ensureContent({
        __type: 'encounter',
        id: 'forest-clearing',
        name: 'Forest Clearing',
        fights: [{ monsters: [{ monsterId: 'goblin' }, {}] }, {}],
        completionRewards: [{ collectibleId: 'seed', chance: 1 }],
      } as unknown as EncounterContent);

      expect(result.fights).toEqual([
        { monsters: [{ monsterId: 'goblin' }, { monsterId: 'UNKNOWN' }] },
        { monsters: [] },
      ]);
      expect(result.completionRewards).toEqual([
        { collectibleId: 'seed', chance: 1 },
      ]);
    });
  });

  describe('gathering', () => {
    it('validates nested gather result items', () => {
      const result = ensureContent({
        __type: 'gathering',
        id: 'oak-tree',
        name: 'Oak Tree',
        gatherResults: [
          { chance: 0.5, items: [{ itemId: 'wood', quantity: 3 }, {}] },
        ],
      } as unknown as GatheringContent);

      expect(result.gatherResults).toEqual([
        {
          chance: 0.5,
          items: [
            { itemId: 'wood', quantity: 3 },
            { itemId: 'UNKNOWN', quantity: 1 },
          ],
        },
      ]);
    });
  });

  describe('job', () => {
    it('filters invalid equippableTypes and validates skill paths', () => {
      const result = ensureContent({
        __type: 'job',
        id: 'warrior',
        name: 'Warrior',
        equippableTypes: ['Sword', 'NotAType', 'Shield'],
        skillPath: [
          {
            pathName: 'Offense',
            levels: [{ level: 3, skillId: 'sweep' }, {}],
          },
        ],
      } as unknown as JobContent);

      expect(result.equippableTypes).toEqual(['Sword', 'Shield']);
      expect(result.skillPath).toEqual([
        {
          pathName: 'Offense',
          levels: [
            { level: 3, skillId: 'sweep' },
            { level: 1, skillId: 'UNKNOWN' },
          ],
        },
      ]);
    });
  });

  describe('recipe', () => {
    it('discriminates requirement variants and fills defaults', () => {
      const result = ensureContent({
        __type: 'recipe',
        id: 'iron-sword',
        name: 'Iron Sword',
        requirements: [
          { itemId: 'iron-ore', quantity: 3 },
          { equipmentId: 'hammer' },
          { collectibleId: 'blueprint' },
          {},
        ],
      } as unknown as RecipeContent);

      expect(result.requirements).toEqual([
        { itemId: 'iron-ore', quantity: 3 },
        { equipmentId: 'hammer' },
        { collectibleId: 'blueprint' },
        { itemId: 'UNKNOWN', quantity: 1 },
      ]);
    });
  });

  describe('statuseffect', () => {
    it('filters invalid elements and validates behavior variants', () => {
      const result = ensureContent({
        __type: 'statuseffect',
        id: 'burning',
        name: 'Burning',
        elements: ['Fire', 'NotAnElement'],
        onTick: [
          {
            type: 'AddCombatStatNumber',
            combatStat: 'missChance',
            value: 5,
          },
          { type: 'TakeDamage' },
          { type: 'NotARealBehavior' },
        ],
      } as unknown as StatusEffectContent);

      expect(result.elements).toEqual(['Fire']);
      expect(result.onTick).toEqual([
        {
          type: 'AddCombatStatNumber',
          combatMessage: undefined,
          combatStat: 'missChance',
          value: 5,
        },
        { type: 'TakeDamage', combatMessage: undefined },
        { type: 'SendMessage', combatMessage: 'UNKNOWN' },
      ]);
    });

    it('falls back to a valid default when an enum field is bogus', () => {
      const result = ensureContent({
        __type: 'statuseffect',
        id: 'burning',
        name: 'Burning',
        onApply: [
          {
            type: 'AddCombatStatNumber',
            combatStat: 'notARealStat',
            value: 5,
          },
        ],
      } as unknown as StatusEffectContent);

      expect(result.onApply).toEqual([
        {
          type: 'AddCombatStatNumber',
          combatMessage: undefined,
          combatStat: 'repeatActionChance',
          value: 5,
        },
      ]);
    });
  });

  describe('skill', () => {
    it('validates nested technique arrays, filtering bogus enum values', () => {
      const result = ensureContent({
        __type: 'skill',
        id: 'fireball',
        name: 'Fireball',
        techniques: [
          {
            targets: 1,
            targetType: 'NotAType',
            elements: ['Fire', 'NotAnElement'],
            attributes: ['DamagesTarget', 'NotAnAttribute'],
            targetBehaviors: [{ behavior: 'Always' }, { behavior: 'Bogus' }],
            statusEffects: [{ statusEffectId: 'burn', chance: 0.2, duration: 3 }],
          },
        ],
      } as unknown as EquipmentSkillContent);

      expect(result.techniques).toHaveLength(1);
      const technique = result.techniques[0];
      expect(technique.targetType).toBe('Enemies');
      expect(technique.elements).toEqual(['Fire']);
      expect(technique.attributes).toEqual(['DamagesTarget']);
      expect(technique.targetBehaviors).toEqual([
        { behavior: 'Always', statusEffectId: undefined },
        { behavior: 'Always', statusEffectId: undefined },
      ]);
      expect(technique.statusEffects).toEqual([
        { statusEffectId: 'burn', chance: 0.2, duration: 3 },
      ]);
    });

    it('returns an empty techniques array when omitted', () => {
      const result = ensureContent({
        __type: 'skill',
        id: 'fireball',
        name: 'Fireball',
      } as unknown as EquipmentSkillContent);

      expect(result.techniques).toEqual([]);
    });
  });
});
