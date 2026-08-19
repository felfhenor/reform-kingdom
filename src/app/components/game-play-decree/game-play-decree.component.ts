import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { DragDropModule } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OptionRewardComponent } from '@components/option-reward/option-reward.component';
import { RowDecreeClauseComponent } from '@components/row-decree-clause/row-decree-clause.component';
import { SpriteNodeComponent } from '@components/sprite-node/sprite-node.component';
import { autoModeIsEnabled, autoModeToggle } from '@helpers/auto-mode';
import { getEntry } from '@helpers/content';
import {
  decreeClauseAdd,
  decreeClauseConflicts,
  decreeClauseRemove,
  decreeClauseReorder,
  decreeClauses,
  decreeClauseSetEnabled,
  decreeClauseUpdate,
  decreeSetWaitForFullHealthBeforeCombat,
  decreeWaitForFullHealthBeforeCombat,
} from '@helpers/decree';
import { HIGH_RISK_LEVELS_ABOVE_PARTY } from '@helpers/decree-evaluation';
import {
  exploreNodeFarmOptions,
  farmNodeRewardOptions,
} from '@helpers/decree-farm-node';
import { gatherableMaterialIds } from '@helpers/world-node-gathering';
import { rewardKey } from '@helpers/world-node-rewards';
import type {
  DecreeClause,
  DecreeClauseAction,
  DecreeClauseId,
  DecreeRiskLevel,
  FarmNodeRewardOption,
  ItemContent,
  MaterialId,
  RewardContentInfo,
} from '@interfaces';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TippyDirective } from '@ngneat/helipopper';
import { sortBy } from 'es-toolkit/compat';
import { IconComponent } from '../icon/icon.component';

const CLAUSE_TYPE_OPTIONS: {
  value: DecreeClauseAction['type'];
  label: string;
}[] = sortBy(
  [
    { value: 'GatherMaterial', label: 'Gather Material' },
    { value: 'FarmNode', label: 'Farm Node' },
    { value: 'FinishUnfinishedAreas', label: 'Finish Unfinished Areas' },
    { value: 'LevelUpParty', label: 'Level Up Party' },
  ],
  'label',
);

type RiskToleranceOption = {
  value: DecreeRiskLevel;
  label: string;
  description: string;
};

// Reward-shaped so the Gather Material picker can reuse `app-option-reward` for its icon+name row.
type MaterialOption = RewardContentInfo & { id: MaterialId };

const RISK_TOLERANCE_OPTIONS: RiskToleranceOption[] = [
  {
    value: 'Low',
    label: 'Low',
    description:
      "Only target nodes with a max level at or below the party's level.",
  },
  {
    value: 'Medium',
    label: 'Medium',
    description:
      "Target nodes with at least a minimum level of the party's level.",
  },
  {
    value: 'High',
    label: 'High',
    description: `Attempt encounters up to ${HIGH_RISK_LEVELS_ABOVE_PARTY} levels above the party's weakest hero - the riskiest fights Auto Mode will ever pick on its own.`,
  },
];

@Component({
  selector: 'app-game-play-decree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    DragDropModule,
    RowDecreeClauseComponent,
    SpriteNodeComponent,
    OptionRewardComponent,
    IconComponent,
    TippyDirective,
  ],
  templateUrl: './game-play-decree.component.html',
})
export class GamePlayDecreeComponent {
  public autoModeEnabled = computed(() => autoModeIsEnabled());
  public waitForFullHealthBeforeCombat = computed(() =>
    decreeWaitForFullHealthBeforeCombat(),
  );
  public clauses = computed(() => decreeClauses());

  public readonly clauseTypeOptions = CLAUSE_TYPE_OPTIONS;
  public readonly riskToleranceOptions = RISK_TOLERANCE_OPTIONS;

  public materialOptions = computed<MaterialOption[]>(() =>
    sortBy(
      gatherableMaterialIds()
        .map((id) => getEntry<ItemContent>(id))
        .filter((item): item is ItemContent => !!item)
        .map((item) => ({
          id: item.id as MaterialId,
          name: item.name,
          sprite: item.sprite,
          spritesheet: 'item',
        })),
      (item) => item.name,
    ),
  );

  public exploreNodeOptions = computed(() => exploreNodeFarmOptions());

  public draftType = signal<DecreeClauseAction['type']>('GatherMaterial');
  public draftMaterialId = signal<MaterialId | undefined>(undefined);
  public draftNodeName = signal<string | undefined>(undefined);
  public draftRewardKey = signal<string | undefined>(undefined);
  public draftTargetQuantity = signal<number>(1);
  public draftRiskTolerance = signal<DecreeRiskLevel>('Medium');

  // Scoped to the currently-selected node - a FarmNode reward only ever
  // makes sense in the context of the node it's farmed from.
  public rewardOptions = computed<FarmNodeRewardOption[]>(() => {
    const nodeName = this.draftNodeName();
    return nodeName ? farmNodeRewardOptions(nodeName) : [];
  });

  // Keyed by a stable string (`FarmNodeRewardOption.key`) rather than the reward object, so it can drive ng-select's bindValue like `draftMaterialId`.
  public selectedRewardOption = computed(() =>
    this.rewardOptions().find((option) => option.key === this.draftRewardKey()),
  );

  // Which clause types are editable in place is decided by `RowDecreeClauseComponent.isEditable`.
  public editingClauseId = signal<DecreeClauseId | undefined>(undefined);
  public isEditing = computed(() => !!this.editingClauseId());

  public draftAction = computed<DecreeClauseAction | undefined>(() => {
    switch (this.draftType()) {
      case 'GatherMaterial': {
        const materialId = this.draftMaterialId();
        return materialId
          ? {
              type: 'GatherMaterial',
              materialId,
              targetQuantity: this.draftTargetQuantity(),
            }
          : undefined;
      }
      case 'FarmNode': {
        const nodeName = this.draftNodeName();
        const reward = this.selectedRewardOption()?.reward;
        return nodeName && reward
          ? {
              type: 'FarmNode',
              nodeName,
              reward,
              targetQuantity: this.draftTargetQuantity(),
            }
          : undefined;
      }
      case 'LevelUpParty':
        return {
          type: 'LevelUpParty',
          riskTolerance: this.draftRiskTolerance(),
        };
      case 'FinishUnfinishedAreas':
        return {
          type: 'FinishUnfinishedAreas',
          riskTolerance: this.draftRiskTolerance(),
        };
      case 'ReturnToKingdom':
        return { type: 'ReturnToKingdom' };
    }
  });

  // Excludes the clause being edited, so saving it back unchanged isn't flagged as a duplicate of itself.
  public otherClauses = computed(() =>
    this.clauses().filter((clause) => clause.id !== this.editingClauseId()),
  );

  public isDuplicateDraft = computed(() => {
    const action = this.draftAction();
    return !!action && decreeClauseConflicts(action, this.otherClauses());
  });

  public canAddClause = computed(() => {
    const action = this.draftAction();
    if (!action) return false;
    if (
      (action.type === 'GatherMaterial' || action.type === 'FarmNode') &&
      this.draftTargetQuantity() <= 0
    ) {
      return false;
    }
    return !this.isDuplicateDraft();
  });

  public toggleAutoMode(): void {
    autoModeToggle(!this.autoModeEnabled());
  }

  public toggleWaitForFullHealthBeforeCombat(): void {
    decreeSetWaitForFullHealthBeforeCombat(
      !this.waitForFullHealthBeforeCombat(),
    );
  }

  // ng-select's (change) emits the full item, not the bindValue-mapped field, so this pulls it out manually.
  public setDraftRiskTolerance(option: RiskToleranceOption): void {
    this.draftRiskTolerance.set(option.value);
  }

  public setDraftType(option: { value: DecreeClauseAction['type'] }): void {
    this.draftType.set(option.value);
  }

  public setDraftMaterialId(option: MaterialOption | null): void {
    this.draftMaterialId.set(option ? option.id : undefined);
  }

  public setDraftNodeName(option: { nodeName: string } | null): void {
    this.draftNodeName.set(option ? option.nodeName : undefined);
    this.draftRewardKey.set(undefined);
  }

  public setDraftReward(option: FarmNodeRewardOption | null): void {
    this.draftRewardKey.set(option ? option.key : undefined);
  }

  public toggleClauseEnabled(clause: DecreeClause): void {
    decreeClauseSetEnabled(clause.id, !clause.enabled);
  }

  public removeClause(clauseId: DecreeClauseId): void {
    if (this.editingClauseId() === clauseId) this.cancelEditClause();
    decreeClauseRemove(clauseId);
  }

  public onDrop(event: CdkDragDrop<DecreeClause[]>): void {
    decreeClauseReorder(event.previousIndex, event.currentIndex);
  }

  public startEditClause(clause: DecreeClause): void {
    if (clause.type === 'GatherMaterial') {
      this.editingClauseId.set(clause.id);
      this.draftType.set('GatherMaterial');
      this.draftMaterialId.set(clause.materialId);
      this.draftTargetQuantity.set(clause.targetQuantity);
      return;
    }

    if (clause.type === 'FarmNode') {
      this.editingClauseId.set(clause.id);
      this.draftType.set('FarmNode');
      this.draftNodeName.set(clause.nodeName);
      this.draftRewardKey.set(rewardKey(clause.reward));
      this.draftTargetQuantity.set(clause.targetQuantity);
      return;
    }

    if (
      clause.type === 'LevelUpParty' ||
      clause.type === 'FinishUnfinishedAreas'
    ) {
      this.editingClauseId.set(clause.id);
      this.draftType.set(clause.type);
      this.draftRiskTolerance.set(clause.riskTolerance);
    }
  }

  public cancelEditClause(): void {
    this.editingClauseId.set(undefined);
    this.draftMaterialId.set(undefined);
    this.draftNodeName.set(undefined);
    this.draftRewardKey.set(undefined);
    this.draftTargetQuantity.set(1);
    this.draftRiskTolerance.set('Medium');
  }

  public submitClause(): void {
    const action = this.draftAction();
    if (!action || !this.canAddClause()) return;

    const editingClauseId = this.editingClauseId();
    const succeeded = editingClauseId
      ? decreeClauseUpdate(editingClauseId, action)
      : decreeClauseAdd(action);

    if (succeeded) {
      this.editingClauseId.set(undefined);
      this.draftTargetQuantity.set(1);
    }
  }
}
