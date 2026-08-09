import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { DragDropModule } from '@angular/cdk/drag-drop';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecreeClauseRowComponent } from '@components/decree-clause-row/decree-clause-row.component';
import {
  autoModeIsEnabled,
  autoModeToggle,
  decreeClauseAdd,
  decreeClauseConflicts,
  decreeClauseRemove,
  decreeClauseReorder,
  decreeClauses,
  decreeClauseSetEnabled,
  decreeClauseUpdate,
  decreeRiskTolerance,
  decreeSetRiskTolerance,
  decreeSetWaitForFullHealthBeforeCombat,
  decreeWaitForFullHealthBeforeCombat,
  gatherableMaterialIds,
  getEntry,
  HIGH_RISK_LEVELS_ABOVE_PARTY,
  MEDIUM_RISK_LEVELS_ABOVE_PARTY,
} from '@helpers';
import type {
  DecreeClause,
  DecreeClauseAction,
  DecreeClauseId,
  DecreeRiskLevel,
  ItemContent,
  MaterialId,
} from '@interfaces';
import {
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { sortBy } from 'es-toolkit/compat';

const CLAUSE_TYPE_OPTIONS: {
  value: DecreeClauseAction['type'];
  label: string;
}[] = [
  { value: 'GatherMaterial', label: 'Gather Material' },
  { value: 'FinishUnfinishedAreas', label: 'Finish Unfinished Areas' },
  { value: 'LevelUpParty', label: 'Level Up Party' },
  { value: 'ReturnToKingdom', label: 'Return to Kingdom' },
];

type RiskToleranceOption = {
  value: DecreeRiskLevel;
  label: string;
  description: string;
};

const RISK_TOLERANCE_OPTIONS: RiskToleranceOption[] = [
  {
    value: 'Low',
    label: 'Low',
    description: "Only target enemies at or below the party's level.",
  },
  {
    value: 'Medium',
    label: 'Medium',
    description: `Also allow enemies up to ${MEDIUM_RISK_LEVELS_ABOVE_PARTY} levels above the party.`,
  },
  {
    value: 'High',
    label: 'High',
    description: `Also allow enemies up to ${HIGH_RISK_LEVELS_ABOVE_PARTY} levels above the party - the riskiest fights Auto Mode will ever pick on its own.`,
  },
];

@Component({
  selector: 'app-game-play-decree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    DragDropModule,
    DecreeClauseRowComponent,
  ],
  templateUrl: './game-play-decree.component.html',
})
export class GamePlayDecreeComponent {
  public autoModeEnabled = computed(() => autoModeIsEnabled());
  public riskTolerance = computed(() => decreeRiskTolerance());
  public waitForFullHealthBeforeCombat = computed(() =>
    decreeWaitForFullHealthBeforeCombat(),
  );
  public clauses = computed(() => decreeClauses());

  public readonly clauseTypeOptions = CLAUSE_TYPE_OPTIONS;
  public readonly riskToleranceOptions = RISK_TOLERANCE_OPTIONS;

  public materialOptions = computed(() =>
    sortBy(
      gatherableMaterialIds()
        .map((id) => getEntry<ItemContent>(id))
        .filter((item): item is ItemContent => !!item),
      (item) => item.name,
    ),
  );

  public draftType = signal<DecreeClauseAction['type']>('GatherMaterial');
  public draftMaterialId = signal<MaterialId | undefined>(undefined);
  public draftTargetQuantity = signal<number>(1);

  // Only GatherMaterial clauses have parameters worth editing in place - see
  // `DecreeClauseRowComponent.isEditable`, which gates the row's Edit button
  // the same way.
  public editingClauseId = signal<DecreeClauseId | undefined>(undefined);
  public isEditing = computed(() => !!this.editingClauseId());

  public draftAction = computed<DecreeClauseAction | undefined>(() => {
    const materialId = this.draftMaterialId();

    switch (this.draftType()) {
      case 'GatherMaterial':
        return materialId
          ? {
              type: 'GatherMaterial',
              materialId,
              targetQuantity: this.draftTargetQuantity(),
            }
          : undefined;
      case 'LevelUpParty':
        return { type: 'LevelUpParty' };
      case 'FinishUnfinishedAreas':
        return { type: 'FinishUnfinishedAreas' };
      case 'ReturnToKingdom':
        return { type: 'ReturnToKingdom' };
    }
  });

  // Excludes the clause currently being edited, so saving it back with the
  // same material (just a different quantity, say) isn't flagged as a
  // duplicate of itself.
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
    if (action.type === 'GatherMaterial' && this.draftTargetQuantity() <= 0) {
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

  // ng-select's (change) output emits the full selected item from `items`,
  // not the `bindValue`-mapped field (that mapping only applies to
  // ngModel/writeValue) - so a bindValue select's change handler has to pull
  // the field back out itself.
  public setRiskTolerance(option: RiskToleranceOption): void {
    decreeSetRiskTolerance(option.value);
  }

  public setDraftType(option: { value: DecreeClauseAction['type'] }): void {
    this.draftType.set(option.value);
  }

  public setDraftMaterialId(item: ItemContent | null): void {
    this.draftMaterialId.set(item ? (item.id as MaterialId) : undefined);
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
    if (clause.type !== 'GatherMaterial') return;

    this.editingClauseId.set(clause.id);
    this.draftType.set('GatherMaterial');
    this.draftMaterialId.set(clause.materialId);
    this.draftTargetQuantity.set(clause.targetQuantity);
  }

  public cancelEditClause(): void {
    this.editingClauseId.set(undefined);
    this.draftMaterialId.set(undefined);
    this.draftTargetQuantity.set(1);
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
