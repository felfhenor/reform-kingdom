vi.mock('@helpers/town/town-visit');

import { modalCloseAll, modalOpen } from '@helpers/engine/modal-stack';
import {
  activeTownNode,
  gamePlayView,
  mapNodeAutoShowOnArrival,
  mapNodeDeselect,
  mapNodeSelect,
  selectedMapNode,
  setGamePlayView,
  townOpen,
} from '@helpers/engine/ui';
import { townMarkVisited } from '@helpers/town/town-visit';
import { ensureTown } from '@helpers/content/ensure-town';
import type { TownId, WorldNodeEntry } from '@interfaces';
import { seedContent } from '@/testing/content';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function node(nodeName: string): WorldNodeEntry {
  return {
    mapName: 'Carrina',
    x: 0,
    y: 0,
    nodeName,
    nodeData: {
      id: 1,
      name: nodeName,
      type: 'NonPlayerKingdom',
      x: 0,
      y: 0,
      width: 16,
      height: 16,
      visible: true,
    },
  };
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
  const larsia = ensureTown({ id: 'larsia' as TownId, name: 'Larsia' });

  beforeEach(() => {
    modalCloseAll();
    setGamePlayView('world');
    vi.clearAllMocks();
  });

  it('sets the active town node and switches to the town view', () => {
    seedContent([larsia]);

    townOpen(node('Larsia'));

    expect(activeTownNode()).toEqual(node('Larsia'));
    expect(gamePlayView()).toBe('town');
  });

  it('marks the town visited when the node resolves to a town', () => {
    seedContent([larsia]);

    townOpen(node('Larsia'));

    expect(townMarkVisited).toHaveBeenCalledWith('larsia');
  });

  it('does not mark a visit when the node has no town content', () => {
    seedContent([larsia]);

    townOpen(node('Field Ruins'));

    expect(townMarkVisited).not.toHaveBeenCalled();
    expect(gamePlayView()).toBe('town');
  });
});
