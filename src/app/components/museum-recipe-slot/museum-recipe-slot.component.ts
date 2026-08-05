import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import {
  recipeBackdropSprite,
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers';
import type { EquipmentContent, ItemContent, MuseumRecipeEntry } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-museum-recipe-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    IconBlankSlotComponent,
    IconUnknownComponent,
    TippyDirective,
  ],
  templateUrl: './museum-recipe-slot.component.html',
  styleUrl: './museum-recipe-slot.component.scss',
})
export class MuseumRecipeSlotComponent {
  public entry = input.required<MuseumRecipeEntry>();

  public resultContent = computed<ItemContent | EquipmentContent | undefined>(
    () => recipeResultContent(this.entry().recipe),
  );

  public resultSpritesheet = computed<'item' | 'equipment'>(() =>
    recipeResultSpritesheet(this.entry().recipe),
  );

  public backdropSprite = computed(() => recipeBackdropSprite());
}
