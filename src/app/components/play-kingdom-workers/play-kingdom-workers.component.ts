import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AtlasAnimationComponent } from '@components/atlas-animation/atlas-animation.component';
import { ButtonKingdomBackComponent } from '@components/button-kingdom-back/button-kingdom-back.component';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconComponent } from '@components/icon/icon.component';
import { OptionRewardComponent } from '@components/option-reward/option-reward.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { getEntry } from '@helpers/content';
import { formatDuration } from '@helpers/engine/timer';
import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { gamestate } from '@helpers/state-game';
import {
  WORKER_MAX_LEVEL,
  workerIsReadyToLevelUp,
  workerLevelUp,
  workerLevelUpCost,
  workerStatsForLevel,
} from '@helpers/worker/worker-progression';
import {
  canWorkerReachNode,
  workerAssign,
  workerRecall,
  workerStaminaCostToNode,
  workerTravelRemainingTicks,
} from '@helpers/worker/worker-travel';
import { worldNodeGatherMaterialIds } from '@helpers/world-node/world-node-gathering';
import { rewardContentInfo } from '@helpers/world-node/world-node-rewards';
import { worldNodeLevelLabel } from '@helpers/world-node/world-node-status';
import {
  kingdomNodeGet,
  worldNodeByName,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  ItemContent,
  ItemId,
  RewardContentInfo,
  WorkerAssignment,
  WorkerContent,
  WorkerId,
  WorkerState,
  WorldNodeEntry,
} from '@interfaces';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TippyDirective } from '@ngneat/helipopper';
import { sortBy } from 'es-toolkit/compat';

type WorkerEntry = {
  id: WorkerId;
  content: WorkerContent;
  state: WorkerState;
};

type NodeOption = {
  nodeName: string;
  entry: WorldNodeEntry;
  staminaCost: number | undefined;
  levelRangeLabel: string;
  disabled: boolean;
};

type ItemOption = RewardContentInfo & { id: ItemId };

type EntryStatusDisplay = {
  label: string;
  locationEntry: WorldNodeEntry | undefined;
};

@Component({
  selector: 'app-play-kingdom-workers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardPageComponent,
    ButtonKingdomBackComponent,
    AtlasAnimationComponent,
    IconComponent,
    SpriteNodeComponent,
    OptionRewardComponent,
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    DecimalPipe,
    TippyDirective,
  ],
  templateUrl: './play-kingdom-workers.component.html',
  styleUrl: './play-kingdom-workers.component.scss',
})
export class PlayKingdomWorkersComponent {
  public readonly workerMaxLevel = WORKER_MAX_LEVEL;

  public selectedWorkerId = signal<WorkerId | undefined>(undefined);
  public draftNodeName = signal<string | undefined>(undefined);
  public draftItemId = signal<ItemId | undefined>(undefined);

  public entries = computed<WorkerEntry[]>(() => {
    const discovered = gamestate().discoveredWorkers;
    const workers = gamestate().workers;

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
    const status = this.selectedEntry()?.state.status.kind;
    return status === 'TravelingTo' || status === 'Gathering';
  });

  public levelUpCost = computed(() => {
    const entry = this.selectedEntry();
    return entry ? workerLevelUpCost(entry.state.level) : 0;
  });

  public canLevelUp = computed(() => {
    const entry = this.selectedEntry();
    return !!entry && workerIsReadyToLevelUp(entry.state);
  });

  // Live status while traveling/gathering, else the stored assignment (`state.assignment` may
  // already point at a different, not-yet-started job even mid-trip - see `workerAssign`).
  public currentAssignment = computed<WorkerAssignment | null>(() => {
    const entry = this.selectedEntry();
    if (!entry) return null;

    const status = entry.state.status;
    if (status.kind === 'TravelingTo' || status.kind === 'Gathering') {
      return { nodeName: status.nodeName, itemId: status.itemId };
    }

    return entry.state.assignment;
  });

  public displayedNodeName = computed(
    () => this.draftNodeName() ?? this.currentAssignment()?.nodeName,
  );
  public displayedItemId = computed(
    () => this.draftItemId() ?? this.currentAssignment()?.itemId,
  );

  // Every discovered gather node the worker could theoretically be sent to,
  // disabled (not filtered out) when out of stamina range for the selected worker.
  public nodeOptions = computed<NodeOption[]>(() => {
    const stamina = this.selectedStats()?.stamina ?? 0;

    const options = worldNodesOfType('GatherNode')
      .filter((node) => isGatherNodeDiscovered(node.nodeName))
      .map((node) => {
        const gathering = worldNodeGathering(node);
        return {
          nodeName: node.nodeName,
          entry: node,
          staminaCost: workerStaminaCostToNode(node.nodeName),
          levelRangeLabel: gathering
            ? worldNodeLevelLabel(gathering.workerLevelRange)
            : '?',
          disabled: !canWorkerReachNode(node.nodeName, stamina),
        };
      });

    return sortBy(options, (o) => o.nodeName);
  });

  public itemOptions = computed<ItemOption[]>(() => {
    const nodeName = this.displayedNodeName();
    if (!nodeName) return [];

    const node = worldNodeByName(nodeName);
    if (!node) return [];

    return worldNodeGatherMaterialIds(node)
      .map((itemId) => {
        const info = rewardContentInfo({ itemId });
        return info ? { id: itemId, ...info } : undefined;
      })
      .filter((option): option is ItemOption => !!option);
  });

  public canConfirmAssignment = computed(
    () =>
      !!this.selectedEntry() &&
      !!this.displayedNodeName() &&
      !!this.displayedItemId(),
  );

  public selectWorker(id: WorkerId): void {
    this.selectedWorkerId.set(id);
    this.draftNodeName.set(undefined);
    this.draftItemId.set(undefined);
  }

  public setDraftNodeName(nodeName: string): void {
    this.draftNodeName.set(nodeName);
    this.draftItemId.set(undefined);
  }

  public setDraftItemId(itemId: ItemId): void {
    this.draftItemId.set(itemId);
  }

  public confirmAssignment(): void {
    const entry = this.selectedEntry();
    const nodeName = this.displayedNodeName();
    const itemId = this.displayedItemId();
    if (!entry || !nodeName || !itemId) return;

    workerAssign(entry.id, nodeName, itemId);
    this.draftNodeName.set(undefined);
    this.draftItemId.set(undefined);
  }

  public recall(): void {
    const entry = this.selectedEntry();
    if (!entry) return;
    workerRecall(entry.id);
  }

  public levelUp(): void {
    const entry = this.selectedEntry();
    if (!entry) return;
    workerLevelUp(entry.id);
  }
}
