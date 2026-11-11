import { formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { DetailCollectibleEffectsComponent } from '@components/detail-collectible-effects/detail-collectible-effects.component';
import { IconComponent } from '@components/icon/icon.component';
import { ModalComponent } from '@components/modal/modal.component';
import { RowCurrencyCostComponent } from '@components/row-currency-cost/row-currency-cost.component';
import { SlotArmoryItemComponent } from '@components/slot-armory-item/slot-armory-item.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { SlotRequirementComponent } from '@components/slot-requirement/slot-requirement.component';
import { TooltipItemPreviewComponent } from '@components/tooltip-item-preview/tooltip-item-preview.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content';
import { activeExchangeNode } from '@helpers/engine/ui';
import {
  exchangeHasOnlyEquippedInputs,
  exchangeInputHints,
  exchangePerformCollectible,
  exchangePerformEquipment,
  exchangePerformItem,
  exchangeRows,
} from '@helpers/exchange/exchange.ui';
import { getMaterialQuantity } from '@helpers/index';
import { isPartyAtNode } from '@helpers/world';
import { worldNodeExchange } from '@helpers/world-node/world-nodes';
import type { ExchangeItemRow, ExchangeRow, ItemContent } from '@interfaces';
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
    SlotRequirementComponent,
  ],
  templateUrl: './modal-exchange-node.component.html',
})
export class ModalExchangeNodeComponent {
  private locale = inject(LOCALE_ID);

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

  public itemInput(row: ExchangeItemRow) {
    return {
      item: getEntry<ItemContent>(row.exchange.input.itemId)!,
      required: row.exchange.input.required,
    };
  }

  public itemOutput(row: ExchangeItemRow) {
    return {
      item: getEntry<ItemContent>(row.exchange.output.itemId)!,
      quantity: row.exchange.output.quantity,
    };
  }

  public inputRequirement(row: ExchangeItemRow): string {
    const ownedTotal = getMaterialQuantity(row.exchange.input.itemId);

    const owned = formatNumber(ownedTotal, this.locale);
    const quantity = formatNumber(row.exchange.input.required, this.locale);
    return `${row.inputName} (${owned}/${quantity})`;
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
