import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OptionRewardComponent } from '@components/option-reward/option-reward.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { SFXDirective } from '@directives/sfx.directive';
import { WORKER_MAX_LEVEL } from '@helpers/config';
import { getEntry } from '@helpers/content/content';
import { gatherDifficultyTier } from '@helpers/engine/difficulty-tier';
import { rangeLabel } from '@helpers/engine/leveled-range';
import { isGatherNodeDiscovered } from '@helpers/item/gather-node-discovery';
import { getMaterialQuantity } from '@helpers/item/materials';
import { workersState } from '@helpers/state-game';
import { workerStatsForLevel } from '@helpers/worker/worker-progression';
import {
  canWorkerReachNode,
  workerStaminaCostToNode,
} from '@helpers/worker/worker-assignment';
import { workerAssign } from '@helpers/worker/worker-travel';
import { worldNodeGatherMaterialIds } from '@helpers/world-node/world-node-gathering-discovery';
import { rewardContentInfo } from '@helpers/world-node/world-node-rewards';
import {
  worldNodeByName,
  worldNodeGathering,
  worldNodesOfType,
} from '@helpers/world-node/world-nodes';
import type {
  DifficultyTier,
  ItemId,
  RewardContentInfo,
  WorkerContent,
  WorkerGatherAssignment,
  WorkerId,
  WorldNodeEntry,
} from '@interfaces';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { DecimalPipe } from '@angular/common';
import { sortBy } from 'es-toolkit/compat';

type NodeOption = {
  nodeName: string;
  entry: WorldNodeEntry;
  staminaCost?: number;
  levelRangeLabel: string;
  difficulty?: DifficultyTier;
  maxLevel: number;
  disabled: boolean;
};

type ItemOption = RewardContentInfo & { id: ItemId; owned: number };

@Component({
  selector: 'app-panel-kingdom-workers-assignment-gather',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    OptionRewardComponent,
    SpriteNodeComponent,
    SFXDirective,
  ],
  templateUrl: './panel-kingdom-workers-assignment-gather.component.html',
  styleUrl: './panel-kingdom-workers-assignment-gather.component.scss',
})
export class PanelKingdomWorkersAssignmentGatherComponent {
  public workerId = input.required<WorkerId>();

  public worker = computed(() => workersState()[this.workerId()]);
  public content = computed(() => getEntry<WorkerContent>(this.workerId()));

  public level = computed(() => this.worker()?.level ?? 1);

  public gatherAssignment = computed<WorkerGatherAssignment | undefined>(
    () => {
      const assignment = this.worker()?.assignment;
      return assignment && !('recipeId' in assignment) ? assignment : undefined;
    },
    { equal: (a, b) => a?.nodeName === b?.nodeName && a?.itemId === b?.itemId },
  );

  // Falls back to the live trip so a pending craft still shows what's being gathered.
  public currentAssignment = computed<WorkerGatherAssignment | undefined>(
    () => {
      const assignment = this.gatherAssignment();
      if (assignment) return assignment;

      const status = this.worker()?.status;
      return status?.kind === 'TravelingTo' || status?.kind === 'Gathering'
        ? { nodeName: status.nodeName, itemId: status.itemId }
        : undefined;
    },
  );

  // Keyed on the stored job, so drafts reset only once a confirm lands, never on trip progress.
  private draftSource = computed(() => ({
    workerId: this.workerId(),
    assignment: this.gatherAssignment(),
  }));
  public draftNodeName = linkedSignal<unknown, string | undefined>({
    source: this.draftSource,
    computation: () => undefined,
  });
  public draftItemId = linkedSignal<unknown, ItemId | undefined>({
    source: this.draftSource,
    computation: () => undefined,
  });

  public isActive = computed(() => !!this.gatherAssignment());

  // Keeps the last gather job on screen after the worker switches to crafting.
  public shownAssignment = linkedSignal<
    { workerId: WorkerId; assignment?: WorkerGatherAssignment },
    WorkerGatherAssignment | undefined
  >({
    source: () => ({
      workerId: this.workerId(),
      assignment: this.currentAssignment(),
    }),
    computation: (source, previous) =>
      source.assignment ??
      (previous?.source.workerId === source.workerId
        ? previous.value
        : undefined),
  });

  public displayedNodeName = computed(
    () => this.draftNodeName() ?? this.shownAssignment()?.nodeName,
  );

  // Every discovered gather node, disabled (not filtered out) when out of stamina range or level.
  public nodeOptions = computed<NodeOption[]>(() => {
    const content = this.content();
    const level = this.level();
    const stamina = content ? workerStatsForLevel(content, level).stamina : 0;
    const allowTeleport = content?.canUseTeleports ?? true;

    const options = worldNodesOfType('GatherNode')
      .filter((node) => isGatherNodeDiscovered(node.nodeName))
      .map((node) => {
        const gathering = worldNodeGathering(node);
        return {
          nodeName: node.nodeName,
          entry: node,
          staminaCost: workerStaminaCostToNode(node.nodeName, allowTeleport),
          maxLevel: gathering?.workerLevelRange.max ?? WORKER_MAX_LEVEL,
          levelRangeLabel: gathering
            ? rangeLabel(gathering.workerLevelRange)
            : '?',
          difficulty: gathering
            ? gatherDifficultyTier(gathering.workerLevelRange, level)
            : undefined,
          disabled:
            !canWorkerReachNode(node.nodeName, stamina, allowTeleport) ||
            (gathering?.workerLevelRange.min ?? 0) > level,
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
        return info
          ? { id: itemId, owned: getMaterialQuantity(itemId), ...info }
          : undefined;
      })
      .filter((option): option is ItemOption => !!option);
  });

  public displayedItemId = computed(() => {
    const itemId = this.draftItemId() ?? this.shownAssignment()?.itemId;
    if (!itemId) return undefined;
    return this.itemOptions().some((option) => option.id === itemId)
      ? itemId
      : undefined;
  });

  public canConfirm = computed(
    () => !!this.displayedNodeName() && !!this.displayedItemId(),
  );

  public setDraftNodeName(nodeName: string): void {
    this.draftNodeName.set(nodeName);
    this.draftItemId.set(undefined);
  }

  public setDraftItemId(itemId: ItemId): void {
    this.draftItemId.set(itemId);
  }

  public confirm(): void {
    const nodeName = this.displayedNodeName();
    const itemId = this.displayedItemId();
    if (!nodeName || !itemId) return;

    if (workerAssign(this.workerId(), nodeName, itemId)) return;

    this.draftNodeName.set(undefined);
    this.draftItemId.set(undefined);
  }
}
