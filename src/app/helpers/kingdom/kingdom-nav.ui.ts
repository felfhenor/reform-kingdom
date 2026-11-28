import { contentName } from '@helpers/i18n/i18n-content';
import { t } from '@helpers/i18n/i18n';
import { hasAnyCommission } from '@helpers/commission/commission-tick.ui';
import { COLOSSEUM_UNLOCK_LEVEL } from '@helpers/config';
import { tradeskillsEnabled } from '@helpers/crafting/tradeskill';
import { edictsActive } from '@helpers/edict/edict';
import { isRevealedAtLevel } from '@helpers/engine/feature-reveal';
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
} from '@interfaces';
import { uniq } from 'es-toolkit/compat';

export const KINGDOM_FEATURE_NAV: Record<
  KingdomFeatureSubview,
  KingdomFeatureNav
> = {
  storage: {
    get label() {
      return t('kingdomNav.storage');
    },
    icon: 'storage',
    group: 'reserves',
  },
  armory: {
    get label() {
      return t('kingdomNav.armory');
    },
    icon: 'armory',
    group: 'reserves',
  },
  astralprojector: {
    get label() {
      return t('kingdomNav.astralProjector');
    },
    icon: 'astralprojector',
    group: 'reserves',
    isAvailable: () => unlockedAstralProjectorEntries().length > 0,
  },
  museum: {
    get label() {
      return t('kingdomNav.museum');
    },
    icon: 'museum',
    group: 'collections',
  },
  bestiary: {
    get label() {
      return t('kingdomNav.bestiary');
    },
    icon: 'bestiary',
    group: 'collections',
  },
  workers: {
    get label() {
      return t('kingdomNav.quartermastersAnnex');
    },
    icon: 'workers',
    group: 'workforce',
    isAvailable: () => Object.keys(discoveredWorkersState()).length > 0,
  },
  workshop: {
    get label() {
      return t('kingdomNav.workshop');
    },
    icon: 'workshop',
    group: 'actions',
    isAvailable: () => isInfusionUnlocked() || isReforgeUnlocked(),
  },
  commissions: {
    get label() {
      return t('kingdomNav.commissions');
    },
    icon: 'commissions',
    group: 'actions',
    isAvailable: hasAnyCommission,
  },
  edicts: {
    get label() {
      return t('kingdomNav.edicts');
    },
    icon: 'edicts',
    group: 'actions',
    isAvailable: () => edictsActive().length > 0,
  },
  colosseum: {
    get label() {
      return t('kingdomNav.colosseum');
    },
    icon: 'colosseum',
    group: 'actions',
    isAvailable: () => isRevealedAtLevel(COLOSSEUM_UNLOCK_LEVEL),
  },
};

// Exhaustive over the non-feature icons, so a new one won't compile until it's listed (and so preloaded).
const KINGDOM_EXTRA_ICONS: Record<
  Exclude<KingdomIcon, KingdomFeatureSubview>,
  true
> = {
  improvements: true,
  kingdom: true,
  reclass: true,
  remembrance: true,
  requesteddefenses: true,
  rumor: true,
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
  return tradeskillsEnabled().map((content) => {
    const tradeskill = content.name as Tradeskill;
    return {
      kind: 'tradeskill',
      subview: kingdomSubviewForTradeskill(tradeskill),
      label: contentName(content),
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
