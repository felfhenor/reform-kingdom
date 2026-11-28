import type { Icon } from '@interfaces/artable';

export type GameElement = 'Fire' | 'Water' | 'Earth' | 'Air';

export type ElementBlock = Record<GameElement, number>;

export type ElementVerdict = 'Weak' | 'Resist';

export const GameElementOrder: GameElement[] = [
  'Fire',
  'Water',
  'Earth',
  'Air',
];

export const GameElementIcon: Record<GameElement, Icon> = {
  Fire: 'gameSmallFire',
  Water: 'gameIceCube',
  Earth: 'gameStonePile',
  Air: 'gameSwanBreeze',
};

// Named element combinations (from Glowrift Duskhall), keyed by the elements sorted alphabetically.
export const GameElementCombinationNames: Record<string, string> = {
  'Fire/Water': 'Steam',
  'Air/Fire': 'Arid',
  'Earth/Fire': 'Molten',
  'Earth/Water': 'Mud',
  'Air/Water': 'Storm',
  'Air/Earth': 'Sand',
  'Air/Earth/Fire/Water': 'Holy',
};

export const GameElementTextColor: Record<GameElement, string> = {
  Fire: 'text-element-Fire',
  Water: 'text-element-Water',
  Earth: 'text-element-Earth',
  Air: 'text-element-Air',
};
