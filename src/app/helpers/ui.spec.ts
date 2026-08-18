import { beforeEach, describe, expect, it } from 'vitest';
import { modalCloseAll, modalOpen } from '@helpers/modal-stack';
import {
  mapNodeAutoShowOnArrival,
  mapNodeDeselect,
  mapNodeSelect,
  selectedMapNode,
} from '@helpers/ui';
import type { WorldNodeEntry } from '@interfaces';

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
