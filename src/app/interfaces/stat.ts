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

export const StatShorthand: Record<BaseStat, string> = {
  Agility: 'AGI',
  Energy: 'EP',
  Health: 'HP',
  Intelligence: 'INT',
  Luck: 'LUK',
  Resistance: 'RES',
  Strength: 'STR',
  Vitality: 'VIT',
  Spirit: 'SPR',
  Constitution: 'CON',
};

export const StatInformation: Record<BaseStat, string> = {
  Agility:
    'Agility is used to determine turn order, and contributes to damage scaling for some skills.',
  Energy:
    'EP determines how many Energy Points a hero has when going into an encounter.',
  Health:
    'HP determines how many Health Points a hero has when going into an encounter.',
  Intelligence: 'Intelligence is used primarily to scale magical skills.',
  Strength: 'Strength is used primarily to scale physical skills.',
  Luck: 'Luck is used to mitigate incoming damage, debuffs, get critical hits, and rarely contributes to damage scaling for some skills.',
  Resistance: 'Resistance is used to mitigate incoming magical damage.',
  Vitality: 'Vitality is used to mitigate incoming physical damage.',
  Spirit: 'Spirit is used to regenerate Energy faster when out of combat.',
  Constitution:
    'Constitution is used to regenerate Health faster when out of combat.',
};

export type SkillStatScaling = {
  stat: GameStat;
  multiplier: number;
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
