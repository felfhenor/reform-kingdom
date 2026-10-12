import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { DetailItemPreviewComponent } from '@components/detail-item-preview/detail-item-preview.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { getEntry } from '@helpers/content/content';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import { isMaterialDiscovered } from '@helpers/item/materials';
import { worldNodeGatherMaterialTradeskillIds } from '@helpers/world-node/world-node-gathering-discovery';
import type {
  ItemContent,
  ItemId,
  TradeskillContent,
  WorldNodeEntry,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-gather-material',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    DetailItemPreviewComponent,
    IconUnknownComponent,
    TippyDirective,
    SlotRarityOutlineComponent,
  ],
  templateUrl: './slot-gather-material.component.html',
  styleUrl: './slot-gather-material.component.scss',
})
export class SlotGatherMaterialComponent {
  public node = input.required<WorldNodeEntry>();
  public itemId = input.required<ItemId>();

  public item = computed(() => getEntry<ItemContent>(this.itemId()));
  public isDiscovered = computed(() => isMaterialDiscovered(this.itemId()));

  public display = computed(() => {
    const item = this.item();
    return item ? itemPreviewDisplay('item', item) : undefined;
  });

  public tradeskills = computed(() =>
    worldNodeGatherMaterialTradeskillIds(this.node(), this.itemId())
      .map((id) => getEntry<TradeskillContent>(id))
      .filter((tradeskill) => !!tradeskill),
  );
}
