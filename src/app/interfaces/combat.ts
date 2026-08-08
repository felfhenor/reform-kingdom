import type { HasAnimation } from '@interfaces/artable';
import type { EncounterId } from '@interfaces/content-encounter';
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
  repeatActionChance: number;
  skillStrikeAgainChance: number;
  skillAdditionalUseChance: number;
  skillAdditionalUseCount: number;
  redirectionChance: number;
  missChance: number;
  debuffIgnoreChance: number;
  damageReflectPercent: number;
  healingIgnorePercent: number;
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
  ep: number;

  targettingType: CombatantTargettingType;

  baseStats: StatBlock;
  statBoosts: StatBlock;
  totalStats: StatBlock;

  combatStats: CombatantCombatStats;

  resistance: ElementBlock;
  affinity: ElementBlock;

  skillIds: EquipmentSkillId[];
  skillRefs: EquipmentSkill[];
  skillWeights: Record<EquipmentSkillId, number>;

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

  encounterId?: EncounterId;
  fightIndex?: number;
};
