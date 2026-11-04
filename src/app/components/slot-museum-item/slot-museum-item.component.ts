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
import type { MuseumItemEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-museum-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DetailItemPreviewComponent,
    IconUnknownComponent,
    TippyDirective,
    SlotRarityOutlineComponent,
    NgTemplateOutlet,
  ],
  templateUrl: './slot-museum-item.component.html',
  styleUrl: './slot-museum-item.component.scss',
})
export class SlotMuseumItemComponent {
  public entry = input.required<MuseumItemEntry>();

  public display = computed(() =>
    itemPreviewDisplay('item', this.entry().item),
  );
}
