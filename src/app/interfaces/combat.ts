import type { HasAnimation } from '@interfaces/artable';
import type { CharacterId } from '@interfaces/character';
import type { CombatOrderClause } from '@interfaces/combat-order';
import type { EncounterId } from '@interfaces/content-encounter';
import type { JobId } from '@interfaces/content-job';
import type { EncounterRandomId } from '@interfaces/content-encounter-random';
import type {
  EquipmentSkill,
  EquipmentSkillId,
} from '@interfaces/content-skill';
import type {
  StatusEffect,
  StatusEffectTag,
} from '@interfaces/content-statuseffect';
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
  stunChance: number;
};

export type CombatantTargettingType =
  | 'Random'
  | 'Strongest'
  | 'Weakest'
  | 'Self'
  | 'SpecificHero'
  | 'MatchingAllies';

// One step of a combatant's target priority list - tried in order, first non-empty result wins.
// jobId, when set, narrows the pool to that job before type's mode picks from it (e.g. Weakest + jobId: Healer -> the weakest healer).
export type TargettingPriorityEntry = {
  type: CombatantTargettingType;
  jobId?: JobId;
};

// Extra context only the Self/SpecificHero/MatchingAllies targeting modes need.
export type CombatTargetModeContext = {
  combatant: Combatant;
  targetCharacterId?: CharacterId;
  matchingAllies?: Combatant[];
};

export type Combatant = HasAnimation & {
  id: string;
  name: string;

  isEnemy: boolean;
  // Enemy-only MonsterId source for post-combat rewards; untyped to avoid a circular import with content-monster.ts.
  monsterId?: string;

  level: number;
  hp: number;
  ep: number;

  // Priority list of targeting modes, tried in order - see combatGetTargetsFromPriorityList.
  targetting: TargettingPriorityEntry[];
  // Set for hero combatants only (from Character.jobId), so a monster's targetting entries can narrow by jobId.
  jobId?: JobId;
  // Resolved once at Combatant creation from the owning hero's current job
  // (empty for monsters) - see combatantFromCharacter.
  combatOrders: CombatOrderClause[];

  baseStats: StatBlock;
  statBoosts: StatBlock;
  totalStats: StatBlock;

  combatStats: CombatantCombatStats;

  resistance: ElementBlock;
  affinity: ElementBlock;
  tagResistance: Record<StatusEffectTag, number>;

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
  encounterRandomId?: EncounterRandomId;
  fightIndex?: number;
};

// A combatant HP change, pushed to combatantDamageEvents to show a floating +/- number; amount is signed for display (positive = heal).
export type CombatantDamageEvent = {
  id: string;
  combatantId: string;
  amount: number;
};

// Pushed when a combatant resolves which skill to use for their turn, to flash the skill's icon/name on their status card.
export type CombatantSkillCastEvent = {
  id: string;
  combatantId: string;
  skillName: string;
  skillSprite: string;
};
