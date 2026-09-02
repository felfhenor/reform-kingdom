import type {
  CombatStatBlock,
  CombatantStatusEffectData,
} from '@interfaces/combat';
import type { GameElement } from '@interfaces/element';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { GameStat, StatBlock } from '@interfaces/stat';
import type { StatDisplayDimension } from '@interfaces/stat-display';

export type StatusEffectId = Branded<string, 'StatusEffectId'>;

export type StatusEffectTrigger = 'TurnStart' | 'TurnEnd';

// Categorizes what a status effect *does*, independent of its element, so
// gear/infusions can grant resistance to a family of debuffs (e.g. every
// stun-like effect) rather than one specific effect by id.
export type StatusEffectTag =
  'Stun' | 'StatDown' | 'Accuracy' | 'DamageOverTime' | 'Poison' | 'Burn';

// Order is alphabetical by label. Labels spell out "Resist" since these
// values are always shown as gear/hero resistance, never the raw debuff.
export const StatusEffectTagDimension: StatDisplayDimension<StatusEffectTag> = {
  order: ['Accuracy', 'Burn', 'DamageOverTime', 'Poison', 'StatDown', 'Stun'],
  label: {
    Stun: 'Stun Resist',
    StatDown: 'Stat Down Resist',
    Accuracy: 'Accuracy Down Resist',
    DamageOverTime: 'Damage Over Time Resist',
    Poison: 'Poison Resist',
    Burn: 'Burn Resist',
  },
  icon: {
    Stun: 'gameGooeyImpact',
    StatDown: 'gameArmorDowngrade',
    Accuracy: 'gameDustCloud',
    DamageOverTime: 'gameBleedingWound',
    Poison: 'gamePoison',
    Burn: 'gameFlame',
  },
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
  combatStat: keyof CombatStatBlock;
  value: number;
};

export type StatusEffectTakeCombatStatNumber = {
  type: 'TakeCombatStatNumber';
  combatMessage?: string;
  combatStat: keyof CombatStatBlock;
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
