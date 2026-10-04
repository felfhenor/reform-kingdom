import type { Icon } from '@interfaces/artable';
import type { StatDisplayDimension } from '@interfaces/stat-display';

export type GameElement = 'Fire' | 'Water' | 'Earth' | 'Air';

export type ElementBlock = Record<GameElement, number>;

export const GameElementOrder: GameElement[] = [
  'Fire',
  'Water',
  'Earth',
  'Air',
];

const GameElementIcon: Record<GameElement, Icon> = {
  Fire: 'gameSmallFire',
  Water: 'gameIceCube',
  Earth: 'gameStonePile',
  Air: 'gameSwanBreeze',
};

export const ElementResistanceDimension: StatDisplayDimension<GameElement> = {
  order: GameElementOrder,
  label: {
    Fire: 'Fire Resist',
    Water: 'Water Resist',
    Earth: 'Earth Resist',
    Air: 'Air Resist',
  },
  icon: GameElementIcon,
};

export const ElementBoonDimension: StatDisplayDimension<GameElement> = {
  order: GameElementOrder,
  label: {
    Fire: 'Fire Boon',
    Water: 'Water Boon',
    Earth: 'Earth Boon',
    Air: 'Air Boon',
  },
  icon: GameElementIcon,
};
