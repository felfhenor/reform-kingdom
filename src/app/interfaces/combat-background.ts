// One entry per image in public/asset/combatbg, named <setting>-<feature>[-<variant>].
export const COMBAT_BACKGROUNDS = [
  'arena-castle',
  'arena-colosseum',
  'arena-graveyard',
  'arena-grove',
  'arena-lava',
  'arena-snow',
  'castle-courtyard',
  'castle-dungeon',
  'castle-gate',
  'castle-hall-carpet',
  'castle-hall-windows',
  'castle-throne',
  'cave-crystal-blue',
  'cave-crystal-red',
  'cave-mine',
  'cave-shrine',
  'cave-webs',
  'desert-camp',
  'desert-palms',
  'desert-ruins',
  'desert-shore',
  'field-meadow',
  'field-terrace',
  'forest-clearing',
  'forest-hut',
  'forest-magic',
  'forest-mushroom',
  'forest-night',
  'forest-runestones',
  'forest-waterfall',
  'lava-cave',
  'lava-falls',
  'ruins-arches',
  'ruins-brick',
  'ruins-portal',
  'ruins-stone',
  'ship-deck',
  'ship-hold',
  'sky-castle',
  'sky-temple',
  'swamp-camp',
  'swamp-roots',
  'swamp-tusks',
] as const;

export type CombatBackground = (typeof COMBAT_BACKGROUNDS)[number];

export type CombatBackgroundFilter = 'None' | 'Faded' | 'Frozen' | 'Astral';

export type HasCombatBackground = {
  combatBackground: CombatBackground;
  // Tints reused art so it reads as a different place.
  combatBackgroundFilter?: CombatBackgroundFilter;
};
