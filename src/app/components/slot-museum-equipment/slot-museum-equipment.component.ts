import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { DetailItemPreviewComponent } from '@components/detail-item-preview/detail-item-preview.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import type { MuseumEquipmentEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-museum-equipment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DetailItemPreviewComponent,
    IconUnknownComponent,
    TippyDirective,
    SlotRarityOutlineComponent,
    NgTemplateOutlet,
  ],
  templateUrl: './slot-museum-equipment.component.html',
  styleUrl: './slot-museum-equipment.component.scss',
})
export class SlotMuseumEquipmentComponent {
  public entry = input.required<MuseumEquipmentEntry>();

  public display = computed(() =>
    itemPreviewDisplay('equipment', this.entry().equipment),
  );
}
