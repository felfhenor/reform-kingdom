import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import { IconJobComponent } from '@components/icon-job/icon-job.component';
import { InfusedMaterialsRowComponent } from '@components/infused-materials-row/infused-materials-row.component';
import { ItemStatRowsComponent } from '@components/item-stat-rows/item-stat-rows.component';
import { KingdomBackButtonComponent } from '@components/kingdom-back-button/kingdom-back-button.component';
import {
  canInfuseEquipmentItem,
  characterInfuseEquipment,
  equipmentItemInfusionBonus,
  equippedItemsByPrimarySlot,
  getEntry,
  getStorageMaterials,
  goldCoinId,
  infusionMaterialCost,
  isInfusionMaterial,
  partyGet,
} from '@helpers';
import type {
  Character,
  CharacterId,
  EquipmentContent,
  EquipmentItem,
  EquipmentItemId,
  ItemContent,
  ItemId,
  JobContent,
  StorageMaterialEntry,
} from '@interfaces';
import type { SwalComponent } from '@sweetalert2/ngx-sweetalert2';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';

@Component({
  selector: 'app-play-kingdom-infusion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    CardPageComponent,
    IconBlankSlotComponent,
    IconJobComponent,
    InfusedMaterialsRowComponent,
    ItemStatRowsComponent,
    KingdomBackButtonComponent,
    SweetAlert2Module,
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

  // Keyed by primary slot rather than instance id, so a two-handed item
  // never shows up twice - not even for a legacy save whose two-handed
  // item was backfilled with mismatched per-slot instance ids (see
  // `equippedItemsByPrimarySlot`).
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

  public selectedItemBonus = computed(() =>
    equipmentItemInfusionBonus(this.selectedItem()?.infusedItemIds ?? []),
  );

  // Owned materials that can be infused - shown once a slot is picked.
  public infusionMaterials = computed<StorageMaterialEntry[]>(() =>
    getStorageMaterials().filter((entry) => isInfusionMaterial(entry.item)),
  );

  public goldCoinQuantity = computed(() => {
    const goldEntry = getStorageMaterials().find(
      (entry) => entry.item.id === goldCoinId(),
    );
    return goldEntry?.quantity ?? 0;
  });

  public goldCoinSprite = computed(
    () => getEntry<ItemContent>(goldCoinId())?.sprite ?? '',
  );

  public equipmentContentFor(item: EquipmentItem): EquipmentContent | undefined {
    return getEntry<EquipmentContent>(item.equipmentId);
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
      ? `${base} This slot is already infused - doing this will replace it, with no refund for what's there now.`
      : base;
  }

  public requestInfuse(materialItemId: ItemId): void {
    const swal = this.infuseSwal();
    if (!swal) return;

    // `swalOptions` is a plain setter (unlike `[text]`, which only takes
    // effect once Angular flushes a bound input - too late for a `.fire()`
    // called synchronously right after), so this is the one that reliably
    // reaches `Swal.fire()` with fresh text every time.
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
