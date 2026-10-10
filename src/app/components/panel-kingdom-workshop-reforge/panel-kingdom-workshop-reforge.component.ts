import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { DetailItemPreviewComponent } from '@components/detail-item-preview/detail-item-preview.component';
import { RowAffixEffectsComponent } from '@components/row-affix-effects/row-affix-effects.component';
import { RowCurrencyCostComponent } from '@components/row-currency-cost/row-currency-cost.component';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { SlotButtonContainerComponent } from '@components/slot-button-container/slot-button-container.component';
import { SFXDirective } from '@directives/sfx.directive';
import { TeleportToDirective } from '@directives/teleport.to.directive';
import { equipmentItemAffixDisplays } from '@helpers/item/affix-display.ui';
import { equipmentItemSlotCount } from '@helpers/item/infusion';
import { equipmentItemReforgeCost } from '@helpers/item/reforge';
import {
  equipmentReforge,
  isEquipmentItemReforgeable,
  reforgeMayDestroyGems,
} from '@helpers/item/reforge.ui';
import { worldNodeCanAffordCost } from '@helpers/world-node/world-node-cost';
import type { EquipmentItem, ItemPreviewDisplay } from '@interfaces';
import { AnimationService } from '@services/animation.service';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-panel-kingdom-workshop-reforge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    DetailItemPreviewComponent,
    RowAffixEffectsComponent,
    RowCurrencyCostComponent,
    RowInfusedMaterialsComponent,
    SFXDirective,
    SlotButtonContainerComponent,
    SweetAlert2Module,
    TeleportToDirective,
  ],
  host: { class: 'contents' },
  templateUrl: './panel-kingdom-workshop-reforge.component.html',
})
export class PanelKingdomWorkshopReforgeComponent {
  private anim = inject(AnimationService);
  private reforgeSwal = viewChild<SwalComponent>('reforgeSwal');

  public item = input.required<EquipmentItem>();
  public display = input.required<ItemPreviewDisplay>();
  public modifiable = input.required<boolean>();
  public actionOutlet = input.required<string>();

  public reforging = signal(false);

  public slotCount = computed(() => equipmentItemSlotCount(this.item()));

  // The affix rows below already show these.
  public previewDisplay = computed(() => ({
    ...this.display(),
    miscAffixDescriptions: undefined,
  }));

  public affixDisplays = computed(() =>
    equipmentItemAffixDisplays(this.item()),
  );

  public cost = computed(() => equipmentItemReforgeCost(this.item()));

  public reforgeable = computed(() => isEquipmentItemReforgeable(this.item()));

  public canAfford = computed(() => worldNodeCanAffordCost(this.cost()));

  public mayDestroyGems = computed(() => reforgeMayDestroyGems(this.item()));

  public canReforge = computed(
    () =>
      this.reforgeable() &&
      this.canAfford() &&
      this.modifiable() &&
      !this.reforging(),
  );

  public onAffixEnter(event: AnimationCallbackEvent, index: number): void {
    this.anim.staggerIn(event.target, index);
  }

  public requestReforge(skipConfirm = false): void {
    if (skipConfirm) {
      void this.confirmReforge();
      return;
    }

    const swal = this.reforgeSwal();
    if (!swal) return;

    // A plain setter, so it applies before the synchronous fire() below.
    swal.swalOptions = {
      text: this.mayDestroyGems()
        ? 'Its affixes will be rerolled and the current ones lost. Gems in sockets added by affixes may be destroyed; other infusions are kept.'
        : 'Its affixes will be rerolled and the current ones lost. Infusions are kept.',
    };
    swal.fire();
  }

  public async confirmReforge(): Promise<void> {
    if (!this.canReforge()) return;

    this.reforging.set(true);
    try {
      await equipmentReforge(this.item().id);
    } finally {
      this.reforging.set(false);
    }
  }
}
