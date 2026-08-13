import { ChangeDetectionStrategy, Component, computed, signal, viewChild } from '@angular/core';
import { SlotCaravanTradeComponent } from '@components/slot-caravan-trade/slot-caravan-trade.component';
import { ModalComponent } from '@components/modal/modal.component';
import {
  activeCaravanNode,
  caravanExecuteTrade,
  caravanIsTradeSoldOut,
  caravanState,
  caravanTicksUntilReset,
  caravanTimerLabel,
  caravanTimerUrgency,
  caravanTradeClose,
  caravanTradeDisplay,
  caravanTradeMaxQuantity,
  caravanTradeOwnedQuantity,
  caravanTradePrice,
  caravanTradeRemaining,
  getEntry,
  notifySuccess,
  worldNodeCaravan,
} from '@helpers';
import type { CaravanTraderContent, CaravanTradeRow } from '@interfaces';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-modal-caravan-trade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlotCaravanTradeComponent, ModalComponent, SweetAlert2Module],
  templateUrl: './modal-caravan-trade.component.html',
})
export class ModalCaravanTradeComponent {
  public entry = computed(() => activeCaravanNode());
  public isVisible = computed(() => !!this.entry());

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

  public trades = computed<CaravanTradeRow[]>(() => {
    const caravan = this.caravan();
    const trader = this.trader();
    const state = this.nodeState();
    if (!caravan || !trader || !state) return [];

    return state.activeTradeIndices
      .map((index) => trader.trades[index] && { index, trade: trader.trades[index] })
      .filter((entry): entry is { index: number; trade: (typeof trader.trades)[number] } => !!entry)
      .map(({ index, trade }) => ({
        index,
        trade,
        price: caravanTradePrice(caravan, trade),
        remaining: caravanTradeRemaining(trade, state.tradeCounts, index),
        soldOut: caravanIsTradeSoldOut(trade, state.tradeCounts, index),
        maxQuantity: caravanTradeMaxQuantity(caravan, trade, state.tradeCounts, index),
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

  public timerUrgency = computed(() => caravanTimerUrgency(this.ticksUntilReset()));

  private confirmSwal = viewChild<SwalComponent>('confirmSwal');
  private quantitySwal = viewChild<SwalComponent>('quantitySwal');
  private pendingRow = signal<CaravanTradeRow | undefined>(undefined);

  // A trade with only one unit available skips straight to a plain yes/no
  // confirm; anything more prompts for how many (0 = cancel, capped at
  // `maxQuantity`) via `confirmQuantity`.
  public requestTrade(row: CaravanTradeRow): void {
    if (row.soldOut || row.maxQuantity <= 0) return;

    this.pendingRow.set(row);
    const name = caravanTradeDisplay(row.trade)?.name ?? 'this';
    const verb = row.trade.type === 'sell' ? 'Buy' : 'Sell';

    if (row.maxQuantity === 1) {
      const swal = this.confirmSwal();
      if (!swal) return;
      swal.swalOptions = { text: `${verb} ${name} for ${row.price}g?` };
      swal.fire();
      return;
    }

    const swal = this.quantitySwal();
    if (!swal) return;
    swal.swalOptions = {
      text: `How many ${name} would you like to ${verb.toLowerCase()}? (${row.price}g each)`,
      inputValue: 1,
      inputAttributes: { min: '0', max: `${row.maxQuantity}` },
    };
    swal.fire();
  }

  public confirmSingle(): void {
    const row = this.pendingRow();
    this.pendingRow.set(undefined);
    if (row) this.commitTrade(row, 1);
  }

  public confirmQuantity(value: unknown): void {
    const row = this.pendingRow();
    this.pendingRow.set(undefined);
    if (!row) return;

    const requested = Math.floor(Number(value));
    const quantity = Number.isFinite(requested)
      ? Math.min(Math.max(requested, 0), row.maxQuantity)
      : 0;
    if (quantity <= 0) return;

    this.commitTrade(row, quantity);
  }

  private commitTrade(row: CaravanTradeRow, quantity: number): void {
    const entry = this.entry();
    if (!entry) return;

    const name = caravanTradeDisplay(row.trade)?.name ?? 'item';
    if (!caravanExecuteTrade(entry, row.index, quantity)) return;

    const qtyLabel = quantity > 1 ? ` x${quantity}` : '';
    notifySuccess(
      row.trade.type === 'sell'
        ? `You bought ${name}${qtyLabel}!`
        : `You sold ${name}${qtyLabel}!`,
    );
  }

  public close(): void {
    caravanTradeClose();
  }
}
