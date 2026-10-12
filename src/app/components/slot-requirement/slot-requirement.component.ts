import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { DetailItemPreviewComponent } from '@components/detail-item-preview/detail-item-preview.component';
import { DetailMaterialSourcesComponent } from '@components/detail-material-sources/detail-material-sources.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import { itemPreviewDisplay } from '@helpers/item/item-preview';
import type {
  AtlasedImage,
  HasRarity,
  HasSprite,
  Identifiable,
  ItemId,
  ItemPreviewContent,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-requirement',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    SlotRarityOutlineComponent,
    IconUnknownComponent,
    DetailItemPreviewComponent,
    DetailMaterialSourcesComponent,
    TippyDirective,
  ],
  templateUrl: './slot-requirement.component.html',
  host: { class: 'block relative w-8 h-8 shrink-0' },
})
export class SlotRequirementComponent {
  public content = input<HasRarity & HasSprite & Identifiable>();
  public spritesheet = input.required<AtlasedImage>();
  public owned = input.required<number>();
  public quantity = input.required<number>();
  public tooltip = input.required<string>();
  public detailed = input(false);

  // Collectibles keep the plain tooltip, which carries their "(not consumed)" note.
  public hasDetail = computed(
    () =>
      this.detailed() &&
      !!this.content() &&
      ['item', 'equipment'].includes(this.spritesheet()),
  );

  public previewDisplay = computed(() =>
    itemPreviewDisplay(
      this.spritesheet() as 'item' | 'equipment',
      this.content() as ItemPreviewContent,
    ),
  );

  public materialId = computed(() =>
    this.spritesheet() === 'item'
      ? (this.content()?.id as ItemId | undefined)
      : undefined,
  );
}
