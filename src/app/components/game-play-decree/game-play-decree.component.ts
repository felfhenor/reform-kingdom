import type { CdkDragDrop } from '@angular/cdk/drag-drop';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { DecimalPipe } from '@angular/common';
import type { AnimationCallbackEvent } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardPageComponent } from '@components/card-page/card-page.component';
import { IconComponent } from '@components/icon/icon.component';
import { OptionRewardComponent } from '@components/option-reward/option-reward.component';
import { OptionWorldNodeComponent } from '@components/option-world-node/option-world-node.component';
import { RowDecreeClauseComponent } from '@components/row-decree-clause/row-decree-clause.component';
import { ListReflowDragDirective } from '@directives/list-reflow-drag.directive';
import { ListReflowDirective } from '@directives/list-reflow.directive';
import { SFXDirective } from '@directives/sfx.directive';
import { HIGH_RISK_LEVELS_ABOVE_PARTY } from '@helpers/config';
import { getEntriesByType, getEntry } from '@helpers/content/content';
import {
  autoModeIsEnabled,
  autoModeToggle,
} from '@helpers/decree/auto-mode-state';
import {
  decreeClauseAdd,
  decreeClauseCap,
  decreeClauseConflicts,
  decreeClauseReorder,
  decreeClauses,
  decreeClauseSetEnabled,
  decreeWaitForFullEnergyBeforeCombat,
  decreeWaitForFullHealthBeforeCombat,
} from '@helpers/decree/decree';
import {
  exploreNodeFarmOptions,
  farmNodeActiveWarning,
  farmNodeRewardOptions,
} from '@helpers/decree/decree-farm-node.ui';
import {
  decreeActiveClauseId,
  decreeClauseRemove,
  decreeClauseUpdate,
  decreeSetWaitForFullEnergyBeforeCombat,
  decreeSetWaitForFullHealthBeforeCombat,
} from '@helpers/decree/decree.ui';
import { RISK_BAND_DIFFICULTY } from '@helpers/engine/difficulty-tier';
import { uiScaleCurrent } from '@helpers/engine/ui-scale.ui';
import { homeNodeGet } from '@helpers/town/town-spawn';
import {
  gatherableDiscoveredMaterialIds,
  gatherNodeFarmOptions,
  gatherNodeFarmOptionsFor,
  gatherNodeMaterialIds,
} from '@helpers/world-node/world-node-gathering-discovery.ui';
import { rewardKey } from '@helpers/world-node/world-node-rewards';
import { worldNodeTown } from '@helpers/world-node/world-nodes';
import type {
  DecreeClause,
  DecreeClauseAction,
  DecreeClauseId,
  DecreeRiskLevel,
  DifficultyTier,
  FarmNodeRewardOption,
  ItemContent,
  MaterialId,
  RewardContentInfo,
  TownContent,
} from '@interfaces';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TippyDirective } from '@ngneat/helipopper';
import { AnimationService } from '@services/animation.service';
import { sortBy } from 'es-toolkit/compat';

// GatherFromNode is a node-first form for the same GatherMaterial clause; GatherMaterial picks the material first.
type ClauseFormType = DecreeClauseAction['type'] | 'GatherFromNode';

const CLAUSE_TYPE_OPTIONS: {
  value: ClauseFormType;
  label: string;
}[] = sortBy(
  [
    { value: 'GatherMaterial', label: 'Gather Material' },
    { value: 'GatherFromNode', label: 'Gather from Node' },
    { value: 'FarmNode', label: 'Farm Node' },
    { value: 'FinishUnfinishedAreas', label: 'Finish Unfinished Areas' },
    { value: 'LevelUpParty', label: 'Level Up Party' },
    { value: 'DefendTowns', label: 'Defend Towns' },
  ],
  'label',
);

type RiskToleranceOption = {
  value: DecreeRiskLevel;
  label: string;
  difficulty: DifficultyTier;
  description: string;
};

type MaterialOption = RewardContentInfo & { id: MaterialId };

const DEFAULT_DECREE_GATHER_QUANTITY = 100;

const RISK_TOLERANCE_OPTIONS: RiskToleranceOption[] = [
  {
    value: 'Low',
    label: 'Low',
    difficulty: RISK_BAND_DIFFICULTY.Low,
    description:
      "Only target nodes with a max level at or below the party's level.",
  },
  {
    value: 'Medium',
    label: 'Medium',
    difficulty: RISK_BAND_DIFFICULTY.Medium,
    description:
      "Target nodes with at least a minimum level of the party's level.",
  },
  {
    value: 'High',
    label: 'High',
    difficulty: RISK_BAND_DIFFICULTY.High,
    description: `Attempt encounters up to ${HIGH_RISK_LEVELS_ABOVE_PARTY} levels above the party's weakest hero - the riskiest fights Auto Mode will ever pick on its own.`,
  },
];

function materialOptionsFor(ids: MaterialId[]): MaterialOption[] {
  return sortBy(
    ids
      .map((id) => getEntry<ItemContent>(id))
      .filter((item): item is ItemContent => !!item)
      .map((item) => ({
        id: item.id as MaterialId,
        name: item.name,
        sprite: item.sprite,
        spritesheet: 'item',
      })),
    (item) => item.name,
  );
}

@Component({
  selector: 'app-game-play-decree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardPageComponent,
    ListReflowDirective,
    ListReflowDragDirective,
    DecimalPipe,
    FormsModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    DragDropModule,
    RowDecreeClauseComponent,
    OptionRewardComponent,
    OptionWorldNodeComponent,
    IconComponent,
    TippyDirective,
    SFXDirective,
  ],
  templateUrl: './game-play-decree.component.html',
})
export class GamePlayDecreeComponent {
  private anim = inject(AnimationService);

  public uiScale = uiScaleCurrent;
  public autoModeEnabled = computed(() => autoModeIsEnabled());
  public waitForFullHealthBeforeCombat = computed(() =>
    decreeWaitForFullHealthBeforeCombat(),
  );
  public waitForFullEnergyBeforeCombat = computed(() =>
    decreeWaitForFullEnergyBeforeCombat(),
  );
  public clauses = computed(() => decreeClauses());
  public clauseCap = computed(() => decreeClauseCap());
  public isClauseCapReached = computed(
    () => this.clauses().length >= this.clauseCap(),
  );
  public activeClauseId = computed(() => decreeActiveClauseId());

  public homeDisplayName = computed(() => {
    const home = homeNodeGet();
    if (!home) return 'the Duchy';
    return worldNodeTown(home)?.name ?? home.nodeName;
  });

  public readonly clauseTypeOptions = CLAUSE_TYPE_OPTIONS;
  public readonly riskToleranceOptions = RISK_TOLERANCE_OPTIONS;

  public materialOptions = computed<MaterialOption[]>(() => {
    if (this.isGatherByMaterial()) {
      return materialOptionsFor(gatherableDiscoveredMaterialIds());
    }

    const nodeName = this.draftNodeName();
    const currentMaterialId = this.draftMaterialId();
    const ids = nodeName ? gatherNodeMaterialIds(nodeName) : [];
    const scopedIds =
      currentMaterialId && !ids.includes(currentMaterialId)
        ? [...ids, currentMaterialId]
        : ids;

    return materialOptionsFor(scopedIds);
  });

  public exploreNodeOptions = computed(() => exploreNodeFarmOptions());
  public draftFarmNodeWarning = computed(() => {
    const nodeName = this.draftNodeName();
    return this.draftType() === 'FarmNode' && nodeName
      ? farmNodeActiveWarning(nodeName)
      : undefined;
  });
  public gatherNodeOptions = computed(() => {
    if (!this.isGatherByMaterial()) return gatherNodeFarmOptions();
    const materialId = this.draftMaterialId();
    return materialId ? gatherNodeFarmOptionsFor(materialId) : [];
  });

  public draftFormType = signal<ClauseFormType>('GatherMaterial');
  public draftType = computed<DecreeClauseAction['type']>(() => {
    const formType = this.draftFormType();
    return formType === 'GatherFromNode' ? 'GatherMaterial' : formType;
  });
  public isGatherByMaterial = computed(
    () => this.draftFormType() === 'GatherMaterial',
  );
  public draftMaterialId = signal<MaterialId | undefined>(undefined);
  public draftNodeName = signal<string | undefined>(undefined);
  public draftRewardKey = signal<string | undefined>(undefined);
  public draftTargetQuantity = signal<number>(DEFAULT_DECREE_GATHER_QUANTITY);
  public draftRiskTolerance = signal<DecreeRiskLevel>('Medium');
  // Undefined = "any town"
  public draftTownName = signal<string | undefined>(undefined);

  public townOptions = computed(() =>
    sortBy(getEntriesByType<TownContent>('town'), (town) => town.name),
  );

  // Scoped to the currently-selected node - a FarmNode reward only ever
  // makes sense in the context of the node it's farmed from.
  public rewardOptions = computed<FarmNodeRewardOption[]>(() => {
    const nodeName = this.draftNodeName();
    return nodeName ? sortBy(farmNodeRewardOptions(nodeName), 'name') : [];
  });

  // Keyed by a stable string rather than the reward object, so it can drive ng-select's bindValue.
  public selectedRewardOption = computed(() =>
    this.rewardOptions().find((option) => option.key === this.draftRewardKey()),
  );

  public editingClauseId = signal<DecreeClauseId | undefined>(undefined);
  public isEditing = computed(() => !!this.editingClauseId());

  public draftAction = computed<DecreeClauseAction | undefined>(() => {
    switch (this.draftType()) {
      case 'GatherMaterial': {
        const materialId = this.draftMaterialId();
        const nodeName = this.draftNodeName();
        return materialId && nodeName
          ? {
              type: 'GatherMaterial',
              materialId,
              nodeName,
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
      case 'DefendTowns':
        return {
          type: 'DefendTowns',
          riskTolerance: this.draftRiskTolerance(),
          townName: this.draftTownName(),
        };
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
    if (!this.isEditing() && this.isClauseCapReached()) return false;
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

  public toggleWaitForFullEnergyBeforeCombat(): void {
    decreeSetWaitForFullEnergyBeforeCombat(
      !this.waitForFullEnergyBeforeCombat(),
    );
  }

  // ng-select's (change) emits the full item, not the bindValue-mapped field, so this pulls it out manually.
  public setDraftRiskTolerance(option: RiskToleranceOption): void {
    this.draftRiskTolerance.set(option.value);
  }

  public setDraftType(option: { value: ClauseFormType }): void {
    this.draftFormType.set(option.value);
    this.draftNodeName.set(undefined);
    this.draftMaterialId.set(undefined);
    this.draftRewardKey.set(undefined);
  }

  public setDraftMaterialId(option: MaterialOption | null): void {
    this.draftMaterialId.set(option ? option.id : undefined);
    if (!this.isGatherByMaterial()) return;

    const nodeOptions = this.gatherNodeOptions();
    this.draftNodeName.set(
      nodeOptions.length === 1 ? nodeOptions[0].nodeName : undefined,
    );
  }

  // Keeps the material - it was picked first and scopes these nodes.
  public setDraftGatherNodeName(option: { nodeName: string } | null): void {
    this.draftNodeName.set(option ? option.nodeName : undefined);
  }

  public setDraftNodeName(option: { nodeName: string } | null): void {
    this.draftNodeName.set(option ? option.nodeName : undefined);
    this.draftRewardKey.set(undefined);
    this.draftMaterialId.set(undefined);
  }

  public setDraftReward(option: FarmNodeRewardOption | null): void {
    this.draftRewardKey.set(option ? option.key : undefined);
  }

  public setDraftTownName(option: TownContent | null): void {
    this.draftTownName.set(option ? option.name : undefined);
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

  public onClauseLeave(event: AnimationCallbackEvent): void {
    this.anim
      .fadeOut(event.target)
      .then(() => event.animationComplete())
      .catch(() => event.animationComplete());
  }

  public startEditClause(clause: DecreeClause): void {
    if (clause.type === 'GatherMaterial') {
      this.editingClauseId.set(clause.id);
      this.draftFormType.set('GatherFromNode');
      this.draftNodeName.set(clause.nodeName);
      this.draftMaterialId.set(clause.materialId);
      this.draftTargetQuantity.set(clause.targetQuantity);
      return;
    }

    if (clause.type === 'FarmNode') {
      this.editingClauseId.set(clause.id);
      this.draftFormType.set('FarmNode');
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
      this.draftFormType.set(clause.type);
      this.draftRiskTolerance.set(clause.riskTolerance);
      return;
    }

    if (clause.type === 'DefendTowns') {
      this.editingClauseId.set(clause.id);
      this.draftFormType.set('DefendTowns');
      this.draftRiskTolerance.set(clause.riskTolerance);
      this.draftTownName.set(clause.townName);
    }
  }

  public cancelEditClause(): void {
    this.editingClauseId.set(undefined);
    this.draftMaterialId.set(undefined);
    this.draftNodeName.set(undefined);
    this.draftRewardKey.set(undefined);
    this.draftTargetQuantity.set(DEFAULT_DECREE_GATHER_QUANTITY);
    this.draftRiskTolerance.set('Medium');
    this.draftTownName.set(undefined);
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
      this.draftTargetQuantity.set(DEFAULT_DECREE_GATHER_QUANTITY);
    }
  }
}
