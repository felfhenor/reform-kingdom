import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CurrencyCostComponent } from '@components/currency-cost/currency-cost';
import { IconItemPreviewComponent } from '@components/icon-item-preview/icon-item-preview.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { SlotRarityOutlineComponent } from '@components/slot-rarity-outline/slot-rarity-outline.component';
import {
  recipeBackdropSprite,
  recipeCanUnlockWithTokens,
  recipeResultContent,
  recipeResultSpritesheet,
  recipeStylizedName,
} from '@helpers/crafting/recipes';
import { traderTokenId } from '@helpers/item/materials';
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
    IconItemPreviewComponent,
    CurrencyCostComponent,
    IconUnknownComponent,
    TippyDirective,
    SlotRarityOutlineComponent,
  ],
  templateUrl: './slot-museum-recipe.component.html',
  styleUrl: './slot-museum-recipe.component.scss',
})
export class SlotMuseumRecipeComponent {
  public entry = input.required<MuseumRecipeEntry>();

  public unlock = output<void>();

  public traderTokenItemId = traderTokenId();

  public resultContent = computed<
    ItemContent | EquipmentContent | CollectibleContent | undefined
  >(() => recipeResultContent(this.entry().recipe));

  public resultSpritesheet = computed<'item' | 'equipment' | 'collectible'>(
    () => recipeResultSpritesheet(this.entry().recipe),
  );

  public backdropSprite = computed(() => recipeBackdropSprite());

  public canUnlock = computed(() =>
    recipeCanUnlockWithTokens(this.entry().recipe.id),
  );

  public recipeName = computed(() => recipeStylizedName(this.entry().recipe));
}
