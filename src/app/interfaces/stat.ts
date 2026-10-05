import type { StatDisplayDimension } from '@interfaces/stat-display';

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

export const StatDimension: StatDisplayDimension<BaseStat> = {
  order: StatOrder,
  label: {
    Intelligence: 'Intelligence',
    Strength: 'Strength',
    Vitality: 'Vitality',
    Resistance: 'Resistance',
    Agility: 'Agility',
    Health: 'Health',
    Energy: 'Energy',
    Luck: 'Luck',
    Constitution: 'Constitution',
    Spirit: 'Spirit',
  },
  icon: {
    Intelligence: 'gameBrain',
    Strength: 'gameGavel',
    Vitality: 'gameHeartBeats',
    Resistance: 'gameVibratingShield',
    Agility: 'gameDuration',
    Health: 'gameGlassHeart',
    Energy: 'gameDrop',
    Luck: 'gameClover',
    Constitution: 'gameCaduceus',
    Spirit: 'gameEmbrassedEnergy',
  },
  color: {
    Intelligence: 'text-sky-400',
    Strength: 'text-red-500',
    Vitality: 'text-pink-400',
    Resistance: 'text-indigo-400',
    Agility: 'text-green-400',
    Health: 'text-rose-500',
    Energy: 'text-yellow-400',
    Luck: 'text-emerald-400',
    Constitution: 'text-rose-700',
    Spirit: 'text-yellow-600',
  },
  isPercent: {
    Intelligence: false,
    Strength: false,
    Vitality: false,
    Resistance: false,
    Agility: false,
    Health: false,
    Energy: false,
    Luck: false,
    Constitution: false,
    Spirit: false,
  },
};
