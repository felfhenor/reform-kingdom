import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { DetailCollectibleEffectsComponent } from '@components/detail-collectible-effects/detail-collectible-effects.component';
import { IconComponent } from '@components/icon/icon.component';
import { ModalComponent } from '@components/modal/modal.component';
import { RowCurrencyCostComponent } from '@components/row-currency-cost/row-currency-cost.component';
import { SlotArmoryItemComponent } from '@components/slot-armory-item/slot-armory-item.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { TooltipItemPreviewComponent } from '@components/tooltip-item-preview/tooltip-item-preview.component';
import { SFXDirective } from '@directives/sfx.directive';
import { activeExchangeNode } from '@helpers/engine/ui';
import {
  exchangeHasOnlyEquippedInputs,
  exchangeInputHints,
  exchangePerformCollectible,
  exchangePerformEquipment,
  exchangePerformItem,
  exchangeRows,
} from '@helpers/exchange/exchange.ui';
import { isPartyAtNode } from '@helpers/world';
import { worldNodeExchange } from '@helpers/world-node/world-nodes';
import type { CostItem, ExchangeItemRow, ExchangeRow } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-modal-exchange-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    BlankSlateComponent,
    DetailCollectibleEffectsComponent,
    ModalComponent,
    RowCurrencyCostComponent,
    SlotArmoryItemComponent,
    SlotRarityOutlineComponent,
    SFXDirective,
    TippyDirective,
    TooltipItemPreviewComponent,
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

  public inputHints = computed(() => {
    const node = this.node();
    return node ? exchangeInputHints(node) : [];
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

    if (row.kind === 'Collectible') {
      exchangePerformCollectible(entry.nodeName, row.exchangeIndex);
      return;
    }

    exchangePerformItem(entry.nodeName, row.exchangeIndex);
  }
}
