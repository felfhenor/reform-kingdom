import { DecimalPipe, formatNumber } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ButtonTravelHereComponent } from '@components/button-travel-here/button-travel-here.component';
import { ModalComponent } from '@components/modal/modal.component';
import { SlotRequirementComponent } from '@components/slot-requirement/slot-requirement.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { ListReflowDirective } from '@directives/list-reflow.directive';
import { getEntry } from '@helpers/content/content';
import { modalIsOpen } from '@helpers/engine/modal-stack';
import { getMaterialQuantity } from '@helpers/item/materials';
import { worldNodeImprovementRows } from '@helpers/world-node/world-node-improvement.ui';
import type { CostItem, ItemContent } from '@interfaces';

@Component({
  selector: 'app-modal-improvements',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    ButtonTravelHereComponent,
    DecimalPipe,
    ListReflowDirective,
    ModalComponent,
    SlotRequirementComponent,
    SpriteNodeComponent,
  ],
  templateUrl: './modal-improvements.component.html',
})
export class ModalImprovementsComponent {
  private locale = inject(LOCALE_ID);

  // Always mounted, so skip per-row pathing while closed.
  public rows = computed(() =>
    modalIsOpen('improvements') ? worldNodeImprovementRows() : [],
  );

  public costContent(cost: CostItem): ItemContent | undefined {
    return getEntry<ItemContent>(cost.itemId);
  }

  public costOwned(cost: CostItem): number {
    return getMaterialQuantity(cost.itemId);
  }

  public costTooltip(cost: CostItem): string {
    const name = this.costContent(cost)?.name ?? 'Unknown';
    const owned = formatNumber(this.costOwned(cost), this.locale);
    const quantity = formatNumber(cost.required, this.locale);
    return `${name} (${owned}/${quantity})`;
  }
}
