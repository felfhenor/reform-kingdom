import type { EncounterContent, TiledObject, WorldNodeEntry } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@helpers/world-node/world-node-discovery', () => ({
  isWorldNodeDiscovered: vi.fn(() => false),
  worldNodeDiscover: vi.fn(),
}));

vi.mock('@helpers/item/collectibles', () => ({
  isCollectibleDiscovered: vi.fn(() => true),
}));

vi.mock('@helpers/combat/combat-log', () => ({
  miscellaneousMessageLog: vi.fn(),
}));

import { miscellaneousMessageLog } from '@helpers/combat/combat-log';
import { setAllContentById, setAllIdsByName } from '@helpers/content';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { worldNodeDiscoverIfCollectibleGateMet } from '@helpers/world-node/world-node-collectible-gate';
import {
  isWorldNodeDiscovered,
  worldNodeDiscover,
} from '@helpers/world-node/world-node-discovery';
import type { CollectibleId } from '@interfaces';

function buildObject(overrides: Partial<TiledObject>): TiledObject {
  return {
    id: 1,
    name: 'Unnamed',
    type: '',
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    visible: true,
    ...overrides,
  };
}

function buildEntry(nodeData: Partial<TiledObject> = {}): WorldNodeEntry {
  return {
    mapName: 'Carrina',
    x: 24,
    y: 24,
    nodeName: 'Forest Ruins',
    nodeData: buildObject(nodeData),
  };
}

function buildEncounter(
  overrides: Partial<EncounterContent> = {},
): EncounterContent {
  return {
    id: 'encounter-forest-ruins',
    name: 'Forest Ruins',
    __type: 'encounter',
    description: 'A crumbling ruin at the edge of the forest.',
    levelRange: { min: 1, max: 3 },
    fights: [],
    invisibleUntilCollectibleIdsFound: [],
    ...overrides,
  } as EncounterContent;
}

function seedEncounter(encounter: EncounterContent): void {
  setAllIdsByName(new Map([[encounter.name, encounter.id]]));
  setAllContentById(new Map([[encounter.id, encounter]]));
}

describe('worldNodeDiscoverIfCollectibleGateMet', () => {
  beforeEach(() => {
    setAllIdsByName(new Map());
    setAllContentById(new Map());
    vi.mocked(isWorldNodeDiscovered).mockReturnValue(false);
    vi.mocked(isCollectibleDiscovered).mockReset().mockReturnValue(true);
    vi.mocked(worldNodeDiscover).mockClear();
    vi.mocked(miscellaneousMessageLog).mockClear();
  });

  it('does nothing for a node with no gate', () => {
    seedEncounter(buildEncounter());

    worldNodeDiscoverIfCollectibleGateMet(buildEntry());

    expect(worldNodeDiscover).not.toHaveBeenCalled();
    expect(miscellaneousMessageLog).not.toHaveBeenCalled();
  });

  it('does nothing while the gate remains unmet', () => {
    seedEncounter(
      buildEncounter({
        invisibleUntilCollectibleIdsFound: ['Gobweb' as CollectibleId],
      }),
    );
    vi.mocked(isCollectibleDiscovered).mockReturnValue(false);

    worldNodeDiscoverIfCollectibleGateMet(buildEntry());

    expect(worldNodeDiscover).not.toHaveBeenCalled();
    expect(miscellaneousMessageLog).not.toHaveBeenCalled();
  });

  it('discovers and logs the unlock exactly once the gate becomes met', () => {
    seedEncounter(
      buildEncounter({
        invisibleUntilCollectibleIdsFound: ['Gobweb' as CollectibleId],
      }),
    );
    vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
    vi.mocked(isWorldNodeDiscovered).mockReturnValue(false);

    worldNodeDiscoverIfCollectibleGateMet(buildEntry());

    expect(worldNodeDiscover).toHaveBeenCalledWith('Forest Ruins');
    expect(miscellaneousMessageLog).toHaveBeenCalledWith(
      '**Forest Ruins** is now accessible.',
    );
  });

  it('stays silent for a node that is also hidden, leaving reveal-on-click intact', () => {
    seedEncounter(
      buildEncounter({
        hidden: true,
        invisibleUntilCollectibleIdsFound: ['Gobweb' as CollectibleId],
      }),
    );
    vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
    vi.mocked(isWorldNodeDiscovered).mockReturnValue(false);

    worldNodeDiscoverIfCollectibleGateMet(buildEntry());

    expect(worldNodeDiscover).not.toHaveBeenCalled();
    expect(miscellaneousMessageLog).not.toHaveBeenCalled();
  });

  it('does not re-notify a node that has already been discovered', () => {
    seedEncounter(
      buildEncounter({
        invisibleUntilCollectibleIdsFound: ['Gobweb' as CollectibleId],
      }),
    );
    vi.mocked(isCollectibleDiscovered).mockReturnValue(true);
    vi.mocked(isWorldNodeDiscovered).mockReturnValue(true);

    worldNodeDiscoverIfCollectibleGateMet(buildEntry());

    expect(worldNodeDiscover).not.toHaveBeenCalled();
    expect(miscellaneousMessageLog).not.toHaveBeenCalled();
  });
});
