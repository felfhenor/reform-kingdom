import type { HasAnimation } from '@interfaces/artable';
import type {
  EquipmentSkill,
  EquipmentSkillId,
} from '@interfaces/content-skill';
import type { StatusEffect } from '@interfaces/content-statuseffect';
import type { ElementBlock } from '@interfaces/element';
import type { Branded } from '@interfaces/identifiable';
import type { StatBlock } from '@interfaces/stat';

export type CombatId = Branded<string, 'CombatId'>;

export type CombatantStatusEffectData = {
  isFrozen?: boolean;
};

export type CombatantCombatStats = {
  repeatActionChance: ElementBlock;
  skillStrikeAgainChance: ElementBlock;
  skillAdditionalUseChance: ElementBlock;
  skillAdditionalUseCount: ElementBlock;
  redirectionChance: ElementBlock;
  missChance: ElementBlock;
  debuffIgnoreChance: ElementBlock;
  damageReflectPercent: ElementBlock;
  healingIgnorePercent: ElementBlock;
  reviveChance: number;
};

export type CombatantTargettingType = 'Random' | 'Strongest' | 'Weakest';

export type Combatant = HasAnimation & {
  id: string;
  name: string;

  isEnemy: boolean;
  // Set only for enemy combatants; the MonsterId they were created from, so
  // rewards (XP/drops) can be resolved once combat ends. Left untyped as
  // MonsterId to avoid a circular import between combat.ts and
  // content-monster.ts.
  monsterId?: string;

  level: number;
  hp: number;

  targettingType: CombatantTargettingType;

  baseStats: StatBlock;
  statBoosts: StatBlock;
  totalStats: StatBlock;

  combatStats: CombatantCombatStats;

  resistance: ElementBlock;
  affinity: ElementBlock;

  skillIds: EquipmentSkillId[];
  skillRefs: EquipmentSkill[];

  skillUses: Record<EquipmentSkillId, number>;

  statusEffects: StatusEffect[];
  statusEffectData: CombatantStatusEffectData;

  sprite?: string;
};

export type Combat = {
  id: CombatId;
  locationName: string;
  locationPosition: { x: number; y: number };
  rounds: number;
  heroes: Combatant[];
  guardians: Combatant[];

  elementalModifiers: ElementBlock;
};
