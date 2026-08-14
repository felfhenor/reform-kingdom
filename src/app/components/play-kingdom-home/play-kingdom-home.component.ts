import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { armoryGet } from '@helpers/armory';
import { getBestiaryEntries } from '@helpers/bestiary';
import { getEntry } from '@helpers/content';
import {
  craftQueueTicksRemaining,
  craftQueueTotalTicks,
  craftQueueUnitsRemaining,
} from '@helpers/crafting';
import { modalOpen } from '@helpers/modal-stack';
import {
  getMuseumCollectibleEntries,
  getMuseumRecipeEntries,
} from '@helpers/museum';
import { gamestate } from '@helpers/state-game';
import { formatDuration } from '@helpers/timer';
import { tradeskillBuilding } from '@helpers/tradeskill';
import { kingdomSubviewShow, uiClockTick } from '@helpers/ui';
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
  selector: 'app-play-kingdom-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPageComponent, TippyDirective, PluralizePipe],
  templateUrl: './play-kingdom-home.component.html',
})
export class PlayKingdomHomeComponent {
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
    modalOpen('reclass-heroes');
  }
}
