import type {
  CombatantCombatStats,
  CombatantStatusEffectData,
} from '@interfaces/combat';
import type { GameElement } from '@interfaces/element';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { GameStat, StatBlock } from '@interfaces/stat';

export type StatusEffectId = Branded<string, 'StatusEffectId'>;

export type StatusEffectTrigger = 'TurnStart' | 'TurnEnd';

// Categorizes what a status effect *does*, independent of its element, so
// gear/infusions can grant resistance to a family of debuffs (e.g. every
// stun-like effect) rather than one specific effect by id.
export type StatusEffectTag =
  | 'Stun'
  | 'StatDown'
  | 'Accuracy'
  | 'DamageOverTime'
  | 'Poison'
  | 'Burn';

export const StatusEffectTagLabel: Record<StatusEffectTag, string> = {
  Stun: 'Stun',
  StatDown: 'Stat Down',
  Accuracy: 'Accuracy',
  DamageOverTime: 'Damage over Time',
  Poison: 'Poison',
  Burn: 'Burn',
};

export type StatusEffectBehaviorType =
  | 'ModifyStatusEffectData'
  | 'AddDamageToStat'
  | 'TakeDamageFromStat'
  | 'AddCombatStatNumber'
  | 'TakeCombatStatNumber'
  | 'HealDamage'
  | 'TakeDamage'
  | 'SendMessage';

export type StatusEffectBehaviorSendMessage = {
  type: 'SendMessage';
  combatMessage: string;
};

export type StatusEffectBehaviorDataChange = {
  type: 'ModifyStatusEffectData';
  combatMessage?: string;
  key: keyof CombatantStatusEffectData;
  value: CombatantStatusEffectData[keyof CombatantStatusEffectData];
};

export type StatusEffectAddCombatStatNumber = {
  type: 'AddCombatStatNumber';
  combatMessage?: string;
  combatStat: keyof CombatantCombatStats;
  value: number;
};

export type StatusEffectTakeCombatStatNumber = {
  type: 'TakeCombatStatNumber';
  combatMessage?: string;
  combatStat: keyof CombatantCombatStats;
  value: number;
};

export type StatusEffectBehaviorAddStat = {
  type: 'AddDamageToStat';
  combatMessage?: string;
  modifyStat: GameStat;
};

export type StatusEffectBehaviorTakeStat = {
  type: 'TakeDamageFromStat';
  combatMessage?: string;
  modifyStat: GameStat;
};

export type StatusEffectBehaviorTakeDamage = {
  type: 'TakeDamage';
  combatMessage?: string;
};

export type StatusEffectBehaviorHealDamage = {
  type: 'HealDamage';
  combatMessage?: string;
};

export type StatusEffectBehavior =
  | StatusEffectBehaviorSendMessage
  | StatusEffectBehaviorDataChange
  | StatusEffectBehaviorTakeDamage
  | StatusEffectBehaviorHealDamage
  | StatusEffectBehaviorAddStat
  | StatusEffectBehaviorTakeStat
  | StatusEffectAddCombatStatNumber
  | StatusEffectTakeCombatStatNumber;

export type StatusEffectContent = IsContentItem & {
  id: StatusEffectId;
  __type: 'statuseffect';

  effectType: 'Buff' | 'Debuff';
  elements: GameElement[];
  tags: StatusEffectTag[];

  trigger: StatusEffectTrigger;

  onApply: StatusEffectBehavior[];
  onTick: StatusEffectBehavior[];
  onUnapply: StatusEffectBehavior[];

  statScaling: StatBlock;
  useTargetStats: boolean;
};

export type StatusEffect = StatusEffectContent & {
  duration: number;

  creatorStats: StatBlock;
  targetStats: StatBlock;
};
