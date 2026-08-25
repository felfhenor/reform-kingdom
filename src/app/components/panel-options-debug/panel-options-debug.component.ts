import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OptionsBaseComponent } from '@components/panel-options/option-base-page.component';
import { AnalyticsClickDirective } from '@directives/analytics-click.directive';
import { getEntriesByType } from '@helpers/content';
import { isRecipeDropGated } from '@helpers/crafting/recipes';
import { TRADESKILL_MAX_LEVEL } from '@helpers/crafting/tradeskill';
import {
  debugDiscoverAllRecipes,
  debugFillBestiary,
  debugGiveCollectible,
  debugGiveEquipment,
  debugGiveItem,
  debugResetBestiary,
  debugResetCommissions,
  debugSetCharacterLevel,
  debugSetTradeskillLevel,
  debugUndiscoverRecipe,
} from '@helpers/debug/debug';
import { CHARACTER_MAX_LEVEL, partyGet } from '@helpers/hero/party';
import type {
  CharacterId,
  CollectibleContent,
  CollectibleId,
  EquipmentContent,
  EquipmentId,
  ItemContent,
  ItemId,
  RecipeContent,
  RecipeId,
  Tradeskill,
} from '@interfaces';
import { ALL_TRADESKILLS } from '@interfaces';
import { NgSelectComponent } from '@ng-select/ng-select';
import { sortBy } from 'es-toolkit/compat';

@Component({
  selector: 'app-panel-options-debug',
  imports: [AnalyticsClickDirective, FormsModule, NgSelectComponent],
  templateUrl: './panel-options-debug.component.html',
  styleUrl: './panel-options-debug.component.scss',
})
export class PanelOptionsDebugComponent extends OptionsBaseComponent {
  public debugItems = computed(() =>
    sortBy(getEntriesByType<ItemContent>('item'), (item) => item.name).filter(
      (item) => !item.unobtainable,
    ),
  );

  public debugEquipment = computed(() =>
    sortBy(
      getEntriesByType<EquipmentContent>('equipment'),
      (item) => item.name,
    ),
  );

  public debugCollectibles = computed(() =>
    sortBy(
      getEntriesByType<CollectibleContent>('collectible'),
      (item) => item.name,
    ),
  );

  public selectedItemId = signal<ItemId | undefined>(undefined);
  public itemQuantity = signal<number>(1);

  public selectedEquipmentId = signal<EquipmentId | undefined>(undefined);
  public equipmentQuantity = signal<number>(1);

  public selectedCollectibleId = signal<CollectibleId | undefined>(undefined);
  public collectibleQuantity = signal<number>(1);

  // Only drop-gated recipes have a discovery record to undo - see
  // `debugDiscoverAllRecipes`'s identical filter.
  public debugDropGatedRecipes = computed(() =>
    sortBy(
      getEntriesByType<RecipeContent>('recipe').filter((recipe) =>
        isRecipeDropGated(recipe.id),
      ),
      (recipe) => recipe.name,
    ),
  );

  public selectedRecipeId = signal<RecipeId | undefined>(undefined);

  public party = computed(() =>
    sortBy(partyGet(), (character) => character.name),
  );

  public characterMaxLevel = CHARACTER_MAX_LEVEL;
  public selectedCharacterId = signal<CharacterId | undefined>(undefined);
  public characterLevel = signal<number>(1);

  public tradeskills = ALL_TRADESKILLS;
  public tradeskillMaxLevel = TRADESKILL_MAX_LEVEL;
  public selectedTradeskill = signal<Tradeskill | undefined>(undefined);
  public tradeskillLevel = signal<number>(1);

  public giveItem(): void {
    const itemId = this.selectedItemId();
    if (!itemId) return;

    debugGiveItem(itemId, this.itemQuantity());
  }

  public giveEquipment(): void {
    const equipmentId = this.selectedEquipmentId();
    if (!equipmentId) return;

    debugGiveEquipment(equipmentId, this.equipmentQuantity());
  }

  public giveCollectible(): void {
    const collectibleId = this.selectedCollectibleId();
    if (!collectibleId) return;

    debugGiveCollectible(collectibleId, this.collectibleQuantity());
  }

  public setCharacterLevel(): void {
    const characterId = this.selectedCharacterId();
    if (!characterId) return;

    debugSetCharacterLevel(characterId, this.characterLevel());
  }

  public setTradeskillLevel(): void {
    const tradeskill = this.selectedTradeskill();
    if (!tradeskill) return;

    debugSetTradeskillLevel(tradeskill, this.tradeskillLevel());
  }

  public resetBestiary(): void {
    debugResetBestiary();
  }

  public resetCommissions(): void {
    debugResetCommissions();
  }

  public fillBestiary(): void {
    debugFillBestiary();
  }

  public discoverAllRecipes(): void {
    debugDiscoverAllRecipes();
  }

  public undiscoverRecipe(): void {
    const recipeId = this.selectedRecipeId();
    if (!recipeId) return;

    debugUndiscoverRecipe(recipeId);
  }
}
