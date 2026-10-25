import {
  categoryMessageLog,
  ITEM_ICON_TOKEN,
  rarityNameHtml,
} from '@helpers/combat/combat-log';
import { resolvedDropLogPart } from '@helpers/combat/combat-rewards';
import { getEntry } from '@helpers/content/content';
import { equipmentItemDisplayName } from '@helpers/item/affix';
import { notifyError } from '@helpers/engine/notify';
import { armoryHasRoom } from '@helpers/kingdom/armory';
import { rumorSprite } from '@helpers/rumor/rumor';
import { updateGamestate } from '@helpers/state-game';
import type {
  AdventureLogRewardPart,
  EquipmentContent,
  EquipmentItem,
  GameState,
  ResolvedDrop,
  RumorContent,
  RumorId,
  TradeCommitOutcome,
  TradeGoods,
} from '@interfaces';
import { rewardContentInfo } from '@helpers/world-node/world-node-rewards';
import { compact } from 'es-toolkit/compat';

const TRADE_FAILURE_MESSAGES: Partial<Record<TradeCommitOutcome, string>> = {
  armoryFull: 'Your armory is full.',
  vanished: 'That item has disappeared from the shop.',
};

export function tradeWarn(outcome: TradeCommitOutcome): void {
  const message = TRADE_FAILURE_MESSAGES[outcome];
  if (message) notifyError(message);
}

// Fast path before committing; the live re-check inside `tradeCommit` is what actually guards.
export function tradeArmoryHasRoom(quantity: number): boolean {
  if (armoryHasRoom(quantity)) return true;

  tradeWarn('armoryFull');
  return false;
}

// Awaited so `outcome` is set before it's read, even when the update is deferred outside a tick.
export async function tradeCommit(
  apply: (state: GameState) => TradeCommitOutcome,
): Promise<boolean> {
  let outcome = 'rejected' as TradeCommitOutcome;

  await updateGamestate((state) => {
    outcome = apply(state);
    return state;
  });

  tradeWarn(outcome);
  return outcome === 'executed';
}

function tradeGoodsDrop(
  goods: TradeGoods,
  quantity: number,
): ResolvedDrop | undefined {
  if (goods.itemId) return { kind: 'Item', itemId: goods.itemId, quantity };
  if (goods.equipmentId) {
    return { kind: 'Equipment', equipmentId: goods.equipmentId };
  }
  if (goods.collectibleId) {
    return { kind: 'Collectible', collectibleId: goods.collectibleId };
  }
  if (goods.recipeId) return { kind: 'Recipe', recipeId: goods.recipeId };
  return undefined;
}

// Non-item drops carry no quantity, so a multi-unit one gets an explicit count.
export function tradeGoodsLogPart(
  goods: TradeGoods,
  quantity: number,
): AdventureLogRewardPart | undefined {
  const drop = tradeGoodsDrop(goods, quantity);
  const part = drop ? resolvedDropLogPart(drop) : undefined;
  if (!part || drop?.kind === 'Item' || quantity === 1) return part;

  return { ...part, html: `${quantity.toLocaleString()}x ${part.html}` };
}

// A specific rolled instance, so its affixes show in the name.
export function tradeEquipmentItemLogPart(
  item: EquipmentItem,
): AdventureLogRewardPart | undefined {
  const content = getEntry<EquipmentContent>(item.equipmentId);
  const icon = rewardContentInfo({ equipmentId: item.equipmentId });
  if (!content || !icon) return undefined;

  const name = equipmentItemDisplayName(item, content.name);
  return {
    html: `${ITEM_ICON_TOKEN}${rarityNameHtml(name, content.rarity)}`,
    icon,
  };
}

export function tradeRumorLogPart(
  rumorId: RumorId,
): AdventureLogRewardPart | undefined {
  const rumor = getEntry<RumorContent>(rumorId);
  const sprite = rumorSprite();
  if (!rumor || !sprite) return undefined;

  return {
    html: `${ITEM_ICON_TOKEN}${rarityNameHtml(rumor.name, rumor.rarity)}`,
    icon: { sprite, spritesheet: 'item' },
  };
}

function tradeLogPartsHtml(parts: AdventureLogRewardPart[]): string {
  return parts.map((part) => part.html).join(', ');
}

export function tradeLog(
  locationName: string,
  verb: string,
  goods: (AdventureLogRewardPart | undefined)[],
  price: (AdventureLogRewardPart | undefined)[],
): void {
  const goodsParts = compact(goods);
  const priceParts = compact(price);
  if (goodsParts.length === 0) return;

  const priceText =
    priceParts.length === 0 ? '' : ` for ${tradeLogPartsHtml(priceParts)}`;
  categoryMessageLog(
    'Miscellaneous',
    locationName,
    `You ${verb} ${tradeLogPartsHtml(goodsParts)}${priceText}.`,
    compact([...goodsParts, ...priceParts].map((part) => part.icon)),
  );
}
