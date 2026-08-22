import { ensureContent } from '@helpers/content-initializers';
import type {
  EncounterContent,
  EncounterRandomContent,
  EquipmentContent,
  EquipmentSkillContent,
  GatheringContent,
  GlobalEffectContent,
  ItemContent,
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
          { itemId: 'gold', min: 1, max: 5, bonusPerLevel: 2, chance: 0.5 },
          { equipmentId: 'rusty-sword', chance: 0.1 },
          {},
        ],
        skills: [{ skillId: 'bite' }, {}],
      } as unknown as MonsterContent);

      expect(result.drops).toEqual([
        { itemId: 'gold', min: 1, max: 5, bonusPerLevel: 2, chance: 0.5 },
        { equipmentId: 'rusty-sword', chance: 0.1 },
        { itemId: 'UNKNOWN', min: 0, max: 0, chance: 0 },
      ]);
      expect(result.skills).toEqual([
        { skillId: 'bite', weight: 1 },
        { skillId: 'UNKNOWN', weight: 1 },
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

  describe('encounterrandom', () => {
    it('validates the creature pool, fights, and completion rewards, defaulting ranges/resetTime', () => {
      const result = ensureContent({
        __type: 'encounterrandom',
        id: 'gobslime-shrine',
        name: 'Mystical Gobslime Shrine',
        creaturePool: [{ monsterId: 'goblin', weight: 3 }, {}],
        completionRewards: [{ collectibleId: 'gobslime-flower', chance: 100 }],
      } as unknown as EncounterRandomContent);

      expect(result.resetTime).toBe(3600);
      expect(result.levelRange).toEqual({ min: 1, max: 1 });
      expect(result.encounterRange).toEqual({ min: 1, max: 1 });
      expect(result.combatantRange).toEqual({ min: 1, max: 1 });
      expect(result.creaturePool).toEqual([
        { monsterId: 'goblin', weight: 3 },
        { monsterId: 'UNKNOWN', weight: 1 },
      ]);
      expect(result.fights).toEqual([]);
      expect(result.completionRewards).toEqual([
        { collectibleId: 'gobslime-flower', chance: 100 },
      ]);
    });

    it('preserves an authored resetTime and ranges', () => {
      const result = ensureContent({
        __type: 'encounterrandom',
        id: 'gobslime-shrine',
        name: 'Mystical Gobslime Shrine',
        resetTime: 1800,
        levelRange: { min: 15, max: 18 },
        encounterRange: { min: 2, max: 4 },
        combatantRange: { min: 4, max: 7 },
      } as unknown as EncounterRandomContent);

      expect(result.resetTime).toBe(1800);
      expect(result.levelRange).toEqual({ min: 15, max: 18 });
      expect(result.encounterRange).toEqual({ min: 2, max: 4 });
      expect(result.combatantRange).toEqual({ min: 4, max: 7 });
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
        statPriority: ['Strength', 'NotAStat', 'Agility'],
        skillPath: [
          {
            pathName: 'Offense',
            levels: [{ level: 3, skillId: 'sweep' }, {}],
          },
        ],
      } as unknown as JobContent);

      expect(result.equippableTypes).toEqual(['Sword', 'Shield']);
      expect(result.statPriority).toEqual(['Strength', 'Agility']);
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

    it('filters invalid tags and defaults to an empty array when omitted', () => {
      const withTags = ensureContent({
        __type: 'statuseffect',
        id: 'stopped',
        name: 'Stopped',
        tags: ['StatDown', 'Accuracy', 'NotARealTag'],
      } as unknown as StatusEffectContent);
      expect(withTags.tags).toEqual(['StatDown', 'Accuracy']);

      const withoutTags = ensureContent({
        __type: 'statuseffect',
        id: 'empowered',
        name: 'Empowered',
      } as unknown as StatusEffectContent);
      expect(withoutTags.tags).toEqual([]);
    });
  });

  describe('equipment', () => {
    it('fills in debuffResistances densely, defaulting unauthored tags to 0', () => {
      const result = ensureContent({
        __type: 'equipment',
        id: 'oozemire-plate',
        name: 'Oozemire Plate',
        debuffResistances: { Poison: 6 },
      } as unknown as EquipmentContent);

      expect(result.debuffResistances).toEqual({
        Stun: 0,
        StatDown: 0,
        Accuracy: 0,
        DamageOverTime: 0,
        Poison: 6,
        Burn: 0,
      });
    });

    it('defaults to all-zero debuffResistances when omitted', () => {
      const result = ensureContent({
        __type: 'equipment',
        id: 'plain-sword',
        name: 'Plain Sword',
      } as unknown as EquipmentContent);

      expect(result.debuffResistances).toEqual({
        Stun: 0,
        StatDown: 0,
        Accuracy: 0,
        DamageOverTime: 0,
        Poison: 0,
        Burn: 0,
      });
    });
  });

  describe('item', () => {
    it('fills in infusionDebuffResistances densely, defaulting unauthored tags to 0', () => {
      const result = ensureContent({
        __type: 'item',
        id: 'spirit-flesh',
        name: 'Spirit Flesh',
        infusionDebuffResistances: { StatDown: 2 },
      } as unknown as ItemContent);

      expect(result.infusionDebuffResistances).toEqual({
        Stun: 0,
        StatDown: 2,
        Accuracy: 0,
        DamageOverTime: 0,
        Poison: 0,
        Burn: 0,
      });
    });
  });

  describe('globaleffect', () => {
    it('validates a DebuffResistance effect entry', () => {
      const result = ensureContent({
        __type: 'globaleffect',
        id: 'fortitude-of-the-warden-i',
        name: 'Fortitude of the Warden I',
        effects: [{ effectType: 'DebuffResistance', value: 10 }],
      } as unknown as GlobalEffectContent);

      expect(result.effects).toEqual([
        { effectType: 'DebuffResistance', value: 10 },
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
