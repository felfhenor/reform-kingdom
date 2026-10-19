import { ensureEquipment, ensureItem } from '@helpers/content/ensure-item';
import { ensureJob } from '@helpers/content/ensure-job';
import { ensureSkillTreeNode } from '@helpers/content/ensure-skilltreenode';
import { defaultEquipment, defaultGameState } from '@helpers/defaults';
import type {
  Character,
  CharacterId,
  CombatOrderClause,
  CombatOrderClauseId,
  EquipmentContent,
  EquipmentId,
  EquipmentItem,
  GameState,
  ItemId,
  JobId,
  Regalia,
  RegaliaId,
  SkillTreeNodeId,
} from '@interfaces';
import { buildCharacter } from '@/testing/builders';
import { seedContent } from '@/testing/content';

export const warriorId = 'job-warrior' as JobId;
export const mageId = 'job-mage' as JobId;
export const warriorLv1NodeId = 'warrior-lv1' as SkillTreeNodeId;
export const warriorLv20NodeId = 'warrior-lv20' as SkillTreeNodeId;
export const swordId = 'sword' as EquipmentId;
export const shieldId = 'shield' as EquipmentId;
export const spearId = 'spear' as EquipmentId;
export const hatId = 'hat' as EquipmentId;
export const ringId = 'ring' as EquipmentId;
export const heavyHelmId = 'heavy-helm' as EquipmentId;
export const goldId = 'gold-coin' as ItemId;

export const randomClause: CombatOrderClause = {
  id: 'clause' as CombatOrderClauseId,
  enabled: true,
  condition: { type: 'Always' },
  action: { type: 'RandomSkill' },
};

const gear = (
  id: EquipmentId,
  type: EquipmentContent['type'],
  levelRequirement = 0,
) => ensureEquipment({ id, name: id, type, levelRequirement });

// Mage can wear hats and rings, so reclassing keeps some gear usable across both jobs.
export function seedRegaliaContent(): void {
  seedContent([
    ensureItem({ id: goldId, name: 'Gold Coin' }),
    gear(swordId, 'Sword'),
    gear(shieldId, 'Shield'),
    gear(spearId, 'Spear'),
    gear(hatId, 'Hat'),
    gear(ringId, 'Ring'),
    gear(heavyHelmId, 'Helm', 50),
    ensureJob({
      id: warriorId,
      name: 'Warrior',
      equippableTypes: ['Sword', 'Shield', 'Spear', 'Hat', 'Helm', 'Ring'],
    }),
    ensureJob({ id: mageId, name: 'Mage', equippableTypes: ['Hat', 'Ring'] }),
    ensureSkillTreeNode({
      id: warriorLv1NodeId,
      name: 'Warrior: Lv1',
      jobId: warriorId,
      level: 1,
    }),
    ensureSkillTreeNode({
      id: warriorLv20NodeId,
      name: 'Warrior: Lv20',
      jobId: warriorId,
      level: 20,
    }),
  ]);
}

export function regaliaHero(
  equipped: Partial<Character['equipment']> = {},
  overrides: Partial<Character> = {},
): Character {
  return buildCharacter({
    id: 'Jala' as CharacterId,
    jobId: warriorId,
    level: 10,
    equipment: { ...defaultEquipment(), ...equipped },
    ...overrides,
  });
}

export function buildRegalia(
  equipmentItemIds: EquipmentItem['id'][],
  overrides: Partial<Regalia> = {},
): Regalia {
  return {
    id: 'regalia-a' as RegaliaId,
    name: 'A',
    characterId: 'Jala' as CharacterId,
    jobId: warriorId,
    equipmentItemIds,
    combatOrders: [],
    burstSkillIds: [],
    skillTreeNodeIds: [],
    skillTreeVersion: 0,
    ...overrides,
  };
}

export function regaliaStateWith(
  character: Character,
  entries: Regalia[] = [],
  edit?: (state: GameState) => void,
): GameState {
  const state = defaultGameState();
  state.world.party = [character];
  state.regalias.entries = entries;
  edit?.(state);
  return state;
}

export const itemIds = (items: EquipmentItem[]) => items.map((item) => item.id);
