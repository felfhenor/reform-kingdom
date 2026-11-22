import { describe, expect, it } from 'vitest';

import {
  presenceActivityText,
  steamPresenceTokens,
  steamPresenceVdf,
  steamRichPresence,
} from '@helpers/engine/presence';

describe('presenceActivityText', () => {
  it('fills in the name, or leaves a nameless activity as-is', () => {
    expect(presenceActivityText({ kind: 'Gathering', name: 'Iron Vein' })).toBe(
      'Gathering in Iron Vein',
    );
    expect(presenceActivityText({ kind: 'MainMenu' })).toBe('In Main Menu');
  });
});

describe('steamRichPresence', () => {
  it('always points at a token that exists', () => {
    const tokens = steamPresenceTokens();
    const displays = [
      steamRichPresence({ kind: 'MainMenu' }),
      steamRichPresence({ kind: 'Resting', name: 'Elfheim' }, 7),
      steamRichPresence({ kind: 'Trading', name: 'Grix' }, 1, true),
      steamRichPresence({ kind: 'Traveling' }, undefined, true),
    ].map((presence) => presence.steam_display);

    displays.forEach((display) => expect(tokens[display]).toBeDefined());
    expect(tokens['#Trading_Level_Paused']).toBe(
      'Paused · Trading with %name% · Lv %level%',
    );
  });
});

describe('steamPresenceVdf', () => {
  it('nests each token as a tab-separated pair inside the english Tokens block', () => {
    const vdf = steamPresenceVdf();
    expect(
      vdf.startsWith('"lang"\n{\n\t"Language"\t"english"\n\t"Tokens"\n\t{\n'),
    ).toBe(true);
    expect(vdf).toContain(
      '\t\t"#Exploring_Level"\t"Exploring %name% · Lv %level%"\n',
    );
    expect(vdf.endsWith('\n\t}\n}\n')).toBe(true);
  });
});
