import {
  ChangeDetectionStrategy,
  Component,
  computed,
  viewChild,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ModalComponent } from '@components/modal/modal.component';
import { ModalTradeQuantityComponent } from '@components/modal-trade-quantity/modal-trade-quantity.component';
import { SlotCaravanTokenTradeComponent } from '@components/slot-caravan-token-trade/slot-caravan-token-trade.component';
import { SlotCaravanTradeComponent } from '@components/slot-caravan-trade/slot-caravan-trade.component';
import { SlotCommissionComponent } from '@components/slot-commission/slot-commission.component';
import {
  caravanState,
  caravanTicksUntilReset,
  caravanTimerLabel,
  caravanTimerUrgency,
} from '@helpers/caravan/caravan';
import {
  caravanExecuteTokenTrade,
  caravanExecuteTrade,
} from '@helpers/caravan/caravan-trade.ui';
import {
  caravanTokenTradeDisplay,
  caravanTradeDisplay,
} from '@helpers/caravan/caravan-trade-display.ui';
import {
  caravanIsTradeSoldOut,
  caravanTradeMaxQuantity,
  caravanTradeOwnedQuantity,
  caravanTradePrice,
  caravanTradeRemaining,
} from '@helpers/caravan/caravan-trade-quantity';
import { commissionFulfill } from '@helpers/commission/commission-fulfill';
import { commissionRowViewModel } from '@helpers/commission/commission-fulfill.ui';
import { getEntry } from '@helpers/content/content';
import { isRecipeDiscovered } from '@helpers/crafting/recipes';
import { notifySuccess } from '@helpers/engine/notify';
import { activeCaravanNode } from '@helpers/engine/ui';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { worldNodeCaravan } from '@helpers/world-node/world-nodes';
import type {
  CaravanTokenTradeRow,
  CaravanTraderContent,
  CaravanTradeRow,
} from '@interfaces';

@Component({
  selector: 'app-modal-caravan-trade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    SlotCaravanTradeComponent,
    SlotCaravanTokenTradeComponent,
    SlotCommissionComponent,
    ModalComponent,
    ModalTradeQuantityComponent,
  ],
  templateUrl: './modal-caravan-trade.component.html',
})
export class ModalCaravanTradeComponent {
  public entry = computed(() => activeCaravanNode());

  public caravan = computed(() => {
    const entry = this.entry();
    return entry ? worldNodeCaravan(entry) : undefined;
  });

  private nodeState = computed(() => {
    const caravan = this.caravan();
    return caravan ? caravanState(caravan.id) : undefined;
  });

  public trader = computed(() => {
    const traderId = this.nodeState()?.traderId;
    return traderId ? getEntry<CaravanTraderContent>(traderId) : undefined;
  });

  public tokenTrades = computed<CaravanTokenTradeRow[]>(() => {
    const trader = this.trader();
    if (!trader) return [];

    return trader.tokenTrades
      .map((trade, index) => ({ index, trade }))
      .filter(
        ({ trade }) =>
          (!trade.collectibleId ||
            !isCollectibleDiscovered(trade.collectibleId)) &&
          (!trade.recipeId || !isRecipeDiscovered(trade.recipeId)),
      );
  });

  public commission = computed(() => {
    const entry = this.entry();
    return entry ? commissionRowViewModel(entry) : undefined;
  });

  public fulfillCommission(): Promise<boolean> {
    const row = this.commission();
    return row ? commissionFulfill(row.caravanId) : Promise.resolve(false);
  }

  public trades = computed<CaravanTradeRow[]>(() => {
    const caravan = this.caravan();
    const trader = this.trader();
    const state = this.nodeState();
    if (!caravan || !trader || !state) return [];

    return state.activeTradeIndices
      .map(
        (index) =>
          trader.trades[index] && { index, trade: trader.trades[index] },
      )
      .filter(
        (
          entry,
        ): entry is { index: number; trade: (typeof trader.trades)[number] } =>
          !!entry,
      )
      .map(({ index, trade }) => ({
        index,
        trade,
        equipmentItem: state.rolledEquipment?.[index],
        price: caravanTradePrice(caravan, trade),
        remaining: caravanTradeRemaining(trade, state.tradeCounts, index),
        soldOut: caravanIsTradeSoldOut(trade, state.tradeCounts, index),
        maxQuantity: caravanTradeMaxQuantity(
          caravan,
          trade,
          state.tradeCounts,
          index,
        ),
        ownedQuantity: caravanTradeOwnedQuantity(trade),
      }));
  });

  private ticksUntilReset = computed(() => {
    const caravan = this.caravan();
    return caravan ? caravanTicksUntilReset(caravan, this.nodeState()) : 0;
  });

  public timerLabel = computed(() => {
    const caravan = this.caravan();
    return caravan ? caravanTimerLabel(caravan, this.nodeState()) : undefined;
  });

  public timerUrgency = computed(() =>
    caravanTimerUrgency(this.ticksUntilReset()),
  );

  private quantityPrompt = viewChild(ModalTradeQuantityComponent);

  public async requestTrade(
    row: CaravanTradeRow,
    skipConfirm = false,
  ): Promise<void> {
    if (row.soldOut) return;

    const verb = row.trade.type === 'sell' ? 'Buy' : 'Sell';
    const name =
      caravanTradeDisplay(row.trade, row.equipmentItem)?.name ?? 'this';
    const quantity =
      (await this.quantityPrompt()?.ask(
        { verb, name, price: row.price, maxQuantity: row.maxQuantity },
        skipConfirm,
      )) ?? 0;
    if (quantity > 0) await this.commitTrade(row, quantity);
  }

  private async commitTrade(
    row: CaravanTradeRow,
    quantity: number,
  ): Promise<void> {
    const entry = this.entry();
    if (!entry) return;

    // A bulk equipment buy only gets the previewed roll for the first unit
    // (the rest are freshly rolled) - use the plain content name so the
    // toast doesn't imply every unit shares that one roll's affixes.
    const previewedItem = quantity === 1 ? row.equipmentItem : undefined;
    const name = caravanTradeDisplay(row.trade, previewedItem)?.name ?? 'item';
    if (!(await caravanExecuteTrade(entry, row.index, quantity))) return;

    const qtyLabel = quantity > 1 ? ` x${quantity}` : '';
    notifySuccess(
      row.trade.type === 'sell'
        ? `You bought ${name}${qtyLabel}!`
        : `You sold ${name}${qtyLabel}!`,
    );
  }

  public async buyTokenTrade(row: CaravanTokenTradeRow): Promise<void> {
    const entry = this.entry();
    if (!entry) return;

    const name = caravanTokenTradeDisplay(row.trade)?.name ?? 'item';
    if (!(await caravanExecuteTokenTrade(entry, row.index))) return;

    notifySuccess(`You bought ${name}!`);
  }
}
