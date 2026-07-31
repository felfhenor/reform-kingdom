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
