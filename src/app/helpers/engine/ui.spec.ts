vi.mock('@helpers/town/town-visit', () => ({
  townMarkVisited: vi.fn(),
}));

vi.mock('@helpers/world-node/world-nodes', () => ({
  worldNodeCaravan: vi.fn(),
  worldNodeTown: vi.fn(),
}));

import {
  modalCloseAll,
  modalIsOpen,
  modalOpen,
} from '@helpers/engine/modal-stack';
import {
  activeTownNode,
  mapNodeAutoShowOnArrival,
  mapNodeDeselect,
  mapNodeSelect,
  selectedMapNode,
  townOpen,
} from '@helpers/engine/ui';
import { townMarkVisited } from '@helpers/town/town-visit';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import type { TownContent, WorldNodeEntry } from '@interfaces';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function node(nodeName: string): WorldNodeEntry {
  return { mapName: 'Carrina', x: 0, y: 0, nodeName, nodeData: {} as never };
}

describe('mapNodeAutoShowOnArrival', () => {
  beforeEach(() => {
    mapNodeDeselect();
    modalCloseAll();
  });

  it('selects the arrived-at node when nothing else is selected', () => {
    mapNodeAutoShowOnArrival(node('Field Ruins'));

    expect(selectedMapNode()).toEqual(node('Field Ruins'));
  });

  it('does not override a node the player already has selected', () => {
    mapNodeSelect(node('Old Town'));

    mapNodeAutoShowOnArrival(node('Field Ruins'));

    expect(selectedMapNode()).toEqual(node('Old Town'));
  });

  it('does not open while a modal is open', () => {
    modalOpen('caravan-trade');

    mapNodeAutoShowOnArrival(node('Field Ruins'));

    expect(selectedMapNode()).toBeUndefined();
  });
});

describe('townOpen', () => {
  beforeEach(() => {
    modalCloseAll();
    vi.clearAllMocks();
  });

  it('sets the active town node and opens the town modal', () => {
    vi.mocked(worldNodeTown).mockReturnValue({ id: 'larsia' } as TownContent);

    townOpen(node('Larsia'));

    expect(activeTownNode()).toEqual(node('Larsia'));
    expect(modalIsOpen('town')).toBe(true);
  });

  it('marks the town visited when the node resolves to a town', () => {
    vi.mocked(worldNodeTown).mockReturnValue({ id: 'larsia' } as TownContent);

    townOpen(node('Larsia'));

    expect(townMarkVisited).toHaveBeenCalledWith('larsia');
  });

  it('does not mark a visit when the node has no town content', () => {
    vi.mocked(worldNodeTown).mockReturnValue(undefined);

    townOpen(node('Field Ruins'));

    expect(townMarkVisited).not.toHaveBeenCalled();
    expect(modalIsOpen('town')).toBe(true);
  });
});
