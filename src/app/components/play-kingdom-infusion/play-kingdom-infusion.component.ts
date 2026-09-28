import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { RowGatherYieldBonusesComponent } from '@components/row-gather-yield-bonuses/row-gather-yield-bonuses.component';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { RowSkillStatBonusesComponent } from '@components/row-skill-stat-bonuses/row-skill-stat-bonuses.component';
import { RowStatSummaryComponent } from '@components/row-stat-summary/row-stat-summary.component';
import { SlotButtonContainerComponent } from '@components/slot-button-container/slot-button-container.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { DetailItemPreviewComponent } from '@components/detail-item-preview/detail-item-preview.component';
import { RowEquipmentItemSummaryComponent } from '@components/row-equipment-item-summary/row-equipment-item-summary.component';
import { RowHeroSummaryComponent } from '@components/row-hero-summary/row-hero-summary.component';
import { ListReflowDirective } from '@directives/list-reflow.directive';
import { ListRowDirective } from '@directives/list-row.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { TutorialTargetDirective } from '@directives/tutorial-target.directive';
import { getEntry } from '@helpers/content/content';
import { characterInfuseEquipment } from '@helpers/hero/character-equipment';
import {
  canModifyEquipment,
  equippedItemsByPrimarySlot,
} from '@helpers/item/equipment';
import {
  canInfuseEquipmentItem,
  equipmentItemSlotCount,
  infusionMaterialCost,
  isInfusionMaterial,
} from '@helpers/item/infusion';
import {
  resolveGatherYieldBonusDisplay,
  resolveSkillStatBonusDisplay,
} from '@helpers/item/item-preview';
import { equipmentItemPreviewDisplay } from '@helpers/item/item-preview.ui';
import { getGoldQuantity, goldCoinId } from '@helpers/item/materials';
import { getStorageMaterials } from '@helpers/kingdom/storage.ui';
import { worldPartyState } from '@helpers/state-game';
import {
  type CharacterId,
  type EquipmentContent,
  type EquipmentItem,
  type EquipmentItemId,
  type ItemContent,
  type ItemId,
  type StorageMaterialEntry,
} from '@interfaces';
import { AnimationService } from '@services/animation.service';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-play-kingdom-infusion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    ListReflowDirective,
    SlotButtonContainerComponent,
    CardPageComponent,
    CurrencyCostComponent,
    RowInfusedMaterialsComponent,
    DetailItemPreviewComponent,
    RowEquipmentItemSummaryComponent,
    RowHeroSummaryComponent,
    RowStatSummaryComponent,
    RowGatherYieldBonusesComponent,
    RowSkillStatBonusesComponent,
    ButtonKingdomBackComponent,
    SweetAlert2Module,
    SlotRarityOutlineComponent,
    ListRowDirective,
    SFXDirective,
    TutorialTargetDirective,
  ],
  templateUrl: './play-kingdom-infusion.component.html',
  styleUrl: './play-kingdom-infusion.component.scss',
})
export class PlayKingdomInfusionComponent {
  private anim = inject(AnimationService);
  private materialsRowEl = viewChild(RowInfusedMaterialsComponent, {
    read: ElementRef,
  });

  public party = computed(() => worldPartyState());
  public goldCoinItemId = goldCoinId();

  public selectedCharacterId = signal<CharacterId | undefined>(undefined);
  public selectedEquipmentItemId = signal<EquipmentItemId | undefined>(
    undefined,
  );
  public selectedSlotIndex = signal<number | undefined>(undefined);

  public selectedCharacter = computed(() =>
    this.party().find((c) => c.id === this.selectedCharacterId()),
  );

  // Keyed by primary slot, not instance id, so a two-handed item never shows up twice.
  public selectedCharacterEquippedItems = computed<EquipmentItem[]>(() => {
    const character = this.selectedCharacter();
    return character ? equippedItemsByPrimarySlot(character.equipment) : [];
  });

  public selectedItem = computed<EquipmentItem | undefined>(() =>
    this.selectedCharacterEquippedItems().find(
      (item) => item.id === this.selectedEquipmentItemId(),
    ),
  );

  public selectedItemDisplay = computed(() => {
    const item = this.selectedItem();
    return item ? equipmentItemPreviewDisplay(item) : undefined;
  });

  public selectedItemSlotCount = computed(() => {
    const item = this.selectedItem();
    return item ? equipmentItemSlotCount(item) : 0;
  });

  // Owned materials that can be infused - shown once a slot is picked.
  public infusionMaterials = computed<StorageMaterialEntry[]>(() =>
    getStorageMaterials().filter((entry) => isInfusionMaterial(entry.item)),
  );

  // Gear can't be infused mid-fight; drives disabling the material list and the header warning icon.
  public equipmentModifiable = computed(() => canModifyEquipment());

  public goldCoinQuantity = computed(() => getGoldQuantity());

  public equipmentContentFor(
    item: EquipmentItem,
  ): (EquipmentContent & { slotsTaken: number }) | undefined {
    const eq = getEntry<EquipmentContent>(item.equipmentId);
    if (!eq) return undefined;

    return {
      ...eq,
      slotsTaken: item.infusedItemIds.filter(Boolean).length,
    };
  }

  public materialCost(itemId: ItemId): number {
    return infusionMaterialCost(itemId);
  }

  public materialSkillStatBonuses(material: ItemContent) {
    return resolveSkillStatBonusDisplay(
      material.infusionSkillStatBonuses ?? [],
    );
  }

  // Raw, uncombined - just this one material's own infusion grant, same treatment as its infusionStats/infusionDebuffResistances/infusionCombatStats above.
  public materialGatherYieldBonuses(material: ItemContent) {
    return resolveGatherYieldBonusDisplay(
      material.infusionGatherYieldBonuses ?? [],
    );
  }

  // Never disabled for "slot already infused" - overwriting is allowed.
  // Only disabled when the player can't actually afford/supply it.
  public canAffordMaterial(itemId: ItemId): boolean {
    const item = this.selectedItem();
    const slotIndex = this.selectedSlotIndex();
    if (!item || slotIndex === undefined) return false;

    return canInfuseEquipmentItem(item, slotIndex, itemId);
  }

  public selectCharacter(characterId: CharacterId): void {
    this.selectedCharacterId.set(characterId);
    this.selectedEquipmentItemId.set(undefined);
    this.selectedSlotIndex.set(undefined);
  }

  public selectItem(itemId: EquipmentItemId): void {
    this.selectedEquipmentItemId.set(itemId);
    this.selectedSlotIndex.set(undefined);
  }

  public selectSlot(slotIndex: number): void {
    this.selectedSlotIndex.set(slotIndex);
  }

  private infuseSwal = viewChild<SwalComponent>('infuseSwal');
  private pendingMaterialId = signal<ItemId | undefined>(undefined);
  private pendingSourceEl?: HTMLElement;

  private isOverwritingSelectedSlot(): boolean {
    const item = this.selectedItem();
    const slotIndex = this.selectedSlotIndex();
    if (!item || slotIndex === undefined) return false;

    return !!item.infusedItemIds[slotIndex];
  }

  private buildInfuseConfirmText(materialItemId: ItemId): string {
    const material = getEntry<ItemContent>(materialItemId);
    const cost = this.materialCost(materialItemId);
    const base = `Infuse ${material?.name ?? 'this material'} for ${cost}g?`;

    return this.isOverwritingSelectedSlot()
      ? `${base} This slot is already infused - doing this will replace it, and the existing items will not be refunded.`
      : base;
  }

  public requestInfuse(
    materialItemId: ItemId,
    event: Event,
    skipConfirm = false,
  ): void {
    this.pendingMaterialId.set(materialItemId);
    this.pendingSourceEl =
      (event.currentTarget as HTMLElement).querySelector('img') ?? undefined;
    if (skipConfirm) {
      this.confirmInfuse();
      return;
    }

    const swal = this.infuseSwal();
    if (!swal) return;

    // `swalOptions` is a plain setter, unlike `[text]` which needs an Angular flush - too late for a synchronous `.fire()` right after.
    swal.swalOptions = { text: this.buildInfuseConfirmText(materialItemId) };
    swal.fire();
  }

  public confirmInfuse(): void {
    const character = this.selectedCharacter();
    const item = this.selectedItem();
    const slotIndex = this.selectedSlotIndex();
    const materialItemId = this.pendingMaterialId();
    if (!character || !item || slotIndex === undefined || !materialItemId) {
      return;
    }

    const sourceEl = this.pendingSourceEl;
    const targetEl = this.materialsRowEl()?.nativeElement.querySelector(
      `[data-slot-index="${slotIndex}"]`,
    );

    characterInfuseEquipment(character.id, item.id, slotIndex, materialItemId);
    this.pendingMaterialId.set(undefined);
    this.pendingSourceEl = undefined;

    if (sourceEl && targetEl) {
      this.anim.flyTo(sourceEl, targetEl);
    }
  }
}
