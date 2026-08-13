import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import {
  recipeBackdropSprite,
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers';
import type {
  CollectibleContent,
  EquipmentContent,
  ItemContent,
  MuseumRecipeEntry,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-slot-museum-recipe',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    SlotIconBlankComponent,
    IconUnknownComponent,
    TippyDirective,
  ],
  templateUrl: './slot-museum-recipe.component.html',
  styleUrl: './slot-museum-recipe.component.scss',
})
export class SlotMuseumRecipeComponent {
  public entry = input.required<MuseumRecipeEntry>();

  public resultContent = computed<
    ItemContent | EquipmentContent | CollectibleContent | undefined
  >(() => recipeResultContent(this.entry().recipe));

  public resultSpritesheet = computed<'item' | 'equipment' | 'collectible'>(() =>
    recipeResultSpritesheet(this.entry().recipe),
  );

  public backdropSprite = computed(() => recipeBackdropSprite());
}
