import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { BarProgressComponent } from '@components/bar-progress/bar-progress.component';
import { BlankSlateComponent } from '@components/blank-slate/blank-slate.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconComponent } from '@components/icon/icon.component';
import { PanelKingdomWorkersAssignmentCraftComponent } from '@components/panel-kingdom-workers-assignment-craft/panel-kingdom-workers-assignment-craft.component';
import { PanelKingdomWorkersAssignmentGatherComponent } from '@components/panel-kingdom-workers-assignment-gather/panel-kingdom-workers-assignment-gather.component';
import { RowCurrencyCostComponent } from '@components/row-currency-cost/row-currency-cost.component';
import { SlotIconBlankComponent } from '@components/slot-icon-blank/slot-icon-blank.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { TextNumberTweenComponent } from '@components/text-number-tween/text-number-tween.component';
import { ListRowDirective } from '@directives/list-row.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { TutorialTargetDirective } from '@directives/tutorial-target.directive';
import { getEntry } from '@helpers/content/content';
import { formatDuration } from '@helpers/engine/timer';
import { goldCoinId } from '@helpers/item/materials';
import { discoveredWorkersState, workersState } from '@helpers/state-game';
import { workerCraftRemainingTicks } from '@helpers/worker/worker-crafting.ui';
import {
  workerIsReadyToLevelUp,
  workerLevelUpCost,
  workerStatsForLevel,
} from '@helpers/worker/worker-progression';
import { workerLevelUp } from '@helpers/worker/worker-progression.ui';
import { workerRecall } from '@helpers/worker/worker-travel';
import { workerTravelRemainingTicks } from '@helpers/worker/worker-travel.ui';
import {
  kingdomNodeGet,
  worldNodeByName,
} from '@helpers/world-node/world-nodes';
import type {
  CostItem,
  ItemContent,
  RecipeContent,
  WorkerContent,
  WorkerId,
  WorkerState,
  WorkerStatusCrafting,
  WorldNodeEntry,
} from '@interfaces';
import { TippyDirective } from '@ngneat/helipopper';
import { AnimationService } from '@services/animation.service';

type WorkerEntry = {
  id: WorkerId;
  content: WorkerContent;
  state: WorkerState;
};

type EntryStatusDisplay = {
  label: string;
  locationEntry?: WorldNodeEntry;
};

@Component({
  selector: 'app-play-kingdom-workers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BlankSlateComponent,
    CardPageComponent,
    ButtonKingdomBackComponent,
    AtlasAnimationComponent,
    BarProgressComponent,
    TextNumberTweenComponent,
    IconComponent,
    SpriteNodeComponent,
    DecimalPipe,
    TippyDirective,
    SlotIconBlankComponent,
    ListRowDirective,
    SFXDirective,
    TutorialTargetDirective,
    RowCurrencyCostComponent,
    PanelKingdomWorkersAssignmentGatherComponent,
    PanelKingdomWorkersAssignmentCraftComponent,
  ],
  templateUrl: './play-kingdom-workers.component.html',
  styleUrl: './play-kingdom-workers.component.scss',
})
export class PlayKingdomWorkersComponent {
  private anim = inject(AnimationService);

  public selectedWorkerId = signal<WorkerId | undefined>(undefined);

  public entries = computed<WorkerEntry[]>(() => {
    const discovered = discoveredWorkersState();
    const workers = workersState();

    return (Object.keys(discovered) as WorkerId[])
      .map((id) => {
        const content = getEntry<WorkerContent>(id);
        const state = workers[id];
        return content && state ? { id, content, state } : undefined;
      })
      .filter((entry): entry is WorkerEntry => !!entry);
  });

  public busyCount = computed(
    () =>
      this.entries().filter((e) => e.state.status.kind !== 'AtDuchy').length,
  );

  public selectedEntry = computed(() => {
    const entries = this.entries();
    const selectedId = this.selectedWorkerId();
    return entries.find((e) => e.id === selectedId) ?? entries[0];
  });

  public selectedStats = computed(() => {
    const entry = this.selectedEntry();
    if (!entry) return undefined;
    return workerStatsForLevel(entry.content, entry.state.level);
  });

  public capacityDisplay = computed(() =>
    Math.floor(this.selectedStats()?.capacity ?? 0),
  );

  public statusLabel = computed(() => {
    const entry = this.selectedEntry();
    if (!entry) return '';

    const status = entry.state.status;
    switch (status.kind) {
      case 'AtDuchy':
        return 'At the Duchy';
      case 'Crafting':
        return this.craftingLabel(entry.id, status);
      case 'TravelingTo': {
        const remaining = workerTravelRemainingTicks(entry.id);
        return `Traveling to ${status.nodeName} (${remaining !== undefined ? formatDuration(remaining) : '?'} remaining)`;
      }
      case 'Gathering': {
        const item = getEntry<ItemContent>(status.itemId);
        return `At ${status.nodeName} (${status.itemsGathered}/${this.capacityDisplay()} ${item?.name ?? '???'})`;
      }
      case 'TravelingBack': {
        const remaining = workerTravelRemainingTicks(entry.id);
        return `Returning to the Duchy (${remaining !== undefined ? formatDuration(remaining) : '?'} remaining)`;
      }
    }
  });

  // Short per-entry status + the node the worker is currently at (or heading to), for the worker list row.
  public entryStatusDisplay(entry: WorkerEntry): EntryStatusDisplay {
    const status = entry.state.status;
    switch (status.kind) {
      case 'AtDuchy':
        return { label: 'At the Duchy', locationEntry: kingdomNodeGet() };
      case 'Crafting':
        return {
          label: status.materialsHeld ? 'Crafting...' : 'Waiting for materials',
          locationEntry: kingdomNodeGet(),
        };
      case 'TravelingTo': {
        const remaining = workerTravelRemainingTicks(entry.id);
        return {
          label: `Traveling... (${remaining !== undefined ? formatDuration(remaining) : '?'})`,
          locationEntry: worldNodeByName(status.nodeName),
        };
      }
      case 'Gathering': {
        const capacity = workerStatsForLevel(
          entry.content,
          entry.state.level,
        ).capacity;
        return {
          label: `Gathering... (${status.itemsGathered}/${Math.floor(capacity)})`,
          locationEntry: worldNodeByName(status.nodeName),
        };
      }
      case 'TravelingBack': {
        const remaining = workerTravelRemainingTicks(entry.id);
        return {
          label: `Returning... (${remaining !== undefined ? formatDuration(remaining) : '?'})`,
          locationEntry: kingdomNodeGet(),
        };
      }
    }
  }

  public canRecall = computed(() => {
    const state = this.selectedEntry()?.state;
    const status = state?.status.kind;
    if (status === 'TravelingTo' || status === 'Gathering') return true;
    if (status === 'Crafting') return true;
    return (
      status === 'TravelingBack' &&
      !!state?.assignment &&
      'recipeId' in state.assignment
    );
  });

  public levelUpCost = computed(() => {
    const entry = this.selectedEntry();
    return entry ? workerLevelUpCost(entry.state.level) : 0;
  });

  public canLevelUp = computed(() => {
    const entry = this.selectedEntry();
    return !!entry && workerIsReadyToLevelUp(entry.state);
  });

  public levelUpCostDisplay = computed<CostItem[]>(() => [
    {
      itemId: goldCoinId(),
      required: this.levelUpCost(),
    },
  ]);

  public selectWorker(id: WorkerId): void {
    this.selectedWorkerId.set(id);
  }

  private craftingLabel(
    workerId: WorkerId,
    status: WorkerStatusCrafting,
  ): string {
    const recipe = getEntry<RecipeContent>(status.recipeId);
    const name = recipe?.name ?? '???';
    if (!status.materialsHeld) return `Waiting for materials (${name})`;

    const remaining = workerCraftRemainingTicks(workerId);
    return `Crafting ${name} (${remaining !== undefined ? formatDuration(remaining) : '?'} remaining)`;
  }

  public recall(): void {
    const entry = this.selectedEntry();
    if (!entry) return;
    workerRecall(entry.id);
  }

  public levelUp(event: MouseEvent): void {
    const entry = this.selectedEntry();
    if (!entry) return;
    workerLevelUp(entry.id);
    this.anim.levelUp(event.currentTarget as HTMLElement);
  }
}
