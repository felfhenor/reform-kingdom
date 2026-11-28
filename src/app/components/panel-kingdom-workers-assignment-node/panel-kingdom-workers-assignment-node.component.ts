import { TPipe } from '@pipes/t.pipe';
import { FFSelectDirective } from '@ff/controls/ff-select.directive';
import { FFStepperDirective } from '@ff/controls/ff-stepper.directive';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@components/icon/icon.component';
import { OptionRewardComponent } from '@components/option-reward/option-reward.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { SFXDirective } from '@directives/sfx.directive';
import { getEntry } from '@helpers/content/content';
import { workersState } from '@helpers/state-game';
import {
  workerAssignmentItemOptions,
  workerAssignmentKind,
  workerAssignmentNodeOptions,
} from '@helpers/worker/worker-assignment.ui';
import { workerCombatPower } from '@helpers/worker/worker-combat';
import { kingdomWorkerStatsForLevel } from '@helpers/worker/worker-progression';
import {
  workerAssignmentSameJob,
  workerOrderDraftKept,
} from '@helpers/worker/worker-order.ui';
import { workerAssign } from '@helpers/worker/worker-travel';
import type {
  ItemId,
  WorkerAssignmentItemOption,
  WorkerAssignmentMode,
  WorkerAssignmentNodeOption,
  WorkerContent,
  WorkerGatherAssignment,
  WorkerId,
  WorkerOrderDraftSource,
} from '@interfaces';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { DecimalPipe } from '@angular/common';
import { TippyDirective } from '@ngneat/helipopper';

@Component({
  selector: 'app-panel-kingdom-workers-assignment-node',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TPipe,
    FFSelectDirective,
    FFStepperDirective,
    DecimalPipe,
    FormsModule,
    IconComponent,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    OptionRewardComponent,
    SpriteNodeComponent,
    SFXDirective,
    TippyDirective,
  ],
  templateUrl: './panel-kingdom-workers-assignment-node.component.html',
  styleUrl: './panel-kingdom-workers-assignment-node.component.scss',
})
export class PanelKingdomWorkersAssignmentNodeComponent {
  public workerId = input.required<WorkerId>();
  public mode = input.required<WorkerAssignmentMode>();

  public worker = computed(() => workersState()[this.workerId()]);
  public content = computed(() => getEntry<WorkerContent>(this.workerId()));

  public level = computed(() => this.worker()?.level ?? 1);

  public stats = computed(() => {
    const content = this.content();
    return content
      ? kingdomWorkerStatsForLevel(content, this.level())
      : undefined;
  });

  public capacity = computed(() => Math.floor(this.stats()?.capacity ?? 0));

  public combatPower = computed(() => {
    const content = this.content();
    return content ? workerCombatPower(content, this.level()) : 0;
  });

  private isOwnJob(assignment: WorkerGatherAssignment): boolean {
    return workerAssignmentKind(assignment) === this.mode();
  }

  public nodeAssignment = computed<WorkerGatherAssignment | undefined>(
    () => {
      const assignment = this.worker()?.assignment;
      return assignment &&
        !('recipeId' in assignment) &&
        this.isOwnJob(assignment)
        ? assignment
        : undefined;
    },
    { equal: (a, b) => a?.nodeName === b?.nodeName && a?.itemId === b?.itemId },
  );

  // Falls back to the live trip so a pending craft still shows what's being worked.
  public currentAssignment = computed<WorkerGatherAssignment | undefined>(
    () => {
      const assignment = this.nodeAssignment();
      if (assignment) return assignment;

      const status = this.worker()?.status;
      if (status?.kind !== 'TravelingTo' && status?.kind !== 'Gathering') {
        return undefined;
      }

      const trip = { nodeName: status.nodeName, itemId: status.itemId };
      return this.isOwnJob(trip) ? trip : undefined;
    },
  );

  // Ignores the ticking count, so drafts reset only when a confirm changes the job.
  private assignment = computed(() => this.worker()?.assignment, {
    equal: workerAssignmentSameJob,
  });
  private draftSource = computed(() => ({
    workerId: this.workerId(),
    assignment: this.assignment(),
  }));
  public draftNodeName = linkedSignal<unknown, string | undefined>({
    source: this.draftSource,
    computation: () => undefined,
  });
  public draftItemId = linkedSignal<unknown, ItemId | undefined>({
    source: this.draftSource,
    computation: () => undefined,
  });

  public isActive = computed(() => !!this.nodeAssignment());

  private liveRemaining = computed(() =>
    this.isActive() ? this.worker()?.assignment?.remaining : undefined,
  );

  public draftCount = linkedSignal<WorkerOrderDraftSource, string | undefined>({
    source: () => ({
      job: this.draftSource(),
      remaining: this.liveRemaining(),
    }),
    computation: (source, previous) =>
      !!previous &&
      previous.source.job === source.job &&
      workerOrderDraftKept(previous.value, source.remaining)
        ? previous.value
        : undefined,
  });

  public countTooltip = computed(
    () =>
      `How many to ${this.mode() === 'Gather' ? 'gather' : 'fight for'}. Leave blank or 0 to repeat forever.`,
  );

  public displayedNodeName = computed(
    () => this.draftNodeName() ?? this.currentAssignment()?.nodeName,
  );

  public nodeOptions = computed<WorkerAssignmentNodeOption[]>(() => {
    const content = this.content();
    return content
      ? workerAssignmentNodeOptions(this.mode(), content, this.level())
      : [];
  });

  public itemOptions = computed<WorkerAssignmentItemOption[]>(() => {
    const nodeName = this.displayedNodeName();
    return nodeName ? workerAssignmentItemOptions(this.mode(), nodeName) : [];
  });

  public displayedItemId = computed(() => {
    const itemId = this.draftItemId() ?? this.currentAssignment()?.itemId;
    if (!itemId) return undefined;
    return this.itemOptions().some((option) => option.id === itemId)
      ? itemId
      : undefined;
  });

  // The live count only belongs to the job it's counting, not a different one being picked.
  public displayedCount = computed(() => {
    const current = this.nodeAssignment();
    const sameJob =
      current?.nodeName === this.displayedNodeName() &&
      current?.itemId === this.displayedItemId();
    const live = sameJob ? this.liveRemaining()?.toString() : undefined;
    return this.draftCount() ?? live ?? '';
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

    const count = Number(this.displayedCount());
    if (workerAssign(this.workerId(), nodeName, itemId, count)) return;

    this.draftNodeName.set(undefined);
    this.draftItemId.set(undefined);
    this.draftCount.set(undefined);
  }
}
