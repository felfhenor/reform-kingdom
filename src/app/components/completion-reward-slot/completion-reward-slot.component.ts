import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconBlankSlotComponent } from '@components/icon-blank-slot/icon-blank-slot.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import {
  getEntry,
  isCollectibleDiscovered,
  isEquipmentDiscovered,
  isMaterialDiscovered,
  isRecipeDiscovered,
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
  selector: 'app-completion-reward-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    IconBlankSlotComponent,
    IconUnknownComponent,
    TippyDirective,
  ],
  templateUrl: './completion-reward-slot.component.html',
  styleUrl: './completion-reward-slot.component.scss',
})
export class CompletionRewardSlotComponent {
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

  public content = computed<RewardContent | undefined>(() => {
    const reward = this.reward();
    if ('itemId' in reward) return getEntry<ItemContent>(reward.itemId);
    if ('equipmentId' in reward) {
      return getEntry<EquipmentContent>(reward.equipmentId);
    }
    if ('recipeId' in reward) {
      const recipe = this.recipeContent();
      return recipe ? recipeResultContent(recipe) : undefined;
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
