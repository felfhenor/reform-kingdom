import { hasAnyCommission } from '@helpers/commission/commission-tick.ui';
import { getEntriesByType } from '@helpers/content/content';
import { kingdomSubviewForTradeskill } from '@helpers/engine/ui';
import { isInfusionUnlocked } from '@helpers/item/infusion';
import { isReforgeUnlocked } from '@helpers/item/reforge';
import { unlockedAstralProjectorEntries } from '@helpers/kingdom/astral-projector.ui';
import { discoveredWorkersState } from '@helpers/state-game';
import type {
  KingdomFeatureNav,
  KingdomFeatureSubview,
  KingdomNavEntry,
  KingdomNavGroup,
  KingdomNavSection,
  Tradeskill,
  TradeskillContent,
} from '@interfaces';
import { sortBy } from 'es-toolkit/compat';

export const KINGDOM_FEATURE_NAV: Record<
  KingdomFeatureSubview,
  KingdomFeatureNav
> = {
  storage: { label: 'Storage', icon: 'gameChest', group: 'reserves' },
  armory: { label: 'Armory', icon: 'gameCrossedSwords', group: 'reserves' },
  astralprojector: {
    label: 'Astral Projector',
    icon: 'gameCrystalBall',
    group: 'reserves',
    isAvailable: () => unlockedAstralProjectorEntries().length > 0,
  },
  museum: { label: 'Museum', icon: 'gameTrophyCup', group: 'collections' },
  bestiary: { label: 'Bestiary', icon: 'gameOpenBook', group: 'collections' },
  workers: {
    label: "Quartermaster's Annex",
    icon: 'gameMeepleGroup',
    group: 'workforce',
    isAvailable: () => Object.keys(discoveredWorkersState()).length > 0,
  },
  workshop: {
    label: 'Workshop',
    icon: 'gameAnvil',
    group: 'actions',
    isAvailable: () => isInfusionUnlocked() || isReforgeUnlocked(),
  },
  commissions: {
    label: 'Commissions',
    icon: 'gameContract',
    group: 'actions',
    isAvailable: hasAnyCommission,
  },
};

const KINGDOM_NAV_GROUP_ORDER: KingdomNavGroup[] = [
  'reserves',
  'collections',
  'workforce',
  'crafting',
  'actions',
];

export function isKingdomFeatureAvailable(
  subview: KingdomFeatureSubview,
): boolean {
  return KINGDOM_FEATURE_NAV[subview].isAvailable?.() ?? true;
}

function kingdomFeatureNavEntries(group: KingdomNavGroup): KingdomNavEntry[] {
  return (Object.keys(KINGDOM_FEATURE_NAV) as KingdomFeatureSubview[])
    .filter((subview) => KINGDOM_FEATURE_NAV[subview].group === group)
    .filter(isKingdomFeatureAvailable)
    .map((subview) => ({
      kind: 'feature',
      subview,
      label: KINGDOM_FEATURE_NAV[subview].label,
      icon: KINGDOM_FEATURE_NAV[subview].icon,
    }));
}

function kingdomTradeskillNavEntries(): KingdomNavEntry[] {
  return sortBy(
    getEntriesByType<TradeskillContent>('tradeskill'),
    (content) => content.name,
  ).map((content) => {
    const tradeskill = content.name as Tradeskill;
    return {
      kind: 'tradeskill',
      subview: kingdomSubviewForTradeskill(tradeskill),
      label: content.name,
      sprite: content.sprite,
      tradeskill,
    };
  });
}

export function kingdomNavSections(): KingdomNavSection[] {
  return KINGDOM_NAV_GROUP_ORDER.map((group) => ({
    group,
    entries:
      group === 'crafting'
        ? kingdomTradeskillNavEntries()
        : kingdomFeatureNavEntries(group),
  })).filter((section) => section.entries.length > 0);
}
