import type { DebuffPotency } from '@interfaces/combat';
import type { AffixEffect } from '@interfaces/content-affix';
import type { JobAbilityId } from '@interfaces/content-jobability';
import type { EquipmentSkillId } from '@interfaces/content-skill';
import type { StatusEffectId } from '@interfaces/content-statuseffect';
import type { GameElement } from '@interfaces/element';
import type { BaseStat } from '@interfaces/stat';

export type HeroEffectStatPerLevel = {
  kind: 'StatPerLevel';
  stat: BaseStat;
  value: number; // added to the job's growth, so it applies retroactively
};

export type HeroEffectJobAbility = {
  kind: 'JobAbility';
  jobAbilityId: JobAbilityId;
  value: number; // the rank's value; the highest grant of an ability wins
};

export type HeroEffectDebuffPotency = DebuffPotency & {
  kind: 'DebuffPotency';
};

// Changes every tier of one skill family; `source` is the granting node's name, set when effects are collected.
type HeroEffectSkillModifierBase = {
  kind: 'SkillModifier';
  family: string;
  source?: string;
};

export type HeroEffectSkillModifierTargets = HeroEffectSkillModifierBase & {
  modifier: 'Targets';
  value: number;
};

// onElement limits it to hits of that element, e.g. Frostfire Bolt's frost half.
export type HeroEffectSkillModifierInflict = HeroEffectSkillModifierBase & {
  modifier: 'Inflict';
  statusEffectId: StatusEffectId;
  chance: number;
  duration: number;
  onElement?: GameElement;
};

export type HeroEffectSkillModifierPotency = HeroEffectSkillModifierBase & {
  modifier: 'Potency';
  statusEffectId: StatusEffectId;
  chance: number;
  duration: number;
};

export type HeroEffectSkillModifierScaling = HeroEffectSkillModifierBase & {
  modifier: 'Scaling';
  stat: BaseStat;
  value: number;
};

export type HeroEffectSkillModifierElement = HeroEffectSkillModifierBase & {
  modifier: 'Element';
  element: GameElement;
};

// Also casts the hits of another skill, which pick their own targets.
export type HeroEffectSkillModifierEcho = HeroEffectSkillModifierBase & {
  modifier: 'Echo';
  skillId: EquipmentSkillId;
};

export type HeroEffectSkillModifier =
  | HeroEffectSkillModifierTargets
  | HeroEffectSkillModifierInflict
  | HeroEffectSkillModifierPotency
  | HeroEffectSkillModifierScaling
  | HeroEffectSkillModifierElement
  | HeroEffectSkillModifierEcho;

// Every effect a hero can carry: gear/teaching affix shapes plus kinds only skill trees grant.
export type HeroEffect =
  | AffixEffect
  | HeroEffectStatPerLevel
  | HeroEffectJobAbility
  | HeroEffectDebuffPotency
  | HeroEffectSkillModifier;
