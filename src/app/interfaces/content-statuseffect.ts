import type { CharacterId } from '@interfaces/character';
import type { HasSprite } from '@interfaces/artable';
import type {
  CombatStatBlock,
  CombatantStatusEffectData,
} from '@interfaces/combat';
import type { GameElement } from '@interfaces/element';
import type { Branded, IsContentItem } from '@interfaces/identifiable';
import type { GameStat, StatBlock } from '@interfaces/stat';

export type StatusEffectId = Branded<string, 'StatusEffectId'>;

export type StatusEffectTrigger = 'TurnStart' | 'TurnEnd';

export type StatusEffectTag =
  | 'Stun'
  | 'StatDown'
  | 'Accuracy'
  | 'DamageOverTime'
  | 'Poison'
  | 'Burn'
  | 'Bleed';

export type StatusEffectBlock = Record<StatusEffectTag, number>;

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

export type StatusEffectContent = IsContentItem &
  HasSprite & {
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
  // Resolved when applied, so a summon's effect still credits its owner after the summon is replaced.
  creditHeroId?: CharacterId;
};
