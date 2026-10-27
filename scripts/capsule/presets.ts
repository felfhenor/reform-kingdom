import type {
  CapsuleParty,
  CapsulePreset,
  CapsuleRing,
  CapsuleTitle,
  CapsuleWhirl,
} from './types';

const larsiaMap = {
  name: 'LarsianDesert',
  focus: 'Larsia',
  scale: 2,
  brightness: 1,
};

const larsiaGear = { levelRange: [18, 30] as [number, number] };
const carrinaGear = { levelRange: [1, 12] as [number, number] };

const carrinaMap = {
  name: 'Carrina',
  focus: 'Duchy of Carrina',
  scale: 2,
  brightness: 0.8,
};

// two crossed outer orbits around a smaller flat one; tilt[0] fattens each ellipse, tilt[1] rolls it
const atomRings = (radius: number, items: number): CapsuleRing[] => [
  { radius, items, tilt: [8, 22] },
  { radius, items, tilt: [8, -22] },
  { radius: radius * 0.6, items: Math.round(items * 0.6), tilt: [-4, 0] },
];

const gyroWhirl = (
  rings: CapsuleRing[],
  overrides: Partial<CapsuleWhirl> = {},
): CapsuleWhirl => ({
  gear: larsiaGear,
  rings,
  cameraTilt: 20,
  tumble: 4,
  itemScale: 1,
  backBrightness: 0.4,
  perspective: 1800,
  clearRadius: 80,
  ...overrides,
});

const crossRings = (
  radius: number,
  items: number,
  roll = 22,
): CapsuleRing[] => [
  { radius, items, tilt: [8, roll] },
  { radius, items, tilt: [8, -roll] },
];

const title = (pixelSize: number, y = 0.04): CapsuleTitle => ({
  text: 're:Form Kingdom',
  pixelSize,
  x: 0.5,
  y,
  color: '#f6e7c8',
  outline: '#2b1a10',
  outlineWidth: 1,
});

const versus = (
  spacing: number,
  scale = 2,
  monsters = ['Akroki Swashbuckler', 'Akroki Mage'],
): CapsuleParty => ({
  heroes: ['Warrior', 'Ranger', 'Magician', 'Healer'],
  monsters,
  scale,
  layout: 'versus',
  groundY: 0.95,
  spacing,
});

export const CAPSULE_PRESETS: Record<string, CapsulePreset> = {
  gyro: {
    size: 'main',
    seed: 9,
    map: larsiaMap,
    whirl: gyroWhirl(atomRings(480, 34)),
    party: versus(120),
    title: title(4),
  },

  // two wide orbits crossing behind Larsia
  'gyro-cross': {
    size: 'main',
    seed: 14,
    map: larsiaMap,
    whirl: gyroWhirl(crossRings(470, 40)),
    party: versus(120),
    title: title(4),
  },

  // heroes along the bottom with the Akroki flanking them
  'gyro-line': {
    size: 'main',
    seed: 3,
    map: larsiaMap,
    whirl: gyroWhirl(atomRings(480, 34)),
    party: {
      heroes: ['Warrior', 'Ranger', 'Magician', 'Healer'],
      monsters: ['Akroki Swashbuckler', 'Akroki Vanguard', 'Akroki Mage'],
      scale: 2,
      layout: 'line',
      groundY: 0.96,
      spacing: 120,
      centerGap: 40,
    },
    title: title(4),
  },

  'gyro-header': {
    size: 'header',
    seed: 9,
    map: larsiaMap,
    whirl: gyroWhirl(crossRings(380, 24)),
    party: versus(90),
    title: title(3),
  },

  'gyro-vertical': {
    size: 'vertical',
    seed: 5,
    map: larsiaMap,
    whirl: gyroWhirl(crossRings(330, 28, 30), { cameraTilt: 34 }),
    party: {
      heroes: ['Warrior', 'Ranger', 'Magician', 'Healer'],
      monsters: ['Akroki Swashbuckler', 'Akroki Mage'],
      scale: 2,
      layout: 'line',
      groundY: 0.96,
      spacing: 110,
      centerGap: 30,
    },
    title: title(3),
  },

  'gyro-small': {
    size: 'small',
    seed: 2,
    // sprites can't shrink below 1x, so this size keeps the map zoomed out and the gear sparse
    map: { ...larsiaMap, scale: 1 },
    whirl: gyroWhirl(crossRings(250, 9, 10), { clearRadius: 40 }),
    party: versus(55, 1),
    title: title(2, 0.05),
  },

  // the player's home duchy, with Carrina's goblins and orcs and its starter gear
  'carrina-cross': {
    size: 'main',
    seed: 14,
    map: carrinaMap,
    whirl: gyroWhirl(crossRings(470, 40), { gear: carrinaGear }),
    party: versus(120, 2, ['Goblin Warrior', 'Orc Smasher']),
    title: title(4),
  },

  'carrina-header': {
    size: 'header',
    seed: 9,
    map: carrinaMap,
    whirl: gyroWhirl(crossRings(380, 24), { gear: carrinaGear }),
    party: versus(90, 2, ['Goblin Warrior', 'Orc Smasher']),
    title: title(3),
  },
};
