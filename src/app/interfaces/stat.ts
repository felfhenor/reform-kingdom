export type BaseStat =
  | 'Intelligence'
  | 'Strength'
  | 'Vitality'
  | 'Resistance'
  | 'Agility'
  | 'Health'
  | 'Energy'
  | 'Luck';

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
];

export const StatShorthand: Record<BaseStat, string> = {
  Agility: 'AGI',
  Energy: 'EP',
  Health: 'HP',
  Intelligence: 'INT',
  Luck: 'LUK',
  Resistance: 'RES',
  Strength: 'STR',
  Vitality: 'VIT',
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
