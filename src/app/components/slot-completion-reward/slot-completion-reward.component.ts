import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { IconUnknownComponent } from '@components/icon-unknown/icon-unknown.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { getEntry } from '@helpers/content';
import {
  isRecipeDiscovered,
  recipeBackdropSprite,
  recipeResultContent,
  recipeResultSpritesheet,
} from '@helpers/crafting/recipes';
import { isCollectibleDiscovered } from '@helpers/item/collectibles';
import { assertNeverReward } from '@helpers/item/loot';
import { isMaterialDiscovered } from '@helpers/item/materials';
import { isEquipmentDiscovered } from '@helpers/kingdom/armory';
import { isWorkerRescued } from '@helpers/worker/worker-discovery';
import type {
  CollectibleContent,
  DropRarity,
  DroppedReward,
  EquipmentContent,
  ItemContent,
  RecipeContent,
  WorkerContent,
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

  public spritesheet = computed<'item' | 'equipment' | 'collectible' | 'worker'>(
    () => {
      const reward = this.reward();
      switch (reward.kind) {
        case 'Item':
          return 'item';
        case 'Equipment':
          return 'equipment';
        case 'Worker':
          return 'worker';
        case 'Recipe': {
          const recipe = this.recipeContent();
          return recipe ? recipeResultSpritesheet(recipe) : 'item';
        }
        case 'Collectible':
          return 'collectible';
        default:
          return assertNeverReward(reward);
      }
    },
  );

  // Composited behind the result sprite for recipe rewards only (see
  // `SlotMuseumRecipeComponent`, which uses the same backdrop) - the visual
  // cue that this slot grants a recipe, not the crafted item itself.
  public backdropSprite = computed<string | undefined>(() => {
    const reward = this.reward();
    return 'recipeId' in reward ? recipeBackdropSprite() : undefined;
  });

  public content = computed<RewardContent | undefined>(() => {
    const reward = this.reward();
    switch (reward.kind) {
      case 'Item':
        return getEntry<ItemContent>(reward.itemId);
      case 'Equipment':
        return getEntry<EquipmentContent>(reward.equipmentId);
      case 'Worker': {
        const worker = getEntry<WorkerContent>(reward.workerId);
        // Workers have no rarity of their own - displayed as Rare, matching
        // how rare a worker rescue actually is.
        return worker ? { ...worker, rarity: 'Rare' as DropRarity } : undefined;
      }
      case 'Recipe': {
        const recipe = this.recipeContent();
        const result = recipe ? recipeResultContent(recipe) : undefined;
        // The recipe's own name (not its crafted result's) - a recipe reward
        // grants the blueprint, not the item, and recipe names already carry
        // a "Category: Item" naming convention that calls this out.
        return recipe && result ? { ...result, name: recipe.name } : undefined;
      }
      case 'Collectible':
        return getEntry<CollectibleContent>(reward.collectibleId);
      default:
        return assertNeverReward(reward);
    }
  });

  public isDiscovered = computed(() => {
    const reward = this.reward();
    switch (reward.kind) {
      case 'Item':
        return isMaterialDiscovered(reward.itemId);
      case 'Equipment':
        return isEquipmentDiscovered(reward.equipmentId);
      case 'Recipe':
        return isRecipeDiscovered(reward.recipeId);
      case 'Worker':
        return isWorkerRescued(reward.workerId);
      case 'Collectible':
        return isCollectibleDiscovered(reward.collectibleId);
      default:
        return assertNeverReward(reward);
    }
  });
}
