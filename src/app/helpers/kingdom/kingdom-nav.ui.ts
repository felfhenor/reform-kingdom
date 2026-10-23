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
  KingdomIcon,
  KingdomNavEntry,
  KingdomNavGroup,
  KingdomNavSection,
  Tradeskill,
  TradeskillContent,
} from '@interfaces';
import { sortBy, uniq } from 'es-toolkit/compat';

export const KINGDOM_FEATURE_NAV: Record<
  KingdomFeatureSubview,
  KingdomFeatureNav
> = {
  storage: {
    label: 'Storage',
    icon: 'storage',
    group: 'reserves',
  },
  armory: {
    label: 'Armory',
    icon: 'armory',
    group: 'reserves',
  },
  astralprojector: {
    label: 'Astral Projector',
    icon: 'astralprojector',
    group: 'reserves',
    isAvailable: () => unlockedAstralProjectorEntries().length > 0,
  },
  museum: {
    label: 'Museum',
    icon: 'museum',
    group: 'collections',
  },
  bestiary: {
    label: 'Bestiary',
    icon: 'bestiary',
    group: 'collections',
  },
  workers: {
    label: "Quartermaster's Annex",
    icon: 'workers',
    group: 'workforce',
    isAvailable: () => Object.keys(discoveredWorkersState()).length > 0,
  },
  workshop: {
    label: 'Workshop',
    icon: 'workshop',
    group: 'actions',
    isAvailable: () => isInfusionUnlocked() || isReforgeUnlocked(),
  },
  commissions: {
    label: 'Commissions',
    icon: 'commissions',
    group: 'actions',
    isAvailable: hasAnyCommission,
  },
};

// Exhaustive over the non-feature icons, so a new one won't compile until it's listed (and so preloaded).
const KINGDOM_EXTRA_ICONS: Record<
  Exclude<KingdomIcon, KingdomFeatureSubview>,
  true
> = {
  kingdom: true,
  reclass: true,
  requesteddefenses: true,
  sethome: true,
  tasks: true,
};

const KINGDOM_NAV_GROUP_ORDER: KingdomNavGroup[] = [
  'reserves',
  'collections',
  'workforce',
  'crafting',
  'actions',
];

export function kingdomIconURL(icon: KingdomIcon): string {
  return `asset/kingdom/${icon}.png`;
}

export function kingdomIconURLs(): string[] {
  const icons = [
    ...Object.values(KINGDOM_FEATURE_NAV).map((nav) => nav.icon),
    ...(Object.keys(KINGDOM_EXTRA_ICONS) as KingdomIcon[]),
  ];
  return uniq(icons).map(kingdomIconURL);
}

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
