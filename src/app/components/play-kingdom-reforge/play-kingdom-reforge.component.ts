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
import { DetailItemPreviewComponent } from '@components/detail-item-preview/detail-item-preview.component';
import { IconComponent } from '@components/icon/icon.component';
import { RowAffixEffectsComponent } from '@components/row-affix-effects/row-affix-effects.component';
import { RowCurrencyCostComponent } from '@components/row-currency-cost/row-currency-cost.component';
import { RowEquipmentItemSummaryComponent } from '@components/row-equipment-item-summary/row-equipment-item-summary.component';
import { RowHeroSummaryComponent } from '@components/row-hero-summary/row-hero-summary.component';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { SlotButtonContainerComponent } from '@components/slot-button-container/slot-button-container.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { ListReflowDirective } from '@directives/list-reflow.directive';
import { ListRowDirective } from '@directives/list-row.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { TutorialTargetDirective } from '@directives/tutorial-target.directive';
import { getEntry } from '@helpers/content/content';
import { equipmentItemAffixDisplays } from '@helpers/item/affix-display.ui';
import {
  canModifyEquipment,
  equippedItemsByPrimarySlot,
} from '@helpers/item/equipment';
import { equipmentItemSlotCount } from '@helpers/item/infusion';
import { equipmentItemPreviewDisplay } from '@helpers/item/item-preview.ui';
import { equipmentItemReforgeCost, isReforgeable } from '@helpers/item/reforge';
import {
  equipmentReforge,
  reforgeMayDestroyGems,
} from '@helpers/item/reforge.ui';
import { getArmoryEntries } from '@helpers/kingdom/armory';
import { filterArmoryEntries } from '@helpers/kingdom/armory.ui';
import { worldPartyState } from '@helpers/state-game';
import { worldNodeCanAffordCost } from '@helpers/world-node/world-node-cost';
import type {
  CharacterId,
  EquipmentArmoryEntry,
  EquipmentContent,
  EquipmentItem,
  EquipmentItemId,
} from '@interfaces';
import { PluralizePipe } from '@pipes/pluralize.pipe';
import { AnimationService } from '@services/animation.service';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

const ARMORY_SOURCE = 'armory';

@Component({
  selector: 'app-play-kingdom-reforge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    ButtonKingdomBackComponent,
    CardPageComponent,
    DecimalPipe,
    PluralizePipe,
    IconComponent,
    ListReflowDirective,
    ListRowDirective,
    DetailItemPreviewComponent,
    RowAffixEffectsComponent,
    RowCurrencyCostComponent,
    RowEquipmentItemSummaryComponent,
    RowHeroSummaryComponent,
    RowInfusedMaterialsComponent,
    SFXDirective,
    SlotButtonContainerComponent,
    SlotIconBlankComponent,
    SweetAlert2Module,
    TutorialTargetDirective,
  ],
  templateUrl: './play-kingdom-reforge.component.html',
})
export class PlayKingdomReforgeComponent {
  private anim = inject(AnimationService);
  private reforgeSwal = viewChild<SwalComponent>('reforgeSwal');

  public readonly armorySource = ARMORY_SOURCE;

  public party = computed(() => worldPartyState());

  public selectedSource = signal<
    CharacterId | typeof ARMORY_SOURCE | undefined
  >(undefined);
  public selectedEquipmentItemId = signal<EquipmentItemId | undefined>(
    undefined,
  );
  public armorySearch = signal('');
  public reforging = signal(false);

  public isArmorySelected = computed(
    () => this.selectedSource() === ARMORY_SOURCE,
  );

  public selectedCharacter = computed(() =>
    this.party().find((c) => c.id === this.selectedSource()),
  );

  private reforgeableArmoryEntries = computed<EquipmentArmoryEntry[]>(() =>
    getArmoryEntries().filter((entry) => isReforgeable(entry.content)),
  );

  // Hero gear is keyed by primary slot, so a two-handed item never shows up twice.
  public sourceItems = computed<EquipmentItem[]>(() => {
    if (this.isArmorySelected()) {
      return filterArmoryEntries(
        this.reforgeableArmoryEntries(),
        this.armorySearch(),
      ).map((entry) => entry.item);
    }

    const character = this.selectedCharacter();
    return character ? equippedItemsByPrimarySlot(character.equipment) : [];
  });

  // Looked up outside the search filter so typing doesn't drop the selection.
  public selectedItem = computed<EquipmentItem | undefined>(() => {
    const id = this.selectedEquipmentItemId();
    const pool = this.isArmorySelected()
      ? this.reforgeableArmoryEntries().map((entry) => entry.item)
      : this.sourceItems();
    return pool.find((item) => item.id === id);
  });

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
    () => this.isArmorySelected() || canModifyEquipment(),
  );

  public canReforge = computed(
    () =>
      this.cost().length > 0 &&
      this.canAfford() &&
      this.modifiable() &&
      !this.reforging(),
  );

  public itemReforgeable(item: EquipmentItem): boolean {
    const content = getEntry<EquipmentContent>(item.equipmentId);
    return !!content && isReforgeable(content);
  }

  public selectSource(source: CharacterId | typeof ARMORY_SOURCE): void {
    this.selectedSource.set(source);
    this.selectedEquipmentItemId.set(undefined);
  }

  public selectItem(itemId: EquipmentItemId): void {
    this.selectedEquipmentItemId.set(itemId);
  }

  public onArmorySearch(event: Event): void {
    this.armorySearch.set((event.target as HTMLInputElement).value);
  }

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
