import type { TrailerShot } from './types';
import { caravanShot } from './shot-caravan';
import { collectibleRevealShot } from './shot-collectible-reveal';
import { combatShot } from './shot-combat';
import { decreesShot } from './shot-decrees';
import { depthMontageShot } from './shot-depth-montage';
import { endCardShot } from './shot-end-card';
import { regionsShot } from './shot-regions';
import { rescueShot } from './shot-rescue';
import { titleCrawlShot } from './shot-title-crawl';

export const TRAILER_SHOTS: TrailerShot[] = [
  titleCrawlShot,
  collectibleRevealShot,
  regionsShot,
  decreesShot,
  combatShot,
  rescueShot,
  depthMontageShot,
  caravanShot,
  endCardShot,
];
