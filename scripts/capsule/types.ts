export type CapsuleSizeName =
  'header' | 'small' | 'main' | 'vertical' | 'library' | 'hero';

// Steam store/library capsule sizes.
export const CAPSULE_SIZES: Record<CapsuleSizeName, [number, number]> = {
  header: [920, 430],
  small: [462, 174],
  main: [1232, 706],
  vertical: [748, 896],
  library: [600, 900],
  hero: [3840, 1240],
};

export interface CapsuleGearSelector {
  // exact equipment names
  names?: string[];
  // any equipment whose name contains one of these
  nameIncludes?: string[];
  // inclusive levelRequirement range
  levelRange?: [number, number];
  // equipment types, eg. 'Staff', 'Bow'
  types?: string[];
}

export interface CapsuleRing {
  // in screen px
  radius: number;
  items: number;
  // degrees to tip the ring toward the camera, then to roll it sideways
  tilt: [number, number];
  // vertical offset from the focus node (negative is up), in screen px
  height?: number;
}

export interface CapsuleWhirl {
  // pull gear from these equipment entries
  gear: CapsuleGearSelector;

  rings: CapsuleRing[];

  // camera looks down at the whirl by this many degrees
  cameraTilt: number;

  // how far items wobble off their ring, in degrees. 0 is perfectly neat
  tumble: number;

  // integer upscale of each item before 3D
  itemScale: number;

  // brightness of the item furthest from the camera (front is 1)
  backBrightness: number;

  // camera distance in px; lower is a stronger 3D effect
  perspective: number;

  // items whose on-screen center lands within this many px of the focus node are dropped, so it stays visible
  clearRadius?: number;

  // shift the whirl center away from the focus node, in screen px
  center?: [number, number];
}

export interface CapsuleParty {
  // job names, eg. 'Warrior'
  heroes: string[];
  // monster names, eg. 'Akroki Mage'
  monsters: string[];
  // integer upscale for heroes and monsters
  scale: number;

  // line: heroes along the bottom with monsters flanking; versus: heroes left, monsters right facing them
  layout: 'line' | 'versus';

  // feet position as a fraction of capsule height
  groundY: number;
  // horizontal distance between party members, in screen px
  spacing: number;
  // extra gap left in the middle of the hero line so the focus node stays visible
  centerGap?: number;
}

export interface CapsuleTitle {
  text: string;
  // screen px per Geist Pixel square; whole numbers keep every square the same size
  pixelSize: number;
  // top-center of the text, as a fraction of the capsule size
  x: number;
  y: number;
  color: string;
  // hard (unblurred) outline color, or omit for none
  outline?: string;
  // in font squares
  outlineWidth?: number;
}

export interface CapsuleMap {
  name: string;
  // explore node to center the capsule on
  focus: string;
  // integer upscale of the map
  scale: number;
  // flat brightness multiply, so the sprites stand out
  brightness: number;
}

export interface CapsulePreset {
  size: CapsuleSizeName | [number, number];
  seed: number;
  map: CapsuleMap;
  whirl: CapsuleWhirl;
  party: CapsuleParty;
  title?: CapsuleTitle;
}
