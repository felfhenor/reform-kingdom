import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import {
  getEntry,
  isCollectibleDiscovered,
  isEquipmentDiscovered,
  isMaterialDiscovered,
  isRecipeDiscovered,
  recipeBackdropSprite,
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers';
import type {
  CollectibleContent,
  DropRarity,
  DroppedReward,
  EquipmentContent,
  ItemContent,
  RecipeContent,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';

type RewardContent = {
  name: string;
  description: string;
  sprite: string;
  rarity: DropRarity;
};

@Component({
  selector: 'app-slot-completion-reward',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    SlotIconBlankComponent,
    IconUnknownComponent,
    TippyDirective,
  ],
  templateUrl: './slot-completion-reward.component.html',
  styleUrl: './slot-completion-reward.component.scss',
})
export class SlotCompletionRewardComponent {
  public reward = input.required<DroppedReward>();

  // A recipe has no sprite/rarity of its own - it borrows whatever it
  // crafts, so its spritesheet/content resolve through the recipe's result.
  private recipeContent = computed<RecipeContent | undefined>(() => {
    const reward = this.reward();
    if (!('recipeId' in reward)) return undefined;
    return getEntry<RecipeContent>(reward.recipeId);
  });

  public spritesheet = computed<'item' | 'equipment' | 'collectible'>(() => {
    const reward = this.reward();
    if ('itemId' in reward) return 'item';
    if ('equipmentId' in reward) return 'equipment';
    if ('recipeId' in reward) {
      const recipe = this.recipeContent();
      return recipe ? recipeResultSpritesheet(recipe) : 'item';
    }
    return 'collectible';
  });

  // Composited behind the result sprite for recipe rewards only (see
  // `SlotMuseumRecipeComponent`, which uses the same backdrop) - the visual
  // cue that this slot grants a recipe, not the crafted item itself.
  public backdropSprite = computed<string | undefined>(() => {
    const reward = this.reward();
    return 'recipeId' in reward ? recipeBackdropSprite() : undefined;
  });

  public content = computed<RewardContent | undefined>(() => {
    const reward = this.reward();
    if ('itemId' in reward) return getEntry<ItemContent>(reward.itemId);
    if ('equipmentId' in reward) {
      return getEntry<EquipmentContent>(reward.equipmentId);
    }
    if ('recipeId' in reward) {
      const recipe = this.recipeContent();
      const result = recipe ? recipeResultContent(recipe) : undefined;
      // The recipe's own name (not its crafted result's) - a recipe reward
      // grants the blueprint, not the item, and recipe names already carry
      // a "Category: Item" naming convention that calls this out.
      return recipe && result ? { ...result, name: recipe.name } : undefined;
    }
    return getEntry<CollectibleContent>(reward.collectibleId);
  });

  public isDiscovered = computed(() => {
    const reward = this.reward();
    if ('itemId' in reward) return isMaterialDiscovered(reward.itemId);
    if ('equipmentId' in reward) {
      return isEquipmentDiscovered(reward.equipmentId);
    }
    if ('recipeId' in reward) return isRecipeDiscovered(reward.recipeId);
    return isCollectibleDiscovered(reward.collectibleId);
  });
}
