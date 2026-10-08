import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { IconComponent } from '@components/icon/icon.component';
import { ModalComponent } from '@components/modal/modal.component';
import { RowCurrencyCostComponent } from '@components/row-currency-cost/row-currency-cost.component';
import { SlotArmoryItemComponent } from '@components/slot-armory-item/slot-armory-item.component';
import { SFXDirective } from '@directives/sfx.directive';
import { activeExchangeNode } from '@helpers/engine/ui';
import {
  exchangeHasOnlyEquippedInputs,
  exchangePerformEquipment,
  exchangePerformItem,
  exchangeRows,
} from '@helpers/exchange/exchange.ui';
import { isPartyAtNode } from '@helpers/world';
import { worldNodeExchange } from '@helpers/world-node/world-nodes';
import type { CostItem, ExchangeItemRow, ExchangeRow } from '@interfaces';

@Component({
  selector: 'app-modal-exchange-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    ModalComponent,
    RowCurrencyCostComponent,
    SlotArmoryItemComponent,
    SFXDirective,
    IconComponent,
  ],
  templateUrl: './modal-exchange-node.component.html',
})
export class ModalExchangeNodeComponent {
  public node = computed(() => {
    const entry = activeExchangeNode();
    return entry ? worldNodeExchange(entry) : undefined;
  });

  public isAtNode = computed(() => {
    const entry = activeExchangeNode();
    return !!entry && isPartyAtNode(entry.nodeName);
  });

  public rows = computed<ExchangeRow[]>(() => {
    const node = this.node();
    return node ? exchangeRows(node) : [];
  });

  public showUnequipHint = computed(() => {
    const node = this.node();
    return !!node && exchangeHasOnlyEquippedInputs(node);
  });

  public rowTrack(row: ExchangeRow): string {
    return row.kind === 'Equipment'
      ? `${row.exchangeIndex}:${row.item.id}`
      : `${row.exchangeIndex}`;
  }

  public itemInput(row: ExchangeItemRow): CostItem[] {
    return [row.exchange.input];
  }

  public itemOutput(row: ExchangeItemRow): CostItem[] {
    return [
      {
        itemId: row.exchange.output.itemId,
        required: row.exchange.output.quantity,
      },
    ];
  }

  public perform(row: ExchangeRow): void {
    const entry = activeExchangeNode();
    if (!entry || !this.isAtNode() || !row.canAfford) return;

    if (row.kind === 'Equipment') {
      exchangePerformEquipment(entry.nodeName, row.exchangeIndex, row.item.id);
      return;
    }

    exchangePerformItem(entry.nodeName, row.exchangeIndex);
  }
}
