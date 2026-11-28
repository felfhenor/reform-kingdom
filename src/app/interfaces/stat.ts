export type BaseStat =
  | 'Intelligence'
  | 'Strength'
  | 'Vitality'
  | 'Resistance'
  | 'Agility'
  | 'Health'
  | 'Energy'
  | 'Luck'
  | 'Constitution'
  | 'Spirit';

export type GameStat = BaseStat;

export type StatBlock = Record<GameStat, number>;

export const StatOrder: BaseStat[] = [
  'Health',
  'Energy',
  'Strength',
  'Intelligence',
  'Vitality',
  'Resistance',
  'Agility',
  'Luck',
  'Constitution',
  'Spirit',
];

export type SkillStatScaling = {
  stat: GameStat;
  multiplier: number;
};

// Extra damageScaling gear adds to every stat-scaling technique of a skill family, e.g. +2 Vitality on Fireball = +2.00x VIT.
export type SkillStatBonus = {
  skillFamily: string;
  stat: GameStat;
  value: number;
};

export const PhysicalStats: GameStat[] = [
  'Strength',
  'Vitality',
  'Health',
  'Agility',
];

export const MagicalStats: GameStat[] = [
  'Intelligence',
  'Resistance',
  'Energy',
  'Luck',
];
