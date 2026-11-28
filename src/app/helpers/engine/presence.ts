import { t } from '@helpers/i18n/i18n';
import type {
  PresenceActivity,
  PresenceActivityKind,
  SteamRichPresence,
} from '@interfaces';

// %name% doubles as a Steam rich presence key, so these strings are also the Steam tokens' text.
export const PRESENCE_ACTIVITY_TEXT: Record<PresenceActivityKind, string> = {
  MainMenu: 'In Main Menu',
  NewGame: 'Starting a new game...',
  NewAdventure: 'Starting a grand adventure',
  FinishedAdventure: 'Finishing a grand adventure',
  Exploring: 'Exploring %name%',
  TravelingTo: 'Traveling to %name%',
  Gathering: 'Gathering in %name%',
  Visiting: 'Visiting %name%',
  Traveling: 'Traveling',
  Trading: 'Trading with %name%',
  Recovering: 'Recovering at %name%',
  Resting: 'Resting at %name%',
};

export function presencePausedText(text: string): string {
  return `Paused · ${text}`;
}

export function presenceActivityText(activity: PresenceActivity): string {
  return t(`presence.${activity.kind}`, { name: activity.name ?? '' });
}

function steamPresenceToken(
  kind: PresenceActivityKind,
  hasLevel: boolean,
  paused: boolean,
): string {
  return `#${kind}${hasLevel ? '_Level' : ''}${paused ? '_Paused' : ''}`;
}

function steamPresenceTokenText(
  kind: PresenceActivityKind,
  hasLevel: boolean,
  paused: boolean,
): string {
  const text = `${PRESENCE_ACTIVITY_TEXT[kind]}${hasLevel ? ' · Lv %level%' : ''}`;
  return paused ? presencePausedText(text) : text;
}

export function steamRichPresence(
  activity: PresenceActivity,
  level?: number,
  paused = false,
): SteamRichPresence {
  return {
    steam_display: steamPresenceToken(
      activity.kind,
      level !== undefined,
      paused,
    ),
    name: activity.name,
    level: level?.toString(),
  };
}

// One flat token per variant, since Steam's docs never promise a nested token gets its own %key% filled in.
export function steamPresenceTokens(): Record<string, string> {
  const kinds = Object.keys(PRESENCE_ACTIVITY_TEXT) as PresenceActivityKind[];
  const flags = [false, true];
  return Object.fromEntries(
    kinds.flatMap((kind) =>
      flags.flatMap((hasLevel) =>
        flags.map((paused) => [
          steamPresenceToken(kind, hasLevel, paused),
          steamPresenceTokenText(kind, hasLevel, paused),
        ]),
      ),
    ),
  );
}

export function steamPresenceVdf(): string {
  const tokens = Object.entries(steamPresenceTokens())
    .map(([token, text]) => `\t\t"${token}"\t"${text}"`)
    .join('\n');
  return `"lang"\n{\n\t"Language"\t"english"\n\t"Tokens"\n\t{\n${tokens}\n\t}\n}\n`;
}
