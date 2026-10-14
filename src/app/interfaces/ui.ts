import type { Tradeskill } from '@interfaces/tradeskill';

export type DaisyColor =
  'primary' | 'neutral' | 'info' | 'success' | 'warning' | 'error';

export type ResourceBarColor = 'hp' | 'ep' | 'xp' | 'reputation';

export type ProgressBarColor = DaisyColor | ResourceBarColor | 'muted';

export type ProgressBarSize = 'default' | 'sm' | 'md';

export type BlankSlateSize = 'inline' | 'page';

export type GamePlayView =
  'world' | 'kingdom' | 'adventurelog' | 'heroes' | 'decree' | 'town';

export type HeroesSubview = '' | 'regalia';

export type KingdomSubview =
  | 'storage'
  | 'museum'
  | 'bestiary'
  | 'armory'
  | 'commissions'
  | 'astralprojector'
  | 'workshop'
  | 'tradeskill-artificing'
  | 'tradeskill-blacksmithing'
  | 'tradeskill-jewelcrafting'
  | 'tradeskill-tailoring'
  | 'tradeskill-woodworking'
  | 'workers';

export type KingdomFeatureSubview = Exclude<
  KingdomSubview,
  `tradeskill-${string}`
>;

export type KingdomNavGroup =
  'reserves' | 'collections' | 'workforce' | 'crafting' | 'actions';

export type KingdomIcon =
  | KingdomFeatureSubview
  | 'kingdom'
  | 'reclass'
  | 'requesteddefenses'
  | 'sethome'
  | 'tasks';

export type KingdomFeatureNav = {
  label: string;
  icon: KingdomIcon;
  group: KingdomNavGroup;
  isAvailable?: () => boolean;
};

export type KingdomNavEntry =
  | {
      kind: 'feature';
      subview: KingdomSubview;
      label: string;
      icon: KingdomIcon;
    }
  | {
      kind: 'tradeskill';
      subview: KingdomSubview;
      label: string;
      sprite: string;
      tradeskill: Tradeskill;
    };

export type KingdomNavSection = {
  group: KingdomNavGroup;
  entries: KingdomNavEntry[];
};
