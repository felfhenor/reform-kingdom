import { ensureAffix } from '@helpers/content/ensure-affix';
import { ensureAstralProjector } from '@helpers/content/ensure-astralprojector';
import {
  ensureCaravan,
  ensureCaravanTrader,
} from '@helpers/content/ensure-caravan';
import { ensureCommissionOffer } from '@helpers/content/ensure-commission';
import {
  ensureEncounter,
  ensureEncounterRandom,
} from '@helpers/content/ensure-encounternode';
import { ensureGathering } from '@helpers/content/ensure-gathernode';
import { ensureGlobalEffect } from '@helpers/content/ensure-globaleffect';
import {
  ensureCollectible,
  ensureEquipment,
  ensureItem,
} from '@helpers/content/ensure-item';
import { ensureJob } from '@helpers/content/ensure-job';
import { ensureMonster } from '@helpers/content/ensure-monster';
import { ensureNodeOverride } from '@helpers/content/ensure-nodeoverride';
import { ensureRecipe } from '@helpers/content/ensure-recipe';
import { ensureSkill } from '@helpers/content/ensure-skill';
import { ensureStatusEffect } from '@helpers/content/ensure-statuseffect';
import { ensureTown } from '@helpers/content/ensure-town';
import {
  ensureTradeskill,
  ensureTradeskillLevelRequirement,
} from '@helpers/content/ensure-tradeskill';
import { ensureWorker } from '@helpers/content/ensure-worker';
import type { ContentType, IsContentItem } from '@interfaces';

// eat my ass, typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const initializers: Record<ContentType, (entry: any) => any> = {
  affix: ensureAffix,
  astralprojector: ensureAstralProjector,
  caravan: ensureCaravan,
  caravantrader: ensureCaravanTrader,
  collectible: ensureCollectible,
  commissionoffer: ensureCommissionOffer,
  encounter: ensureEncounter,
  encounterrandom: ensureEncounterRandom,
  equipment: ensureEquipment,
  gathering: ensureGathering,
  globaleffect: ensureGlobalEffect,
  item: ensureItem,
  job: ensureJob,
  monster: ensureMonster,
  nodeoverride: ensureNodeOverride,
  recipe: ensureRecipe,
  skill: ensureSkill,
  statuseffect: ensureStatusEffect,
  town: ensureTown,
  tradeskill: ensureTradeskill,
  tradeskilllevelrequirement: ensureTradeskillLevelRequirement,
  worker: ensureWorker,
};

export function hasContentInitializer<T extends IsContentItem>(
  content: T,
): boolean {
  return !!initializers[content.__type];
}

export function ensureContent<T extends IsContentItem>(content: T): T {
  return initializers[content.__type](content) satisfies T;
}
