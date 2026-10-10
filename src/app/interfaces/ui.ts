export type DaisyColor =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export type ResourceBarColor = 'hp' | 'ep' | 'xp';

export type ProgressBarSize = 'default' | 'sm' | 'md';

export type BlankSlateSize = 'inline' | 'page';

export type GamePlayView =
  'world' | 'kingdom' | 'adventurelog' | 'heroes' | 'decree' | 'town';

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
  | 'achievements'
  | 'prestige'
  | 'workers';
