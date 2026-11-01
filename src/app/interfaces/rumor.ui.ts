import type { DropRarity } from '@interfaces/droppable';
import type { RumorId } from '@interfaces/content-rumor';
import type { WorldNodeEntry } from '@interfaces/world-nodes';

export type RumorCatalogDestination = {
  node: WorldNodeEntry;
  regionName: string;
  isPartyHere: boolean;
  canTravel: boolean;
  // Set only while actively traveling toward this node.
  travelEtaSeconds?: number;
};

export type RumorCatalogRowViewModel = {
  rumorId: RumorId;
  name: string;
  description: string;
  rarity: DropRarity;
  sprite: string;
  // Only set once bought.
  destination?: RumorCatalogDestination;
};
