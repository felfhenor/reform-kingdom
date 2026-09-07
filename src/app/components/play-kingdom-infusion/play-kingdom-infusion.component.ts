import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { IconComponent } from '@components/icon/icon.component';
import { RowInfusedMaterialsComponent } from '@components/row-infused-materials/row-infused-materials.component';
import { RowStatSummaryComponent } from '@components/row-stat-summary/row-stat-summary.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { getEntry } from '@helpers/content/content';
import {
  defaultCombatStats,
  defaultStats,
  defaultTagResistances,
} from '@helpers/defaults';
import { characterInfuseEquipment } from '@helpers/hero/character-equipment';
import { partyGet } from '@helpers/hero/party';
import { equipmentItemDisplayName } from '@helpers/item/affix';
import {
  canModifyEquipment,
  equippedItemsByPrimarySlot,
} from '@helpers/item/equipment';
import {
  equipmentItemBonusCombatStats,
  equipmentItemBonusResistances,
  equipmentItemBonusStats,
} from '@helpers/item/equipment-display';
import {
  canInfuseEquipmentItem,
  equipmentItemSlotCount,
  infusionMaterialCost,
  isInfusionMaterial,
} from '@helpers/item/infusion';
import { getGoldQuantity, goldCoinId } from '@helpers/item/materials';
import { getStorageMaterials } from '@helpers/kingdom/storage.ui';
import {
  type Character,
  type CharacterId,
  type EquipmentContent,
  type EquipmentItem,
  type EquipmentItemId,
  type ItemContent,
  type ItemId,
  type JobContent,
  type StorageMaterialEntry,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-play-kingdom-infusion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    CardPageComponent,
    IconComponent,
    SlotIconBlankComponent,
    IconJobComponent,
    RowInfusedMaterialsComponent,
    RowStatSummaryComponent,
    ButtonKingdomBackComponent,
    SweetAlert2Module,
    TippyDirective,
  ],
  templateUrl: './play-kingdom-infusion.component.html',
  styleUrl: './play-kingdom-infusion.component.scss',
})
export class PlayKingdomInfusionComponent {
  public party = computed(() => partyGet());
  public goldCoinId = goldCoinId;

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

  public selectedItemContent = computed<EquipmentContent | undefined>(() => {
    const item = this.selectedItem();
    return item ? getEntry<EquipmentContent>(item.equipmentId) : undefined;
  });

  public selectedItemDisplayName = computed(() => {
    const item = this.selectedItem();
    const content = this.selectedItemContent();
    return item && content ? equipmentItemDisplayName(item, content.name) : '';
  });

  public selectedItemBonus = computed(() => {
    const item = this.selectedItem();
    return item ? equipmentItemBonusStats(item) : defaultStats();
  });

  public selectedItemResistanceBonus = computed(() => {
    const item = this.selectedItem();
    return item ? equipmentItemBonusResistances(item) : defaultTagResistances();
  });

  public selectedItemCombatStatBonus = computed(() => {
    const item = this.selectedItem();
    return item ? equipmentItemBonusCombatStats(item) : defaultCombatStats();
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

  public goldCoinSprite = computed(
    () => getEntry<ItemContent>(goldCoinId())?.sprite ?? '',
  );

  public equipmentContentFor(
    item: EquipmentItem,
  ): EquipmentContent | undefined {
    return getEntry<EquipmentContent>(item.equipmentId);
  }

  public displayNameFor(
    item: EquipmentItem,
    content: EquipmentContent,
  ): string {
    return equipmentItemDisplayName(item, content.name);
  }

  public jobFor(character: Character): JobContent | undefined {
    return getEntry<JobContent>(character.jobId);
  }

  public materialCost(itemId: ItemId): number {
    return infusionMaterialCost(itemId);
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

  public requestInfuse(materialItemId: ItemId): void {
    const swal = this.infuseSwal();
    if (!swal) return;

    // `swalOptions` is a plain setter, unlike `[text]` which needs an Angular flush - too late for a synchronous `.fire()` right after.
    swal.swalOptions = { text: this.buildInfuseConfirmText(materialItemId) };
    this.pendingMaterialId.set(materialItemId);
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

    characterInfuseEquipment(character.id, item.id, slotIndex, materialItemId);
    this.pendingMaterialId.set(undefined);
  }
}
