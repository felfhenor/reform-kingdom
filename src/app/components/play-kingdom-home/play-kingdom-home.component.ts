import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { AtlasImageComponent } from '@components/atlas-image/atlas-image.component';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { ButtonGlowComponent } from '@components/button-glow/button-glow.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconComponent } from '@components/icon/icon.component';
import { SFXDirective } from '@directives/sfx.directive';
import { commissionCanFulfill } from '@helpers/commission/commission-fulfill';
import { hasAnyCommission } from '@helpers/commission/commission-tick.ui';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import { craftQueueTicksRemaining } from '@helpers/crafting/crafting';
import {
  craftQueueTotalTicks,
  craftQueueUnitsRemaining,
} from '@helpers/crafting/crafting.ui';
import { tradeskillBuilding } from '@helpers/crafting/tradeskill';
import { modalOpen } from '@helpers/engine/modal-stack';
import { notifySuccess } from '@helpers/engine/notify';
import { formatDuration } from '@helpers/engine/timer';
import {
  kingdomSubviewForTradeskill,
  kingdomSubviewShow,
  uiClockTick,
} from '@helpers/engine/ui';
import { armoryCap, armoryGet } from '@helpers/kingdom/armory';
import { armoryFillColor } from '@helpers/kingdom/armory.ui';
import { unlockedAstralProjectorEntries } from '@helpers/kingdom/astral-projector.ui';
import { getBestiaryEntries } from '@helpers/kingdom/bestiary.ui';
import {
  getMuseumCollectibleEntries,
  getMuseumRecipeEntries,
} from '@helpers/kingdom/museum.ui';
import {
  discoveredWorkersState,
  materialsState,
  workersState,
  worldHomeNodeNameState,
} from '@helpers/state-game';
import { raidDefenseRowViewModels } from '@helpers/town/raid/town-raid-defense.ui';
import { homeNodeResetToDuchy } from '@helpers/town/town-spawn.ui';
import { workersReadyToLevelUpEntries } from '@helpers/worker/worker-progression.ui';
import { isPlayerAtKingdom } from '@helpers/world';
import {
  worldNodeCaravan,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  KingdomSubview,
  RecipeContent,
  Tradeskill,
  TradeskillContent,
} from '@interfaces';
import { PluralizePipe } from '@pipes/pluralize.pipe';
import { clamp, sortBy } from 'es-toolkit/compat';

@Component({
  selector: 'app-play-kingdom-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AtlasImageComponent,
    ButtonGlowComponent,
    CardPageComponent,
    DecimalPipe,
    IconComponent,
    PluralizePipe,
    SFXDirective,
    BarProgressComponent,
  ],
  templateUrl: './play-kingdom-home.component.html',
})
export class PlayKingdomHomeComponent {
  public canReclass = computed(() => isPlayerAtKingdom());

  public materialCount = computed(() => Object.keys(materialsState()).length);

  public armoryCount = computed(() => armoryGet().length);
  public armoryCapValue = computed(() => armoryCap());
  public armoryColor = computed(() =>
    armoryFillColor(this.armoryCount(), this.armoryCapValue()),
  );

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

  // Hidden until the player has rescued at least one worker.
  public workersUnlocked = computed(
    () => Object.keys(discoveredWorkersState()).length > 0,
  );
  public workerTotalCount = computed(() => Object.keys(workersState()).length);
  public workerBusyCount = computed(
    () =>
      Object.values(workersState()).filter(
        (worker) => worker.status.kind !== 'AtDuchy',
      ).length,
  );
  public workerLevelUpReadyCount = computed(
    () => workersReadyToLevelUpEntries().length,
  );

  // Hidden until any caravan has actually generated a commission.
  public commissionsUnlocked = computed(() => hasAnyCommission());

  public raidDefenseCount = computed(() => raidDefenseRowViewModels().length);

  // Commissions ready to turn in right now - shown as a nudge on the tile.
  public fulfillableCommissionCount = computed(
    () =>
      worldNodesOfType('CaravanNode').filter((entry) => {
        const caravan = worldNodeCaravan(entry);
        return !!caravan && commissionCanFulfill(caravan.id);
      }).length,
  );

  public readonly tradeskillContent = computed(() =>
    sortBy(getEntriesByType<TradeskillContent>('tradeskill'), (t) => t.name),
  );

  // Also recomputes once a second so the progress bars never look frozen while the gameloop skips ticks (e.g. tab backgrounded).
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

  public isKingdomHome = computed(() => !worldHomeNodeNameState());

  public openSubview(subview: KingdomSubview): void {
    kingdomSubviewShow(subview);
  }

  public openReclassModal(): void {
    if (!this.canReclass()) return;
    modalOpen('reclass-heroes');
  }

  public openRaidDefenseModal(): void {
    modalOpen('raid-defense');
  }

  public resetHome(): void {
    homeNodeResetToDuchy();
    notifySuccess('The Duchy is your home once again!');
  }
}
