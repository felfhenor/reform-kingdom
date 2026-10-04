import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/migrate');
vi.mock('@helpers/savefile/savefile-load');

import { combatLog, combatMessageLog } from '@helpers/combat/combat-log';
import {
  gamePlayView,
  kingdomSubview,
  kingdomSubviewShow,
  setGamePlayView,
} from '@helpers/engine/ui';
import { gameReset } from '@helpers/game-init';
import { migrateGameState } from '@helpers/migrate';
import { savefileMarkFresh } from '@helpers/savefile/savefile-load';
import { gamestate } from '@helpers/state-game';
import { getOption, setOption } from '@helpers/state-options';
import { buildCharacter, buildCombat } from '@/testing/builders';
import { seedGamestate } from '@/testing/gamestate';

beforeEach(() => {
  vi.resetAllMocks();
  seedGamestate((state) => (state.world.party = [buildCharacter()]));
});

describe('gameReset', () => {
  it('starts a fresh game, then re-runs migration so guaranteed grants still apply', () => {
    let partyWhenMigrated: number | undefined;
    vi.mocked(migrateGameState).mockImplementation(
      () => (partyWhenMigrated = gamestate().world.party.length),
    );

    gameReset();

    expect(gamestate().world.party).toEqual([]);
    expect(partyWhenMigrated).toBe(0);
  });

  it('unblocks saving before resetting, so a new game replacing an unloadable save persists', () => {
    let partyWhenUnblocked: number | undefined;
    vi.mocked(savefileMarkFresh).mockImplementation(
      () => (partyWhenUnblocked = gamestate().world.party.length),
    );

    gameReset();

    expect(partyWhenUnblocked).toBe(1);
  });

  it('unpauses the gameloop and clears the previous session’s view and log', () => {
    setOption('gameloopPaused', true);
    setGamePlayView('town');
    kingdomSubviewShow('museum');
    combatMessageLog(buildCombat(), 'Old news.');

    gameReset();

    expect(getOption('gameloopPaused')).toBe(false);
    expect(gamePlayView()).toBe('world');
    expect(kingdomSubview()).toBe('');
    expect(combatLog()).toEqual([]);
  });
});
