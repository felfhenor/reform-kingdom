import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { getEntriesByType, getEntry } from '@helpers/content';
import {
  craftQueueTicksRemaining,
  craftQueueTotalTicks,
  craftQueueUnitsRemaining,
} from '@helpers/crafting/crafting';
import { tradeskillBuilding } from '@helpers/crafting/tradeskill';
import { modalOpen } from '@helpers/engine/modal-stack';
import { formatDuration } from '@helpers/engine/timer';
import {
  kingdomSubviewForTradeskill,
  kingdomSubviewShow,
  uiClockTick,
} from '@helpers/engine/ui';
import { armoryGet } from '@helpers/kingdom/armory';
import { unlockedAstralProjectorEntries } from '@helpers/kingdom/astral-projector';
import { getBestiaryEntries } from '@helpers/kingdom/bestiary';
import {
  getMuseumCollectibleEntries,
  getMuseumRecipeEntries,
} from '@helpers/kingdom/museum';
import { gamestate } from '@helpers/state-game';
import { isPlayerAtKingdom } from '@helpers/world';
import type {
  KingdomSubview,
  RecipeContent,
  Tradeskill,
  TradeskillContent,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { clamp, sortBy } from 'es-toolkit/compat';
import { PluralizePipe } from '../../pipes/pluralize.pipe';

@Component({
  selector: 'app-play-kingdom-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    CardPageComponent,
    DecimalPipe,
    TippyDirective,
    PluralizePipe,
  ],
  templateUrl: './play-kingdom-home.component.html',
})
export class PlayKingdomHomeComponent {
  public canReclass = computed(() => isPlayerAtKingdom());

  public materialCount = computed(
    () => Object.keys(gamestate().materials).length,
  );

  public armoryCount = computed(() => armoryGet().length);

  public unlockedAstralSpellCount = computed(
    () => unlockedAstralProjectorEntries().length,
  );

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

  public readonly tradeskillContent = computed(() =>
    sortBy(getEntriesByType<TradeskillContent>('tradeskill'), (t) => t.name),
  );

  // Recomputes whenever `gamestate()` changes AND once a second regardless
  // (via `uiClockTick`), so the progress bars never look frozen even if the
  // gameloop itself is skipping ticks (e.g. tab backgrounded).
  public tradeskillButtonViewModels = computed(() => {
    uiClockTick();

    return this.tradeskillContent().map((content) => {
      const tradeskill = content.name as Tradeskill;
      const building = tradeskillBuilding(tradeskill);
      const activeEntry = building.queue[0];
      const activeRecipe = activeEntry
        ? getEntry<RecipeContent>(activeEntry.recipeId)
        : undefined;

      const totalTicks = craftQueueTotalTicks(tradeskill);
      const remainingTicks = craftQueueTicksRemaining(tradeskill);
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
        subview: kingdomSubviewForTradeskill(tradeskill),
        label: content.name,
        sprite: content.sprite,
        tradeskill,
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
        queueUnitsRemaining: craftQueueUnitsRemaining(tradeskill),
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
    modalOpen('reclass-heroes');
  }
}
