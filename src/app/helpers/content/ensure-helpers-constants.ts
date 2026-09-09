import {
  defaultAffinities,
  defaultCombatStats,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import type {
  AffixPosition,
  CaravanTradeType,
  CombatStatBlock,
  EquipmentItemType,
  EquipmentSkillAttribute,
  EquipmentSkillTargetBehavior,
  EquipmentSkillTargetType,
  GameElement,
  GameStat,
  MonsterType,
  StatusEffectTag,
} from '@interfaces';
import { EquipmentTypeToSlot } from '@interfaces';

export const VALID_GAME_ELEMENTS = Object.keys(
  defaultAffinities(),
) as GameElement[];
export const VALID_STATUS_EFFECT_TAGS = Object.keys(
  defaultTagResistances(),
) as StatusEffectTag[];
export const VALID_GAME_STATS = Object.keys(defaultStats()) as GameStat[];
export const VALID_COMBAT_STATS = Object.keys(
  defaultCombatStats(),
) as (keyof CombatStatBlock)[];
export const VALID_EQUIPMENT_ITEM_TYPES = Object.keys(
  EquipmentTypeToSlot,
) as EquipmentItemType[];
export const VALID_SKILL_TARGET_TYPES: EquipmentSkillTargetType[] = [
  'Allies',
  'Enemies',
  'Self',
  'All',
];
export const VALID_SKILL_TARGET_BEHAVIORS: EquipmentSkillTargetBehavior[] = [
  'Always',
  'NotZeroHealth',
  'NotMaxHealth',
  'IfStatusEffect',
  'IfNotStatusEffect',
];
export const VALID_AFFIX_POSITIONS: AffixPosition[] = ['Prefix', 'Suffix'];
export const VALID_SKILL_ATTRIBUTES: EquipmentSkillAttribute[] = [
  'BypassDefense',
  'NeverMisses',
  'DamagesTarget',
  'AllowPlink',
  'AllowLuckDodge',
  'HealsTarget',
  'Buff',
  'Debuff',
];

export const VALID_MONSTER_TYPES: MonsterType[] = [
  'Amalgamation',
  'Beast',
  'Demon',
  'Humanoid',
  'Insect',
  'Spirit',
];

export const VALID_CARAVAN_TRADE_TYPES: CaravanTradeType[] = ['sell', 'buy'];
