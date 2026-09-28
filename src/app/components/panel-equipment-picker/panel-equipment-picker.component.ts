import { NgTemplateOutlet } from '@angular/common';
import type { TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  signal,
} from '@angular/core';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { IconComponent } from '@components/icon/icon.component';
import { RowEquipmentItemSummaryComponent } from '@components/row-equipment-item-summary/row-equipment-item-summary.component';
import { RowHeroSummaryComponent } from '@components/row-hero-summary/row-hero-summary.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { ListReflowDirective } from '@directives/list-reflow.directive';
import { ListRowDirective } from '@directives/list-row.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { equippedItemsByPrimarySlot } from '@helpers/item/equipment';
import { getArmoryEntries } from '@helpers/kingdom/armory';
import { filterArmoryEntries } from '@helpers/kingdom/armory.ui';
import { worldPartyState } from '@helpers/state-game';
import type {
  EquipmentArmoryEntry,
  EquipmentItem,
  EquipmentItemId,
  EquipmentPickerMetaContext,
  EquipmentPickerSource,
} from '@interfaces';

// Renders two grid columns (sources, then items) - the host is display: contents so a parent grid lays them out.
@Component({
  selector: 'app-panel-equipment-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    IconComponent,
    ListReflowDirective,
    ListRowDirective,
    NgTemplateOutlet,
    RowEquipmentItemSummaryComponent,
    RowHeroSummaryComponent,
    SFXDirective,
    SlotIconBlankComponent,
  ],
  host: { class: 'contents' },
  templateUrl: './panel-equipment-picker.component.html',
})
export class PanelEquipmentPickerComponent {
  public armoryFilter = input<(entry: EquipmentArmoryEntry) => boolean>(
    () => true,
  );
  public itemEnabled = input<(item: EquipmentItem) => boolean>(() => true);
  public itemMeta = input.required<TemplateRef<EquipmentPickerMetaContext>>();
  public emptyArmoryText = input('No matching gear in the armory.');

  public source = model<EquipmentPickerSource | undefined>(undefined);
  public selectedItemId = model<EquipmentItemId | undefined>(undefined);

  public armorySearch = signal('');

  public party = computed(() => worldPartyState());

  public isArmorySelected = computed(() => this.source() === 'armory');

  // Hero gear is keyed by primary slot, so a two-handed item never shows up twice.
  public items = computed<EquipmentItem[]>(() => {
    if (this.isArmorySelected()) {
      return filterArmoryEntries(
        getArmoryEntries().filter(this.armoryFilter()),
        this.armorySearch(),
      ).map((entry) => entry.item);
    }

    const character = this.party().find((c) => c.id === this.source());
    return character ? equippedItemsByPrimarySlot(character.equipment) : [];
  });

  public selectSource(source: EquipmentPickerSource): void {
    this.source.set(source);
    this.selectedItemId.set(undefined);
  }

  public onArmorySearch(event: Event): void {
    this.armorySearch.set((event.target as HTMLInputElement).value);
  }
}
