// One entry per image in public/asset/nodebg, named <setting>-<feature>[-<variant>].
export const NODE_BACKGROUNDS = [
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

export type NodeBackground = (typeof NODE_BACKGROUNDS)[number];

export type NodeBackgroundFilter = 'None' | 'Faded' | 'Frozen' | 'Astral';

export type HasNodeBackground = {
  background: NodeBackground;
  // Tints reused art so it reads as a different place.
  backgroundFilter?: NodeBackgroundFilter;
};
