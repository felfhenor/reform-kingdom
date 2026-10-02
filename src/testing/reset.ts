import { resetCombatLog } from '@helpers/combat/combat-log';
import { setAllContentById, setAllIdsByName } from '@helpers/content/content';
import { defaultGameState } from '@helpers/defaults';
import { setAllMaps } from '@helpers/maps';
import { setGameState } from '@helpers/state-game';
import { beforeEach } from 'vitest';

// Registered on import so every spec using the testing helpers starts each test from a clean world.
beforeEach(() => {
  setGameState(defaultGameState(), false);
  setAllContentById(new Map());
  setAllIdsByName(new Map());
  setAllMaps(new Map());
  resetCombatLog();
});
