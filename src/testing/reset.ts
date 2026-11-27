import { resetCombatLog } from '@helpers/combat/combat-log';
import {
  contentSnapshotBase,
  setAllContentById,
  setAllIdsByName,
} from '@helpers/content/content';
import { defaultGameState } from '@helpers/defaults';
import { mapsSnapshotBase, setAllMaps, setBaseTilesets } from '@helpers/maps';
import {
  setModsAppliedRefs,
  setModsInstalled,
} from '@helpers/mod/mod-registry';
import { setModSprites } from '@helpers/mod/mod-sprites';
import { setGameState } from '@helpers/state-game';
import { beforeEach } from 'vitest';

// Registered on import so every spec using the testing helpers starts each test from a clean world.
beforeEach(() => {
  setGameState(defaultGameState(), false);
  setAllContentById(new Map());
  setAllIdsByName(new Map());
  setAllMaps(new Map());
  setBaseTilesets({});
  contentSnapshotBase();
  mapsSnapshotBase();
  setModSprites([]);
  setModsInstalled([]);
  setModsAppliedRefs([]);
  resetCombatLog();
});
