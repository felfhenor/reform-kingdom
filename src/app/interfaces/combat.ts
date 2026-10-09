import type { HasAnimation } from '@interfaces/artable';
import type { CharacterId } from '@interfaces/character';
import type {
  CombatOrderClause,
  CombatOrderPick,
} from '@interfaces/combat-order';
import type { EncounterId } from '@interfaces/content-encounter';
import type { EncounterRandomId } from '@interfaces/content-encounter-random';
import type { JobId } from '@interfaces/content-job';
import type {
  EquipmentSkill,
  EquipmentSkillId,
} from '@interfaces/content-skill';
import type {
  StatusEffect,
  StatusEffectBlock,
} from '@interfaces/content-statuseffect';
import type { ElementBlock, GameElement } from '@interfaces/element';
import type { Branded } from '@interfaces/identifiable';
import type { SkillStatBonus, StatBlock } from '@interfaces/stat';
import type { StatDisplayDimension } from '@interfaces/stat-display';

export type CombatId = Branded<string, 'CombatId'>;

export type CombatantStatusEffectData = {
  isFrozen?: boolean;
};

export type CombatStat =
  | 'repeatActionChance'
  | 'skillStrikeAgainChance'
  | 'redirectionChance'
  | 'missChance'
  | 'debuffIgnoreChance'
  | 'damageReflectPercent'
  | 'healingIgnorePercent'
  | 'reviveChance'
  | 'stunChance'
  | 'epCostIncreasePercent'
  | 'agroValue';

export type CombatStatBlock = Record<CombatStat, number>;

// Only agroValue is a flat weight - every other combat stat is a 0-100 percent chance/modifier.
export const CombatStatDimension: StatDisplayDimension<CombatStat> = {
  order: [
    'repeatActionChance',
    'skillStrikeAgainChance',
    'damageReflectPercent',
    'debuffIgnoreChance',
    'reviveChance',
    'agroValue',
    'missChance',
    'stunChance',
    'redirectionChance',
    'healingIgnorePercent',
    'epCostIncreasePercent',
  ],
  label: {
    repeatActionChance: 'Extra Turn Chance',
    skillStrikeAgainChance: 'Skill Repeat Chance',
    redirectionChance: 'Confusion Chance',
    missChance: 'Miss Chance',
    debuffIgnoreChance: 'Debuff Resist Chance',
    damageReflectPercent: 'Damage Reflect',
    healingIgnorePercent: 'Healing Reduction',
    reviveChance: 'Revive Chance',
    stunChance: 'Self-Stun Chance',
    epCostIncreasePercent: 'EP Cost Increase',
    agroValue: 'Aggro',
  },
  icon: {
    repeatActionChance: 'gameExtraTime',
    skillStrikeAgainChance: 'gameDeadlyStrike',
    redirectionChance: 'gameFog',
    missChance: 'gameDodging',
    debuffIgnoreChance: 'gameMagicShield',
    damageReflectPercent: 'gameShieldReflect',
    healingIgnorePercent: 'gameBrokenHeart',
    reviveChance: 'gameAngelWings',
    stunChance: 'gameKnockedOutStars',
    epCostIncreasePercent: 'gameNestedEclipses',
    agroValue: 'gameTargeted',
  },
  color: {
    repeatActionChance: 'text-green-500',
    skillStrikeAgainChance: 'text-red-600',
    redirectionChance: 'text-sky-500',
    missChance: 'text-rose-400',
    debuffIgnoreChance: 'text-pink-500',
    damageReflectPercent: 'text-fuchsia-500',
    healingIgnorePercent: 'text-red-800',
    reviveChance: 'text-lime-500',
    stunChance: 'text-yellow-500',
    epCostIncreasePercent: 'text-violet-500',
    agroValue: 'text-orange-600',
  },
  isPercent: {
    repeatActionChance: true,
    skillStrikeAgainChance: true,
    redirectionChance: true,
    missChance: true,
    debuffIgnoreChance: true,
    damageReflectPercent: true,
    healingIgnorePercent: true,
    reviveChance: true,
    stunChance: true,
    epCostIncreasePercent: true,
    agroValue: false,
  },
};

export type CombatantTargettingType =
  | 'Random'
  | 'Strongest'
  | 'Weakest'
  | 'Self'
  | 'SpecificHero'
  | 'MatchingAllies'
  | 'MatchingEnemies';

// One step of a combatant's target priority list - tried in order, first non-empty result wins.
// jobId, when set, narrows the pool to that job before type's mode picks from it (e.g. Weakest + jobId: Healer -> the weakest healer).
export type TargettingPriorityEntry = {
  type: CombatantTargettingType;
  jobId?: JobId;
};

// Extra context only the Self/SpecificHero/Matching* targeting modes need.
export type CombatTargetModeContext = {
  combatant: Combatant;
  targetCharacterId?: CharacterId;
  matchingCombatants?: Combatant[];
};

// Keeps the cast's Combat Order target override; matched combatants can't survive the per-round clone.
export type CombatantDelayedSkill = Omit<
  CombatOrderPick,
  'matchingCombatants'
> & {
  turnsRemaining: number;
};

export type Combatant = HasAnimation & {
  id: string;
  name: string;

  isEnemy: boolean;
  // Enemy-only MonsterId source for post-combat rewards; untyped to avoid a circular import.
  monsterId?: string;
  summonerId?: string;

  // Percent damage bonus per MonsterType (keyed by string, same reasoning as `monsterId`, to avoid a circular import with content-monster.ts). Only heroes populate this, from equipped-gear affixes.
  monsterTypeDamageBonus?: Record<string, number>;

  // Gear-granted extra damageScaling per skill family. Only heroes populate this.
  skillStatBonuses?: SkillStatBonus[];

  level: number;
  hp: number;
  ep: number;

  // Priority list of targeting modes, tried in order.
  targetting: TargettingPriorityEntry[];
  // Set for hero combatants only, so a monster's targetting entries can narrow by jobId.
  jobId?: JobId;
  // Resolved once at Combatant creation from the owning hero's current job (empty for monsters).
  combatOrders: CombatOrderClause[];

  baseStats: StatBlock;
  statBoosts: StatBlock;
  totalStats: StatBlock;

  combatStats: CombatStatBlock;

  resistance: ElementBlock;
  // Elemental boon.
  affinity: ElementBlock;
  // Elements given to non-elemental damaging techniques by gear. Optional so mid-combat saves still load.
  gearElements?: GameElement[];
  tagResistance: StatusEffectBlock;

  skillIds: EquipmentSkillId[];
  skillRefs: EquipmentSkill[];
  skillWeights: Record<EquipmentSkillId, number>;

  skillUses: Record<EquipmentSkillId, number>;
  // Optional so mid-combat saves still load.
  delayedSkills?: CombatantDelayedSkill[];

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
  // Town NPC allies (e.g. raid defenders) - fight alongside heroes but don't count toward the loss check.
  helpers: Combatant[];
  guardians: Combatant[];

  encounterId?: EncounterId;
  encounterRandomId?: EncounterRandomId;
  fightIndex?: number;
  // Untyped (not TownId) to avoid a circular import.
  raidTownId?: string;
  summonCount?: number;
};

// A combatant HP change; amount is signed for display (positive = heal).
export type DamageEventVariant =
  'critical' | 'miss' | 'block' | 'energy' | 'xp';

// Miss/block events carry an amount of 0 (the variant picks the label instead of a number); energy and xp are gains of those resources rather than HP.
export type CombatantDamageEvent = {
  id: string;
  combatantId: string;
  amount: number;
  variant?: DamageEventVariant;
};

// Pushed when a combatant resolves which skill to use for their turn, to flash the skill's icon/name on their status card.
export type CombatantSkillCastEvent = {
  id: string;
  combatantId: string;
  skillName: string;
  skillSprite: string;
};
