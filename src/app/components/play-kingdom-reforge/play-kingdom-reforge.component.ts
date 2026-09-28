import { DecimalPipe } from '@angular/common';
import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { PanelEquipmentPickerComponent } from '@components/panel-equipment-picker/panel-equipment-picker.component';
import { DetailItemPreviewComponent } from '@components/detail-item-preview/detail-item-preview.component';
import { RowAffixEffectsComponent } from '@components/row-affix-effects/row-affix-effects.component';
import { RowCurrencyCostComponent } from '@components/row-currency-cost/row-currency-cost.component';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { SlotButtonContainerComponent } from '@components/slot-button-container/slot-button-container.component';
import { SFXDirective } from '@directives/sfx.directive';
import { TutorialTargetDirective } from '@directives/tutorial-target.directive';
import { getEntry } from '@helpers/content/content';
import { ownedEquipmentItem } from '@helpers/hero/character-equipment.ui';
import { equipmentItemAffixDisplays } from '@helpers/item/affix-display.ui';
import { canModifyEquipment } from '@helpers/item/equipment';
import { equipmentItemSlotCount } from '@helpers/item/infusion';
import { equipmentItemPreviewDisplay } from '@helpers/item/item-preview.ui';
import { equipmentItemReforgeCost, isReforgeable } from '@helpers/item/reforge';
import {
  equipmentReforge,
  reforgeMayDestroyGems,
} from '@helpers/item/reforge.ui';
import { worldNodeCanAffordCost } from '@helpers/world-node/world-node-cost';
import type {
  EquipmentArmoryEntry,
  EquipmentContent,
  EquipmentItem,
  EquipmentItemId,
  EquipmentPickerSource,
} from '@interfaces';
import { PluralizePipe } from '@pipes/pluralize.pipe';
import { AnimationService } from '@services/animation.service';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-play-kingdom-reforge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    ButtonKingdomBackComponent,
    CardPageComponent,
    DecimalPipe,
    PluralizePipe,
    DetailItemPreviewComponent,
    PanelEquipmentPickerComponent,
    RowAffixEffectsComponent,
    RowCurrencyCostComponent,
    RowInfusedMaterialsComponent,
    SFXDirective,
    SlotButtonContainerComponent,
    SweetAlert2Module,
    TutorialTargetDirective,
  ],
  templateUrl: './play-kingdom-reforge.component.html',
})
export class PlayKingdomReforgeComponent {
  private anim = inject(AnimationService);
  private reforgeSwal = viewChild<SwalComponent>('reforgeSwal');

  public selectedSource = signal<EquipmentPickerSource | undefined>(undefined);
  public selectedEquipmentItemId = signal<EquipmentItemId | undefined>(
    undefined,
  );
  public reforging = signal(false);

  public armoryFilter = (entry: EquipmentArmoryEntry) =>
    isReforgeable(entry.content);

  public itemReforgeable = (item: EquipmentItem) => {
    const content = getEntry<EquipmentContent>(item.equipmentId);
    return !!content && isReforgeable(content);
  };

  public selectedItem = computed(() =>
    ownedEquipmentItem(this.selectedEquipmentItemId()),
  );

  public selectedItemSlotCount = computed(() => {
    const item = this.selectedItem();
    return item ? equipmentItemSlotCount(item) : 0;
  });

  public selectedItemDisplay = computed(() => {
    const item = this.selectedItem();
    const display = item && equipmentItemPreviewDisplay(item);
    // The affix rows below already show these.
    return display
      ? { ...display, miscAffixDescriptions: undefined }
      : undefined;
  });

  public affixDisplays = computed(() => {
    const item = this.selectedItem();
    return item ? equipmentItemAffixDisplays(item) : [];
  });

  public cost = computed(() => {
    const item = this.selectedItem();
    return item ? equipmentItemReforgeCost(item) : [];
  });

  public canAfford = computed(() => worldNodeCanAffordCost(this.cost()));

  public mayDestroyGems = computed(() => {
    const item = this.selectedItem();
    return !!item && reforgeMayDestroyGems(item);
  });

  public modifiable = computed(
    () => this.selectedSource() === 'armory' || canModifyEquipment(),
  );

  public canReforge = computed(
    () =>
      this.cost().length > 0 &&
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
    const item = this.selectedItem();
    if (!item || !this.canReforge()) return;

    this.reforging.set(true);
    try {
      await equipmentReforge(item.id);
    } finally {
      this.reforging.set(false);
    }
  }
}
