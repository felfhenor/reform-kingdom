export type PresenceActivityKind =
  | 'MainMenu'
  | 'NewGame'
  | 'NewAdventure'
  | 'FinishedAdventure'
  | 'Exploring'
  | 'TravelingTo'
  | 'Gathering'
  | 'Visiting'
  | 'Traveling'
  | 'Trading'
  | 'Recovering'
  | 'Resting';

export type PresenceActivity = {
  kind: PresenceActivityKind;
  name?: string;
};

export type PresenceStatus = {
  activity: PresenceActivity;
  partyDetails?: string;
  partyLevel?: number;
  paused?: boolean;
};

export type SteamRichPresence = {
  steam_display: string;
  name?: string;
  level?: string;
};

export type DiscordPresenceOpts = {
  state?: string;
  details?: string;
  smallImageKey?: string;
  smallImageText?: string;
  largeImageKey?: string;
  largeImageText?: string;
  steam?: SteamRichPresence;
};
