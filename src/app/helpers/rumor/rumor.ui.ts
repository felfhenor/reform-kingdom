import {
  caravanTraderMapNames,
  isTraderDiscovered,
} from '@helpers/caravan/caravan';
import { travelEtaSecondsTo } from '@helpers/hero/travel';
import { travelCanStartTo } from '@helpers/hero/travel.ui';
import { UNMET_TRADER_NAME } from '@helpers/kingdom/museum.ui';
import { regionNameForMap } from '@helpers/lore/region-intro';
import {
  isRumorBought,
  rumorNodeName,
  rumorsSold,
  rumorSprite,
  rumorTraders,
} from '@helpers/rumor/rumor';
import { isPartyAtNode } from '@helpers/world';
import { isWorldMapVisited } from '@helpers/world-node/world-map-discovery';
import { worldNodeByName } from '@helpers/world-node/world-nodes';
import type {
  RumorCatalogDestination,
  RumorCatalogRowViewModel,
  RumorContent,
} from '@interfaces';
import { sortBy, uniq } from 'es-toolkit/compat';

function rumorDestination(
  rumor: RumorContent,
): RumorCatalogDestination | undefined {
  const nodeName = rumorNodeName(rumor);
  const node = nodeName ? worldNodeByName(nodeName) : undefined;
  if (!node) return undefined;

  return {
    node,
    regionName: regionNameForMap(node.mapName),
    isPartyHere: isPartyAtNode(node.nodeName),
    canTravel: travelCanStartTo(node),
    travelEtaSeconds: travelEtaSecondsTo(node.nodeName),
  };
}

// Names only what the player has seen: the trader if met, else the regions it roams.
function rumorSourceLabel(rumor: RumorContent): string {
  const traders = rumorTraders(rumor.id);
  const metNames = traders
    .filter((trader) => isTraderDiscovered(trader.id))
    .map((trader) => trader.name);
  if (metNames.length > 0) return `From: ${metNames.join(', ')}`;

  const regionNames = uniq(
    traders
      .flatMap((trader) => caravanTraderMapNames(trader.id))
      .filter(isWorldMapVisited)
      .map(regionNameForMap),
  );
  return regionNames.length > 0
    ? `From: ${UNMET_TRADER_NAME} in ${regionNames.join(', ')}`
    : 'Source unknown';
}

function rumorCatalogRow(rumor: RumorContent): RumorCatalogRowViewModel {
  const destination = isRumorBought(rumor)
    ? rumorDestination(rumor)
    : undefined;

  return {
    rumorId: rumor.id,
    name: rumor.name,
    description: destination ? rumor.description : rumorSourceLabel(rumor),
    rarity: rumor.rarity,
    sprite: rumorSprite() ?? '',
    destination,
  };
}

export function rumorsBought(): RumorContent[] {
  return rumorsSold().filter(isRumorBought);
}

// Sorted by real name so a row keeps its slot once bought.
export function rumorCatalogRowViewModels(): RumorCatalogRowViewModel[] {
  return sortBy(rumorsSold(), (rumor) => rumor.name.toLowerCase()).map(
    rumorCatalogRow,
  );
}
