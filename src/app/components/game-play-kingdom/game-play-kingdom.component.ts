import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { PlayKingdomAchievementsComponent } from '@components/play-kingdom-achievements/play-kingdom-achievements.component';
import { PlayKingdomArmoryComponent } from '@components/play-kingdom-armory/play-kingdom-armory.component';
import { PlayKingdomAstralProjectorComponent } from '@components/play-kingdom-astralprojector/play-kingdom-astralprojector.component';
import { PlayKingdomBestiaryComponent } from '@components/play-kingdom-bestiary/play-kingdom-bestiary.component';
import { PlayKingdomInfusionComponent } from '@components/play-kingdom-infusion/play-kingdom-infusion.component';
import { PlayKingdomMuseumComponent } from '@components/play-kingdom-museum/play-kingdom-museum.component';
import { PlayKingdomPrestigeComponent } from '@components/play-kingdom-prestige/play-kingdom-prestige.component';
import { ModalPlayKingdomReclassComponent } from '@components/modal-play-kingdom-reclass/modal-play-kingdom-reclass.component';
import { PlayKingdomStorageComponent } from '@components/play-kingdom-storage/play-kingdom-storage.component';
import { PlayKingdomTradeskillArtificingComponent } from '@components/play-kingdom-tradeskill-artificing/play-kingdom-tradeskill-artificing.component';
import { PlayKingdomTradeskillBlacksmithingComponent } from '@components/play-kingdom-tradeskill-blacksmithing/play-kingdom-tradeskill-blacksmithing.component';
import { PlayKingdomTradeskillJewelcraftingComponent } from '@components/play-kingdom-tradeskill-jewelcrafting/play-kingdom-tradeskill-jewelcrafting.component';
import { PlayKingdomTradeskillTailoringComponent } from '@components/play-kingdom-tradeskill-tailoring/play-kingdom-tradeskill-tailoring.component';
import { PlayKingdomTradeskillWoodworkingComponent } from '@components/play-kingdom-tradeskill-woodworking/play-kingdom-tradeskill-woodworking.component';
import { armoryGet } from '@helpers/armory';
import { getBestiaryEntries } from '@helpers/bestiary';
import { getEntry } from '@helpers/content';
import {
  craftQueueTicksRemaining,
  craftQueueTotalTicks,
  craftQueueUnitsRemaining,
  tradeskillBuilding,
} from '@helpers/crafting';
import {
  getMuseumCollectibleEntries,
  getMuseumRecipeEntries,
} from '@helpers/museum';
import { gamestate } from '@helpers/state-game';
import { formatDuration } from '@helpers/timer';
import {
  kingdomSubview,
  kingdomSubviewShow,
  showReclassHeroesModal,
  uiClockTick,
} from '@helpers/ui';
import { isPlayerAtKingdom } from '@helpers/world';
import type { KingdomSubview, RecipeContent, Tradeskill } from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { clamp } from 'es-toolkit/compat';
import { PluralizePipe } from '../../pipes/pluralize.pipe';

interface TradeskillButton {
  subview: KingdomSubview;
  label: string;
  tradeskill: Tradeskill;
}

@Component({
  selector: 'app-game-play-kingdom',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardPageComponent,
    TippyDirective,
    PluralizePipe,
    PlayKingdomStorageComponent,
    PlayKingdomMuseumComponent,
    PlayKingdomArmoryComponent,
    PlayKingdomAstralProjectorComponent,
    PlayKingdomBestiaryComponent,
    PlayKingdomInfusionComponent,
    PlayKingdomTradeskillArtificingComponent,
    PlayKingdomTradeskillBlacksmithingComponent,
    PlayKingdomTradeskillJewelcraftingComponent,
    PlayKingdomTradeskillTailoringComponent,
    PlayKingdomTradeskillWoodworkingComponent,
    PlayKingdomAchievementsComponent,
    PlayKingdomPrestigeComponent,
    ModalPlayKingdomReclassComponent,
  ],
  templateUrl: './game-play-kingdom.component.html',
})
export class GamePlayKingdomComponent {
  public activeSubview = computed(() => kingdomSubview());
  public canReclass = computed(() => isPlayerAtKingdom());

  public materialCount = computed(
    () => Object.keys(gamestate().materials).length,
  );

  public armoryCount = computed(() => armoryGet().length);

  public museumCollectibleEntries = computed(() =>
    getMuseumCollectibleEntries(),
  );
  public museumCollectiblesFound = computed(
    () =>
      this.museumCollectibleEntries().filter((entry) => entry.discovered)
        .length,
  );

  public museumRecipeEntries = computed(() => getMuseumRecipeEntries());
  public museumRecipesFound = computed(
    () => this.museumRecipeEntries().filter((entry) => entry.discovered).length,
  );

  public bestiaryEntries = computed(() => getBestiaryEntries());
  public bestiaryDiscoveredCount = computed(
    () => this.bestiaryEntries().filter((entry) => entry.discovered).length,
  );

  public readonly tradeskillButtons: TradeskillButton[] = [
    {
      subview: 'tradeskill-artificing',
      label: 'Artificing',
      tradeskill: 'Artificing',
    },
    {
      subview: 'tradeskill-blacksmithing',
      label: 'Blacksmithing',
      tradeskill: 'Blacksmithing',
    },
    {
      subview: 'tradeskill-jewelcrafting',
      label: 'Jewelcrafting',
      tradeskill: 'Jewelcrafting',
    },
    {
      subview: 'tradeskill-tailoring',
      label: 'Tailoring',
      tradeskill: 'Tailoring',
    },
    {
      subview: 'tradeskill-woodworking',
      label: 'Woodworking',
      tradeskill: 'Woodworking',
    },
  ];

  // Recomputes whenever `gamestate()` changes AND once a second regardless
  // (via `uiClockTick`), so the progress bars never look frozen even if the
  // gameloop itself is skipping ticks (e.g. tab backgrounded).
  public tradeskillButtonViewModels = computed(() => {
    uiClockTick();

    return this.tradeskillButtons.map((button) => {
      const building = tradeskillBuilding(button.tradeskill);
      const activeEntry = building.queue[0];
      const activeRecipe = activeEntry
        ? getEntry<RecipeContent>(activeEntry.recipeId)
        : undefined;

      const totalTicks = craftQueueTotalTicks(button.tradeskill);
      const remainingTicks = craftQueueTicksRemaining(button.tradeskill);
      const overallPercent =
        totalTicks > 0
          ? clamp(
              Math.round(((totalTicks - remainingTicks) / totalTicks) * 100),
              0,
              100,
            )
          : 0;
      const activePercent =
        activeEntry && activeRecipe && activeRecipe.craftTime > 0
          ? clamp(
              Math.round(
                (activeEntry.ticksIntoCraft / activeRecipe.craftTime) * 100,
              ),
              0,
              100,
            )
          : 0;

      return {
        ...button,
        level: building.level,
        xpCurrent: building.xp.current,
        xpMaximum: building.xp.maximum,
        xpPercent:
          building.xp.maximum > 0
            ? clamp(
                Math.round((building.xp.current / building.xp.maximum) * 100),
                0,
                100,
              )
            : 0,
        hasQueue: building.queue.length > 0,
        queueUnitsRemaining: craftQueueUnitsRemaining(button.tradeskill),
        overallPercent,
        activePercent,
        totalRemainingLabel:
          building.queue.length > 0
            ? formatDuration(remainingTicks)
            : undefined,
      };
    });
  });

  public openSubview(subview: KingdomSubview): void {
    kingdomSubviewShow(subview);
  }

  public openReclassModal(): void {
    if (!this.canReclass()) return;
    showReclassHeroesModal.set(true);
  }
}
