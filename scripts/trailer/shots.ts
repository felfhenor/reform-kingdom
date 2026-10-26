import type { TrailerShot } from './types';
import { caravanShot } from './shot-caravan';
import { collectibleRevealShot } from './shot-collectible-reveal';
import { combatShot } from './shot-combat';
import { craftingShot } from './shot-crafting';
import { decreesShot } from './shot-decrees';
import { depthMontageShot } from './shot-depth-montage';
import { endCardShot } from './shot-end-card';
import { gatheringShot } from './shot-gathering';
import { gearUpShot } from './shot-gear-up';
import { kingdomBustleShot } from './shot-kingdom-bustle';
import { regionsShot } from './shot-regions';
import { rescueShot } from './shot-rescue';
import { titleCrawlShot } from './shot-title-crawl';

export const TRAILER_SHOTS: TrailerShot[] = [
  kingdomBustleShot,
  titleCrawlShot,
  collectibleRevealShot,
  rescueShot,
  combatShot,
  decreesShot,
  gatheringShot,
  gearUpShot,
  craftingShot,
  depthMontageShot,
  caravanShot,
  regionsShot,
  endCardShot,
];
