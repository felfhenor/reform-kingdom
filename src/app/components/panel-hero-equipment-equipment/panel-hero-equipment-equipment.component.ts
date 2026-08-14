import { ScrollingModule } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { CardEquipmentItemComponent } from '@components/card-equipment-item/card-equipment-item.component';
import { SlotEquipmentComponent } from '@components/slot-equipment/slot-equipment.component';
import {
  characterEquipFromArmory,
  characterUnequipToArmory,
  optimizeCharacterEquipment,
} from '@helpers/character-equipment';
import { getEntry } from '@helpers/content';
import {
  canEquipItem,
  equipmentAvailableForSlot,
  isSlotAvailableForJob,
} from '@helpers/equipment';
import type {
  Character,
  EquipmentArmoryEntry,
  EquipmentContent,
  EquipmentItem,
  EquipmentItemId,
  EquipmentSlot,
} from '@interfaces';

const PAPERDOLL_ROWS: EquipmentSlot[][] = [
  ['Helmet', 'Accessory'],
  ['Armor', 'Ring'],
  ['Weapon', 'Offhand'],
  ['Ammo', 'Artifact'],
];

@Component({
  selector: 'app-panel-hero-equipment-equipment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SlotEquipmentComponent,
    CardEquipmentItemComponent,
    ScrollingModule,
  ],
  host: {
    class: 'contents',
  },
  templateUrl: './panel-hero-equipment-equipment.component.html',
  styleUrl: './panel-hero-equipment-equipment.component.scss',
})
export class PanelHeroEquipmentEquipmentComponent {
  public character = input.required<Character>();

  public paperdollRows = PAPERDOLL_ROWS;

  public selectedSlot = signal<EquipmentSlot | undefined>(undefined);

  // Only equippable-right-now gear shows up in the picker - ineligible items
  // are filtered out entirely rather than shown disabled. Returns one entry
  // per owned instance, not deduped by content id, so distinct physical
  // copies (e.g. differently-infused swords) stay individually pickable.
  public pickerItems = computed<EquipmentArmoryEntry[]>(() => {
    const slot = this.selectedSlot();
    if (!slot) return [];

    const character = this.character();
    return equipmentAvailableForSlot(slot).filter((entry) =>
      canEquipItem(character, entry.content),
    );
  });

  public selectedSlotContent = computed<EquipmentContent | undefined>(() => {
    const slot = this.selectedSlot();
    return slot ? this.equippedContentFor(slot) : undefined;
  });

  public isSlotVisible(slot: EquipmentSlot): boolean {
    return isSlotAvailableForJob(slot, this.character().jobId);
  }

  // Skips rendering a paperdoll row entirely (rather than an empty gap) when
  // none of its slots apply to this hero's class - e.g. the Ammo/Artifact
  // row for anyone who isn't a Ranger or Magician.
  public rowHasVisibleSlot(row: EquipmentSlot[]): boolean {
    return row.some((slot) => this.isSlotVisible(slot));
  }

  public equippedItemFor(slot: EquipmentSlot): EquipmentItem | undefined {
    return this.character().equipment[slot];
  }

  public equippedContentFor(slot: EquipmentSlot): EquipmentContent | undefined {
    const equipmentId = this.equippedItemFor(slot)?.equipmentId;
    return equipmentId ? getEntry<EquipmentContent>(equipmentId) : undefined;
  }

  public trackByItemId(
    _index: number,
    entry: EquipmentArmoryEntry,
  ): EquipmentItemId {
    return entry.item.id;
  }

  public selectSlot(slot: EquipmentSlot): void {
    this.selectedSlot.set(this.selectedSlot() === slot ? undefined : slot);
  }

  public equip(equipmentItemId: EquipmentItemId): void {
    if (characterEquipFromArmory(this.character().id, equipmentItemId)) {
      this.selectedSlot.set(undefined);
    }
  }

  public unequip(slot = this.selectedSlot()): void {
    if (!slot) return;

    if (characterUnequipToArmory(this.character().id, slot)) {
      this.selectedSlot.set(undefined);
    }
  }

  public optimizeEquipment(): void {
    optimizeCharacterEquipment(this.character().id);
    this.selectedSlot.set(undefined);
  }
}
